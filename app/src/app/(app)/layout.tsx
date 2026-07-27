import NavBar from "@/components/NavBar";
import {
  getCurrentMember,
  getWorkspaceBrands,
  getWorkspaceMembers,
} from "@/server/data/queries";
import { getMemberNotifications } from "@/server/services/collaboration";

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
 * Password auth isn't set up yet: getCurrentMember falls back to whoever
 * picked themselves on /select-member, or redirects there.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolves a member (real session or the picked one) and warms the request.
  const { member: viewer, db } = await getCurrentMember();
  const [members, brands, notifications] = await Promise.all([
    getWorkspaceMembers(db, viewer.workspace_id),
    getWorkspaceBrands(db, viewer.workspace_id),
    getMemberNotifications(db, viewer.workspace_id, viewer.id),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <NavBar
        members={members}
        brands={brands}
        viewerId={viewer.id}
        notifications={notifications}
      />
      <main>{children}</main>
    </div>
  );
}
