import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/screens/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in — QuickBite" }],
  }),
  component: LoginPage,
});
