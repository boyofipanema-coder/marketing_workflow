"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import {
  createTaskCommentAction,
  getTaskCommentsAction,
} from "@/app/actions/collaboration";
import type { Member } from "@/server/db/schema";
import type { CommentView } from "@/server/services/collaboration";

export default function CommentThread({
  taskId,
  members,
  readOnly,
}: {
  taskId: string;
  members: Member[];
  readOnly?: boolean;
}) {
  const [comments, setComments] = useState<CommentView[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getTaskCommentsAction(taskId).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.success && result.data) setComments(result.data);
      else setError(result.error ?? "댓글을 불러오지 못했습니다.");
    });
    return () => {
      active = false;
    };
  }, [taskId]);

  async function submit() {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    const result = await createTaskCommentAction(taskId, body);
    setSending(false);
    if (!result.success || !result.data) {
      setError(result.error ?? "댓글을 등록하지 못했습니다.");
      return;
    }
    setComments((current) => [...current, result.data!]);
    setBody("");
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="size-4 text-text-tertiary" />
        <h3 className="text-xs font-semibold text-text-secondary">댓글</h3>
        <span className="text-[10px] tabular-nums text-text-tertiary">{comments.length}</span>
      </div>
      <div className="max-h-52 space-y-2 overflow-y-auto">
        {loading && <Loader2 className="mx-auto my-5 size-4 animate-spin text-text-tertiary" />}
        {!loading && !comments.length && (
          <p className="py-4 text-center text-xs text-text-tertiary">협업할 내용을 댓글로 남겨보세요.</p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-lg bg-surface-2 px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold text-text">{comment.author_name}</span>
              <time className="text-[9px] tabular-nums text-text-quaternary">
                {comment.created_at.slice(5, 16).replace("T", " ")}
              </time>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-text-secondary">{comment.body}</p>
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
                onClick={() => setBody((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}@${member.name} `)}
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
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submit();
              }}
              placeholder="@이름으로 멘션할 수 있습니다."
              className="min-h-16 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!body.trim() || sending}
              aria-label="댓글 등록"
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-white hover:bg-accent-hover disabled:opacity-40"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-[11px] text-flag-blocked">{error}</p>}
        </div>
      )}
    </section>
  );
}
