/**
 * STORY_ART — the 7 inline SVG assets THE LAST WISH uses, ported
 * verbatim (same viewBox, same paths, same colors, same gradient ids)
 * from knifecraft.html's actual `const ART` object
 * (`knifecraft.html:10778`). Zero bitmaps, zero external files, exactly
 * matching the source's own "zero image assets" constraint — these are
 * the same path strings the source concatenates into `innerHTML`, just
 * joined into single template literals instead of `+`-chained pieces.
 *
 * Rendered via `dangerouslySetInnerHTML` in StoryOverlay.tsx/DialogueBubble.tsx —
 * safe here because every string is a build-time-authored literal below,
 * never user input, exactly mirroring the source's own
 * `el('storyStage').innerHTML = ART[b.art]` approach without importing a
 * non-React DOM architecture to do it.
 */

/** The grandparent resting in bed, the restaurant key in their hand. Source `:10779`. The arm is ONE pose authored in its own local frame (`translate(242,155) rotate(16)`) so sleeve/cuff/forearm/palm/fingers share one centreline; the key is drawn BEFORE the hand so its shank passes under the fingers — this render order is load-bearing, do not reorder. */
export const STORY_ART_BEDSIDE = `<svg viewBox="0 0 360 232" role="img" aria-label="The grandparent resting in bed, the restaurant key in their hand">
<defs>
<linearGradient id="sgWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7EAD4"/><stop offset="1" stop-color="#E7D3B6"/></linearGradient>
<linearGradient id="sgWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF8E2"/><stop offset="1" stop-color="#F2E1B9"/></linearGradient>
<radialGradient id="sgLamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE4A8" stop-opacity=".85"/><stop offset="1" stop-color="#FFE4A8" stop-opacity="0"/></radialGradient>
</defs>
<rect width="360" height="232" rx="22" fill="url(#sgWall)"/>
<path d="M104,30 L214,120 L214,206 L104,206 Z" fill="#FFF3D2" opacity=".34"/>
<rect x="24" y="26" width="78" height="84" rx="8" fill="url(#sgWin)"/>
<path d="M63,26 L63,110 M24,68 L102,68" stroke="#DFC9A2" stroke-width="3"/>
<rect x="18" y="110" width="90" height="7" rx="3.5" fill="#D6BE99"/>
<ellipse cx="266" cy="214" rx="98" ry="9" fill="#5E401F" opacity=".13"/>
<rect x="178" y="50" width="164" height="74" rx="15" fill="#8A5A3C"/>
<rect x="190" y="61" width="140" height="52" rx="10" fill="#9B6A48"/>
<rect x="112" y="122" width="52" height="86" rx="6" fill="#96693F"/>
<rect x="118" y="140" width="40" height="4" rx="2" fill="#7E5433"/>
<circle cx="134" cy="96" r="42" fill="url(#sgLamp)"/>
<rect x="130" y="98" width="8" height="24" fill="#7E5433"/>
<path d="M120,78 L148,78 L154,100 L114,100 Z" fill="#D8A03D"/>
<rect x="168" y="118" width="180" height="92" rx="16" fill="#F3E8D6"/>
<ellipse cx="214" cy="130" rx="36" ry="19" fill="#FCF6EA"/>
<path d="M198,158 C198,133 209,124 224,124 C239,124 250,133 250,158 Z" fill="#EADDC6"/>
<ellipse cx="224" cy="103" rx="21" ry="22.5" fill="#E9C6A2"/>
<ellipse cx="246" cy="105" rx="4.5" ry="6.5" fill="#E0B892"/>
<path d="M200,100 q-1,-28 24,-28 q25,0 24,28 q-4,-14 -10,-16 q-14,4 -28,0 q-7,3 -10,16z" fill="#DFDAD2"/>
<path d="M200,96 q-6,4 -5,13 q4,-4 5,-13z M248,96 q6,4 5,13 q-4,-4 -5,-13z" fill="#DFDAD2"/>
<ellipse cx="209" cy="112" rx="4.6" ry="3" fill="#D99C74" opacity=".32"/>
<ellipse cx="239" cy="112" rx="4.6" ry="3" fill="#D99C74" opacity=".32"/>
<path d="M218,118 q6,4 12,-0.5" stroke="#B07C5E" stroke-width="2" fill="none" stroke-linecap="round"/>
<g stroke="#7E6A54" stroke-width="1.6" fill="none"><circle cx="215" cy="105" r="6.6"/><circle cx="233" cy="105" r="6.6"/><path d="M221.6,105 h4.8"/><path d="M208.4,104 l-5,-2"/></g>
<path d="M212,106 q3,2.6 6,0 M230,106 q3,2.6 6,0" stroke="#5C4A38" stroke-width="1.5" fill="none" stroke-linecap="round"/>
<rect x="168" y="152" width="180" height="58" rx="15" fill="#A8B98C"/>
<rect x="168" y="150" width="180" height="14" rx="7" fill="#BECAA6"/>
<rect x="168" y="176" width="180" height="5" fill="#94A879"/>
<rect x="168" y="194" width="180" height="5" fill="#94A879"/>
<g transform="translate(242,155) rotate(16)">
<ellipse cx="58" cy="12" rx="40" ry="9.5" fill="#6E7A4E" opacity=".15"/>
<path d="M-8,-11 C4,-13 14,-11 23,-8 L23,9 C13,11 3,11 -8,9 Z" fill="#EADDC6"/>
<path d="M-6,-6 C2,-7 10,-6 18,-4" stroke="#DCCDB2" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<rect x="20" y="-9.5" width="7.5" height="19" rx="3.2" fill="#DCCDB2"/>
<path d="M26,-8.6 C35,-9.6 44,-8 50,-6 C53.5,-4.8 53.5,4.4 50,5.6 C43,7.6 34,7.8 26,7.2 Z" fill="#E9C6A2"/>
<path d="M28,-7 C37,-8 45,-6.4 50,-4.6" stroke="#F2D3AF" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".7"/>
<path d="M50,-5.4 C52,-2 52,2.4 50,5.2" stroke="#D8AF89" stroke-width="1.2" fill="none" opacity=".8"/>
<circle cx="86" cy="7" r="6" fill="none" stroke="#C9973F" stroke-width="2.6"/>
<rect x="64" y="5.2" width="18" height="3.6" rx="1.4" fill="#D8A03D"/>
<rect x="66" y="8.8" width="3" height="5" rx="1" fill="#D8A03D"/>
<rect x="72" y="8.8" width="3" height="4" rx="1" fill="#D8A03D"/>
<g transform="translate(50,0)">
<path d="M3,-5 C3.4,-10.6 8.4,-12.6 11.8,-10.4 C14.4,-8.6 12.6,-5.2 8.6,-4.2 Z" fill="#E9C6A2"/>
<path d="M0,-5.6 C7,-7.6 15,-7.4 19,-4.4 C23,-1.4 22.6,4.6 17.6,6.6 C11.6,8.6 4,7.6 0,5.6 Z" fill="#E9C6A2"/>
<path d="M18,-4.6 C24,-6.2 29,-4.6 29,-2.2 C29,0 24,1 18,-0.2 Z" fill="#E9C6A2"/>
<path d="M18,-0.2 C25,-1.2 30,0.8 29.8,3.2 C29.6,5.2 24.6,5.8 18,4.4 Z" fill="#E9C6A2"/>
<path d="M18,4.4 C24,3.6 28,5.4 27.4,7.4 C26.8,9.2 22.6,9.4 17.6,7.6 Z" fill="#E9C6A2"/>
<g stroke="#D8AF89" stroke-width="1.1" fill="none" opacity=".85">
<path d="M4,-5.6 C6,-8 9.6,-8.8 11.6,-7.6"/>
<path d="M17.2,-5 C19,-1 19,3 17,7.4"/>
<path d="M19,-0.2 C23,-0.9 26.6,-0.4 28.6,0.6"/>
<path d="M18.6,4.3 C22.6,3.7 26,4.4 28.2,5.6"/></g>
</g></g>
</svg>`;

