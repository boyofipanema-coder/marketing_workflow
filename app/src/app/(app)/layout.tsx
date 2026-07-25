import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import NavBar from "@/components/NavBar";
import { createDb } from "@/server/db/client";
import { validateSession } from "@/server/auth/session";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

/**
 * App shell layout — wraps all authenticated app screens.
 * Validates the D1-backed session on every (app) route.
 * Unauthenticated visitors are redirected to /login.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);
  const currentMember = await validateSession(db, token);

  if (!currentMember) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-bg">
      <NavBar />
      {/* Offset for the fixed 56px (h-14) nav */}
      <main className="pt-14">{children}</main>
    </div>
  );
}
