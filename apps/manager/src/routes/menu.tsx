import { createFileRoute } from "@tanstack/react-router";
import { MenuPage } from "@/features/kitchen/screens/MenuPage";

export const Route = createFileRoute("/menu")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "My Menu — QuickBite" },
      { name: "description", content: "Manage restaurant menu items and availability in QuickBite." },
      { property: "og:title", content: "My Menu — QuickBite" },
      { property: "og:description", content: "Manage restaurant menu items and availability in QuickBite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MenuPage,
});