/** The restaurant keys, as a small held prop. Source `:10843`. */
export const STORY_ART_KEYS = `<svg viewBox="0 0 200 110" role="img" aria-label="The restaurant keys">
<defs><radialGradient id="sgKeyGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE4A8" stop-opacity=".55"/><stop offset="1" stop-color="#FFE4A8" stop-opacity="0"/></radialGradient></defs>
<circle cx="100" cy="55" r="54" fill="url(#sgKeyGlow)"/>
<circle cx="86" cy="34" r="15" fill="none" stroke="#C9973F" stroke-width="5"/>
<g transform="rotate(16 86 34)"><rect x="82" y="46" width="8" height="52" rx="3" fill="#D8A03D"/>
<rect x="90" y="76" width="12" height="7" rx="2" fill="#D8A03D"/><rect x="90" y="88" width="9" height="6" rx="2" fill="#D8A03D"/></g>
<g transform="rotate(-22 108 40)"><rect x="104" y="46" width="7" height="44" rx="3" fill="#9AA0A6"/>
<circle cx="107.5" cy="40" r="11" fill="none" stroke="#9AA0A6" stroke-width="4.5"/>
<rect x="111" y="72" width="10" height="6" rx="2" fill="#9AA0A6"/></g>
<g transform="rotate(-8 84 22)"><rect x="56" y="6" width="30" height="20" rx="5" fill="#8A5A3C"/>
<circle cx="79" cy="16" r="2.6" fill="#6E4529"/></g>
</svg>`;

