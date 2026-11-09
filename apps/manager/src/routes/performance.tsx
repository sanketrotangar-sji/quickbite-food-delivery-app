import { createFileRoute } from "@tanstack/react-router";
import { PerformancePage } from "@/features/kitchen/screens/PerformancePage";

export const Route = createFileRoute("/performance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Performance — QuickBite" },
      { name: "description", content: "Restaurant performance for owners and managers." },
      { property: "og:title", content: "Performance — QuickBite" },
      { property: "og:description", content: "Restaurant performance for owners and managers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PerformancePage,
});
