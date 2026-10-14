import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AudioManager } from "@/game/AudioManager";
import { paintBoardTexture } from "@/game/textures/boardTexture";
import type { BoardDefinition } from "@/game/boards/boardTypes";
import type { KnifeDefinition } from "@/game/knives/knifeTypes";
import { knifeProfile } from "@/game/scenes/knifeProfile";
import { KButton } from "../common/primitives";
import { KnifeGlyph } from "../Workshop";

const WIDTH = 360;
const HEIGHT = 280;
// The game's board artwork is scaled to about 19×13.5 in against the sink basin.
const BOARD_ART_WIDTH = 218;
const BOARD_ART_HEIGHT = 300;
const PLATE = { x: 180, y: 165, rx: 92, ry: 65 };
const BRUSH_RADIUS = 28;
const CLEAN_THRESHOLD = 1;
const ITEM_CHANGE_DELAY_MS = 140;
const TABLEWARE_ITEMS = [
  { id: "dinner-plates", label: "Dinner plate", shape: "plate" },
  { id: "dinner-forks", label: "Dinner fork", shape: "fork" },
  { id: "dinner-knives", label: "Dinner knife", shape: "knife" },
  { id: "side-plates", label: "Side plate", shape: "small-plate" },
  { id: "soup-bowls", label: "Soup bowl", shape: "bowl" },
  { id: "soup-spoons", label: "Soup spoon", shape: "spoon" },
  { id: "dessert-plates", label: "Dessert plate", shape: "small-plate" },
  { id: "dessert-forks", label: "Dessert fork", shape: "fork" },
  { id: "teaspoons", label: "Teaspoon", shape: "spoon" },
  { id: "steak-knives", label: "Steak knife", shape: "knife" },
  { id: "water-glasses", label: "Water glass", shape: "glass" },
  { id: "highball-glasses", label: "Highball glass", shape: "glass" },
  { id: "coffee-tea-set", label: "Coffee cup & saucer", shape: "cup-set" },
  { id: "water-jugs", label: "Water jug", shape: "jug" },
  { id: "salt-pepper", label: "Salt & pepper shakers", shape: "shakers" },
] as const;
// The 18 culinary tools come from restaurant/kitchenTools.ts. The knife and
// board are the two additional pieces used in every hands-on prep session.
const KITCHEN_TOOL_ITEMS = [
  { id: "chef-knife", label: "Chef’s knife", shape: "kitchen-food" },
  { id: "cutting-board", label: "Cutting board", shape: "kitchen-food" },
  { id: "peelers", label: "Vegetable peeler", shape: "kitchen-food" },
  { id: "mixing-bowls", label: "Mixing bowl", shape: "kitchen-food" },
  { id: "measuring-cups", label: "Measuring cup set", shape: "kitchen-food" },
  { id: "sheet-pans", label: "Sheet pan", shape: "kitchen-food" },
  { id: "oven-mitts", label: "Oven mitts", shape: "kitchen-wipe" },
  { id: "frying-pans", label: "Fry pan", shape: "kitchen-food" },
  { id: "tongs", label: "Utility tongs", shape: "kitchen-food" },
  { id: "skimmers", label: "Fine mesh skimmer", shape: "kitchen-food" },
  { id: "stock-pot", label: "Stock pot", shape: "kitchen-food" },
  { id: "ladles", label: "Ladle", shape: "kitchen-food" },
  { id: "storage-containers", label: "Storage container & lid", shape: "kitchen-food" },
  { id: "thermometers", label: "Probe thermometer", shape: "kitchen-wipe" },
  { id: "saucepans", label: "Saucepan", shape: "kitchen-food" },
  { id: "whisks", label: "Piano whisk", shape: "kitchen-food" },
  { id: "saute-pans", label: "Sauté pan", shape: "kitchen-food" },
  { id: "spatulas", label: "High-heat turner", shape: "kitchen-food" },
  { id: "graters", label: "Box grater", shape: "kitchen-food" },
  { id: "kitchen-scales", label: "Digital portion scale", shape: "kitchen-wipe" },
] as const;
const KITCHEN_TOOL_START_INDEX = TABLEWARE_ITEMS.length;
const WASH_ITEMS = [...TABLEWARE_ITEMS, ...KITCHEN_TOOL_ITEMS] as const;
type WashShape = (typeof WASH_ITEMS)[number]["shape"];
const WASH_VISUAL_FRAMES: Record<WashShape, { viewBox: string; left: string; top: string; width: string; height: string }> = {
  plate: { viewBox: "0 0 360 280", left: "0%", top: "0%", width: "100%", height: "100%" },
  "small-plate": { viewBox: "0 0 120 90", left: "33%", top: "43%", width: "34%", height: "32%" },
  bowl: { viewBox: "0 0 120 100", left: "31%", top: "39%", width: "38%", height: "36%" },
  fork: { viewBox: "0 0 40 140", left: "44.5%", top: "34%", width: "11%", height: "48%" },
  knife: { viewBox: "0 0 40 140", left: "45%", top: "34%", width: "10%", height: "48%" },
  spoon: { viewBox: "0 0 40 140", left: "44.5%", top: "34%", width: "11%", height: "48%" },
  glass: { viewBox: "0 0 100 140", left: "42%", top: "36%", width: "16%", height: "43%" },
  "cup-set": { viewBox: "0 0 120 140", left: "35%", top: "36%", width: "30%", height: "42%" },
  jug: { viewBox: "0 0 120 160", left: "36%", top: "31%", width: "28%", height: "50%" },
  shakers: { viewBox: "0 0 120 140", left: "36%", top: "36%", width: "28%", height: "43%" },
  "kitchen-food": { viewBox: "0 0 120 140", left: "32%", top: "30%", width: "36%", height: "52%" },
  "kitchen-wipe": { viewBox: "0 0 120 140", left: "32%", top: "30%", width: "36%", height: "52%" },
};

type KitchenToolLayout = { width: number; height: number; artWidth: number; artHeight: number; horizontal?: boolean };
// The visible basin in the 360×280 scene represents roughly a 24×18 inch
// bowl at about 10 scene pixels per inch. Dimensions below are matched to
// that basin; artWidth/artHeight are the source silhouette bounds in its
// 120×140 viewBox, measured from the SVG paths below.
const KITCHEN_TOOL_LAYOUTS: Record<string, KitchenToolLayout> = {
  "chef-knife": { width: 140, height: 28, artWidth: 120, artHeight: 58, horizontal: true },
  "cutting-board": { width: 180, height: 120, artWidth: 120, artHeight: 140 },
  peelers: { width: 70, height: 22, artWidth: 60, artHeight: 103, horizontal: true },
  "mixing-bowls": { width: 100, height: 58, artWidth: 88, artHeight: 83 },
  "measuring-cups": { width: 70, height: 45, artWidth: 81, artHeight: 70 },
  "sheet-pans": { width: 180, height: 130, artWidth: 104, artHeight: 80 },
  "oven-mitts": { width: 120, height: 65, artWidth: 74, artHeight: 105, horizontal: true },
  "frying-pans": { width: 178, height: 106, artWidth: 101, artHeight: 84 },
  tongs: { width: 120, height: 36, artWidth: 98, artHeight: 116, horizontal: true },
  skimmers: { width: 135, height: 40, artWidth: 60, artHeight: 112, horizontal: true },
  "stock-pot": { width: 140, height: 110, artWidth: 96, artHeight: 88 },
  ladles: { width: 120, height: 30, artWidth: 73, artHeight: 119, horizontal: true },
  "storage-containers": { width: 120, height: 75, artWidth: 84, artHeight: 79 },
  thermometers: { width: 120, height: 16, artWidth: 30, artHeight: 112, horizontal: true },
  saucepans: { width: 165, height: 100, artWidth: 91, artHeight: 77 },
  whisks: { width: 120, height: 48, artWidth: 72, artHeight: 109, horizontal: true },
  "saute-pans": { width: 180, height: 106, artWidth: 101, artHeight: 84 },
  spatulas: { width: 130, height: 25, artWidth: 48, artHeight: 107, horizontal: true },
  graters: { width: 80, height: 120, artWidth: 64, artHeight: 112 },
  "kitchen-scales": { width: 90, height: 80, artWidth: 80, artHeight: 77 },
};

function kitchenToolFrame(itemId: string) {
  const layout = KITCHEN_TOOL_LAYOUTS[itemId] ?? { width: 110, height: 90, artWidth: 85, artHeight: 90 };
  const sourceWidth = layout.horizontal ? layout.artHeight : layout.artWidth;
  const sourceHeight = layout.horizontal ? layout.artWidth : layout.artHeight;
  const width = layout.width * 120 / sourceWidth;
  const height = layout.height * 140 / sourceHeight;
  const x = (WIDTH - width) / 2;
  const y = (HEIGHT - height) / 2;
  return {
    viewBox: "0 0 120 140",
    x, y, frameWidth: width, frameHeight: height,
    left: `${x / WIDTH * 100}%`,
    top: `${y / HEIGHT * 100}%`,
    width: `${width / WIDTH * 100}%`,
    height: `${height / HEIGHT * 100}%`,
    horizontal: Boolean(layout.horizontal),
  };
}