/** The chef, a bust (toque/head/neck/squared shoulders/double-breasted jacket) — not a floating head — composed so the circular portrait frame crops the sleeves, not the shoulders. Expression: asymmetric brows/eyes, a -3deg head tilt, reading surprise + disbelief + a little amusement for "You really spent your savings on this place?" — never anger. Source `:10858`. */
export const STORY_ART_CHEF = `<svg viewBox="0 0 120 120" role="img" aria-label="The chef, caught between surprise and amusement">
<defs><linearGradient id="sgChefBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E6CF"/><stop offset="1" stop-color="#E6D5B7"/></linearGradient></defs>
<circle cx="60" cy="60" r="60" fill="url(#sgChefBg)"/>
<path d="M50,72 h20 v14 q-10,7 -20,0 Z" fill="#C98F60"/>
<path d="M2,120 C6,99 21,88 39,85 L81,85 C99,88 114,100 118,120 Z" fill="#FAF6EE"/>
<path d="M2,120 C5,103 12,94 24,89 C20,98 18,109 18,120 Z" fill="#EFE6D4"/>
<path d="M118,120 C115,103 108,94 96,89 C100,98 102,109 102,120 Z" fill="#EFE6D4"/>
<path d="M60,87 L73,96 L60,110 L47,96 Z" fill="#D94B45"/>
<path d="M43,84 L60,90 L51,106 L36,95 Z" fill="#FFFDF7"/>
<path d="M77,84 L60,90 L69,106 L84,95 Z" fill="#FFFDF7"/>
<g stroke="#E2D6C0" stroke-width="1.5" fill="none"><path d="M43,84 L60,90 L51,106"/><path d="M77,84 L60,90 L69,106"/></g>
<circle cx="48" cy="110" r="1.8" fill="#E2D6C0"/><circle cx="72" cy="110" r="1.8" fill="#E2D6C0"/>
<g transform="rotate(-3 60 62)">
<ellipse cx="38.6" cy="64" rx="3.6" ry="5" fill="#D49B6C"/><ellipse cx="81.4" cy="64" rx="3.6" ry="5" fill="#D49B6C"/>
<ellipse cx="60" cy="62" rx="21.5" ry="23" fill="#E3B183"/>
<path d="M42,74 q18,13 36,0 q-4,11 -18,11 q-14,0 -18,-11z" fill="#3E3129" opacity=".1"/>
<path d="M39.4,52 C41.8,53.4 42.6,57.6 42.4,62 C40.4,62.2 39,59.2 38.8,54.4 Z" fill="#3E3129"/>
<path d="M80.6,52 C78.2,53.4 77.4,57.6 77.6,62 C79.6,62.2 81,59.2 81.2,54.4 Z" fill="#3E3129"/>
<path d="M28,38 C22,16 34,4 50,7 C55,-2 68,-2 73,7 C89,4 99,17 92,38 Z" fill="#FFFDF7"/>
<path d="M28,38 C22,16 34,4 50,7 C47,17 43,27 43,38 Z" fill="#F4ECDD"/>
<rect x="29" y="33" width="62" height="12" rx="6" fill="#FFFDF7"/>
<path d="M31,43.4 h58" stroke="#E2D6C0" stroke-width="1.6" stroke-linecap="round"/>
<path d="M45,51.5 q7,-5.5 14,-2" stroke="#3E3129" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M66,55 q7,-2.5 13,0.5" stroke="#3E3129" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<ellipse cx="52" cy="60.5" rx="3" ry="3.5" fill="#3E3129"/><ellipse cx="70" cy="61.5" rx="2.9" ry="3.3" fill="#3E3129"/>
<path d="M48,56.4 q4,-2.2 8,-0.6" stroke="#C98F60" stroke-width="1.3" fill="none" stroke-linecap="round"/>
<path d="M60,63 q3.4,4 -0.6,5.4" stroke="#C98F60" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M53.5,72.5 C57,70 63,70.4 66,73 C65,78.6 61,80.4 58,79.4 C55,78.4 53.4,76 53.5,72.5 Z" fill="#8A4B40"/>
<path d="M66.5,72.4 q3.4,-0.6 4.6,-3" stroke="#C98F60" stroke-width="1.4" fill="none" stroke-linecap="round"/>
</g>
</svg>`;

