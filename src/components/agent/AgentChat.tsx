"use client";

import { memo, useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import type { RunView } from "@/lib/agent/runs";
import { RunCard } from "./RunCard";

/**
 * The AI agent's chat, opened from the header by privileged operators.
 * The agent can look things up straight away; any change comes back as a plan
 * card that must be confirmed here before the server executes it.
 *
 * Performance: the text box keeps its own state (`Composer`) and the
 * conversation is memoised (`Conversation`), so a keystroke re-renders only the
 * text box, however long the conversation is.
 */

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  run?: RunView | null;
  /** Shown to the operator but never sent back to the model. */
  isError?: boolean;
  notice?: string;
};

type StreamEvent =
  | { type: "status"; label: string }
  | { type: "reply"; text: string; run: RunView | null }
  | { type: "error"; message: string };

const STORAGE_KEY = "palhak-agent-chat-v1";

const EXAMPLES = [
  "מה חתום על …? (שם חייל)",
  "כמה קרטונים יש, וכמה מהם לא מלאים?",
  "מה אזל או עומד להיגמר בימ״ח?",
  "אילו בקשות פתוחות מחכות לטיפול?",
  "תחתים את … על 2 … מהימ״ח",
];

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStored(): ChatItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ChatItem[]) : [];
  } catch {
    return [];
  }
}

function SparkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 4.9a2 2 0 0 0 1.2 1.2L20 11l-5 1.9a2 2 0 0 0-1.2 1.2L12 19l-1.8-4.9a2 2 0 0 0-1.2-1.2L4 11l5-1.9a2 2 0 0 0 1.2-1.2L12 3z" />
      <path d="M19 3v3M20.5 4.5h-3M5 17v3M6.5 18.5h-3" />
    </svg>
  );
}

// ─── text box ─────────────────────────────────────────────────────────────────

type ComposerHandle = { setText: (text: string) => void; focus: () => void };

const Composer = memo(function Composer({
  ref,
  busy,
  onSend,
}: {
  ref: Ref<ComposerHandle>;
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      setText: (text: string) => {
        setDraft(text);
        inputRef.current?.focus();
      },
      focus: () => inputRef.current?.focus(),
    }),
    [],
  );

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    onSend(text);
  };

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={inputRef}
        data-testid="agent-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        dir="auto"
        maxLength={4000}
        placeholder="מה לעשות?"
        aria-label="הודעה לסוכן"
        className="max-h-36 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-base leading-6 text-zinc-50 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        style={{ fieldSizing: "content" } as React.CSSProperties}
      />
      <button
        type="submit"
        data-testid="agent-send"
        disabled={busy || !draft.trim()}
        aria-label="שלח"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-40"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="-scale-x-100">
          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    </form>
  );
});

// ─── conversation ─────────────────────────────────────────────────────────────