function KitchenToolIllustration({ itemId }: { itemId: string }) {
  const metal = "url(#wash-metal)";
  const wood = "url(#wash-wood)";
  const line = { stroke: "#594535", strokeWidth: 2.4, strokeLinejoin: "round" as const };
  const highlight = { fill: "none", stroke: "#fff8e8", strokeOpacity: .72, strokeWidth: 2.2, strokeLinecap: "round" as const };

  switch (itemId) {
    case "chef-knife":
      return <g {...line}><path d="M57 12 Q77 8 88 35 L68 72 L55 68Z" fill={metal}/><path d="M55 66 L70 72 L68 113 Q60 127 49 115 L43 109Z" fill={wood}/><path d="M62 20 L80 37 L67 62" {...highlight}/><path d="M49 83 L65 89" stroke="#51321f" strokeWidth="3"/></g>;
    case "cutting-board":
      return <g {...line}><path d="M22 26 Q22 17 32 17 H88 Q98 17 98 27 V112 Q98 121 88 121 H32 Q22 121 22 112Z" fill={wood}/><path d="M38 29 H82 Q88 29 88 36 V103 Q88 109 82 109 H38 Q32 109 32 103 V36Q32 29 38 29Z" fill="none" stroke="#edc27d" strokeOpacity=".55" strokeWidth="2"/><path d="M42 37 V101 M52 36 V103 M68 35 V102 M78 38 V100" stroke="#57351f" strokeOpacity=".28" strokeWidth="1.4"/><circle cx="60" cy="22" r="3" fill="#e7c68e"/></g>;
    case "peelers":
      return <g {...line}><path d="M57 48 Q60 40 67 44 L77 103 Q77 116 66 120 Q55 121 52 109Z" fill={wood}/><path d="M30 30 Q60 16 90 30 L87 43 Q60 36 33 44Z" fill={metal}/><path d="M40 31 L80 31" {...highlight}/><path d="M59 50 L69 105" {...highlight}/></g>;
    case "mixing-bowls":
      return <g {...line}><path d="M16 50 Q60 39 104 50 L91 101 Q85 120 60 122 Q35 120 29 101Z" fill="url(#wash-metal)"/><ellipse cx="60" cy="50" rx="44" ry="11" fill="#f7f0dd" stroke="#665d51" strokeWidth="3"/><ellipse cx="60" cy="50" rx="35" ry="6" fill="#d6d1c1" stroke="#fff" strokeOpacity=".72" strokeWidth="1.4"/><path d="M34 78 Q60 88 86 78 M38 95 Q60 104 82 95" {...highlight}/></g>;
    case "measuring-cups":
      return <g {...line}><path d="M17 47 H52 L48 83 Q46 90 34 90 Q22 90 20 83Z" fill="#d9e5df" fillOpacity=".8"/><path d="M61 32 H98 L94 70 Q92 77 80 77 Q68 77 66 70Z" fill="#c6d7d2" fillOpacity=".82"/><path d="M28 43 V35 H44 V43 M72 28 V20 H89 V28" fill={metal}/><path d="M25 64 H45 M70 51 H90" stroke="#b58a49" strokeWidth="2"/><path d="M24 52 H32 M24 59 H36 M69 40 H78 M69 47 H82" stroke="#6d6254" strokeWidth="1.4"/></g>;
    case "sheet-pans":
      return <g {...line}>
        {/* Low-sided rectangular tray with a rolled lip and a recessed flat base. */}
        <path d="M22 30 H98 Q112 30 112 44 V96 Q112 110 98 110 H22 Q8 110 8 96 V44 Q8 30 22 30Z" fill="#373a39" stroke="#242726" strokeWidth="3"/>
        <path d="M22 34 H98 Q108 34 108 44 V96 Q108 106 98 106 H22 Q12 106 12 96 V44 Q12 34 22 34Z" fill={metal} stroke="#e5e2d8" strokeWidth="2"/>
        <path d="M24 41 H96 Q101 41 101 46 V94 Q101 99 96 99 H24 Q19 99 19 94 V46 Q19 41 24 41Z" fill="#383c3c" stroke="#555a59" strokeWidth="2.5"/>
        <path d="M27 45 H93 Q97 45 97 49 V91 Q97 95 93 95 H27 Q23 95 23 91 V49 Q23 45 27 45Z" fill="#4d504f" stroke="#a9aaa3" strokeWidth="1.6"/>
        <path d="M29 49 H91 M28 90 Q31 93 37 93 H83 Q89 93 92 90" fill="none" stroke="#d9d8d0" strokeOpacity=".48" strokeWidth="1.6"/>
        <path d="M17 40 Q17 35 24 35 H96" {...highlight}/>
      </g>;
    case "oven-mitts":
      return <g {...line}><path d="M40 116 Q28 113 27 102 L24 64 Q23 55 30 55 Q36 55 37 63 L37 32 Q37 23 44 23 Q51 23 51 32 V55 V25 Q51 17 59 17 Q67 17 67 26 V55 V31 Q67 23 74 24 Q81 25 80 34 L79 58 Q87 50 93 56 Q98 61 94 69 L85 101 Q80 118 64 122Z" fill="#b94b35"/><path d="M39 76 L42 106 Q58 115 74 104 L83 72" fill="none" stroke="#edb168" strokeWidth="3"/><path d="M31 64 L34 92 M46 31 V51 M60 27 V50 M73 34 V52" {...highlight}/></g>;
    case "frying-pans":
    case "saute-pans": {
      const saute = itemId === "saute-pans";
      return (
        <g {...line}>
          {/* Long wood grip with a metal tang, fixed behind the pan body. */}
          <path d="M62 44 L84 41 L87 53 L63 53Z" fill={metal} stroke="#4b4942" strokeWidth="2" />
          <path d="M81 41 L108 37 Q115 37 117 43 L116 49 Q115 54 109 55 L82 53Z" fill={wood} stroke="#503a27" strokeWidth="2.5" />
          <path d="M88 44 L110 41" {...highlight} />
          <circle cx="73" cy="47.5" r="2.1" fill="#d1ad6b" stroke="#57442d" strokeWidth="1" />
          <path d={saute
            ? "M14 48 C13 62 16 78 22 84 Q45 98 68 84 C75 77 78 62 76 48Z"
            : "M15 48 C14 57 17 65 23 70 Q45 82 67 70 C73 65 76 57 75 48Z"} fill={metal} />
          <ellipse cx="45" cy={saute ? 82 : 76} rx={saute ? 24 : 22} ry={saute ? 11 : 6} fill="#77766f" stroke="#504b43" strokeWidth="2" />
          <ellipse cx="45" cy="48" rx={saute ? 31 : 30} ry="20" fill={metal} stroke="#48453e" strokeWidth="3" />
          <ellipse cx="45" cy="47" rx={saute ? 26 : 25} ry="15" fill="#373633" stroke="#eee6d6" strokeWidth="2" />
          <path d="M23 44 Q44 35 66 45" {...highlight} />
          <path d={saute ? "M22 58 Q44 68 68 58" : "M23 57 Q45 65 67 57"} fill="none" stroke="#f2eee3" strokeOpacity=".42" strokeWidth="2" />
          <circle cx="70" cy="62" r="3.5" fill="#d8c6a5" />
        </g>
      );
    }
    case "tongs":
      return <g stroke="#77531d" strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round">
        {/* One-piece spring tongs, with long arms and broad spoon-shaped ends. */}
        <path d="M52 108 Q59 124 68 108" fill="none" stroke="url(#wash-gold)" strokeWidth="5" />
        <path d="M52 108 L42 45 Q41 40 46 40 Q50 40 51 44 L62 103 Q63 109 58 113Z" fill="url(#wash-gold)" />
        <path d="M61 103 L77 47 Q78 42 83 44 Q87 45 85 50 L70 109 Q68 114 63 114Z" fill="url(#wash-gold)" />
        <path d="M42 45 C34 47 25 41 22 33 Q18 24 25 17 Q33 10 42 15 Q52 19 52 28 Q52 37 42 45Z" fill="url(#wash-gold)" />
        <path d="M79 53 C73 47 76 37 83 30 Q91 22 101 25 Q112 28 114 37 Q116 47 106 53 Q96 60 86 57Z" fill="url(#wash-gold)" />
        <path d="M29 20 Q37 15 45 22 M84 32 Q94 25 105 31" fill="none" stroke="#fff1ac" strokeOpacity=".92" strokeWidth="2.2" />
        <path d="M31 30 Q37 37 44 34 M88 43 Q99 49 108 41" fill="none" stroke="#8b6326" strokeOpacity=".72" strokeWidth="1.5" />
        <path d="M47 51 L56 100 M81 53 L68 101" fill="none" stroke="#fff0a6" strokeOpacity=".78" strokeWidth="1.8" />
      </g>;
    case "skimmers":
      return <g {...line}><path d="M55 67 L63 119 Q64 127 71 125 Q77 123 75 116 L67 63Z" fill={metal}/><circle cx="51" cy="44" r="29" fill={metal} stroke="#5e564b" strokeWidth="3"/><circle cx="51" cy="44" r="22" fill="#aaa89f" stroke="#f8f2e5" strokeWidth="2"/><circle cx="43" cy="37" r="2.3" fill="#4d4b47"/><circle cx="54" cy="34" r="2.3" fill="#4d4b47"/><circle cx="63" cy="40" r="2.3" fill="#4d4b47"/><circle cx="40" cy="48" r="2.3" fill="#4d4b47"/><circle cx="51" cy="48" r="2.3" fill="#4d4b47"/><circle cx="62" cy="51" r="2.3" fill="#4d4b47"/><circle cx="48" cy="58" r="2.3" fill="#4d4b47"/><path d="M47 30 L57 57" {...highlight}/></g>;
    case "stock-pot":
      return <g {...line}>
        <path d="M27 50 H93 L88 106 Q86 115 60 116 Q34 115 32 106Z" fill={metal}/>
        <path d="M29 59 H17 Q11 59 11 66 V68 Q11 75 18 75 H31 M91 59 H103 Q109 59 109 66 V68 Q109 75 102 75 H89" fill="none" stroke="#504941" strokeWidth="9" strokeLinejoin="round"/>
        <path d="M29 59 H17 Q11 59 11 66 V68 Q11 75 18 75 H31 M91 59 H103 Q109 59 109 66 V68 Q109 75 102 75 H89" fill="none" stroke={metal} strokeWidth="5" strokeLinejoin="round"/>
        <path d="M25 59 H31 M89 59 H95 M25 75 H31 M89 75 H95" stroke="#d9bd85" strokeWidth="2.5" />
        <path d="M20 46 Q60 29 100 46 L96 55 H24Z" fill="#c9c6ba" stroke="#574e42" strokeWidth="3"/>
        <path d="M53 39 Q60 30 67 39" fill="none" stroke="#554535" strokeWidth="4"/>
        <path d="M39 65 V99 M49 63 V104 M70 63 V104 M81 65 V99" {...highlight}/>
      </g>;
    case "ladles":
      return <g {...line}>
        {/* 8 cm bowl × 4.5 cm deep, on a handle about 22.8 cm long. */}
        <path d="M52 38 L72 119 Q75 127 82 124 Q88 121 84 114 L61 34Z" fill={metal}/>
        <ellipse cx="45" cy="24" rx="22" ry="15.5" fill={metal} stroke="#5b5247" strokeWidth="3"/>
        <ellipse cx="45" cy="23" rx="17" ry="11.5" fill="#aaa69b" stroke="#f8f3e8" strokeWidth="2"/>
        <ellipse cx="44" cy="22" rx="9" ry="5.5" fill="#77766f" fillOpacity=".5" stroke="none"/>
        <path d="M35 18 Q43 13 51 17" {...highlight}/>
      </g>;
    case "storage-containers":
      return <g {...line}><path d="M22 54 H98 L93 111 Q92 118 85 118 H35 Q28 118 27 111Z" fill="#bdd8d2" fillOpacity=".65"/><path d="M18 45 Q18 39 25 39 H95 Q102 39 102 45 V54 H18Z" fill="#d9ece3" stroke="#5f8178" strokeWidth="3"/><path d="M34 62 V106 M42 62 V106 M83 62 V106 M91 62 V106" {...highlight}/><path d="M30 51 H90" stroke="#fff" strokeOpacity=".8" strokeWidth="2"/></g>;
    case "thermometers":
      return <g {...line}><rect x="45" y="23" width="30" height="48" rx="13" fill="#383d3d"/><rect x="50" y="28" width="20" height="32" rx="9" fill="#e8e8d9"/><circle cx="60" cy="45" r="7" fill="#c54532" stroke="#762d25" strokeWidth="2"/><path d="M60 68 V121 Q60 129 64 121 L69 69" fill={metal}/><path d="M56 78 H64 M56 88 H64 M56 98 H64 M57 108 H63" stroke="#5e5448" strokeWidth="1.5"/><path d="M54 34 H60" {...highlight}/></g>;
    case "saucepans":
      return (
        <g {...line}>
          <path d="M63 39 L81 39 L84 51 L64 52Z" fill={metal} stroke="#4b4942" strokeWidth="2" />
          <path d="M80 39 L109 33 Q116 33 118 39 L117 47 Q116 52 109 53 L82 51Z" fill={wood} stroke="#503a27" strokeWidth="2.5" />
          <path d="M88 42 L111 37" {...highlight} />
          <circle cx="72" cy="45" r="2.1" fill="#d1ad6b" stroke="#57442d" strokeWidth="1" />
          <path d="M24 42 C23 59 25 82 30 91 Q46 103 62 91 C67 82 69 59 68 42Z" fill={metal} />
          <ellipse cx="46" cy="89" rx="17" ry="9" fill="#77766f" stroke="#504b43" strokeWidth="2" />
          <ellipse cx="46" cy="42" rx="22" ry="16" fill={metal} stroke="#48453e" strokeWidth="3" />
          <ellipse cx="46" cy="41" rx="18" ry="11" fill="#373633" stroke="#eee6d6" strokeWidth="2" />
          <path d="M30 39 Q46 32 62 40" {...highlight} />
          <path d="M30 56 Q46 62 62 56 M32 73 Q46 78 60 73" fill="none" stroke="#f2eee3" strokeOpacity=".42" strokeWidth="2" />
          <circle cx="67" cy="57" r="3.5" fill="#d8c6a5" />
        </g>
      );
    case "whisks":
      return <g fill="none" strokeLinecap="round"><path d="M56 77 L51 119 Q51 126 59 126 Q66 126 66 119 L62 77Z" fill={wood} stroke="#563d2a" strokeWidth="3"/><path d="M58 77 C31 61 30 33 46 24 C60 17 65 48 60 76 M59 77 C43 52 45 25 59 21 C74 19 70 52 61 77 M60 77 C69 49 81 33 89 39 C98 47 77 68 61 80 M58 77 C48 55 27 47 24 58 C21 68 44 77 58 82 M61 78 C76 60 96 61 96 72 C96 81 75 84 61 82" stroke="#51493f" strokeWidth="5"/><path d="M58 77 C31 61 30 33 46 24 C60 17 65 48 60 76 M59 77 C43 52 45 25 59 21 C74 19 70 52 61 77 M60 77 C69 49 81 33 89 39 C98 47 77 68 61 80 M58 77 C48 55 27 47 24 58 C21 68 44 77 58 82 M61 78 C76 60 96 61 96 72 C96 81 75 84 61 82" stroke={metal} strokeWidth="2.2"/><path d="M57 88 L59 116" stroke="#fff" strokeOpacity=".65" strokeWidth="2"/></g>;
    case "spatulas":
      return <g {...line}><path d="M57 67 L61 117 Q62 125 68 124 Q74 123 73 116 L67 63Z" fill={wood}/><path d="M36 26 Q60 18 84 27 L77 77 Q75 88 62 88 Q48 88 45 77Z" fill={metal}/><path d="M43 34 Q60 28 78 34 L73 70 Q60 78 49 70Z" fill="#c9c6ba" stroke="#fbf4e4" strokeWidth="2"/><path d="M47 38 L51 68" {...highlight}/></g>;
    case "graters":
      return <g {...line}><path d="M34 25 H82 Q90 25 89 34 L82 111 Q81 119 73 119 H38 Q30 118 31 110 L25 35 Q24 25 34 25Z" fill={metal}/><path d="M36 35 H78 L73 108 H40Z" fill="#a8a69d" stroke="#f5eedf" strokeWidth="2"/><path d="M40 43 L44 101 M52 41 L54 103 M65 40 L64 103 M76 42 L73 100" stroke="#625a4e" strokeWidth="2"/><path d="M41 54 H75 M40 69 H74 M41 84 H73" stroke="#ece5d7" strokeWidth="2"/><path d="M43 17 Q59 7 76 17 L74 28 H45Z" fill={wood}/></g>;
    case "kitchen-scales":
      return <g {...line}><path d="M20 65 Q20 59 28 59 H92 Q100 59 100 67 L94 111 Q93 118 85 118 H35 Q27 118 26 111Z" fill="#555a59"/><path d="M35 71 H85 L81 105 H39Z" fill="#bfc9c1" stroke="#ece9de" strokeWidth="2"/><rect x="42" y="78" width="36" height="13" rx="3" fill="#33443e"/><path d="M48 84 H69" stroke="#9fe3a8" strokeWidth="2"/><circle cx="78" cy="99" r="3" fill="#d19a44"/><path d="M23 56 Q60 42 97 56 L91 65 H29Z" fill={metal}/><path d="M35 57 Q60 50 85 57" {...highlight}/></g>;
    default:
      return <g {...line}><rect x="25" y="28" width="70" height="88" rx="12" fill={metal}/><path d="M34 41 H86 M34 99 H86" {...highlight}/></g>;
  }
}