/** The player's own portrait, for the "I promised." line. Source `:10889`. */
export const STORY_ART_YOU = `<svg viewBox="0 0 120 120" role="img" aria-label="You">
<circle cx="60" cy="60" r="60" fill="#E7DCC9"/>
<path d="M14,120 C17,97 36,86 60,86 C84,86 103,97 106,120 Z" fill="#F6EFE2"/>
<path d="M40,96 C44,112 46,120 46,120 L74,120 C74,120 76,112 80,96 C74,90 66,88 60,88 C54,88 46,90 40,96 Z" fill="#A8724C"/>
<rect x="52" y="71" width="16" height="19" rx="6" fill="#DDAE84"/>
<ellipse cx="60" cy="55" rx="24" ry="26" fill="#EBC49F"/>
<path d="M36,50 q4,-24 24,-24 q22,0 24,25 q-8,-13 -24,-13 q-16,0 -24,12z" fill="#4A3B33"/>
<circle cx="51" cy="57" r="2.6" fill="#4A3B33"/><circle cx="69" cy="57" r="2.6" fill="#4A3B33"/>
<path d="M54,68 q6,4 12,0" stroke="#B98564" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>`;

/** The full dining room, finale beats 3-4: three pendant lamps with radial glows, seated diner silhouettes BEHIND the tables (so it reads as a room being eaten in, not a row of shapes), tables. Source `:10901`. */
export const STORY_ART_DINING = `<svg viewBox="0 0 360 116" role="img" aria-label="A full dining room, every table taken">
<defs>
<linearGradient id="sgRoom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1E14" stop-opacity="0"/><stop offset="1" stop-color="#241A12" stop-opacity=".55"/></linearGradient>
<radialGradient id="sgPend" cx="50%" cy="22%" r="62%"><stop offset="0" stop-color="#FFD98F" stop-opacity=".34"/><stop offset="1" stop-color="#FFD98F" stop-opacity="0"/></radialGradient>
<linearGradient id="sgTbl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A5763F"/><stop offset="1" stop-color="#6E4A28"/></linearGradient>
</defs>
<rect width="360" height="116" fill="url(#sgRoom)"/>
<g transform="translate(58,0)" opacity="1">
<ellipse cx="0" cy="44" rx="62" ry="54" fill="url(#sgPend)"/>
<rect x="-1" y="0" width="2" height="22" fill="#2A1E14"/>
<path d="M-12,22 L12,22 L8,33 L-8,33 Z" fill="#E2AE52"/>
<circle cx="0" cy="34" r="4" fill="#FFE9B4"/>
<g fill="#2A1E14" opacity=".88">
<circle cx="-22" cy="62" r="8"/><path d="M-37,86 q2,-15 15,-15 q13,0 15,15z"/>
<circle cx="22" cy="60" r="8.5"/><path d="M6,86 q2,-16 16,-16 q14,0 16,16z"/></g>
<rect x="-40" y="84" width="80" height="8" rx="3" fill="url(#sgTbl)"/>
<rect x="-36" y="92" width="72" height="18" rx="2" fill="#2A1E14" opacity=".5"/>
<circle cx="-13" cy="81" r="3.4" fill="#F3E3C4" opacity=".9"/>
<rect x="9" y="74" width="5" height="10" rx="1.6" fill="#F3E3C4" opacity=".75"/>
</g>
<g transform="translate(180,6)" opacity=".92">
<ellipse cx="0" cy="44" rx="62" ry="54" fill="url(#sgPend)"/>
<rect x="-1" y="0" width="2" height="22" fill="#2A1E14"/>
<path d="M-12,22 L12,22 L8,33 L-8,33 Z" fill="#E2AE52"/>
<circle cx="0" cy="34" r="4" fill="#FFE9B4"/>
<g fill="#2A1E14" opacity=".88">
<circle cx="-22" cy="62" r="8"/><path d="M-37,86 q2,-15 15,-15 q13,0 15,15z"/>
<circle cx="22" cy="60" r="8.5"/><path d="M6,86 q2,-16 16,-16 q14,0 16,16z"/></g>
<rect x="-40" y="84" width="80" height="8" rx="3" fill="url(#sgTbl)"/>
<rect x="-36" y="92" width="72" height="18" rx="2" fill="#2A1E14" opacity=".5"/>
<circle cx="-13" cy="81" r="3.4" fill="#F3E3C4" opacity=".9"/>
<rect x="9" y="74" width="5" height="10" rx="1.6" fill="#F3E3C4" opacity=".75"/>
</g>
<g transform="translate(302,2)" opacity=".86">
<ellipse cx="0" cy="44" rx="62" ry="54" fill="url(#sgPend)"/>
<rect x="-1" y="0" width="2" height="22" fill="#2A1E14"/>
<path d="M-12,22 L12,22 L8,33 L-8,33 Z" fill="#E2AE52"/>
<circle cx="0" cy="34" r="4" fill="#FFE9B4"/>
<g fill="#2A1E14" opacity=".88">
<circle cx="-22" cy="62" r="8"/><path d="M-37,86 q2,-15 15,-15 q13,0 15,15z"/>
<circle cx="22" cy="60" r="8.5"/><path d="M6,86 q2,-16 16,-16 q14,0 16,16z"/></g>
<rect x="-40" y="84" width="80" height="8" rx="3" fill="url(#sgTbl)"/>
<rect x="-36" y="92" width="72" height="18" rx="2" fill="#2A1E14" opacity=".5"/>
<circle cx="-13" cy="81" r="3.4" fill="#F3E3C4" opacity=".9"/>
<rect x="9" y="74" width="5" height="10" rx="1.6" fill="#F3E3C4" opacity=".75"/>
</g>
</svg>`;

