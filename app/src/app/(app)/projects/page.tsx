import { redirect } from "next/navigation";

/**
 * Project is no longer a separate destination. Projects live inside their
 * brand on Home; keeping this redirect preserves old bookmarks without
 * rebuilding the disconnected list screen.
 */
export default function ProjectsPage() {
  redirect("/home");
}
