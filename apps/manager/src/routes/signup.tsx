import { createFileRoute } from "@tanstack/react-router";
import { SignupPage } from "@/features/auth/screens/SignupPage";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Become a partner — QuickBite" }],
  }),
  component: SignupPage,
});
