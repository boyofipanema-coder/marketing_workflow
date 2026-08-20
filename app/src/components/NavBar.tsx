"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus, Search, Menu, X, FileText, FolderPlus, CircleHelp } from "lucide-react";
import QuickAdd from "./QuickAdd";
import ProjectFormDialog from "./projects/ProjectFormDialog";
import { Button } from "@/components/ui";
import { createTaskAction } from "@/app/actions/tasks";
import { switchMemberAction } from "@/app/actions/identity";
import { ownerColor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { Brand, Member } from "@/server/db/schema";
import type { NotificationView } from "@/server/services/collaboration";
import type { MemoDocumentView } from "@/server/services/personal-note";
import NotificationMenu, { WorkInboxMenu } from "./NotificationMenu";
import PersonalMemo from "./PersonalMemo";

// ── Nav items ────────────────────────────────────────────────────────────────

// Two destinations, because there are two questions: "what is the state of the
// work" (홈, the canvas) and "what do I do next" (내 업무). 인박스, 프로젝트 and
// 팀 were never separate places — they are the canvas grouped or filtered a
// different way, and the toolbar already does that. Their routes still resolve
// so old links keep working; they just stopped being top-level nav.
const NAV_ITEMS = [
  { href: "/home", label: "홈" },
  { href: "/my-work", label: "내 업무" },
  { href: "/calendar", label: "캘린더" },
  { href: "/team", label: "팀" },
] as const;

// ── NavBar ────────────────────────────────────────────────────────────────────

export interface NavBarProps {
  members: Member[];
  brands: Brand[];
  viewerId: string;
  notifications: NotificationView[];
  memoDocuments: MemoDocumentView[];
}

export default function NavBar({
  members,
  brands,
  viewerId,
  notifications,
  memoDocuments,
}: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const viewer = members.find((m) => m.id === viewerId);

  const handleCreate = async (title: string) => {
    const result = await createTaskAction(title);
    if (!result.success) {
      setQuickAddError(result.error ?? "업무를 추가하지 못했습니다.");
      return;
    }
    setQuickAddError(null);
    setShowQuickAdd(false);
    // Stay where you are. The task lands unfiled and shows up in the board's
    // 인박스 band without navigating away from whatever you were looking at —
    // capturing a thought should not cost you your place.
    router.refresh();
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    setMobileMenuOpen(false);
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* ── Top bar — ordinary document flow, never pinned over the board ── */}
      <header className="relative z-40 border-b border-separator/70 bg-surface/[0.72] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-5 px-4 sm:px-6">
          {/* Wordmark — editorial serif accent */}
          <Link
            href="/home"
            className="flex-shrink-0 rounded text-[18px] font-semibold tracking-[-0.02em] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="마케팅 워크플로 홈"
          >
            워크플로
          </Link>

          {/* Desktop nav links */}
          <nav
            className="hidden flex-1 items-center gap-0.5 overflow-x-auto sm:flex"
            aria-label="주 메뉴"
          >
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-[10px] px-3 py-2 text-sm font-semibold transition-[transform,background-color,color] duration-fast ease-out active:scale-[0.97]",
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
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <form onSubmit={submitSearch} className="relative hidden md:block">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="검색"
                aria-label="업무 검색"
                className="h-9 w-44 rounded-xl border border-border bg-surface-2/70 pl-8 pr-3 text-sm text-text placeholder:text-text-quaternary transition-[border-color,box-shadow,background-color] duration-fast ease-out focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/25 lg:w-56"
              />
            </form>

            <Link
              href="/guide"
              aria-label="사용 안내"
              title="사용 안내"
              className="hidden size-8 place-items-center rounded-lg text-text-secondary transition-[transform,background-color,color] duration-fast ease-out hover:bg-surface-2 hover:text-text active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg md:grid"
            >
              <CircleHelp className="size-4" aria-hidden />
            </Link>

            <NotificationMenu initialNotifications={notifications} />
            <WorkInboxMenu initialNotifications={notifications} />
            <PersonalMemo initialDocuments={memoDocuments} />

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="primary" size="sm" aria-label="추가">
                  <Plus aria-hidden />
                  <span className="hidden xs:inline sm:inline">추가</span>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-[11rem] rounded-lg border border-separator bg-elevated p-1 shadow-xl"
                >
                  <DropdownMenu.Item
                    onSelect={() => {
                      setShowQuickAdd(true);
                      setQuickAddError(null);
                      setMobileMenuOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-2"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    빠른 업무 기록
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => {
                      setShowProjectForm(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-2"
                  >
                    <FolderPlus className="h-3.5 w-3.5" aria-hidden />
                    프로젝트 만들기
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {viewer && (
              <form action={switchMemberAction}>
                <button
                  type="submit"
                  title="다른 사람으로 전환"
                  aria-label={`${viewer.name}님 — 다른 사람으로 전환`}
                  className="grid h-8 min-w-8 flex-shrink-0 place-items-center rounded-full px-2 text-[11px] font-bold tracking-tight text-white transition-[transform,opacity] hover:opacity-85 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  style={{ background: ownerColor(viewer.id) }}
                >
                  {viewer.name}
                </button>
              </form>
            )}

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
            className="border-t border-separator/70 bg-surface/[0.82] px-4 pb-3 pt-2 backdrop-blur-xl sm:hidden"
            aria-label="모바일 메뉴"
          >
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-fast ease-out",
                  isActive(href)
                    ? "bg-surface-3 text-text"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text",
                )}
              >
                {label}
              </Link>
            ))}

            <Link
              href="/guide"
              aria-current={isActive("/guide") ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-fast ease-out",
                isActive("/guide")
                  ? "bg-surface-3 text-text"
                  : "text-text-secondary hover:bg-surface-2 hover:text-text",
              )}
            >
              <CircleHelp className="size-4" aria-hidden />
              사용 안내
            </Link>

            <form onSubmit={submitSearch} className="relative mt-2">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="검색"
                aria-label="업무 검색"
                className="h-10 w-full rounded-md border border-border bg-surface-2 pl-8 pr-3 text-base text-text placeholder:text-text-quaternary focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </form>
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
          <div
            className="absolute inset-0 animate-fade-in bg-[rgb(var(--material-scrim))] backdrop-blur-sm"
            onClick={() => setShowQuickAdd(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md animate-scale-in">
            <QuickAdd
              onCreate={handleCreate}
              onCancel={() => {
                setShowQuickAdd(false);
                setQuickAddError(null);
              }}
            />
            {quickAddError && (
              <p
                role="alert"
                className="mt-2 rounded-lg bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked"
              >
                {quickAddError}
              </p>
            )}
          </div>
        </div>
      )}

      <ProjectFormDialog
        open={showProjectForm}
        onOpenChange={setShowProjectForm}
        members={members}
        brands={brands}
        defaultLeadId={viewerId}
        onSaved={() => {
          // createProjectAction already revalidates the layout; a plain
          // navigate-home puts the new (empty) project container on screen.
          router.push("/home");
          router.refresh();
        }}
      />
    </>
  );
}
