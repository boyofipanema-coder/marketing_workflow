"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Archive, ArchiveRestore, Bold, Check, CheckSquare2, ChevronLeft, Clock3,
  FileText, Heading1, Heading2, Italic, Library, List, ListOrdered, Loader2,
  Maximize2, Minimize2, NotebookPen, PanelLeftClose, Plus, Quote, Search,
  Underline, X,
} from "lucide-react";
import {
  saveMemoDocumentAction,
  setMemoDocumentArchivedAction,
} from "@/app/actions/personal-note";
import { cn } from "@/lib/utils";
import type { MemoDocumentView, MemoMode } from "@/server/services/personal-note";

const SAVE_DELAY = 700;
const SIZE_KEY = "mtw:memo-studio-size";
const SIMPLE_LIMIT = 20_000;
const DEEP_LIMIT = 100_000;
type SaveState = "idle" | "saving" | "saved" | "error";

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
  }
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}

function richTextLength(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").length;
}

function plainToRich(value: string) {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>") || "<br>"}</p>`)
    .join("");
}

function richToPlain(value: string) {
  if (typeof document === "undefined") return value.replace(/<[^>]*>/g, "");
  const container = document.createElement("div");
  container.innerHTML = value;
  return container.innerText;
}

function cleanRichHtml(root: HTMLElement) {
  const allowed = new Set([
    "B", "BLOCKQUOTE", "BR", "DIV", "EM", "H1", "H2", "I", "LI",
    "OL", "P", "STRONG", "U", "UL",
  ]);
  function clean(node: Node): Node {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }
    const element = node as HTMLElement;
    const fragment = document.createDocumentFragment();
    for (const child of Array.from(element.childNodes)) fragment.appendChild(clean(child));
    if (!allowed.has(element.tagName)) return fragment;
    const safe = document.createElement(element.tagName.toLowerCase());
    safe.appendChild(fragment);
    return safe;
  }
  const output = document.createElement("div");
  for (const child of Array.from(root.childNodes)) output.appendChild(clean(child));
  return output.innerHTML;
}

