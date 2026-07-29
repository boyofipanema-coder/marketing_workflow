"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MessageSquare, Send, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createCommentAction,
  deleteCommentAction,
  getCommentsAction,
  markTargetNotificationsReadAction,
} from "@/app/actions/collaboration";
import { cn } from "@/lib/utils";
import type { Member } from "@/server/db/schema";
import type {
  CommentTarget,
  CommentView,
} from "@/server/services/collaboration";

export default function CommentThread({
  target,
  members,
  readOnly,
  embedded,
}: {
  target: CommentTarget;
  members: Member[];
  readOnly?: boolean;
  embedded?: boolean;
}) {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    function load() {
      void getCommentsAction(target).then((result) => {
        if (!active) return;
        setLoading(false);
        if (result.success && result.data) setComments(result.data);
        else setError(result.error ?? "댓글을 불러오지 못했습니다.");
      });
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [target.id, target.type]);

  async function submit() {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    const result = await createCommentAction(target, body);
    setSending(false);
    if (!result.success || !result.data) {
      setError(result.error ?? "댓글을 등록하지 못했습니다.");
      return;
    }
    setComments((current) => [...current, result.data!]);
    setBody("");
  }

  async function remove(commentId: string) {
    if (deletingId) return;
    setDeletingId(commentId);
    setError(null);
    const result = await deleteCommentAction(target, commentId);
    setDeletingId(null);
    if (!result.success) {
      setError(result.error ?? "댓글을 삭제하지 못했습니다.");
      return;
    }
    setComments((current) =>
      current.filter((comment) => comment.id !== commentId),
    );
    setConfirmingId(null);
  }

  return (
    <section
      className={cn(
        "bg-surface",
        embedded ? "min-h-0" : "rounded-xl border border-border p-3",
      )}
    >
      {!embedded && (
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="size-4 text-text-tertiary" />
          <h3 className="text-xs font-semibold text-text-secondary">댓글</h3>
          <span className="text-[10px] tabular-nums text-text-tertiary">
            {comments.length}
          </span>
        </div>
      )}
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {loading && (
          <Loader2 className="mx-auto my-5 size-4 animate-spin text-text-tertiary" />
        )}
        {!loading && !comments.length && (
          <p className="py-8 text-center text-xs text-text-tertiary">
            첫 댓글을 남겨보세요.
          </p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-lg bg-surface-2 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold text-text">
                  {comment.author_name}
                </span>
                <time className="text-[9px] tabular-nums text-text-quaternary">
                  {comment.created_at.slice(5, 16).replace("T", " ")}
                </time>
              </div>
              {comment.can_delete && confirmingId !== comment.id && (
                <button
                  type="button"
                  onClick={() => setConfirmingId(comment.id)}
                  aria-label={`${comment.author_name}님의 댓글 삭제`}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-text-quaternary hover:bg-surface-3 hover:text-flag-blocked focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="size-3" aria-hidden />
                </button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-text-secondary">
              {comment.body}
            </p>
            {comment.can_delete && confirmingId === comment.id && (
              <div
                role="group"
                aria-label="댓글 삭제 확인"
                className="mt-2 flex items-center justify-end gap-2 border-t border-separator pt-2"
              >
                <span className="mr-auto text-[10px] text-text-tertiary">
                  삭제할까요?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  disabled={deletingId === comment.id}
                  className="rounded-md px-2 py-1 text-[10px] font-medium text-text-secondary hover:bg-surface-3"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void remove(comment.id)}
                  disabled={deletingId === comment.id}
                  className="inline-flex items-center gap-1 rounded-md bg-flag-blocked px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                >
                  {deletingId === comment.id && (
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  )}
                  삭제
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 flex flex-wrap gap-1">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() =>
                  setBody(
                    (value) =>
                      `${value}${value && !value.endsWith(" ") ? " " : ""}@${member.name} `,
                  )
                }
                className="rounded-full bg-surface-2 px-2 py-1 text-[10px] font-medium text-text-secondary hover:text-accent"
              >
                @{member.name}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  void submit();
                }
              }}
              placeholder="댓글을 입력하세요."
              className="min-h-16 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!body.trim() || sending}
              aria-label="댓글 등록"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-white hover:bg-accent-hover disabled:opacity-40"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-[11px] text-flag-blocked">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function CommentSidecarButton({
  target,
  title,
  description,
  members,
  unreadCount = 0,
}: {
  target: CommentTarget;
  title: string;
  description?: string | null;
  members: Member[];
  unreadCount?: number;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 64, width: 360 });

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(360, window.innerWidth - 16);
      const rightSide = rect.right + 10;
      const left =
        rightSide + width <= window.innerWidth - 8
          ? rightSide
          : Math.max(8, rect.left - width - 10);
      setPosition({
        left,
        top: Math.min(Math.max(64, rect.top - 12), window.innerHeight - 280),
        width,
      });
    }
    function closeOnOutside(event: PointerEvent) {
      const node = event.target as Node;
      if (
        !panelRef.current?.contains(node) &&
        !triggerRef.current?.contains(node)
      ) {
        setOpen(false);
      }
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", closeOnOutside);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount) {
      await markTargetNotificationsReadAction(target);
      router.refresh();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => void toggle()}
        aria-label={`${title} 댓글${unreadCount ? `, 새 댓글 ${unreadCount}개` : ""}`}
        aria-expanded={open}
        className="relative inline-flex h-8 shrink-0 items-center gap-0.5 rounded-lg px-1.5 text-sm text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden>💬</span>
        {unreadCount > 0 && (
          <span className="min-w-3.5 rounded-full bg-flag-blocked px-1 text-center text-[8px] font-bold leading-3.5 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <aside
            ref={panelRef}
            aria-label={`${title} 댓글`}
            className="fixed z-[85] overflow-y-auto rounded-2xl border border-border bg-surface p-3 shadow-xl"
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: `calc(100dvh - ${position.top + 8}px)`,
            }}
          >
            <header className="mb-3 flex items-start justify-between gap-3 border-b border-separator pb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-text-tertiary">
                  {target.type === "project" ? "프로젝트 댓글" : "업무 댓글"}
                </p>
                <h2 className="mt-0.5 truncate text-sm font-semibold text-text">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="댓글 닫기"
                className="grid size-8 shrink-0 place-items-center rounded-full text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </header>
            {target.type === "task" && (
              <section className="mb-3 border-b border-separator pb-3">
                <h3 className="mb-1.5 text-[10px] font-semibold text-text-tertiary">
                  세부 내용
                </h3>
                <div className="max-h-28 overflow-y-auto rounded-lg bg-surface-2 px-3 py-2">
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-text-secondary">
                    {description || "등록된 세부 내용이 없습니다."}
                  </p>
                </div>
              </section>
            )}
            <section>
              <h3 className="mb-1.5 text-[10px] font-semibold text-text-tertiary">
                댓글
              </h3>
              <CommentThread target={target} members={members} embedded />
            </section>
          </aside>,
          document.body,
        )}
    </>
  );
}
