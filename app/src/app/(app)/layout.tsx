import NavBar from "@/components/NavBar";
import { NotificationProvider } from "@/components/NotificationProvider";
import {
  getCurrentMember,
  getWorkspaceBrands,
  getWorkspaceMembers,
} from "@/server/data/queries";
import { getMemberNotifications } from "@/server/services/collaboration";
import { listMemoDocuments } from "@/server/services/personal-note";

/**
 * Every screen under this layout resolves the current member and reads that
 * member's workspace out of D1, so none of them can be meaningfully rendered
 * ahead of a request. Declaring that explicitly also keeps the build from
 * opening the local D1 replica, which several parallel build workers cannot
 * share.
 */
export const dynamic = "force-dynamic";

/**
 * App shell layout — wraps all authenticated app screens.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Validates the session against D1 before rendering any workspace data.
  const { member: viewer, db } = await getCurrentMember();
  const [members, brands, notifications, memoDocuments] = await Promise.all([
    getWorkspaceMembers(db, viewer.workspace_id),
    getWorkspaceBrands(db, viewer.workspace_id),
    getMemberNotifications(db, viewer.workspace_id, viewer.id),
    listMemoDocuments(db, viewer.workspace_id, viewer.id),
  ]);

  return (
    <NotificationProvider initialNotifications={notifications}>
      <div className="min-h-screen bg-bg">
        <NavBar
          members={members}
          brands={brands}
          viewerId={viewer.id}
          memoDocuments={memoDocuments}
        />
        <main>{children}</main>
      </div>
    </NotificationProvider>
  );
}
