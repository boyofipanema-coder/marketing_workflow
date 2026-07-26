import { getCloudflareContext } from "@opennextjs/cloudflare";
import NavBar from "@/components/NavBar";
import { workspacePassword } from "@/server/auth/workspace-password";
import { getCurrentMember } from "@/server/data/queries";

/**
 * Every screen under this layout resolves the current member and reads that
 * member's workspace out of D1, so none of them can be meaningfully rendered
 * ahead of a request. Declaring that explicitly also keeps the build from
 * opening the local D1 replica, which several parallel build workers cannot
 * share.
 */
export const dynamic = "force-dynamic";

/**
 * App shell layout — wraps all app screens.
 * getCurrentMember redirects to /login once a workspace password is set; until
 * then it auto-enters as the default member.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves a member (real session or default) and warms the request.
  await getCurrentMember();
  const { env } = await getCloudflareContext({ async: true });
  const canLogout = Boolean(workspacePassword(env));

  return (
    <div className="min-h-screen bg-bg">
      <NavBar canLogout={canLogout} />
      {/* Offset for the fixed 48px (h-12) nav */}
      <main className="pt-12">{children}</main>
    </div>
  );
}
