import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "landing";
import { KitchenDashboardPage } from "@/features/kitchen/screens/KitchenDashboardPage";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "QuickBite — Good Food. Brighter Days." },
      {
        name: "description",
        content:
          "Discover local restaurants, order your favourites, and track every delivery in real time — or manage your kitchen on the QuickBite dashboard.",
      },
      { property: "og:title", content: "QuickBite — Good Food. Brighter Days." },
      {
        property: "og:description",
        content:
          "Discover local restaurants, order your favourites, and track every delivery in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading QuickBite…
      </div>
    );
  }

  if (!session) {
    return <LandingPage dashboardUrl="/login" />;
  }

  return <KitchenDashboardPage />;
}
