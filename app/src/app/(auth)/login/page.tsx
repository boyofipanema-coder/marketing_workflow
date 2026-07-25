"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import type { LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState | null, FormData>(
    loginAction,
    null
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-sm rounded-xl border border-separator bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-text">
          마케팅 워크플로
        </h1>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-text-secondary"
            >이메일</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder-text-quaternary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-text-secondary"
            >비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder-text-quaternary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-flag-blocked/10 px-3 py-2 text-sm text-flag-blocked">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 disabled:opacity-50"
          >
            {pending ? "로그인 중…" : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
