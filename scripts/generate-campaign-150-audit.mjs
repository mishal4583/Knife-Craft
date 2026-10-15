import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const docs = new URL('../docs/campaign-redesign-150/', import.meta.url);
const audit = JSON.parse(readFileSync(new URL('docs/campaign-redesign-150/audit-old-campaign.json', root), 'utf8'));
const selectionSource = readFileSync(new URL('src/game/levels/campaignSelection.ts', root), 'utf8');
const selectionBody = selectionSource.match(/CAMPAIGN_150_SOURCE_LEVEL_NUMBERS[^=]*= \[([\s\S]*?)\];/)?.[1];
if (!selectionBody) throw new Error('Could not read source level selection');
const sourceNumbers = [...selectionBody.replace(/^\s*\/\/.*$/gm, '').matchAll(/\d+/g)].map((m) => Number(m[0]));
if (sourceNumbers.length !== 150 || new Set(sourceNumbers).size !== 150) throw new Error(`Expected exactly 150 unique retained levels; got ${sourceNumbers.length}/${new Set(sourceNumbers).size}`);
const oldByNumber = new Map(audit.levels.map((level) => [level.oldLevel, level]));
const recipeById = new Map(audit.levels.flatMap((level) => level.recipes.map((recipe) => [recipe.id, structuredClone(recipe)])));
const ingredients = new Map(audit.levels.flatMap((level) => level.ingredientsWithNames.map((item) => [item.id, item])));
ingredients.set('butter', { id: 'butter', name: 'Butter', category: 'Dairy' });

const tutorial = {
  id: 'camp-level2-basics-tutorial', name: 'Basic Knife Skills Practice', cuisineId: null, authenticity: 'B',
  components: [
    ['tomato', 'dice', 'diced'], ['cucumber', 'slice', 'sliced'], ['carrot', 'julienne', 'julienned'],
    ['garlic', 'peel', 'peeled'], ['garlic', 'smash', 'smashed'],
  ].map(([ingredientId, technique, resultingState]) => ({ ingredientId, technique, resultingState, destinationIds: ['plate'] })),
  destinations: ['Practice Plate'], batchable: false,
};
recipeById.set(tutorial.id, tutorial);
const butterRecipe = recipeById.get('camp-herb-butter-vegetable-plate');
if (!butterRecipe) throw new Error('Butter coverage recipe is missing');
butterRecipe.name = 'Herb Butter Vegetable Plate';
butterRecipe.components.push({ ingredientId: 'butter', technique: 'slice', resultingState: 'sliced', destinationIds: ['plate'] });
const lemonRecipe = recipeById.get('camp-zucchini-fennel-julienne');
if (lemonRecipe) lemonRecipe.name = 'Zucchini & Fennel with Lemon';

