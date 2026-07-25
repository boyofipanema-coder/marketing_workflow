import NavBar from "@/components/NavBar";
import { getCurrentMember } from "@/server/data/queries";

/**
 * App shell layout — wraps all app screens.
 * Login is intentionally bypassed at this stage: getCurrentMember auto-enters
 * as the default workspace member when no valid session is present.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves a member (real session or default) and warms the request.
  await getCurrentMember();

  return (
    <div className="min-h-screen bg-bg">
      <NavBar />
      {/* Offset for the fixed 56px (h-14) nav */}
      <main className="pt-14">{children}</main>
    </div>
  );
}