const Message = memo(function Message({
  item,
  now,
  busy,
  onAct,
}: {
  item: ChatItem;
  now: number;
  busy: boolean;
  onAct: (runId: string, kind: "confirm" | "cancel") => void;
}) {
  const runId = item.run?.id;
  return (
    <div className={`flex flex-col gap-2 ${item.role === "user" ? "items-start" : "items-stretch"}`}>
      {item.text && (
        <div
          dir="auto"
          data-testid={item.role === "user" ? "agent-user-msg" : item.isError ? "agent-error-msg" : "agent-reply"}
          className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-6 ${
            item.role === "user"
              ? "self-start rounded-ss-md bg-emerald-700 text-white"
              : item.isError
                ? "self-end rounded-se-md border border-red-800 bg-red-950 text-red-100"
                : "self-end rounded-se-md bg-zinc-800 text-zinc-50"
          }`}
        >
          {item.text}
        </div>
      )}
      {item.run && runId && (
        <RunCard
          run={item.run}
          now={now}
          busy={busy}
          notice={item.notice}
          onConfirm={() => onAct(runId, "confirm")}
          onCancel={() => onAct(runId, "cancel")}
        />
      )}
    </div>
  );
});

const Conversation = memo(function Conversation({
  items,
  now,
  busy,
  status,
  runBusy,
  onAct,
  onExample,
}: {
  items: ChatItem[];
  now: number;
  busy: boolean;
  status: string;
  runBusy: string | null;
  onAct: (runId: string, kind: "confirm" | "cancel") => void;
  onExample: (text: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [items, status, busy]);

  return (
    <div className="flex min-h-[46dvh] flex-col gap-3 sm:min-h-[420px]" role="log" aria-live="polite" data-testid="agent-log">
      {items.length === 0 && (
        <div className="my-auto flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <SparkIcon size={26} />
          </div>
          <div>
            <div className="text-base font-bold text-zinc-100">במה לעזור?</div>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-zinc-400">
              אפשר לשאול על כל מה שיש במערכת: חיילים, ציוד, קרטונים, מלאי, בקשות ות״ש, ולבקש פעולות. לפני כל שינוי תוצג תוכנית לאישורך, ובסיום תקבל קבלה. הפעולה נרשמת בהיסטוריה על שמך, עם סימון שבוצעה באמצעות הסוכן.
            </p>
          </div>
          <div className="flex w-full max-w-md flex-col gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => onExample(ex.replace(/\s*\(.*\)$/, ""))}
                className="min-h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-start text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {items.map((item) => (
        <Message key={item.id} item={item} now={now} busy={Boolean(item.run && runBusy === item.run.id)} onAct={onAct} />
      ))}

      {busy && (
        <div className="flex items-center gap-2 self-end rounded-2xl bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-300" data-testid="agent-status">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
          </span>
          {status}…
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
});

// ─── the chat ─────────────────────────────────────────────────────────────────

export function AgentChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatItem[]>(loadStored);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [runBusy, setRunBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const composerRef = useRef<ComposerHandle>(null);
  // Latest values for the stable callbacks below (so memoised children are not re-rendered needlessly).
  const live = useRef({ items, busy, runBusy });
  useEffect(() => {
    live.current = { items, busy, runBusy };
  });

  // Keep the conversation while the operator moves between screens (this tab only).
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-60)));
    } catch {
      /* storage unavailable: the chat still works for this page */
    }
  }, [items]);

  // A plan that is waiting visibly expires without a reload.
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const openChat = () => {
    setNow(Date.now());
    setOpen(true);
    window.setTimeout(() => composerRef.current?.focus(), 250);
  };
  const closeChat = useCallback(() => setOpen(false), []);

  const send = useCallback(async (text: string) => {
    if (live.current.busy) return;
    const userItem: ChatItem = { id: newId(), role: "user", text };
    const history = [...live.current.items, userItem];
    setItems(history);
    setBusy(true);
    setStatus("חושב");

    const fail = (message: string) => setItems((prev) => [...prev, { id: newId(), role: "assistant", text: message, isError: true }]);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => !m.isError)
            .map((m) => ({ role: m.role, text: m.text, ...(m.run ? { runId: m.run.id } : {}) })),
        }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        fail(body?.message ?? "הסוכן לא זמין כרגע. נסה שוב.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answered = false;
      const handle = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as StreamEvent;
        if (event.type === "status") setStatus(event.label);
        else if (event.type === "reply") {
          answered = true;
          setItems((prev) => [...prev, { id: newId(), role: "assistant", text: event.text, run: event.run }]);
        } else if (event.type === "error") {
          answered = true;
          fail(event.message);
        }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer);
      if (!answered) fail("החיבור נקטע לפני שהתקבלה תשובה. שום דבר לא בוצע.");
    } catch {
      fail("אין חיבור לשרת. שום דבר לא בוצע.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }, []);

  const act = useCallback(
    async (runId: string, kind: "confirm" | "cancel") => {
      if (live.current.runBusy) return;
      const patchRun = (patch: Partial<Pick<ChatItem, "run" | "notice">>) =>
        setItems((prev) => prev.map((it) => (it.run?.id === runId ? { ...it, ...patch } : it)));
      setRunBusy(runId);
      try {
        const res = await fetch(`/api/agent/runs/${runId}/${kind}`, { method: "POST" });
        const body = (await res.json().catch(() => null)) as { run?: RunView; message?: string } | null;
        if (res.ok && body?.run) {
          patchRun({ run: body.run, notice: undefined });
          // The screens behind the chat show the new data straight away.
          if (kind === "confirm") router.refresh();
        } else {
          patchRun({ notice: body?.message ?? "הפעולה לא הושלמה. בדוק במסכי המערכת מה בוצע." });
        }
      } catch {
        patchRun({ notice: "אין חיבור לשרת. בדוק במסך ההיסטוריה של הסוכן אם התוכנית בוצעה לפני שתנסה שוב." });
      } finally {
        setRunBusy(null);
        setNow(Date.now());
      }
    },
    [router],
  );

  const fillExample = useCallback((text: string) => composerRef.current?.setText(text), []);

  const reset = () => {
    if (busy || runBusy) return;
    setItems([]);
    composerRef.current?.setText("");
  };

  return (
    <>
      <button
        type="button"
        data-testid="agent-open"
        onClick={openChat}
        aria-label="סוכן AI"
        title="סוכן AI"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border transition hover:scale-105 active:scale-95"
        style={{
          borderColor: "var(--t-border)",
          color: "var(--t-accent)",
          background: "color-mix(in srgb, var(--t-accent) 12%, transparent)",
        }}
      >
        <SparkIcon />
      </button>

      <Sheet
        open={open}
        onClose={closeChat}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <span className="text-emerald-500">
              <SparkIcon size={20} />
            </span>
            סוכן AI
          </span>
        }
        subtitle="מחפש ועונה מיד. כל שינוי מתבצע רק אחרי שתאשר."
        headerExtra={
          items.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              disabled={busy || Boolean(runBusy)}
              className="mt-1 text-xs font-bold text-zinc-400 underline-offset-2 transition hover:text-zinc-100 hover:underline disabled:opacity-50"
            >
              שיחה חדשה
            </button>
          ) : undefined
        }
        footer={<Composer ref={composerRef} busy={busy} onSend={send} />}
      >
        <Conversation items={items} now={now} busy={busy} status={status} runBusy={runBusy} onAct={act} onExample={fillExample} />
      </Sheet>
    </>
  );
}
