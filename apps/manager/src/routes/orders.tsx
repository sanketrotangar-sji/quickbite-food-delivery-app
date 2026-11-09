import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/features/kitchen/screens/OrdersPage";

const statuses = ["all", "placed", "preparing", "ready"] as const;
type OrdersFilter = (typeof statuses)[number];

function isFilter(value: unknown): value is OrdersFilter {
  return statuses.includes(value as OrdersFilter);
}

export const Route = createFileRoute("/orders")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
    status: isFilter(search["status"]) ? search["status"] : "all",
  }),
  head: () => ({
    meta: [
      { title: "Orders — QuickBite" },
      { name: "description", content: "Manage incoming, current, and completed restaurant orders." },
      { property: "og:title", content: "Orders — QuickBite" },
      { property: "og:description", content: "Manage incoming, current, and completed restaurant orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});
