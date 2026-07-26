/**
 * The shared workspace password, or null when none is configured.
 *
 * ponytail: while this is unset the app keeps auto-entering as the default
 * member — exactly the behaviour it has had all along. Auth switches itself on
 * the moment the secret exists, so setting it is the only step, and forgetting
 * to set it cannot lock anyone out of a workspace they are already using.
 * Set it with: wrangler secret put WORKSPACE_PASSWORD
 */
export function workspacePassword(env: unknown): string | null {
  const value = (env as { WORKSPACE_PASSWORD?: string })?.WORKSPACE_PASSWORD;
  return value && value.length > 0 ? value : null;
}
