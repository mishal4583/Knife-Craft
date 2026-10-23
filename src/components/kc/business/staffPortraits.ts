/** Which portrait (public/business/staff-portraits/) shows a staff role or specialist chef — presentation only. */
const PORTRAIT: Record<string, string> = {
  "prep-cook": "prep-cook",
  "line-cook": "line-cook",
  "head-chef": "head-chef",
  server: "server",
  cleaner: "cleaner",
  manager: "manager",
  "mexican-chef": "specialist-mexican",
  "indian-chef": "specialist-indian",
  "mediterranean-chef": "specialist-mediterranean",
  "asian-chef": "specialist-asian",
};

export function staffPortraitFile(id: string): string | undefined {
  return PORTRAIT[id];
}
