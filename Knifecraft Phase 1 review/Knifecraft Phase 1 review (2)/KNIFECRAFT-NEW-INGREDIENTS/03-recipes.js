/* KNIFECRAFT — the ten new RECIPES, in `CONFIG.recipes.RECIPES` shape.

   ⚠ LEVEL NUMBERING. `nextRecipe()` is `recipeIndex + 1` mod RECIPES.length, so level N = recipe N by ARRAY
   ORDER. These ten were inserted inside their ingredient groups (not appended), so every recipe after the
   first insertion point shifts index. Regenerate any level/milestone table from the array, never from the
   older 71-row documentation. Total after integration: 81.

   Every stage uses existing technique ids and existing stage fields. No new mechanic, no new plating style. */

const RECIPE_ADDITIONS = [
      { id:'ginger-slice-5', name:'Ginger', technique:'Slice',
        stages:[ { ing:'ginger', objective:'Slice \u00d75', axis:'v', count:5, freeAngle:true, plate:'shingle' } ] },
      { id:'ginger-chop', name:'Ginger', technique:'Chop',
        stages:[ { ing:'ginger', objective:'Chop 3\u00d73', axis:'h', counts:{h:3,v:3},
                   freeAngle:true, perpSnap:true, plate:'mound' } ] },
      { id:'chilli-slice-6', name:'Green Chilli', technique:'Slice',
        stages:[ { ing:'chilli', objective:'Slice \u00d76', axis:'v', count:6, freeAngle:true, plate:'shingle' } ] },
      { id:'chilli-chop-5', name:'Green Chilli', technique:'Chop',
        stages:[ { ing:'chilli', objective:'Chop \u00d75', axis:'v', count:5,
                   freeAngle:true, plate:'mound' } ] },
      { id:'lime-slice-6', name:'Lime', technique:'Slice',
        stages:[ { ing:'lime', objective:'Slice \u00d76', axis:'v', count:6,
                   freeAngle:true, plate:'shingle' } ] },
      { id:'lime-halve', name:'Lime', technique:'Halve',
        stages:[ { ing:'lime', objective:'Halve', axis:'v', count:2, freeAngle:true, plate:'fan' } ] },
      { id:'cilantro-chop', name:'Cilantro', technique:'Chop',
        stages:[ { ing:'cilantro', objective:'Chop 3\u00d73', axis:'h', counts:{h:3,v:3},
                   freeAngle:true, perpSnap:true, plate:'mound' } ] },
      { id:'cilantro-chiffonade', name:'Cilantro', technique:'Chiffonade',
        stages:[ { ing:'cilantro', objective:'Chiffonade \u00d78', axis:'v', count:8,
                   freeAngle:true, parallelSnap:true, minGap:12,
                   tol:{ evennessTol:1.9, consistencyCvTol:1.5, EVENNESS_WEIGHT:1, CONSISTENCY_WEIGHT:2 },
                   plate:'nest' } ] },
      { id:'springonion-slice-8', name:'Spring Onion', technique:'Slice',
        stages:[ { ing:'springonion', objective:'Slice \u00d78', axis:'v', count:8,
                   freeAngle:true, plate:'shingle' } ] },
      { id:'springonion-chop', name:'Spring Onion', technique:'Chop',
        stages:[ { ing:'springonion', objective:'Chop \u00d76', axis:'v', count:6,
                   freeAngle:true, plate:'mound' } ] },
];
