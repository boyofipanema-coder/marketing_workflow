"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, Menu, X } from "lucide-react";
import QuickAdd from "./QuickAdd";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

// ── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/home", label: "홈" },
  { href: "/my-work", label: "내 업무" },
  { href: "/projects", label: "프로젝트" },
  { href: "/team", label: "팀" },
  { href: "/calendar", label: "캘린더" },
] as const;

// ── NavBar ────────────────────────────────────────────────────────────────────

export default function NavBar() {
  const pathname = usePathname();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCreate = (title: string) => {
    // Stub — data wiring handled by other workers (#5, #6, #10)
    console.log("[QuickAdd] created:", title);
    setShowQuickAdd(false);
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* ── Top bar — translucent chrome; content scrolls underneath ──────── */}
      <header className="material-chrome fixed inset-x-0 top-0 z-40 h-14">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-5 px-4 sm:px-6">

          {/* Wordmark — editorial serif accent */}
          <span
            className="flex-shrink-0 font-serif text-[17px] font-semibold tracking-tight text-text"
            aria-label="마케팅 워크플로"
          >
            워크플로
          </span>

          {/* Desktop nav links */}
          <nav
            className="hidden sm:flex items-center gap-0.5 overflow-x-auto flex-1"
            aria-label="주 메뉴"
          >
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-out",
                  isActive(href)
                    ? "bg-surface-3 text-text"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            {/* Search — non-functional stub */}
            <div className="relative hidden md:block">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <input
                type="search"
                placeholder="검색"
                aria-label="검색 (준비 중)"
                className="h-8 w-44 rounded-md border border-border bg-surface-2 pl-8 pr-3 text-sm text-text placeholder:text-text-quaternary transition-[border-color,box-shadow] duration-fast ease-out focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 lg:w-56"
              />
            </div>

            {/* Quick Add button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowQuickAdd(true);
                setMobileMenuOpen(false);
              }}
              aria-label="업무 빠른 추가"
            >
              <Plus aria-hidden />
              <span className="hidden xs:inline sm:inline">업무 추가</span>
            </Button>

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="flex sm:hidden"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <nav
            className="material-chrome sm:hidden border-t border-separator px-4 pb-3 pt-2"
            aria-label="모바일 메뉴"
          >
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast ease-out",
                  isActive(href)
                    ? "bg-surface-3 text-text"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text",
                )}
              >
                {label}
              </Link>
            ))}
            {/* Mobile search */}
            <div className="relative mt-2">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <input
                type="search"
                placeholder="검색"
                aria-label="검색 (준비 중)"
                className="h-9 w-full rounded-md border border-border bg-surface-2 pl-8 pr-3 text-sm text-text placeholder:text-text-quaternary focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </nav>
        )}
      </header>

      {/* ── Quick Add overlay ────────────────────────────────────────────── */}
      {showQuickAdd && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20"
          role="dialog"
          aria-modal="true"
          aria-label="업무 빠른 추가 창"
        >
          {/* Scrim */}
          <div
            className="absolute inset-0 animate-fade-in bg-[rgb(var(--material-scrim))] backdrop-blur-sm"
            onClick={() => setShowQuickAdd(false)}
            aria-hidden
          />
          {/* Card */}
          <div className="relative w-full max-w-md animate-scale-in">
            <QuickAdd
              onCreate={handleCreate}
              onCancel={() => setShowQuickAdd(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
