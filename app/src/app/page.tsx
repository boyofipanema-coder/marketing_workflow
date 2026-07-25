import { redirect } from "next/navigation";

export default function RootPage() {
  // The app content lives under the (app) route group. Send the root to Home,
  // where the (app) layout enforces the session guard.
  redirect("/home");
}