/** Basic Cutting Board purchase card. Source `:10923`. */
export const STORY_ART_BOARD = `<svg viewBox="0 0 120 70" role="img" aria-label="A basic cutting board">
<defs><linearGradient id="sgBrd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9926A"/><stop offset="0.5" stop-color="#BA8259"/><stop offset="1" stop-color="#A26B44"/></linearGradient></defs>
<rect x="10" y="14" width="100" height="48" rx="9" fill="#54331E"/>
<rect x="10" y="10" width="100" height="48" rx="9" fill="url(#sgBrd)"/>
<g stroke="#3C2312" stroke-opacity=".16" stroke-width="1.2">
<path d="M28,10 L28,58 M46,10 L46,58 M64,10 L64,58 M82,10 L82,58 M98,10 L98,58"/></g>
<rect x="12" y="11" width="96" height="2.5" rx="1.2" fill="#FFF2D8" opacity=".22"/>
<circle cx="22" cy="34" r="4" fill="#54331E" opacity=".55"/>
</svg>`;

/** Basic Kitchen Knife purchase card. Source `:10932`. */
export const STORY_ART_KNIFE = `<svg viewBox="0 0 120 70" role="img" aria-label="A basic kitchen knife">
<defs><linearGradient id="sgSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B7BDC3"/><stop offset="0.55" stop-color="#8B9299"/><stop offset="1" stop-color="#72787E"/></linearGradient></defs>
<path d="M14,26 L74,26 C82,26 88,30 92,38 L20,40 C15,36 13,31 14,26 Z" fill="url(#sgSteel)"/>
<path d="M16,28 L72,28 C78,28 82,30 85,34 L20,34 Z" fill="#FFFDF7" opacity=".3"/>
<rect x="88" y="28" width="20" height="13" rx="5" fill="#6C5745" transform="rotate(4 98 34)"/>
<rect x="84" y="29" width="6" height="11" rx="2" fill="#59493B"/>
</svg>`;

export type StoryArtKey = "bedside" | "keys" | "chef" | "you" | "dining" | "board" | "knife";

export const STORY_ART: Record<StoryArtKey, string> = {
  bedside: STORY_ART_BEDSIDE,
  keys: STORY_ART_KEYS,
  chef: STORY_ART_CHEF,
  you: STORY_ART_YOU,
  dining: STORY_ART_DINING,
  board: STORY_ART_BOARD,
  knife: STORY_ART_KNIFE,
};