function RichEditor({
  documentId, initialBody, disabled, onChange, editorRef,
}: {
  documentId: string;
  initialBody: string;
  disabled: boolean;
  onChange: (value: string) => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialBody;
    // A new key is the only moment the editor should replace its own DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return (
    <div
      ref={editorRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Deep 문서 본문"
      data-placeholder="초안을 시작하세요. 제목과 목록, 강조 서식을 활용할 수 있습니다."
      onInput={(event) => onChange(cleanRichHtml(event.currentTarget))}
      onPaste={(event) => {
        event.preventDefault();
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
      }}
      className={cn(
        "memo-rich-editor h-full min-h-80 overflow-y-auto px-8 py-8 text-base leading-7 text-text outline-none sm:px-12",
        disabled && "cursor-default opacity-80",
      )}
    />
  );
}

export default function PersonalMemo({ initialDocuments }: { initialDocuments: MemoDocumentView[] }) {
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState(initialDocuments);
  const [activeId, setActiveId] = useState<string | null>(
    initialDocuments.find((document) => !document.archivedAt)?.id ?? initialDocuments[0]?.id ?? null,
  );
  const [size, setSize] = useState<"small" | "large">("small");
  const [showLibrary, setShowLibrary] = useState(initialDocuments.length > 1);
  const [libraryView, setLibraryView] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<MemoDocumentView | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const richEditorRef = useRef<HTMLDivElement>(null);

  const active = documents.find((document) => document.id === activeId) ?? null;
  const archivedCount = documents.filter((document) => document.archivedAt).length;
  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    return documents
      .filter((document) => {
        const inView = libraryView === "archived" ? document.archivedAt : !document.archivedAt;
        if (!inView) return false;
        if (!normalized) return true;
        const searchableBody = document.mode === "deep" ? richToPlain(document.body) : document.body;
        return `${document.title} ${searchableBody}`.toLocaleLowerCase("ko-KR").includes(normalized);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [documents, libraryView, query]);

  async function persist(document: MemoDocumentView) {
    pending.current = null;
    setState("saving");
    setError(null);
    const result = await saveMemoDocumentAction({
      id: document.id, title: document.title, body: document.body, mode: document.mode,
    });
    if (!result.success || !result.data) {
      setState("error");
      setError(result.error ?? "저장하지 못했습니다.");
      return;
    }
    setDocuments((current) =>
      current.map((item) => (item.id === result.data?.id ? result.data : item)),
    );
    setState("saved");
  }

  function schedule(next: MemoDocumentView) {
    setDocuments((current) =>
      current.map((document) => (document.id === next.id ? next : document)),
    );
    pending.current = next;
    setState("idle");
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void persist(next);
    }, SAVE_DELAY);
  }

  function patchActive(patch: Partial<MemoDocumentView>) {
    if (!active || active.archivedAt) return;
    schedule({ ...active, ...patch, updatedAt: new Date().toISOString() });
  }

  function flushPending() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const document = pending.current;
    if (document) void persist(document);
  }

  function createDocument(mode: MemoMode) {
    flushPending();
    const now = new Date().toISOString();
    const document: MemoDocumentView = {
      id: crypto.randomUUID(),
      title: mode === "deep" ? "새 문서" : "새 메모",
      body: "", mode, archivedAt: null, createdAt: now, updatedAt: now,
    };
    setDocuments((current) => [document, ...current]);
    setActiveId(document.id);
    setLibraryView("active");
    if (mode === "deep") {
      setSize("large");
      setShowLibrary(true);
    }
    void persist(document);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function selectDocument(id: string) {
    if (id === activeId) return;
    flushPending();
    setActiveId(id);
    setError(null);
  }

  async function toggleArchive() {
    if (!active) return;
    flushPending();
    const archived = !active.archivedAt;
    setState("saving");
    const result = await setMemoDocumentArchivedAction(active.id, archived);
    if (!result.success) {
      setState("error");
      setError(result.error ?? "메모를 정리하지 못했습니다.");
      return;
    }
    const archivedAt = archived ? new Date().toISOString() : null;
    setDocuments((current) => current.map((document) =>
      document.id === active.id ? { ...document, archivedAt } : document,
    ));
    if (archived) {
      const next = documents.find((document) =>
        !document.archivedAt && document.id !== active.id,
      );
      setActiveId(next?.id ?? null);
    } else {
      setLibraryView("active");
      setActiveId(active.id);
    }
    setState("saved");
  }

  function insertSimpleText(value: string) {
    if (!active || active.mode !== "simple") return;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? active.body.length;
    const end = textarea?.selectionEnd ?? active.body.length;
    const prefix = start > 0 && active.body[start - 1] !== "\n" ? "\n" : "";
    const body = `${active.body.slice(0, start)}${prefix}${value}${active.body.slice(end)}`;
    patchActive({ body });
    requestAnimationFrame(() => {
      const cursor = start + prefix.length + value.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function switchMode(mode: MemoMode) {
    if (!active || active.mode === mode || active.archivedAt) return;
    const body = mode === "deep" ? plainToRich(active.body) : richToPlain(active.body);
    patchActive({ mode, body });
    if (mode === "deep") {
      setSize("large");
      setShowLibrary(true);
    }
  }

  function runRichCommand(command: string, value?: string) {
    richEditorRef.current?.focus();
    document.execCommand(command, false, value);
    if (richEditorRef.current) patchActive({ body: cleanRichHtml(richEditorRef.current) });
  }

  function toggleSize() {
    setSize((current) => {
      const next = current === "small" ? "large" : "small";
      try { localStorage.setItem(SIZE_KEY, next); } catch { /* Optional preference. */ }
      return next;
    });
  }

  useEffect(() => {
    try { if (localStorage.getItem(SIZE_KEY) === "large") setSize("large"); } catch { /* Compact default. */ }
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    const document = pending.current;
    if (document) void saveMemoDocumentAction(document);
  }, []);

  const isLarge = size === "large" || active?.mode === "deep" || showLibrary;
  const characterCount = active
    ? active.mode === "deep" ? richTextLength(active.body) : active.body.length
    : 0;
  const characterLimit = active?.mode === "deep" ? DEEP_LIMIT : SIMPLE_LIMIT;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) flushPending();
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" aria-label="메모 스튜디오 열기" title="메모 스튜디오 · ⌘⇧M" className="grid size-8 place-items-center rounded-lg text-text-secondary transition-[transform,background-color,color] duration-fast ease-out hover:bg-surface-2 hover:text-text active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
          <NotebookPen className="size-4" aria-hidden />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/15 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby="memo-studio-description"
          className={cn(
            "fixed inset-x-3 top-16 z-[70] flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-elevated shadow-xl outline-none data-[state=open]:animate-scale-in sm:left-auto sm:right-5",
            isLarge ? "sm:w-[min(68rem,calc(100vw-2.5rem))]" : "sm:w-[27rem]",
          )}
        >
          <header className="flex min-h-16 items-center gap-3 border-b border-separator px-4">
            <button type="button" onClick={() => setShowLibrary((current) => !current)} aria-label={showLibrary ? "문서 목록 닫기" : "문서 목록 열기"} className="grid size-8 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {showLibrary ? <PanelLeftClose className="size-4" aria-hidden /> : <Library className="size-4" aria-hidden />}
            </button>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-sm font-semibold tracking-tight text-text">메모 스튜디오</Dialog.Title>
              <Dialog.Description id="memo-studio-description" className="mt-0.5 text-2xs text-text-tertiary">가볍게 기록하거나, 서식을 갖춘 문서로 깊게 작성하세요.</Dialog.Description>
            </div>
            {active && (
              <div className="flex rounded-lg bg-surface-2 p-0.5" aria-label="편집 모드">
                {(["simple", "deep"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => switchMode(mode)} disabled={Boolean(active.archivedAt)} className={cn("h-7 rounded-md px-2.5 text-2xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", active.mode === mode ? "bg-surface text-text shadow-sm" : "text-text-tertiary hover:text-text")}>{mode === "simple" ? "Simple" : "Deep"}</button>
                ))}
              </div>
            )}
            {active?.mode !== "deep" && !showLibrary && (
              <button type="button" onClick={toggleSize} aria-label={isLarge ? "창 작게 보기" : "창 크게 보기"} className="hidden size-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid">
                {isLarge ? <Minimize2 className="size-4" aria-hidden /> : <Maximize2 className="size-4" aria-hidden />}
              </button>
            )}
            <Dialog.Close asChild><button type="button" aria-label="메모 스튜디오 닫기" className="grid size-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden /></button></Dialog.Close>
          </header>

          <div className="flex min-h-0 flex-1">
            {showLibrary && (
              <aside className="absolute inset-y-16 left-0 z-10 flex w-[min(19rem,86vw)] flex-col border-r border-separator bg-elevated shadow-lg sm:static sm:w-64 sm:flex-none sm:shadow-none">
                <div className="space-y-3 border-b border-separator p-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => createDocument("simple")} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white transition-[transform,background-color] hover:bg-accent-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="size-3.5" aria-hidden /> 새 메모</button>
                    <button type="button" onClick={() => createDocument("deep")} aria-label="새 Deep 문서" title="새 Deep 문서" className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FileText className="size-4" aria-hidden /></button>
                  </div>
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-quaternary" aria-hidden />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목과 내용 검색" aria-label="저장한 메모 검색" className="h-8 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-xs text-text outline-none placeholder:text-text-quaternary focus:border-accent focus:ring-2 focus:ring-accent/20" />
                  </label>
                  <div className="flex gap-1" role="tablist" aria-label="메모 분류">
                    <button type="button" role="tab" aria-selected={libraryView === "active"} onClick={() => setLibraryView("active")} className={cn("h-7 rounded-md px-2 text-2xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", libraryView === "active" ? "bg-surface-3 text-text" : "text-text-tertiary hover:text-text")}>내 문서</button>
                    <button type="button" role="tab" aria-selected={libraryView === "archived"} onClick={() => setLibraryView("archived")} className={cn("h-7 rounded-md px-2 text-2xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", libraryView === "archived" ? "bg-surface-3 text-text" : "text-text-tertiary hover:text-text")}>보관함 {archivedCount > 0 && `· ${archivedCount}`}</button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {visibleDocuments.length > 0 ? (
                    <div className="space-y-1">
                      {visibleDocuments.map((document) => (
                        <button key={document.id} type="button" onClick={() => selectDocument(document.id)} className={cn("w-full rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", document.id === activeId ? "bg-accent-soft" : "hover:bg-surface-2")}>
                          <span className="flex items-center gap-2">
                            {document.mode === "deep" ? <FileText className="size-3.5 flex-none text-accent" aria-hidden /> : <NotebookPen className="size-3.5 flex-none text-text-tertiary" aria-hidden />}
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text">{document.title}</span>
                          </span>
                          <span className="mt-1 block truncate text-2xs text-text-tertiary">{document.body ? (document.mode === "deep" ? richToPlain(document.body) : document.body) : "내용 없음"}</span>
                          <span className="mt-1 block text-[10px] text-text-quaternary">{formatUpdatedAt(document.updatedAt)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-10 text-center text-xs leading-5 text-text-tertiary">{query ? "검색 결과가 없습니다." : libraryView === "archived" ? "보관한 문서가 없습니다." : "새 메모를 만들어 시작하세요."}</div>
                  )}
                </div>
              </aside>
            )}

            <section className="flex min-w-0 flex-1 flex-col bg-surface">
              {active ? (
                <>
                  <div className="flex min-h-14 items-center gap-3 border-b border-separator px-4 sm:px-6">
                    {showLibrary && <button type="button" onClick={() => setShowLibrary(false)} aria-label="모바일 문서 목록 닫기" className="grid size-8 place-items-center rounded-lg text-text-tertiary sm:hidden"><ChevronLeft className="size-4" aria-hidden /></button>}
                    <input value={active.title} onChange={(event) => patchActive({ title: event.target.value })} onBlur={flushPending} readOnly={Boolean(active.archivedAt)} maxLength={120} aria-label="메모 제목" className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight text-text outline-none placeholder:text-text-quaternary read-only:cursor-default" placeholder="제목 없는 메모" />
                    <span className="hidden text-2xs text-text-quaternary sm:inline">{formatUpdatedAt(active.updatedAt)}</span>
                    <button type="button" onClick={() => void toggleArchive()} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-2xs font-semibold text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{active.archivedAt ? <><ArchiveRestore className="size-3.5" aria-hidden /> 복원</> : <><Archive className="size-3.5" aria-hidden /> 보관</>}</button>
                  </div>

                  {active.archivedAt && <div className="border-b border-separator bg-surface-2 px-5 py-2 text-center text-2xs font-medium text-text-secondary">보관된 문서입니다. 다시 편집하려면 복원하세요.</div>}

                  {active.mode === "simple" ? (
                    <>
                      <div className="flex items-center gap-1 border-b border-separator bg-surface-2/60 px-3 py-2">
                        <button type="button" disabled={Boolean(active.archivedAt)} onClick={() => insertSimpleText("☐ ")} className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-2xs font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><CheckSquare2 className="size-3.5" aria-hidden /> 체크 항목</button>
                        <button type="button" disabled={Boolean(active.archivedAt)} onClick={() => {
                          const now = new Date();
                          insertSimpleText(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} `);
                        }} className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-2xs font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Clock3 className="size-3.5" aria-hidden /> 날짜·시각</button>
                      </div>
                      <textarea ref={textareaRef} value={active.body} onChange={(event) => patchActive({ body: event.target.value })} onBlur={flushPending} readOnly={Boolean(active.archivedAt)} maxLength={SIMPLE_LIMIT} aria-label="Simple 메모 본문" placeholder="회의 메모, 링크, 떠오른 아이디어를 자유롭게 적어보세요." className={cn("w-full flex-1 resize-none bg-transparent px-6 py-6 text-sm leading-7 text-text outline-none placeholder:text-text-quaternary read-only:cursor-default", isLarge ? "h-[min(62dvh,40rem)] min-h-80" : "h-[min(24rem,calc(100dvh-13rem))] min-h-60")} />
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-0.5 border-b border-separator bg-surface-2/60 px-3 py-2" role="toolbar" aria-label="문서 서식">
                        {[
                          { label: "제목 1", icon: Heading1, command: "formatBlock", value: "h1" },
                          { label: "제목 2", icon: Heading2, command: "formatBlock", value: "h2" },
                          { label: "굵게", icon: Bold, command: "bold" },
                          { label: "기울임", icon: Italic, command: "italic" },
                          { label: "밑줄", icon: Underline, command: "underline" },
                          { label: "글머리 목록", icon: List, command: "insertUnorderedList" },
                          { label: "번호 목록", icon: ListOrdered, command: "insertOrderedList" },
                          { label: "인용", icon: Quote, command: "formatBlock", value: "blockquote" },
                        ].map(({ label, icon: Icon, command, value }) => (
                          <button key={label} type="button" disabled={Boolean(active.archivedAt)} onMouseDown={(event) => event.preventDefault()} onClick={() => runRichCommand(command, value)} aria-label={label} title={label} className="grid size-8 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface hover:text-text disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="size-3.5" aria-hidden /></button>
                        ))}
                      </div>
                      <div className="h-[min(64dvh,43rem)] min-h-96 flex-1 overflow-hidden">
                        <RichEditor key={active.id} documentId={active.id} initialBody={active.body} disabled={Boolean(active.archivedAt)} onChange={(body) => patchActive({ body })} editorRef={richEditorRef} />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="grid min-h-80 flex-1 place-items-center px-6 py-16 text-center">
                  <div>
                    <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent-soft text-accent"><NotebookPen className="size-5" aria-hidden /></span>
                    <h2 className="mt-4 text-lg font-semibold text-text">기록할 공간을 만들어 보세요</h2>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-text-tertiary">Simple은 빠른 메모에, Deep은 서식이 필요한 긴 문서에 잘 맞습니다.</p>
                    <div className="mt-5 flex justify-center gap-2">
                      <button type="button" onClick={() => createDocument("simple")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="size-3.5" aria-hidden /> Simple 메모</button>
                      <button type="button" onClick={() => createDocument("deep")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FileText className="size-3.5" aria-hidden /> Deep 문서</button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <footer className="flex min-h-10 items-center justify-between border-t border-separator bg-surface-2/70 px-4 text-2xs text-text-tertiary">
            <span>{active ? `${characterCount.toLocaleString()} / ${characterLimit.toLocaleString()}자` : "문서는 자동 저장됩니다."}</span>
            <span role="status" className="flex min-h-5 items-center gap-1 font-semibold">
              {state === "saving" && <><Loader2 className="size-3 animate-spin" aria-hidden />저장 중</>}
              {state === "saved" && <><Check className="size-3 text-status-done" aria-hidden />저장됨</>}
              {state === "error" && <span className="text-flag-blocked">{error ?? "저장 실패"}</span>}
            </span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