const chapterMapBody = selectionSource.match(/CAMPAIGN_150_CHAPTER_BY_SOURCE_CHAPTER[^=]*= \{([\s\S]*?)\};/)?.[1] ?? '';
const sourceChapterToNew = new Map([...chapterMapBody.matchAll(/(\d+)\s*:\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]));
const selected = sourceNumbers.map((oldLevel, index) => {
  const source = oldByNumber.get(oldLevel);
  if (!source) throw new Error(`Missing source level ${oldLevel}`);
  let recipeIds = [...source.recipeIds];
  if (oldLevel === 2) recipeIds = [tutorial.id];
  if (oldLevel === 12) recipeIds = ['camp-tomato-basil-toast'];
  if (oldLevel === 24) recipeIds = ['camp-caprese-plate', 'camp-beetroot-plate', 'camp-eggplant-antipasto'];
  const recipes = recipeIds.map((id) => recipeById.get(id)).filter(Boolean);
  const chapter = index < 4 ? 1 : index < 20 ? 2 : sourceChapterToNew.get(source.chapter);
  if (!chapter) throw new Error(`No chapter mapping for old Level ${oldLevel}`);
  const components = recipes.flatMap((recipe) => recipe.components);
  const item = {
    newLevel: index + 1, oldLevel, id: `level-${index + 1}`, chapter,
    title: oldLevel === 2 ? 'Basic Kitchen Learning' : source.title,
    type: source.type,
    recipeIds,
    recipeNames: recipes.map((recipe) => recipe.name),
    ingredients: [...new Set(components.map((component) => component.ingredientId))],
    techniques: [...new Set(components.map((component) => component.technique))],
    componentCount: components.length,
    requiredOrders: source.requiredOrders ?? 1,
    batchGroup: source.batchGroup,
    reward: source.reward,
    purpose: oldLevel === 2
      ? 'Practice tomato dice, cucumber slice, carrot julienne, and garlic peel/smash without spending stock or money.'
      : oldLevel === 8
        ? 'Peel the potato, then halve it evenly for the pan.'
        : oldLevel === 12
          ? 'A fixed tomato-basil toast recipe teaches the next Italian dish without random recipe swaps.'
          : source.description,
    sourceMilestone: source.milestone,
    unlockReward: source.unlockReward,
  };
  return item;
});
const recipeIds = new Set(selected.flatMap((level) => level.recipeIds));
const covered = new Map();
const techniqueFirstUse = new Map();
for (const level of selected) for (const id of level.recipeIds) {
  const recipe = recipeById.get(id);
  for (const component of recipe?.components ?? []) {
    if (!covered.has(component.ingredientId)) covered.set(component.ingredientId, { level: level.newLevel, recipeId: id, name: recipe.name, technique: component.technique });
    if (!techniqueFirstUse.has(component.technique)) techniqueFirstUse.set(component.technique, level.newLevel);
  }
}
const allIngredientIds = [...ingredients.keys()];
const missingIngredients = allIngredientIds.filter((id) => !covered.has(id));
if (allIngredientIds.length !== 57 || missingIngredients.length) throw new Error(`Ingredient coverage failed: ${allIngredientIds.length} total; missing ${missingIngredients.join(', ')}`);
const readNumericMap = (name) => {
  const body = selectionSource.match(new RegExp(`${name}[^=]*= \\{([\\s\\S]*?)\\};`))?.[1];
  if (!body) throw new Error(`Could not read ${name}`);
  return Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*(\d+)/g)].map((match) => [match[1], Number(match[2])]));
};
const ingredientFirstUse = readNumericMap('CAMPAIGN_150_INGREDIENT_FIRST_USE_LEVEL');
const techniqueFirstUseMap = readNumericMap('CAMPAIGN_150_TECHNIQUE_FIRST_USE_LEVEL');
for (const [id, use] of covered) if (ingredientFirstUse[id] !== use.level) throw new Error(`Ingredient unlock map mismatch for ${id}: ${ingredientFirstUse[id]} vs ${use.level}`);
for (const [id, level] of techniqueFirstUse) if (techniqueFirstUseMap[id] !== level) throw new Error(`Technique unlock map mismatch for ${id}: ${techniqueFirstUseMap[id]} vs ${level}`);

const roleByFruit = {
  strawberry: 'Fresh-fruit component; the later steak-and-fruit service pairs it with a savory main.',
  apple: 'Crisp apple in a French celery-apple remoulade side.',
  orange: 'Citrus wedge served with beetroot in the antipasto recipe pool.',
  lemon: 'Citrus finish on the zucchini-and-fennel plate.',
  avocado: 'Savory avocado toast/plate accompaniment.',
  pear: 'Fresh julienned fruit in a Korean pear-and-radish side.',
  peach: 'Fresh peach accompaniment in the French service menu.',
  pineapple: 'Pineapple salsa and a fresh fruit cup; salsa accompanies savory Latin dishes.',
  watermelon: 'Fresh fruit cup paired with savory seafood in a multi-order service.',
  mango: 'Mango chutney/relish as a savory condiment.',
  kiwi: 'Fresh fruit cup paired with savory seafood in a multi-order service.',
  pomegranate: 'Fresh fruit side with apple and beetroot.',
  grapes: 'Fresh fruit cup paired with a savory steak service.',
  coconut: 'Savory coconut component in Thai salmon and curry recipes.',
  lime: 'Citrus finish in avocado and fresh-fruit recipes.',
};
const fruits = ['strawberry','apple','orange','lemon','avocado','pear','peach','pineapple','watermelon','mango','kiwi','pomegranate','grapes','coconut','lime'];
const fruitRows = fruits.map((fruit) => {
  const use = covered.get(fruit);
  if (!use) throw new Error(`Fruit coverage failed: ${fruit}`);
  return { fruit, retainedRecipeId: use.recipeId, recipe: use.name, newLevel: use.level, preparation: use.technique, role: roleByFruit[fruit], verified: true };
});