type Point = { x: number; y: number };
type DirtSample = Point & { dirty: boolean; color: string; radius: number; seed: number };

/** Match the steel blade to KnifeGlyph's own fitted SVG geometry and placement. */
function knifeSteelPolygon(knife: KnifeDefinition): Point[] {
  const profile = knifeProfile(knife.animation.blade, 540);
  const all = [...profile.outline, ...profile.handle, ...profile.bolster];
  const minX = Math.min(...all.map((point) => point.x));
  const maxX = Math.max(...all.map((point) => point.x));
  const minY = Math.min(...all.map((point) => point.y));
  const maxY = Math.max(...all.map((point) => point.y));
  const scale = Math.min(224 / (maxX - minX), 84 / (maxY - minY));
  const offsetX = 120 - ((minX + maxX) / 2) * scale;
  const offsetY = 50 - ((minY + maxY) / 2) * scale;
  const svgWidth = WIDTH * 0.42;
  const svgHeight = svgWidth * 100 / 240;
  const svgLeft = WIDTH * 0.5 - svgWidth * 0.5;
  const svgTop = HEIGHT * 0.52 - svgHeight * 0.5;
  return profile.outline.map((point) => ({
    x: svgLeft + ((offsetX + point.x * scale) / 240) * svgWidth,
    y: svgTop + ((offsetY + point.y * scale) / 100) * svgHeight,
  }));
}

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

function inPolygon(x: number, y: number, points: Point[]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]!;
    const b = points[j]!;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function nearSegment(x: number, y: number, a: Point, b: Point, radius: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared)) : 0;
  return (x - (a.x + t * dx)) ** 2 + (y - (a.y + t * dy)) ** 2 <= radius * radius;
}

function inKitchenToolSurface(x: number, y: number, itemId?: string, equippedKnife?: KnifeDefinition) {
  if (itemId === "chef-knife") {
    return equippedKnife ? inPolygon(x, y, knifeSteelPolygon(equippedKnife)) : false;
  }
  if (itemId === "cutting-board") {
    // Exact face quad for paintBoardTexture at its 218×300 display size.
    return inPolygon(x, y, [{x:95,y:79},{x:265,y:79},{x:279,y:214},{x:81,y:214}]);
  }
  // Match each tool's frame to its real dimensions, then invert any artwork
  // rotation so the hit target stays aligned with the visible SVG.
  const frame = kitchenToolFrame(itemId ?? "");
  const u = (x - frame.x) / (frame.frameWidth / 120);
  const v = (y - frame.y) / (frame.frameHeight / 140);
  const lx = frame.horizontal ? v - 10 : u;
  const ly = frame.horizontal ? 130 - u : v;
  const rect = (x1: number, y1: number, x2: number, y2: number) => lx >= x1 && lx <= x2 && ly >= y1 && ly <= y2;
  const ellipse = (cx: number, cy: number, rx: number, ry: number) => inEllipse(lx, ly, cx, cy, rx, ry);
  const roundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
    if (lx < x || lx > x + width || ly < y || ly > y + height) return false;
    const nearestX = Math.max(x + radius, Math.min(lx, x + width - radius));
    const nearestY = Math.max(y + radius, Math.min(ly, y + height - radius));
    return (lx - nearestX) ** 2 + (ly - nearestY) ** 2 <= radius ** 2;
  };
  const polygon = (points: Point[]) => inPolygon(lx, ly, points);
  const segment = (a: Point, b: Point, r = 5) => nearSegment(lx, ly, a, b, r);

  switch (itemId) {
    case "chef-knife": return polygon([{x:57,y:12},{x:78,y:11},{x:88,y:35},{x:68,y:72},{x:55,y:68}]) || polygon([{x:55,y:66},{x:70,y:72},{x:68,y:113},{x:60,y:122},{x:49,y:115},{x:43,y:109}]);
    case "cutting-board": return rect(22,17,98,121);
    case "peelers": return polygon([{x:57,y:48},{x:67,y:44},{x:77,y:103},{x:77,y:116},{x:66,y:120},{x:52,y:109}]) || polygon([{x:30,y:30},{x:60,y:17},{x:90,y:30},{x:87,y:43},{x:33,y:44}]);
    case "mixing-bowls": return ellipse(60,82,44,42) || ellipse(60,50,44,11);
    case "measuring-cups": return rect(17,32,52,90) || rect(61,20,98,78);
    case "sheet-pans": return roundedRect(23,45,74,50,7);
    case "oven-mitts": return polygon([{x:40,y:116},{x:27,y:102},{x:24,y:64},{x:30,y:55},{x:37,y:63},{x:37,y:32},{x:44,y:23},{x:51,y:32},{x:51,y:25},{x:59,y:17},{x:67,y:26},{x:67,y:31},{x:74,y:24},{x:81,y:34},{x:79,y:58},{x:93,y:56},{x:94,y:69},{x:85,y:101},{x:64,y:122}]);
    case "frying-pans": return ellipse(45,48,30,20) || polygon([{x:15,y:48},{x:75,y:48},{x:75,y:57},{x:67,y:70},{x:45,y:82},{x:23,y:70},{x:15,y:57}]) || polygon([{x:62,y:44},{x:81,y:41},{x:108,y:37},{x:115,y:37},{x:117,y:43},{x:116,y:49},{x:109,y:55},{x:82,y:53},{x:63,y:53}]);
    case "saute-pans": return ellipse(45,48,31,20) || polygon([{x:14,y:48},{x:76,y:48},{x:78,y:62},{x:68,y:84},{x:45,y:98},{x:22,y:84},{x:13,y:62}]) || polygon([{x:62,y:44},{x:81,y:41},{x:108,y:37},{x:115,y:37},{x:117,y:43},{x:116,y:49},{x:109,y:55},{x:82,y:53},{x:63,y:53}]);
    case "tongs": return polygon([{x:22,y:33},{x:18,y:24},{x:22,y:16},{x:31,y:11},{x:42,y:15},{x:52,y:24},{x:52,y:34},{x:44,y:43},{x:34,y:46}])
      || polygon([{x:42,y:40},{x:51,y:39},{x:62,y:103},{x:63,y:109},{x:58,y:115},{x:52,y:111},{x:49,y:105}])
      || polygon([{x:79,y:53},{x:74,y:46},{x:77,y:37},{x:84,y:29},{x:95,y:24},{x:106,y:26},{x:114,y:34},{x:116,y:43},{x:108,y:53},{x:98,y:59},{x:87,y:58}])
      || polygon([{x:77,y:43},{x:86,y:45},{x:71,y:107},{x:68,y:114},{x:62,y:115},{x:60,y:108}])
      || segment({x:52,y:109},{x:68,y:109},4);
    case "skimmers": return ellipse(51,44,30,31) || segment({x:59,y:62},{x:74,y:126},6);
    case "stock-pot": return rect(27,47,93,117) || rect(10,55,33,78) || rect(87,55,110,78) || polygon([{x:20,y:46},{x:60,y:29},{x:100,y:46},{x:96,y:55},{x:24,y:55}]);
    case "ladles": return ellipse(45,24,22,15.5) || polygon([{x:52,y:38},{x:72,y:119},{x:75,y:127},{x:82,y:124},{x:88,y:121},{x:84,y:114},{x:61,y:34}]);
    case "storage-containers": return rect(18,39,102,118);
    case "thermometers": return rect(44,17,76,73) || rect(55,66,70,126);
    case "saucepans": return ellipse(46,42,22,16) || polygon([{x:24,y:42},{x:68,y:42},{x:69,y:59},{x:67,y:82},{x:62,y:91},{x:46,y:103},{x:30,y:91},{x:25,y:82},{x:23,y:59}]) || polygon([{x:63,y:39},{x:80,y:39},{x:109,y:33},{x:116,y:33},{x:118,y:39},{x:117,y:47},{x:109,y:53},{x:82,y:51},{x:64,y:52}]);
    case "whisks": return ellipse(60,51,38,34) || rect(50,74,68,127);
    case "spatulas": return polygon([{x:36,y:26},{x:60,y:18},{x:84,y:27},{x:77,y:77},{x:62,y:88},{x:45,y:77}]) || rect(57,65,74,125);
    case "graters": return polygon([{x:34,y:25},{x:82,y:25},{x:89,y:34},{x:82,y:111},{x:73,y:119},{x:38,y:119},{x:31,y:110},{x:25,y:35}]) || polygon([{x:43,y:17},{x:60,y:8},{x:76,y:17},{x:74,y:28},{x:45,y:28}]);
    case "kitchen-scales": return polygon([{x:20,y:65},{x:28,y:59},{x:92,y:59},{x:100,y:67},{x:94,y:111},{x:85,y:118},{x:35,y:118},{x:26,y:111}]) || polygon([{x:23,y:56},{x:60,y:42},{x:97,y:56},{x:91,y:65},{x:29,y:65}]);
    default: return ellipse(60,72,43,48);
  }
}

