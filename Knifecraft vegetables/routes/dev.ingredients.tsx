import { createFileRoute } from "@tanstack/react-router";
import { IngredientPreview } from "@/components/dev/IngredientPreview";

export const Route = createFileRoute("/dev/ingredients")({
  head: () => ({
    meta: [
      { title: "KnifeCraft — Ingredient Art Preview" },
      {
        name: "description",
        content:
          "Development preview of the KnifeCraft Batch 1 ingredient rendering system: mushroom, bell pepper, strawberry, apple and bread.",
      },
      { property: "og:title", content: "KnifeCraft — Ingredient Art Preview" },
      {
        property: "og:description",
        content:
          "Phaser-rendered ingredient silhouettes, whole art and cross-sections for KnifeCraft.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <main className="min-h-screen bg-[#2A1A10] py-6">
      <h1 className="text-center font-semibold text-2xl text-[#F6E8CC]">
        Batch 1 — Ingredient Art
      </h1>
      <IngredientPreview />
    </main>
  ),
});
