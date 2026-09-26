import { createFileRoute } from "@tanstack/react-router";
import { MarketShop } from "@/components/MarketShop";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kitchen Market — Upgrade Your Kitchen" },
      { name: "description", content: "Browse kitchen tools, equipment, staff, suppliers, and fresh ingredients in the Kitchen Market." },
      { property: "og:title", content: "Kitchen Market — Upgrade Your Kitchen" },
      { property: "og:description", content: "Stock and upgrade your restaurant kitchen in a warm, illustrated game market." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketShop,
});