function inSurface(x: number, y: number, shape: WashShape, itemId?: string, equippedKnife?: KnifeDefinition) {
  if (shape === "plate") {
    const nx = (x - PLATE.x) / (PLATE.rx - 7);
    const ny = (y - PLATE.y) / (PLATE.ry - 7);
    return nx * nx + ny * ny <= 0.96;
  }
  if (shape === "small-plate" || shape === "bowl") {
    const rx = shape === "small-plate" ? 63 : 60;
    const ry = shape === "small-plate" ? 44 : 40;
    return ((x - 180) / rx) ** 2 + ((y - 165) / ry) ** 2 <= 1;
  }
  if (shape === "fork") {
    const inTines = y >= 100 && y <= 132 && [166, 173, 180, 187].some((left) => x >= left && x <= left + 5);
    const inHead = y >= 126 && y <= 151 && x >= 163 && x <= 197;
    const inHandle = y >= 145 && y <= 229 && x >= 176 && x <= 184;
    const handleEnd = ((x - 180) / 6) ** 2 + ((y - 220) / 9) ** 2 <= 1;
    return inTines || inHead || inHandle || handleEnd;
  }
  if (shape === "knife") {
    const bladeHalfWidth = y < 147
      ? 3 + Math.max(0, y - 100) * (11 / 47)
      : y < 157
        ? 14 + (y - 147) * 0.2
        : Math.max(8, 16 - (y - 157) * 1.3);
    const inBlade = y >= 100 && y <= 163 && Math.abs(x - 180) <= bladeHalfWidth;
    const inHandle = y >= 160 && y <= 228 && x >= 174 && x <= 186;
    const handleEnd = ((x - 180) / 7) ** 2 + ((y - 222) / 8) ** 2 <= 1;
    return inBlade || inHandle || handleEnd;
  }
  if (shape === "spoon") {
    const spoonBowl = ((x - 180) / 14) ** 2 + ((y - 117) / 17) ** 2 <= 1;
    const handle = y >= 130 && y <= 222 && x >= 176 && x <= 184;
    const handleEnd = ((x - 180) / 5) ** 2 + ((y - 221) / 8) ** 2 <= 1;
    return spoonBowl || handle || handleEnd;
  }
  if (shape === "glass") {
    const rim = y >= 103 && y <= 117 && x >= 157 && x <= 203;
    const bodyHalfWidth = 22 - Math.max(0, y - 112) * 0.055;
    const body = y >= 112 && y <= 207 && Math.abs(x - 180) <= bodyHalfWidth;
    const base = y >= 205 && y <= 219 && x >= 163 && x <= 197;
    return rim || body || base;
  }
  if (shape === "cup-set") {
    const cup = y >= 128 && y <= 178 && x >= 150 && x <= 210;
    const handle = ((x - 211) / 12) ** 2 + ((y - 145) / 18) ** 2 <= 1 && x >= 205;
    const saucer = ((x - 180) / 46) ** 2 + ((y - 194) / 13) ** 2 <= 1;
    return cup || handle || saucer;
  }
  if (shape === "kitchen-food" || shape === "kitchen-wipe") return inKitchenToolSurface(x, y, itemId, equippedKnife);
  const jugBody = y >= 110 && y <= 207 && x >= 148 && x <= 209;
  const jugNeck = y >= 101 && y <= 126 && x >= 163 && x <= 197;
  const jugHandle = ((x - 211) / 13) ** 2 + ((y - 157) / 25) ** 2 <= 1 && x >= 205;
  if (shape === "jug") return jugBody || jugNeck || jugHandle;
  const leftShaker = y >= 128 && y <= 190 && x >= 148 && x <= 174;
  const leftCap = y >= 117 && y <= 134 && x >= 153 && x <= 170;
  const rightShaker = y >= 128 && y <= 190 && x >= 186 && x <= 212;
  const rightCap = y >= 117 && y <= 134 && x >= 190 && x <= 207;
  return leftShaker || leftCap || rightShaker || rightCap;
}

function dirtSamplesFor(shape: WashShape, itemId?: string, equippedKnife?: KnifeDefinition): DirtSample[] {
  // A stable pattern makes every reset consistent and progress depend on
  // unique dirty spots rather than pointer distance or repeated strokes.
  const points: DirtSample[] = [];
  let index = 0;
  const isCuttingBoard = itemId === "cutting-board";
  const bounds = isCuttingBoard
    ? { minX: 84, maxX: 278, minY: 80, maxY: 213, step: 13 }
    : itemId && (shape === "kitchen-food" || shape === "kitchen-wipe")
    ? { minX: 70, maxX: 290, minY: 35, maxY: 245, step: itemId === "chef-knife" ? 8 : 4 }
    : shape === "plate"
    ? { minX: 88, maxX: 272, minY: 96, maxY: 236, step: 9 }
    : shape === "small-plate"
      ? { minX: 110, maxX: 250, minY: 115, maxY: 215, step: 6 }
      : shape === "bowl"
        ? { minX: 100, maxX: 260, minY: 105, maxY: 225, step: 6 }
        : shape === "fork" || shape === "knife" || shape === "spoon"
          ? { minX: 158, maxX: 202, minY: 96, maxY: 236, step: 4 }
          : shape === "glass"
            ? { minX: 145, maxX: 215, minY: 95, maxY: 230, step: 5 }
            : shape === "cup-set"
              ? { minX: 130, maxX: 230, minY: 100, maxY: 215, step: 5 }
              : shape === "jug"
                ? { minX: 135, maxX: 225, minY: 90, maxY: 230, step: 5 }
                : shape === "shakers"
                  ? { minX: 140, maxX: 220, minY: 112, maxY: 200, step: 4 }
                  : { minX: 115, maxX: 245, minY: 88, maxY: 230, step: 5 };
  for (let y = bounds.minY; y <= bounds.maxY; y += bounds.step) {
    const row = Math.round((y - bounds.minY) / bounds.step);
    const rowOffset = isCuttingBoard && row % 2 ? bounds.step / 2 : 0;
    for (let x = bounds.minX + rowOffset; x <= bounds.maxX; x += bounds.step) {
      const seed = Math.abs(Math.sin((index + 1) * 78.233) * 43758.5453) % 1;
      const pointX = isCuttingBoard ? x + (seed - 0.5) * 2.4 : x;
      const pointY = isCuttingBoard ? y + (Math.abs(Math.sin((index + 1) * 19.19)) - 0.5) * 2.4 : y;
      if (!inSurface(pointX, pointY, shape, itemId, equippedKnife)) {
        index += 1;
        continue;
      }
      if (isCuttingBoard || seed > (shape === "plate" ? 0.2 : 0.28)) {
        const residueColors = shape === "glass" || shape === "jug"
          ? ["#e7f4ef", "#b9d8d3", "#d3e6e2"]
          : shape === "shakers"
            ? ["#f0eadb", "#ddd6c5", "#ece2c8"]
            : shape === "kitchen-wipe"
              ? ["#d4d8d2", "#b8beb7", "#ebece8"]
            : shape === "cup-set"
              ? ["#9a582e", "#b4713c", "#754326"]
              : ["#c44824", "#df7730", "#d9ad43", "#963c25"];
        points.push({
          x: pointX,
          y: pointY,
          dirty: true,
          color: residueColors[Math.floor(seed * residueColors.length)]!,
          radius: isCuttingBoard ? 1.25 + seed * 1.35 : 1.3 + seed * 1.9,
          seed,
        });
      }
      index += 1;
    }
  }
  return points;
}

