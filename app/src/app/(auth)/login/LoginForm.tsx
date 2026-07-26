"use client";

import { useActionState } from "react";
import { enterAction, type LoginState } from "./actions";
import type { Member } from "@/server/db/schema";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-text placeholder-text-quaternary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export default function LoginForm({ members }: { members: Member[] }) {
  const [state, action, pending] = useActionState<LoginState | null, FormData>(
    enterAction,
    null
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-secondary">
          워크스페이스 비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="memberId" className="mb-1 block text-sm font-medium text-text-secondary">
          사용자
        </label>
        <select id="memberId" name="memberId" required defaultValue="" className={fieldClass}>
          <option value="" disabled>
            누구로 들어갈까요?
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-flag-blocked">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-accent text-base font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "들어가는 중…" : "들어가기"}
      </button>
    </form>
  );
}
