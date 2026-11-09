import { createFileRoute } from "@tanstack/react-router";
import { BusinessPage } from "@/features/kitchen/screens/BusinessPage";

export const Route = createFileRoute("/business")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Business — QuickBite" },
      { name: "description", content: "Manage restaurants and the managers who run them." },
      { property: "og:title", content: "Business — QuickBite" },
      { property: "og:description", content: "Manage restaurants and the managers who run them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessPage,
});