function drawSoapBubbles(ctx: CanvasRenderingContext2D, samples: DirtSample[]) {
  if (samples.length === 0) return;
  const bubbleCount = Math.min(34, Math.max(14, Math.round(samples.length / 6)));
  const stride = Math.max(1, Math.floor(samples.length / bubbleCount));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0, bubble = 0; i < samples.length && bubble < bubbleCount; i += stride, bubble += 1) {
    const point = samples[i]!;
    const radius = 2.2 + point.seed * 2.2;
    ctx.globalAlpha = 0.48 + point.seed * 0.28;
    ctx.fillStyle = "rgba(190, 231, 239, .18)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(246, 255, 255, .9)";
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(255, 255, 255, .96)";
    ctx.beginPath();
    ctx.arc(point.x - radius * 0.32, point.y - radius * 0.34, Math.max(0.65, radius * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const DIRT_SAMPLES: Record<WashShape, DirtSample[]> = {
  plate: dirtSamplesFor("plate"),
  "small-plate": dirtSamplesFor("small-plate"),
  bowl: dirtSamplesFor("bowl"),
  fork: dirtSamplesFor("fork"),
  knife: dirtSamplesFor("knife"),
  spoon: dirtSamplesFor("spoon"),
  glass: dirtSamplesFor("glass"),
  "cup-set": dirtSamplesFor("cup-set"),
  jug: dirtSamplesFor("jug"),
  shakers: dirtSamplesFor("shakers"),
  "kitchen-food": dirtSamplesFor("kitchen-food"),
  "kitchen-wipe": dirtSamplesFor("kitchen-wipe"),
};

const KITCHEN_TOOL_DIRT_SAMPLES: Record<string, DirtSample[]> = Object.fromEntries(
  KITCHEN_TOOL_ITEMS.map((item) => [item.id, dirtSamplesFor(item.shape, item.id)]),
);

function clipSurface(ctx: CanvasRenderingContext2D, shape: WashShape, itemId?: string, equippedKnife?: KnifeDefinition) {
  ctx.beginPath();
  if (shape === "kitchen-food" || shape === "kitchen-wipe") {
    if (itemId === "chef-knife") {
      if (equippedKnife) {
        const blade = knifeSteelPolygon(equippedKnife);
        ctx.moveTo(blade[0]!.x, blade[0]!.y);
        for (const point of blade.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.closePath();
      }
      ctx.clip();
      return;
    }
    if (itemId === "cutting-board") {
      ctx.moveTo(95, 79);
      ctx.lineTo(265, 79);
      ctx.lineTo(279, 214);
      ctx.lineTo(81, 214);
      ctx.closePath();
      ctx.clip();
      return;
    }
    const frame = kitchenToolFrame(itemId ?? "");
    const transform = ctx.getTransform();
    const scaleX = frame.frameWidth / 120;
    const scaleY = frame.frameHeight / 140;
    ctx.setTransform(transform.a * scaleX, transform.b * scaleX, transform.c * scaleY, transform.d * scaleY, transform.e + transform.a * frame.x, transform.f + transform.d * frame.y);
    if (frame.horizontal) {
      ctx.translate(60, 70);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-60, -70);
    }
    const p = (x: number, y: number) => ({ x, y });
    const poly = (points: Point[]) => {
      ctx.moveTo(points[0]!.x, points[0]!.y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.closePath();
    };
    switch (itemId) {
      case "chef-knife": poly([p(57,12),p(78,11),p(88,35),p(68,72),p(55,68)]); poly([p(55,66),p(70,72),p(68,113),p(60,122),p(49,115),p(43,109)]); break;
      case "cutting-board": ctx.roundRect(22,17,76,104,10); break;
      case "peelers": poly([p(57,48),p(67,44),p(77,103),p(77,116),p(66,120),p(52,109)]); poly([p(30,30),p(60,17),p(90,30),p(87,43),p(33,44)]); break;
      case "mixing-bowls": ctx.ellipse(60,82,44,42,0,0,Math.PI*2); ctx.ellipse(60,50,44,11,0,0,Math.PI*2); break;
      case "measuring-cups": ctx.roundRect(17,32,35,58,5); ctx.roundRect(61,20,37,58,5); break;
      case "sheet-pans": ctx.roundRect(23,45,74,50,7); break;
      case "oven-mitts": poly([p(40,116),p(27,102),p(24,64),p(30,55),p(37,63),p(37,32),p(44,23),p(51,32),p(51,25),p(59,17),p(67,26),p(67,31),p(74,24),p(81,34),p(79,58),p(93,56),p(94,69),p(85,101),p(64,122)]); break;
      case "frying-pans": ctx.ellipse(45,48,30,20,0,0,Math.PI*2); poly([p(15,48),p(75,48),p(75,57),p(67,70),p(45,82),p(23,70),p(15,57)]); poly([p(62,44),p(81,41),p(108,37),p(115,37),p(117,43),p(116,49),p(109,55),p(82,53),p(63,53)]); break;
      case "saute-pans": ctx.ellipse(45,48,31,20,0,0,Math.PI*2); poly([p(14,48),p(76,48),p(78,62),p(68,84),p(45,98),p(22,84),p(13,62)]); poly([p(62,44),p(81,41),p(108,37),p(115,37),p(117,43),p(116,49),p(109,55),p(82,53),p(63,53)]); break;
      case "tongs":
        poly([p(22,33),p(18,24),p(22,16),p(31,11),p(42,15),p(52,24),p(52,34),p(44,43),p(34,46)]);
        poly([p(42,40),p(51,39),p(62,103),p(63,109),p(58,115),p(52,111),p(49,105)]);
        poly([p(79,53),p(74,46),p(77,37),p(84,29),p(95,24),p(106,26),p(114,34),p(116,43),p(108,53),p(98,59),p(87,58)]);
        poly([p(77,43),p(86,45),p(71,107),p(68,114),p(62,115),p(60,108)]);
        break;
      case "skimmers": ctx.ellipse(51,44,30,31,0,0,Math.PI*2); ctx.roundRect(56,60,22,68,7); break;
      case "stock-pot": ctx.roundRect(27,47,66,70,10); ctx.roundRect(10,55,23,23,7); ctx.roundRect(87,55,23,23,7); poly([p(20,46),p(60,29),p(100,46),p(96,55),p(24,55)]); break;
      case "ladles": ctx.ellipse(45,24,22,15.5,0,0,Math.PI*2); poly([p(52,38),p(72,119),p(75,127),p(82,124),p(88,121),p(84,114),p(61,34)]); break;
      case "storage-containers": ctx.roundRect(18,39,84,79,7); break;
      case "thermometers": ctx.roundRect(44,17,32,56,13); ctx.roundRect(55,66,15,60,6); break;
      case "saucepans": ctx.ellipse(46,42,22,16,0,0,Math.PI*2); poly([p(24,42),p(68,42),p(69,59),p(67,82),p(62,91),p(46,103),p(30,91),p(25,82),p(23,59)]); poly([p(63,39),p(80,39),p(109,33),p(116,33),p(118,39),p(117,47),p(109,53),p(82,51),p(64,52)]); break;
      case "whisks": ctx.ellipse(60,51,38,34,0,0,Math.PI*2); ctx.roundRect(50,74,18,53,7); break;
      case "spatulas": poly([p(36,26),p(60,18),p(84,27),p(77,77),p(62,88),p(45,77)]); ctx.roundRect(57,65,17,60,5); break;
      case "graters": poly([p(34,25),p(82,25),p(89,34),p(82,111),p(73,119),p(38,119),p(31,110),p(25,35)]); poly([p(43,17),p(60,8),p(76,17),p(74,28),p(45,28)]); break;
      case "kitchen-scales": poly([p(20,65),p(28,59),p(92,59),p(100,67),p(94,111),p(85,118),p(35,118),p(26,111)]); poly([p(23,56),p(60,42),p(97,56),p(91,65),p(29,65)]); break;
      default: ctx.ellipse(60,72,43,48,0,0,Math.PI*2);
    }
    ctx.clip();
    ctx.setTransform(transform);
    return;
  } else if (shape === "plate") {
    ctx.ellipse(PLATE.x, PLATE.y, PLATE.rx - 5, PLATE.ry - 5, 0, 0, Math.PI * 2);
  } else if (shape === "small-plate") {
    ctx.ellipse(180, 165, 63, 44, 0, 0, Math.PI * 2);
  } else if (shape === "bowl") {
    ctx.ellipse(180, 165, 60, 40, 0, 0, Math.PI * 2);
  } else if (shape === "fork") {
    ctx.roundRect(166, 99, 5, 35, 2);
    ctx.roundRect(173, 99, 5, 35, 2);
    ctx.roundRect(180, 99, 5, 35, 2);
    ctx.roundRect(187, 99, 5, 35, 2);
    ctx.roundRect(163, 126, 34, 24, 8);
    ctx.roundRect(176, 143, 8, 78, 4);
    ctx.ellipse(180, 220, 6, 8, 0, 0, Math.PI * 2);
  } else if (shape === "knife") {
    ctx.moveTo(178, 100);
    ctx.quadraticCurveTo(180, 96, 183, 102);
    ctx.lineTo(194, 147);
    ctx.quadraticCurveTo(196, 157, 188, 163);
    ctx.lineTo(187, 220);
    ctx.quadraticCurveTo(180, 232, 173, 220);
    ctx.lineTo(172, 163);
    ctx.quadraticCurveTo(164, 157, 166, 147);
    ctx.closePath();
  } else if (shape === "spoon") {
    ctx.ellipse(180, 117, 14, 17, 0, 0, Math.PI * 2);
    ctx.roundRect(176, 130, 8, 92, 4);
    ctx.ellipse(180, 221, 5, 8, 0, 0, Math.PI * 2);
  } else if (shape === "glass") {
    ctx.ellipse(180, 111, 22, 7, 0, 0, Math.PI * 2);
    ctx.moveTo(158, 112);
    ctx.lineTo(165, 204);
    ctx.quadraticCurveTo(180, 213, 195, 204);
    ctx.lineTo(202, 112);
    ctx.closePath();
    ctx.roundRect(163, 207, 34, 8, 4);
  } else if (shape === "cup-set") {
    ctx.ellipse(180, 194, 46, 13, 0, 0, Math.PI * 2);
    ctx.roundRect(150, 117, 60, 66, 8);
    ctx.ellipse(211, 148, 12, 18, 0, 0, Math.PI * 2);
  } else if (shape === "jug") {
    ctx.roundRect(148, 119, 61, 101, 12);
    ctx.roundRect(163, 101, 34, 22, 4);
    ctx.ellipse(212, 158, 14, 26, 0, 0, Math.PI * 2);
  } else if (shape === "shakers") {
    ctx.roundRect(148, 128, 26, 62, 8);
    ctx.roundRect(153, 117, 17, 17, 3);
    ctx.roundRect(186, 128, 26, 62, 8);
    ctx.roundRect(190, 117, 17, 17, 3);
  } else {
    ctx.ellipse(180, 158, 62, 67, 0, 0, Math.PI * 2);
  }
  ctx.clip();
}

function drawDirt(canvas: HTMLCanvasElement, shape: WashShape, itemId?: string, equippedKnife?: KnifeDefinition) {
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(WIDTH * ratio);
  canvas.height = Math.round(HEIGHT * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  clipSurface(ctx, shape, itemId, equippedKnife);
  const samples = itemId === "chef-knife" && equippedKnife
    ? dirtSamplesFor(shape, itemId, equippedKnife)
    : itemId && (shape === "kitchen-food" || shape === "kitchen-wipe")
      ? KITCHEN_TOOL_DIRT_SAMPLES[itemId] ?? []
      : DIRT_SAMPLES[shape];

  // Give each material the residue it would realistically collect. The marks
  // stay on this clipped canvas, so the sponge removes every type consistently.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const foodSoiled = shape === "plate" || shape === "small-plate" || shape === "bowl"
    || shape === "fork" || shape === "knife" || shape === "spoon" || shape === "kitchen-food";
  if (shape === "plate" || shape === "small-plate" || shape === "bowl") {
    ctx.strokeStyle = "rgba(196, 63, 28, .78)";
    ctx.lineWidth = shape === "plate" ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(109, 150);
    ctx.bezierCurveTo(125, 126, 148, 123, 164, 139);
    ctx.bezierCurveTo(177, 153, 192, 162, 211, 150);
    ctx.stroke();
    ctx.strokeStyle = "rgba(225, 128, 43, .76)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(131, 183);
    ctx.bezierCurveTo(150, 171, 162, 175, 179, 184);
    ctx.bezierCurveTo(197, 194, 216, 188, 228, 174);
    ctx.stroke();
    ctx.strokeStyle = "rgba(218, 163, 50, .72)";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(122, 165);
    ctx.quadraticCurveTo(151, 147, 181, 158);
    ctx.stroke();
  } else if (itemId === "chef-knife" && equippedKnife) {
    const blade = knifeSteelPolygon(equippedKnife);
    const minX = Math.min(...blade.map((point) => point.x));
    const maxX = Math.max(...blade.map((point) => point.x));
    const minY = Math.min(...blade.map((point) => point.y));
    const maxY = Math.max(...blade.map((point) => point.y));
    const centerY = (minY + maxY) / 2;
    ctx.strokeStyle = "rgba(196, 63, 28, .58)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(minX + (maxX - minX) * 0.24, centerY + (maxY - minY) * 0.12);
    ctx.quadraticCurveTo(
      minX + (maxX - minX) * 0.48,
      centerY - (maxY - minY) * 0.22,
      minX + (maxX - minX) * 0.72,
      centerY - (maxY - minY) * 0.08,
    );
    ctx.stroke();
    ctx.strokeStyle = "rgba(224, 132, 47, .48)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(minX + (maxX - minX) * 0.38, centerY + (maxY - minY) * 0.28);
    ctx.quadraticCurveTo(
      minX + (maxX - minX) * 0.57,
      centerY + (maxY - minY) * 0.05,
      minX + (maxX - minX) * 0.81,
      centerY + (maxY - minY) * 0.16,
    );
    ctx.stroke();
  } else if (itemId === "cutting-board") {
    // Distribute a few light sauce and prep smears across the board instead
    // of concentrating the visible residue in one central stripe.
    const smears = [
      [104, 108, 139, 100, 165, 112, "rgba(196, 63, 28, .58)", 2.2],
      [190, 104, 218, 116, 253, 101, "rgba(225, 128, 43, .55)", 1.8],
      [96, 145, 128, 132, 151, 149, "rgba(218, 163, 50, .58)", 2.1],
      [164, 137, 203, 126, 236, 145, "rgba(150, 60, 37, .48)", 2],
      [104, 183, 134, 169, 160, 185, "rgba(225, 128, 43, .56)", 2.2],
      [176, 183, 211, 169, 252, 187, "rgba(196, 63, 28, .52)", 2],
    ] as const;
    for (const [x1, y1, cx, cy, x2, y2, color, width] of smears) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();
    }
  } else if (foodSoiled) {
    ctx.strokeStyle = "rgba(196, 63, 28, .72)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(176, 126);
    ctx.bezierCurveTo(184, 140, 176, 151, 183, 164);
    ctx.bezierCurveTo(188, 174, 177, 184, 184, 198);
    ctx.stroke();
    ctx.strokeStyle = "rgba(225, 128, 43, .7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(184, 143);
    ctx.quadraticCurveTo(178, 157, 183, 169);
    ctx.stroke();
  } else if (shape === "cup-set") {
    // A light coffee / tea ring inside the cup, with a small run down the bowl.
    ctx.strokeStyle = "rgba(128, 72, 36, .7)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(180, 132, 19, 4, 0, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    ctx.strokeStyle = "rgba(159, 100, 53, .56)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(166, 136);
    ctx.quadraticCurveTo(169, 148, 166, 155);
    ctx.stroke();
  } else if (shape === "glass" || shape === "jug") {
    // Clear drinkware gets water spots and drying streaks, never food splatter.
    ctx.strokeStyle = "rgba(237, 250, 246, .82)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(170, 126);
    ctx.quadraticCurveTo(175, 150, 171, 168);
    ctx.moveTo(188, 151);
    ctx.quadraticCurveTo(185, 166, 188, 179);
    ctx.stroke();
    ctx.strokeStyle = "rgba(181, 215, 208, .78)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(181, 189, 5, 3, 0.2, 0, Math.PI * 2);
    ctx.ellipse(192, 134, 3.3, 2.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === "shakers") {
    // Seasoning jars get light handling smudges and a little salt dust.
    ctx.strokeStyle = "rgba(118, 105, 83, .34)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(161, 159, 7, 13, -0.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.ellipse(199, 159, 7, 13, 0.2, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = "rgba(250, 245, 224, .92)";
    for (const [x, y] of [[158, 178], [165, 183], [195, 177], [202, 182]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Mitts, probes, and scales are sanitized / wiped; keep this residue light.
    ctx.strokeStyle = "rgba(104, 110, 101, .44)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(163, 153, 10, 15, -0.25, Math.PI * 1.08, Math.PI * 1.9);
    ctx.ellipse(196, 173, 12, 8, 0.12, Math.PI * 1.1, Math.PI * 1.85);
    ctx.stroke();
  }
  for (const point of samples) {
    ctx.globalAlpha = 0.58 + point.seed * 0.32;
    ctx.fillStyle = point.color;
    ctx.beginPath();
    ctx.ellipse(
      point.x,
      point.y,
      point.radius,
      point.radius * (0.56 + point.seed * 0.3),
      point.seed * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  if (foodSoiled) {
    // Tiny herb flecks and sauce drops are restricted to items used for food.
    ctx.globalAlpha = 0.9;
    for (const [x, y, rotation] of [[143, 142, -0.4], [211, 178, 0.6], [173, 193, -0.2]] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = "#66813d";
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.4, 1.3, 0, 0, Math.PI * 2);
      ctx.ellipse(2.8, 1.8, 2.4, 1, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const [x, y, rx, ry] of [[119, 166, 4, 2.3], [232, 148, 3.5, 2], [194, 202, 3, 1.8]] as const) {
      ctx.fillStyle = "rgba(190, 54, 24, .88)";
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawSoapBubbles(ctx, samples);
  ctx.restore();
}

function distanceToSegmentSquared(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (!length) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length));
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return (point.x - x) ** 2 + (point.y - y) ** 2;
}

function positionFromEvent(event: PointerEvent<HTMLElement>, surface: HTMLElement): Point {
  const rect = surface.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

export function DishwashingPrototype({
  onClose,
  reducedMotion = false,
  closingDue = false,
  startAtKitchenTools = false,
  equippedKnife,
  equippedBoard,
}: {
  onClose: () => void;
  reducedMotion?: boolean;
  closingDue?: boolean;
  startAtKitchenTools?: boolean;
  equippedKnife: KnifeDefinition;
  equippedBoard: BoardDefinition;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardArtRef = useRef<HTMLCanvasElement>(null);
  const spongeRef = useRef<HTMLSpanElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressValueRef = useRef<HTMLSpanElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const cleanedSamplesRef = useRef(new Set<number>());
  const progressRef = useRef(0);
  const completedRef = useRef(false);
  const surfaceFinishedRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hasStartedWashing, setHasStartedWashing] = useState(false);
  const [itemFinished, setItemFinished] = useState(false);
  const [complete, setComplete] = useState(false);
  const initialItemIndex = startAtKitchenTools ? KITCHEN_TOOL_START_INDEX : 0;
  const [activeItemIndex, setActiveItemIndex] = useState(initialItemIndex);
  const [cleanedCount, setCleanedCount] = useState(initialItemIndex);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const activeWashItems = closingDue || startAtKitchenTools ? WASH_ITEMS : TABLEWARE_ITEMS;
  const activeItem = activeWashItems[activeItemIndex]!;
  const spongeSize = activeItemIndex >= KITCHEN_TOOL_START_INDEX ? 54 : 72;
  const afterClosing = (closingDue || startAtKitchenTools) && activeItemIndex >= KITCHEN_TOOL_START_INDEX;
  const activeSectionItems = afterClosing ? KITCHEN_TOOL_ITEMS : TABLEWARE_ITEMS;
  const activeSectionOffset = afterClosing ? KITCHEN_TOOL_START_INDEX : 0;
  const cleanedInSection = afterClosing
    ? Math.max(0, cleanedCount - KITCHEN_TOOL_START_INDEX)
    : Math.min(cleanedCount, KITCHEN_TOOL_START_INDEX);

  const updateProgress = useCallback((value: number) => {
    if (progressRef.current === value) return;
    progressRef.current = value;
    if (progressFillRef.current) progressFillRef.current.style.width = `${value}%`;
    if (progressValueRef.current) progressValueRef.current.textContent = `${value}%`;
    progressBarRef.current?.setAttribute("aria-valuenow", String(value));
    progressBarRef.current?.setAttribute("aria-label", `${value}% ${activeItem.label.toLowerCase()} clean`);
  }, [activeItem.label]);

  useEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>("[data-game-content]"));
  }, []);

  useEffect(() => {
    if (activeItem.id !== "cutting-board" || !boardArtRef.current) return;
    const boardCanvas = boardArtRef.current;
    boardCanvas.width = BOARD_ART_WIDTH;
    boardCanvas.height = BOARD_ART_HEIGHT;
    const ctx = boardCanvas.getContext("2d");
    if (!ctx) return;
    paintBoardTexture(
      ctx,
      BOARD_ART_WIDTH,
      BOARD_ART_HEIGHT,
      equippedBoard.visual.tone,
      equippedBoard.visual.pattern,
      equippedBoard.visual.accent,
    );
  }, [activeItem.id, equippedBoard]);

  useEffect(() => {
    if (!portalTarget || !canvasRef.current) return;
    drawDirt(canvasRef.current, activeItem.shape, activeItem.id, equippedKnife);
    cleanedSamplesRef.current = new Set();
    surfaceFinishedRef.current = false;
    updateProgress(0);
    setItemFinished(false);
    setScrubbing(false);
    if (spongeRef.current) {
      spongeRef.current.style.left = activeItem.shape === "plate" ? "68%" : "50%";
      spongeRef.current.style.top = activeItem.shape === "plate" ? "64%" : "59%";
      spongeRef.current.style.opacity = "1";
    }
  }, [portalTarget, activeItemIndex, activeItem.shape, activeItem.id, closingDue, equippedKnife, updateProgress]);

  useEffect(() => () => {
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
  }, []);

  function moveSponge(point: Point) {
    const sponge = spongeRef.current;
    if (!sponge) return;
    sponge.style.left = `${(point.x / WIDTH) * 100}%`;
    sponge.style.top = `${(point.y / HEIGHT) * 100}%`;
    sponge.style.opacity = "1";
  }

  function eraseAlong(start: Point, end: Point) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const brushRadius = activeItem.shape === "plate" ? BRUSH_RADIUS : 18;
    ctx.save();
    clipSurface(ctx, activeItem.shape, activeItem.id, equippedKnife);
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushRadius * 2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(end.x, end.y, brushRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function scrubSegment(start: Point, end: Point) {
    eraseAlong(start, end);
    const brushRadius = activeItem.shape === "plate" ? BRUSH_RADIUS : 18;
    const radiusSquared = brushRadius * brushRadius;
    const samples = activeItem.id === "chef-knife"
      ? dirtSamplesFor(activeItem.shape, activeItem.id, equippedKnife)
      : activeItem.shape === "kitchen-food" || activeItem.shape === "kitchen-wipe"
        ? KITCHEN_TOOL_DIRT_SAMPLES[activeItem.id]!
      : DIRT_SAMPLES[activeItem.shape];
    for (let i = 0; i < samples.length; i += 1) {
      if (cleanedSamplesRef.current.has(i)) continue;
      const sample = samples[i]!;
      if (distanceToSegmentSquared(sample, start, end) <= radiusSquared) {
        cleanedSamplesRef.current.add(i);
      }
    }
    const next = cleanedSamplesRef.current.size / samples.length;
    const pct = Math.min(100, Math.floor(next * 100));
    updateProgress(pct);
    if (next >= CLEAN_THRESHOLD && !surfaceFinishedRef.current && !completedRef.current) {
      surfaceFinishedRef.current = true;
      updateProgress(100);
      setCleanedCount(activeItemIndex + 1);
      setItemFinished(true);
      AudioManager.playSfx("levelComplete");
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, WIDTH, HEIGHT);
      if (activeItemIndex === activeWashItems.length - 1) {
        completedRef.current = true;
        setComplete(true);
      } else {
        advanceTimerRef.current = window.setTimeout(
          () => {
            advanceTimerRef.current = null;
            activePointerRef.current = null;
            lastPointRef.current = null;
            setScrubbing(false);
            setActiveItemIndex((index) => Math.min(index + 1, activeWashItems.length - 1));
          },
          ITEM_CHANGE_DELAY_MS,
        );
      }
    }
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (completedRef.current || surfaceFinishedRef.current) return;
    const surface = canvasRef.current;
    if (!surface) return;
    const point = positionFromEvent(event, surface);
    const grabbedSponge = event.currentTarget === spongeRef.current;
    if (!grabbedSponge && !inSurface(point.x, point.y, activeItem.shape, activeItem.id, equippedKnife)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    lastPointRef.current = point;
    setHasStartedWashing(true);
    setScrubbing(true);
    moveSponge(point);
    scrubSegment(point, point);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (activePointerRef.current !== event.pointerId || completedRef.current || surfaceFinishedRef.current) return;
    event.preventDefault();
    const surface = canvasRef.current;
    if (!surface) return;
    const point = positionFromEvent(event, surface);
    moveSponge(point);
    const previous = lastPointRef.current ?? point;
    scrubSegment(previous, point);
    lastPointRef.current = point;
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    lastPointRef.current = null;
    setScrubbing(false);
  }

  function resetWash() {
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = null;
    completedRef.current = false;
    cleanedSamplesRef.current = new Set();
    activePointerRef.current = null;
    lastPointRef.current = null;
    updateProgress(0);
    setItemFinished(false);
    setComplete(false);
    setHasStartedWashing(false);
    setScrubbing(false);
    setActiveItemIndex(initialItemIndex);
    setCleanedCount(initialItemIndex);
    surfaceFinishedRef.current = false;
    if (canvasRef.current) {
      const initialItem = activeWashItems[initialItemIndex]!;
      drawDirt(canvasRef.current, initialItem.shape, initialItem.id, equippedKnife);
    }
  }

  const surfaceClipPath = activeItem.shape === "plate"
    ? "ellipse(25.6% 23.2% at 50% 58.9%)"
    : activeItem.shape === "small-plate"
      ? "ellipse(17.5% 16% at 50% 59%)"
    : activeItem.shape === "bowl"
        ? "ellipse(17% 14.5% at 50% 59%)"
        : activeItem.shape === "fork" || activeItem.shape === "knife" || activeItem.shape === "spoon"
          ? "ellipse(8% 26% at 50% 59%)"
          : activeItem.shape === "glass"
            ? "ellipse(11% 23% at 50% 58%)"
            : activeItem.shape === "cup-set"
              ? "ellipse(16% 22% at 50% 59%)"
              : activeItem.shape === "kitchen-food" || activeItem.shape === "kitchen-wipe"
                ? activeItem.id === "chef-knife"
                  ? "inset(39% 27% 34% 27%)"
                  : activeItem.id === "cutting-board"
                    ? "polygon(26.4% 28.2%, 73.6% 28.2%, 77.5% 76.4%, 22.5% 76.4%)"
                    : (() => {
                        const frame = kitchenToolFrame(activeItem.id);
                        const top = frame.y / HEIGHT * 100;
                        const left = frame.x / WIDTH * 100;
                        const right = 100 - (frame.x + frame.frameWidth) / WIDTH * 100;
                        const bottom = 100 - (frame.y + frame.frameHeight) / HEIGHT * 100;
                        return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
                      })()
                : activeItem.shape === "jug"
                ? "ellipse(14% 25% at 50% 57%)"
                : "ellipse(9% 15% at 50% 55%)";
  const visualFrame = activeItem.id === "chef-knife" || activeItem.id === "cutting-board"
    ? null
    : activeItem.shape === "kitchen-food" || activeItem.shape === "kitchen-wipe"
      ? kitchenToolFrame(activeItem.id)
      : WASH_VISUAL_FRAMES[activeItem.shape];

  const modal = (
    <div
      className="absolute inset-0 z-[110] flex items-center justify-center p-3"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        padding: 12,
        backgroundColor: "rgba(39, 24, 15, .76)",
        backdropFilter: "blur(6px)",
      }}
    >
      <section
        aria-label="Dishwashing prototype"
        aria-modal="true"
        className="overflow-y-auto rounded-[28px] border border-walnut/20 shadow-lift"
        data-testid="dishwashing-prototype"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        role="dialog"
        style={{
          boxSizing: "border-box",
          width: "min(420px, 100%)",
          maxHeight: "calc(100% - 24px)",
          background: "linear-gradient(165deg, #fff8e9, #f1dfbd)",
          padding: 16,
          color: "#432a1b",
          border: "1px solid #d6b16c",
          boxShadow: "0 18px 56px rgba(12, 7, 4, .58), inset 0 0 0 4px rgba(255,255,255,.46)",
        }}
      >
        <header className="flex items-start gap-3">
          <span aria-hidden="true" style={{ fontSize: 25, lineHeight: 1.1 }}>👨‍🍳</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[21px] font-black leading-tight text-walnut-dark">
              {startAtKitchenTools ? "Chef’s tools wash-up" : afterClosing ? "Kitchen closing clean-up" : "Dishwashing"}
            </p>
            <p className="mt-1 font-hand text-[15px] text-walnut/70">
              {afterClosing
                ? startAtKitchenTools
                  ? "Test the after-closing wash sequence for food-prep tools."
                  : "After closing, wash or sanitize the chef’s tools."
                : "Wash each customer’s reusable tableware, one piece at a time."}
            </p>
          </div>
          <button
            aria-label="Return to Cleanliness & Maintenance"
            className="press grid min-h-12 min-w-12 place-items-center rounded-full border border-walnut/15 bg-ivory/90 font-ui text-[20px] font-black text-walnut-dark shadow-soft"
            onClick={onClose}
            style={{ background: "#fff9ec", color: "#432a1b" }}
            type="button"
          >
            ×
          </button>
        </header>

        <div
          className="mt-3 flex items-center justify-between rounded-2xl px-3 py-2"
          style={{ background: "linear-gradient(105deg, #2b170e, #4a2916 52%, #25150d)", border: "1px solid #9a6b32", boxShadow: "inset 0 1px 0 rgba(255,235,185,.18)" }}
        >
          <p className="flex items-center gap-2 font-ui text-[13px] font-extrabold" style={{ color: "#fff1d2" }}>
            <span aria-hidden="true" style={{ fontSize: 23 }}>{afterClosing ? "🧰" : "🍽️"}</span>
            {afterClosing ? "Closing tools cleaned" : "Tableware cleaned"}
          </p>
          <p className="font-display text-[17px] font-black" aria-live="polite">
            <span style={{ color: "#fff1d2" }}>{cleanedInSection} / {activeSectionItems.length}</span>
          </p>
        </div>

        <ol
          aria-label={afterClosing ? "After-closing kitchen tool wash order" : "Reusable tableware wash order"}
          className={`mt-2 grid gap-1.5 ${afterClosing ? "grid-cols-4" : "grid-cols-3"}`}
        >
          {activeSectionItems.map((item, localIndex) => {
            const index = activeSectionOffset + localIndex;
            const done = index < cleanedCount;
            const current = index === activeItemIndex && !complete;
            return (
              <li
                key={item.id}
                aria-current={current ? "step" : undefined}
                className={`min-w-0 rounded-xl px-1.5 py-1.5 text-center font-ui ${afterClosing ? "text-[10px]" : "text-[11px]"} font-bold`}
                style={{
                  color: done ? "#fff8e8" : "#684727",
                  background: done ? "#718568" : current ? "#f3d99c" : "rgba(255,255,255,.48)",
                  border: current ? "1px solid #b47b32" : "1px solid rgba(126,83,43,.18)",
                }}
              >
                <span aria-hidden="true">{done ? "✓" : current ? "●" : "○"}</span>
                <span className="block truncate">{item.label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-3 rounded-[24px] border border-[#c08b43] p-2 shadow-inner" style={{ background: "linear-gradient(145deg, #5b341d, #211710)", boxShadow: "inset 0 1px 8px rgba(255,230,177,.22), 0 7px 18px rgba(56,31,16,.25)" }}>
          <div
            className="relative mx-auto w-full overflow-hidden rounded-[22px]"
            style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, maxWidth: WIDTH }}
          >
            <img
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full select-none"
              draggable={false}
              src={afterClosing ? "/dishwashing/premium-sink-night.png" : "/dishwashing/premium-sink.png"}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />

            {activeItem.id === "cutting-board" ? (
              <canvas
                ref={boardArtRef}
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{ left: "19.72%", top: "-3.57%", width: "60.56%", height: "107.14%", filter: "drop-shadow(0 4px 4px rgba(20,12,7,.48))" }}
              />
            ) : null}
            {activeItem.id === "chef-knife" ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2"
                style={{ left: "50%", top: "52%", width: "42%", filter: "drop-shadow(1px 3px 2px rgba(40,20,8,.58))" }}
              >
                <KnifeGlyph
                  knife={equippedKnife}
                  size={180}
                  className="block h-auto w-full"
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            ) : null}

            {visualFrame && !complete ? (
              <svg
                aria-hidden="true"
                viewBox={visualFrame.viewBox}
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  left: visualFrame.left,
                  top: visualFrame.top,
                  width: visualFrame.width,
                  height: visualFrame.height,
                  filter: "drop-shadow(1px 3px 2px rgba(40,20,8,.52))",
                  pointerEvents: "none",
                }}
              >
                <defs>
                  <linearGradient id="wash-metal" x1="0" x2="1">
                    <stop stopColor="#716c62" />
                    <stop offset=".22" stopColor="#f8f3df" />
                    <stop offset=".48" stopColor="#a8a394" />
                    <stop offset=".72" stopColor="#fffbed" />
                    <stop offset="1" stopColor="#6b675f" />
                  </linearGradient>
                  <linearGradient id="wash-gold" x1="0" x2="1">
                    <stop stopColor="#8c5d1e" />
                    <stop offset=".2" stopColor="#d6a33d" />
                    <stop offset=".42" stopColor="#fff0a1" />
                    <stop offset=".6" stopColor="#bc842d" />
                    <stop offset=".82" stopColor="#f4d875" />
                    <stop offset="1" stopColor="#8a5d1e" />
                  </linearGradient>
                  <linearGradient id="wash-ceramic" x1="0" y1="0" x2=".8" y2="1">
                    <stop stopColor="#fff9e9" />
                    <stop offset=".58" stopColor="#e9dcc1" />
                    <stop offset="1" stopColor="#c8b493" />
                  </linearGradient>
                  <linearGradient id="wash-glass" x1="0" x2="1">
                    <stop stopColor="#c6e2df" stopOpacity=".28" />
                    <stop offset=".28" stopColor="#fff" stopOpacity=".8" />
                    <stop offset=".58" stopColor="#91c1bd" stopOpacity=".24" />
                    <stop offset=".86" stopColor="#fff" stopOpacity=".76" />
                    <stop offset="1" stopColor="#9ecac6" stopOpacity=".42" />
                  </linearGradient>
                  <linearGradient id="wash-wood" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#d8a465" />
                    <stop offset=".42" stopColor="#9a6338" />
                    <stop offset="1" stopColor="#58351f" />
                  </linearGradient>
                </defs>
                {activeItem.shape === "plate" ? (
                  <g>
                    <ellipse cx="180" cy="171" rx="99" ry="70" fill="rgba(18,13,9,.42)" />
                    <ellipse cx="180" cy="162" rx="96" ry="68" fill="#81501f" stroke="#4b301b" strokeWidth="2" />
                    <ellipse cx="180" cy="160" rx="91" ry="64" fill="url(#wash-ceramic)" stroke="#d9a74f" strokeWidth="3" />
                    <ellipse cx="180" cy="159" rx="76" ry="53" fill="#f5ead5" stroke="#fffaf0" strokeWidth="2.5" />
                    <ellipse cx="180" cy="158" rx="65" ry="43" fill="#e9dcc4" stroke="#d7bd8c" strokeWidth="2" />
                    <ellipse cx="180" cy="157" rx="59" ry="37" fill="#f6eddd" stroke="#fffaf1" strokeWidth="2" />
                    <path d="M111 153 Q120 112 159 101" fill="none" stroke="#fff" strokeOpacity=".72" strokeWidth="3" strokeLinecap="round" />
                    <path d="M203 211 Q239 201 249 177" fill="none" stroke="#fff" strokeOpacity=".56" strokeWidth="2" strokeLinecap="round" />
                  </g>
                ) : activeItem.shape === "small-plate" ? (
                  <g>
                    <ellipse cx="60" cy="45" rx={activeItem.id === "side-plates" ? 55 : 60} ry={activeItem.id === "side-plates" ? 39 : 42} fill="url(#wash-ceramic)" stroke="#a87538" strokeWidth="3" />
                    <ellipse cx="60" cy="45" rx={activeItem.id === "side-plates" ? 47 : 52} ry={activeItem.id === "side-plates" ? 31 : 34} fill="none" stroke="#fffdf4" strokeWidth="2" />
                    <ellipse cx="60" cy="45" rx={activeItem.id === "side-plates" ? 39 : 43} ry={activeItem.id === "side-plates" ? 24 : 26} fill="none" stroke="#d5b878" strokeWidth="1.5" />
                  </g>
                ) : activeItem.shape === "bowl" ? (
                  <g>
                    <path d="M8 22 Q60 16 112 22 L101 67 Q91 88 60 92 Q29 88 19 67Z" fill="url(#wash-ceramic)" stroke="#a87538" strokeWidth="3" />
                    <ellipse cx="60" cy="23" rx="52" ry="15" fill="#fff9e9" stroke="#a87538" strokeWidth="3" />
                    <ellipse cx="60" cy="24" rx="43" ry="10" fill="#d8c8a7" stroke="#fffdf4" strokeWidth="2" />
                    <path d="M24 67 Q60 83 96 67" fill="none" stroke="#fffdf4" strokeOpacity=".8" strokeWidth="3" />
                  </g>
                ) : activeItem.shape === "fork" ? (
                  <g fill="url(#wash-metal)" stroke="#716b60" strokeWidth=".8" strokeLinejoin="round">
                    {activeItem.id === "dessert-forks" ? (
                      <>
                        <rect x="7" y="2" width="6" height="31" rx="3" />
                        <rect x="17" y="2" width="6" height="31" rx="3" />
                        <rect x="27" y="2" width="6" height="31" rx="3" />
                        <path d="M7 25 H33 V30 Q33 40 20 43 Q7 40 7 30Z" />
                      </>
                    ) : (
                      <>
                        <rect x="5" y="2" width="5" height="31" rx="2.5" />
                        <rect x="13" y="2" width="5" height="31" rx="2.5" />
                        <rect x="22" y="2" width="5" height="31" rx="2.5" />
                        <rect x="30" y="2" width="5" height="31" rx="2.5" />
                        <path d="M5 25 H35 V30 Q35 40 20 43 Q5 40 5 30Z" />
                      </>
                    )}
                    <path d="M16 40 H24 V125 Q24 137 20 137 Q16 137 16 125Z" />
                  </g>
                ) : activeItem.shape === "knife" ? (
                  <g fill="url(#wash-metal)" stroke="#716b60" strokeWidth=".8" strokeLinejoin="round">
                    <path d="M20 2 C10 9 5 20 6 33 C7 43 12 49 17 51 L13 123 Q13 137 20 137 Q27 137 27 123 L23 51 C28 49 33 43 34 33 C35 20 30 9 20 2Z" />
                    {activeItem.id === "steak-knives" ? (
                      <path d="M17 52 L13 122 Q20 128 27 122 L23 52Z" fill="#8d6842" stroke="#5b3922" />
                    ) : null}
                  </g>
                ) : activeItem.shape === "spoon" ? (
                  <g fill="url(#wash-metal)" stroke="#716b60" strokeWidth="1">
                    <ellipse cx="20" cy="22" rx={activeItem.id === "soup-spoons" ? 15 : 11} ry={activeItem.id === "soup-spoons" ? 19 : 15} />
                    <path d="M17 37 H23 L24 125 Q24 137 20 137 Q16 137 16 125Z" />
                    <ellipse cx="20" cy="23" rx={activeItem.id === "soup-spoons" ? 9 : 7} ry={activeItem.id === "soup-spoons" ? 13 : 10} fill="none" stroke="#fffdf0" strokeOpacity=".7" />
                  </g>
                ) : activeItem.shape === "glass" ? (
                  <g fill="url(#wash-glass)" stroke="#9ab8b1" strokeWidth="2">
                    {activeItem.id === "highball-glasses" ? (
                      <>
                        <path d="M18 8 H82 L77 123 Q50 132 23 123Z" />
                        <ellipse cx="50" cy="8" rx="32" ry="7" fill="#f8fffb" fillOpacity=".5" />
                        <path d="M23 123 Q50 132 77 123 L79 130 Q50 140 21 130Z" />
                        <path d="M30 20 L34 111" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="4" />
                      </>
                    ) : (
                      <>
                        <path d="M12 12 H88 L80 111 Q50 124 20 111Z" />
                        <ellipse cx="50" cy="12" rx="38" ry="8" fill="#f8fffb" fillOpacity=".5" />
                        <path d="M20 113 Q50 121 80 113 L84 121 Q50 132 16 121Z" />
                        <path d="M25 25 L31 100" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="4" />
                      </>
                    )}
                  </g>
                ) : activeItem.shape === "cup-set" ? (
                  <g fill="url(#wash-ceramic)" stroke="#a87538" strokeWidth="2.5">
                    <ellipse cx="60" cy="119" rx="49" ry="14" />
                    <ellipse cx="60" cy="119" rx="39" ry="8" fill="none" stroke="#fffdf4" strokeWidth="2" />
                    <path d="M27 32 H84 L79 91 Q55 104 32 91Z" />
                    <ellipse cx="55.5" cy="32" rx="28.5" ry="8" fill="#fff9e9" />
                    <path d="M84 43 Q112 41 108 65 Q105 82 82 77" fill="none" strokeWidth="7" />
                    <path d="M36 42 V82" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="4" />
                  </g>
                ) : activeItem.shape === "jug" ? (
                  <g fill="url(#wash-glass)" stroke="#8fa99b" strokeWidth="3" strokeLinejoin="round">
                    <path d="M31 27 H89 L84 121 Q80 137 48 137 Q22 134 20 118 L17 48 Q17 38 31 37Z" />
                    <path d="M31 27 Q50 13 77 24 L89 27 L82 38 H31Z" fill="#e8d4a9" />
                    <path d="M86 47 Q114 42 113 70 Q111 95 84 91" fill="none" strokeWidth="8" />
                    <path d="M33 50 V112" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="5" />
                  </g>
                ) : activeItem.shape === "shakers" ? (
                  <g stroke="#8e7551" strokeWidth="2.5" strokeLinejoin="round">
                    <rect x="20" y="43" width="29" height="66" rx="9" fill="url(#wash-glass)" />
                    <path d="M25 43 V34 Q25 29 30 29 H39 Q44 29 44 34 V43Z" fill="url(#wash-metal)" />
                    <rect x="71" y="43" width="29" height="66" rx="9" fill="url(#wash-glass)" />
                    <path d="M76 43 V34 Q76 29 81 29 H90 Q95 29 95 34 V43Z" fill="url(#wash-metal)" />
                    <path d="M25 56 V96 M76 56 V96" fill="none" stroke="#fff" strokeOpacity=".76" strokeWidth="4" />
                    <circle cx="34.5" cy="77" r="5" fill="#f3ead3" stroke="#b39a6e" />
                    <circle cx="85.5" cy="77" r="5" fill="#a9b278" stroke="#7f8959" />
                  </g>
                ) : (
                  <g transform={visualFrame.horizontal ? "rotate(90 60 70)" : undefined}>
                    <KitchenToolIllustration itemId={activeItem.id} />
                  </g>
                )}
                {activeItem.shape === "fork" || activeItem.shape === "knife" ? (
                  <path d="M20 48 V126" fill="none" stroke="#fffdf0" strokeOpacity=".62" strokeWidth="1.2" />
                ) : null}
              </svg>
            ) : null}

            {/* The active object's clip confines touch handling, leaving the rest of the image scrollable. */}
            <canvas
              ref={canvasRef}
              aria-label={`Dirty ${activeItem.label.toLowerCase()}. Press and scrub across it to clean it.`}
              className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
              onLostPointerCapture={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                zIndex: 2,
                touchAction: "none",
                clipPath: surfaceClipPath,
              }}
            />
            <span
              aria-hidden="true"
              className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-md ${scrubbing && !reducedMotion ? "transition-transform duration-75 scale-110" : ""}`}
              ref={spongeRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onLostPointerCapture={onPointerUp}
              style={{
                left: activeItem.shape === "plate" ? "68%" : "50%",
                top: activeItem.shape === "plate" ? "64%" : "59%",
                opacity: 1,
                width: spongeSize,
                height: spongeSize,
                pointerEvents: "auto",
                touchAction: "none",
                cursor: scrubbing ? "grabbing" : "grab",
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 96 96" width={spongeSize} height={spongeSize} style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="dish-sponge-yellow" x1="0" y1="0" x2="0.8" y2="1">
                    <stop stopColor="#ffe174" /><stop offset=".55" stopColor="#f7b936" /><stop offset="1" stopColor="#d98923" />
                  </linearGradient>
                  <pattern id="dish-sponge-pores" width="11" height="11" patternUnits="userSpaceOnUse">
                    <circle cx="3" cy="3" r="1.2" fill="#fff1b5" opacity=".62" />
                    <circle cx="8" cy="8" r="1.6" fill="#a96724" opacity=".28" />
                  </pattern>
                  <filter id="dish-sponge-shadow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#20130d" floodOpacity=".55" />
                  </filter>
                </defs>
                <g transform="rotate(-25 43 48)" filter="url(#dish-sponge-shadow)">
                  <rect x="17" y="28" width="55" height="42" rx="10" fill="#14765d" stroke="#075440" strokeWidth="3" />
                  <rect x="17" y="20" width="55" height="42" rx="10" fill="url(#dish-sponge-yellow)" stroke="#a96120" strokeWidth="2.5" />
                  <rect x="19" y="22" width="51" height="38" rx="8" fill="url(#dish-sponge-pores)" />
                  <path d="M24 28q15-8 31-2" fill="none" stroke="#fff6d4" strokeOpacity=".66" strokeWidth="3" strokeLinecap="round" />
                </g>
                {!hasStartedWashing ? (
                  <path d="M65 61V44c0-4 6-4 6 0v9-15c0-4 6-4 6 0v15-11c0-4 6-4 6 0v13l2-7c2-5 7-3 6 1l-3 15c-1 6-5 10-11 10h-4c-6 0-10-3-13-8l-5-8c-2-4 3-7 6-4l4 7Z" fill="#fffdf8" stroke="#3d281b" strokeWidth="3.5" strokeLinejoin="round" />
                ) : null}
              </svg>
            </span>
            {complete ? (
              <div className={`pointer-events-none absolute inset-0 grid place-items-center ${reducedMotion ? "" : "animate-[dish-shine_700ms_ease-out]"}`}>
                <span aria-hidden="true" className="rounded-full bg-white/60 px-4 py-2 text-[30px] text-gold shadow-soft">✨</span>
              </div>
            ) : null}
          </div>
        </div>

        <p
          className="mt-3 rounded-2xl px-3 py-2 text-center font-ui text-[14px] font-extrabold"
          role="status"
          style={{ background: "linear-gradient(135deg, #fff8e8, #f2dfbd)", color: "#50331f", border: "1px solid #d5ae6c", boxShadow: "0 3px 10px rgba(80,48,22,.13), inset 0 1px 0 #fff" }}
        >
          {complete
            ? startAtKitchenTools
              ? "All chef’s tools are clean and ready for tomorrow’s service!"
              : "All tableware and chef tools are clean for tomorrow’s service!"
            : itemFinished
              ? `${activeItem.label} clean!`
              : scrubbing
                ? `Keep scrubbing the ${activeItem.label.toLowerCase()}…`
                : afterClosing
                  ? `🌙 Closing task: clean the ${activeItem.label.toLowerCase()} for tomorrow.`
                  : `✨ Wash the ${activeItem.label.toLowerCase()} next. Scrub every mark to finish.`}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div
            ref={progressBarRef}
            aria-label={`0% ${activeItem.label.toLowerCase()} clean`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={0}
            className="h-3 flex-1 overflow-hidden rounded-full bg-walnut/15"
            role="progressbar"
          >
            <div
              ref={progressFillRef}
              className="h-full rounded-full"
              style={{ width: "0%", background: "linear-gradient(90deg, #789270, #a8b47c)" }}
            />
          </div>
          <span ref={progressValueRef} className="w-10 text-right font-ui text-[12px] font-extrabold text-walnut/70">0%</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="font-hand text-[14px] text-walnut/65">🫧 Warm water · gentle soap</p>
          {complete ? (
            <KButton size="sm" variant="cream" className="min-h-12" onClick={resetWash}>
              {startAtKitchenTools ? "Repeat kitchen tools" : "Repeat the full closing clean-up"}
            </KButton>
          ) : null}
        </div>
      </section>
      <style>{`
        @keyframes dish-shine {
          from { opacity: 0; transform: scale(.8); }
          55% { opacity: 1; transform: scale(1.08); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );

  return portalTarget ? createPortal(modal, portalTarget) : null;
}