const exactKey = (level) => JSON.stringify({ recipes: [...level.recipeIds].sort(), orders: level.requiredOrders ?? 1, batch: level.batchGroup });
const selectedByKey = new Map();
for (const level of selected) {
  const key = exactKey(level);
  const group = selectedByKey.get(key) ?? [];
  group.push(level);
  selectedByKey.set(key, group);
}
const oldToNew = [['old_level','old_id','new_level','new_id','status','reason']];
for (const oldLevel of audit.levels) {
  const direct = selected.find((level) => level.oldLevel === oldLevel.oldLevel);
  const exact = selectedByKey.get(exactKey(oldLevel))?.sort((a,b) => Math.abs(a.oldLevel-oldLevel.oldLevel)-Math.abs(b.oldLevel-oldLevel.oldLevel))[0];
  const target = direct ?? exact;
  const status = direct ? (oldLevel.oldLevel === 2 ? 'REWORKED_AS_TUTORIAL' : 'RETAINED') : exact ? 'MERGED_EXACT_SERVICE' : 'REMOVED_FROM_CAMPAIGN';
  const reason = oldLevel.oldLevel === 2
    ? 'Replaced by the required no-cost five-step tutorial.'
    : direct ? 'Curated recipe/service retained and renumbered.'
      : exact ? `Exact recipe pool and service shape retained at new Level ${exact.newLevel}; completion may migrate only on this exact match.`
        : /garnish|again|reinforced|full pool|one more night|revisited|last rehearsal/i.test(oldLevel.title)
          ? 'Removed as an isolated garnish or repeated service that adds no new preparation decision.'
          : oldLevel.componentCount <= 1
            ? 'Removed as a single-cut drill after the technique has already been introduced.'
            : 'Removed from the curated campaign because stronger dishes or service challenges take this slot.';
  oldToNew.push([oldLevel.oldLevel, oldLevel.id, target?.newLevel ?? '', target?.id ?? '', status, reason]);
}
const csv = (rows) => rows.map((row) => row.map((value) => {
  const text = Array.isArray(value) ? value.join('; ') : (value == null ? '' : String(value));
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
}).join(',')).join('\n') + '\n';
mkdirSync(docs, { recursive: true });
writeFileSync(new URL('proposed-campaign-150.json', docs), JSON.stringify({ sourceLevelCount: audit.campaignLevelCount, requiredLevelCount: 150, levels: selected }, null, 2));
writeFileSync(new URL('old-to-new-level-map.csv', docs), csv(oldToNew));
writeFileSync(new URL('ingredient-coverage-plan.csv', docs), csv([
  ['ingredient_id','ingredient','category','retained_recipe_id','new_level','culinary_role','verified'],
  ...allIngredientIds.map((id) => {
    const item = ingredients.get(id); const use = covered.get(id);
    const role = id === 'butter' ? 'Sliced into finishing pats for the herb-butter vegetable plate.' : `${use.name}; prepared with ${use.technique}.`;
    return [id,item.name,item.category,use.recipeId,use.level,role,'YES'];
  }),
]));
writeFileSync(new URL('fruit-coverage-plan.csv', docs), csv([
  ['fruit','retained_recipe_id','recipe_or_side','new_level','supported_preparation','culinary_role','verified'],
  ...fruitRows.map((row) => [row.fruit,row.retainedRecipeId,row.recipe,row.newLevel,row.preparation,row.role,'YES']),
]));
writeFileSync(new URL('technique-coverage-plan.csv', docs), csv([
  ['technique','first_campaign_level','verified'],
  ...[...techniqueFirstUse].sort((a,b) => a[1]-b[1]).map(([technique,level]) => [technique,level,'YES']),
]));
const qualityRows = [['recipe_id','recipe_name','ingredients','preparation_steps','retained_levels','registry_action','notes']];
for (const [id, recipe] of recipeById) {
  const levels = selected.filter((level) => level.recipeIds.includes(id)).map((level) => level.newLevel);
  const action = id === 'camp-level2-basics-tutorial' ? 'NEW_GUIDED_TUTORIAL' : id === 'camp-herb-butter-vegetable-plate' || id === 'camp-zucchini-fennel-julienne' ? 'REWORKED_AND_KEPT' : levels.length ? 'KEPT_IN_CAMPAIGN' : 'OUT_OF_CAMPAIGN; REGISTRY_RETAINED_PENDING_RUNTIME_REFERENCE_AUDIT';
  const notes = id === 'camp-herb-butter-vegetable-plate' ? 'Added supported butter slice as a finishing pat.' : id === 'camp-zucchini-fennel-julienne' ? 'Clarified lemon wedge as the citrus finish.' : '';
  qualityRows.push([id,recipe.name,recipe.components.map((c) => c.ingredientId).join('; '),recipe.components.map((c) => `${c.ingredientId}:${c.technique}`).join('; '),levels.join('; '),action,notes]);
}
writeFileSync(new URL('recipe-quality-ledger.csv', docs), csv(qualityRows));
const duplicateGroups = audit.recipeDuplicateGroups.map((group) => ({ recipes: group, retained: group.filter((id) => recipeIds.has(id)), action: group.filter((id) => recipeIds.has(id)).length > 1 ? 'REVIEW_RETAINED_DUPLICATE_OR_BATCH_DISTINCTION' : 'ONLY_ONE_RETAINED' }));
writeFileSync(new URL('duplicate-report.md', docs), `# Duplicate and near-duplicate review\n\nCompared recipe component identities from the source audit, including ingredient, technique, resulting state and destination. The source had ${audit.recipeDuplicateGroups.length} exact-shape groups.\n\n${duplicateGroups.map((group, index) => `${index+1}. **${group.action}** — ${group.recipes.join(', ')}. Retained: ${group.retained.join(', ') || 'none'}.`).join('\n')}\n\nThe Caprese plate and two skewers-only exercise levels were removed from the opening service sequence. The retained Caprese recipe is Level 9; batch challenges are retained only where the source defines simultaneous shared preparation.\n`);
const chapterRows = new Map();
for (const level of selected) { const row = chapterRows.get(level.chapter) ?? { first: level.newLevel, title: '' }; row.first = Math.min(row.first, level.newLevel); chapterRows.set(level.chapter, row); }
const chapterNames = ['Opening the Restaurant','Italian Kitchen & Service','French Bistro & Precision','Indian Kitchen & Service','Mediterranean & Levant','Mexican & Latin','Japanese Kitchen','Chinese Wok','Thai & Southeast Asian','Korean Kitchen','East Asian Fusion','The Grand Finale'];
for (const [chapter,row] of chapterRows) row.title = chapterNames[chapter-1];
const catalogMd = ['# Curated campaign catalog — 150 levels','', '| New | Old | Chapter | Level title | Recipe(s) | Ingredients | Gameplay purpose |','|---:|---:|---|---|---|---|---|', ...selected.map((level) => `| ${level.newLevel} | ${level.oldLevel} | ${level.chapter}. ${chapterRows.get(level.chapter).title} | ${level.title} | ${level.recipeNames.join('<br>')} | ${level.ingredients.join(', ')} | ${level.purpose.replaceAll('|','/')} |`), ''].join('\n');
writeFileSync(new URL('proposed-campaign-150.md', docs), catalogMd);
const remapThreshold = (oldLevel) => {
  const exact = sourceNumbers.indexOf(oldLevel);
  if (exact >= 0) return exact + 1;
  const retained = sourceNumbers.filter((level) => level >= oldLevel).sort((a,b) => a-b)[0];
  return retained === undefined ? 150 : sourceNumbers.indexOf(retained) + 1;
};
const progressionRows = [
  ['Ingredient stock / Market purchases', 3, 3, 'The Market asks players to buy only what the order needs.'],
  ['First knife, board and culinary-tools shopping', 10, 10, 'A Level 10 shopping list previews tools needed in upcoming services.'],
  ['Business screen and customer menu', null, 11, 'The menu and its dashboard open after the ten-level introduction.'],
  ['Fridge freshness and day ceremony', 21, null, 'Mapped from the legacy freshness threshold.'],
  ['Dine-in tableware and cutlery', 31, null, 'Mapped to the first retained service at or after the legacy threshold.'],
  ['Prep cook requirement begins', 41, null, 'Mapped to the first retained service at or after the legacy threshold.'],
  ['Specialist cuisines begin', 51, null, 'Indian cuisine and its specialist chef open at this threshold.'],
  ['Takeaway supplies begin', 71, null, 'Mapped to the first retained service at or after the legacy threshold.'],
  ['Full-operation management', 91, null, 'Mapped to the first retained service at or after the legacy threshold.'],
  ['Restaurant expansion', 121, null, 'Mapped to the first retained service at or after the legacy threshold.'],
  ['Established restaurant', 161, null, 'Mapped to the first retained service at or after the legacy threshold.'],
  ['Master restaurant', 201, null, 'Mapped to the first retained service at or after the legacy threshold.'],
  ['Grand Service', 241, null, 'The Last Page and Family Legacy remain at new Level 150.'],
  ['Campaign finale and Family Legacy', 250, 150, 'The final retained source level is old Level 250.'],
].map(([feature, oldThreshold, manualNewLevel, note]) => [feature, oldThreshold ?? '—', manualNewLevel ?? remapThreshold(oldThreshold), note]);
writeFileSync(new URL('campaign-progression-map.md', docs), `# Campaign progression and migration map\n\nLegacy thresholds use the exact retained level when present; otherwise they move to the retained source level with the nearest higher legacy number. The Business/menu introduction is intentionally held until campaign Level 11 to match the ten-level opening. Ingredient and technique availability follows first campaign use; these maps are checked against the retained catalog by this generator.\n\n| Feature | Legacy threshold | New level | Mapping note |\n|---|---:|---:|---|\n${progressionRows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} |`).join('\n')}\n\n## Narrative and completion rewards\n\n- The original Level 100 story finale moves to the campaign midpoint, Level 75.\n- The Last Page and Family Legacy remain one-time completion rewards at Level 150. The legacy milestone ID stays campaign-complete, so existing claim and ledger history still prevents a second payment.\n- Original 150-level and 200-level milestones move to new Levels 125 and 140. Knife, board, kitchen-upgrade, café and restaurant thresholds are remapped through the same retained-source threshold function.\n- Old Level 250 completion marks every new level complete, retaining Endless access. Partial saves transfer completion only for retained levels or exact recipe-pool/order/batch matches. Wallet, ledger, inventory, equipment ownership, story mask and milestone claim history remain untouched by the campaign-progress migration.\n\n## First-use availability\n\nSee ingredient-coverage-plan.csv and technique-coverage-plan.csv for every ingredient and cutting technique's first campaign use and its unlock level. The generator fails if either mapping diverges from retained recipe content.\n`);
const summary = {
  sourceLevelCount: audit.campaignLevelCount,
  levels: selected.length,
  sequentialNewLevelIds: selected.every((level,index) => level.id === `level-${index+1}`),
  retainedOldLevels: sourceNumbers,
  uniqueRecipes: recipeIds.size,
  ingredientCount: allIngredientIds.length,
  missingIngredients,
  fruitCount: fruitRows.length,
  missingFruits: [],
  techniqueCount: techniqueFirstUse.size,
  techniqueUnlocksMatchFirstUse: [...techniqueFirstUse].every(([id, level]) => techniqueFirstUseMap[id] === level),
  migration: 'Version 2 nested in levelProgress; retained IDs map directly, removed IDs migrate only on exact recipe-pool/order/batch match; old Level 250 completion marks all 150 complete.',
  economySimulation: 'NOT RUN: repository AGENTS.md prohibits tests/builds/server; no payout retuning was made.',
};
writeFileSync(new URL('audit-summary.json', docs), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ levels: selected.length, uniqueSourceLevels: new Set(sourceNumbers).size, recipes: recipeIds.size, ingredients: allIngredientIds.length, missingIngredients, fruits: fruitRows.length }, null, 2));
