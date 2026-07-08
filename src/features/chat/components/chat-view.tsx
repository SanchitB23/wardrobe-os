"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BugIcon,
  DatabaseIcon,
  Loader2Icon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";

import { PageHeader } from "@/features/layout";
import { useStylistChat } from "@/features/chat/hooks";
import type { ChatMessage, ToolTraceEntry } from "@/features/chat/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "What should I wear to the office today?",
  "How healthy is my wardrobe?",
  "Which items am I not wearing enough?",
  "What should I buy next?",
  "Find my navy tops.",
];

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ToolTrace({ entries }: { entries: ToolTraceEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {entries.map((entry, i) => (
        <details key={i} className="rounded-md border bg-background/60 p-2 text-xs">
          <summary className="flex cursor-pointer items-center gap-2">
            <WrenchIcon className="size-3.5 text-muted-foreground" />
            <span className="font-mono font-medium">{entry.name}</span>
            <Badge
              variant="secondary"
              className={cn(
                "tabular-nums",
                entry.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {entry.ok ? "ok" : "error"} · {entry.latencyMs}ms
            </Badge>
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded bg-muted/40 p-2 whitespace-pre-wrap break-words">
            {entry.error ? entry.error : pretty(entry.data)}
          </pre>
        </details>
      ))}
    </div>
  );
}

function MessageBubble({ message, debug }: { message: ChatMessage; debug: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {message.content ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : message.streaming && !message.error ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Thinking…
          </span>
        ) : null}

        {message.error ? (
          <p className="text-destructive">{message.error}</p>
        ) : null}

        {!isUser && debug ? <ToolTrace entries={message.toolTrace ?? []} /> : null}

        {!isUser && !message.streaming && (message.latencyMs != null || message.usage) ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {message.cached ? (
              <Badge variant="secondary" className="gap-1">
                <DatabaseIcon className="size-3" />
                cached
              </Badge>
            ) : null}
            {message.latencyMs != null ? (
              <Badge variant="outline" className="tabular-nums">
                {message.latencyMs} ms
              </Badge>
            ) : null}
            {message.usage ? (
              <Badge variant="outline" className="tabular-nums">
                {message.usage.totalTokens} tokens
              </Badge>
            ) : null}
            {!debug && (message.toolTrace?.length ?? 0) > 0 ? (
              <Badge variant="outline">
                {message.toolTrace!.length} tool
                {message.toolTrace!.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ChatView() {
  const { messages, isStreaming, send, reset } = useStylistChat();
  const [input, setInput] = useState("");
  const [debug, setDebug] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const seededRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Deep-link from Today's "Ask the stylist": /chat?q=… auto-sends once.
  useEffect(() => {
    const q = searchParams.get("q");
    if (!seededRef.current && q && messages.length === 0) {
      seededRef.current = true;
      void send(q);
    }
  }, [searchParams, messages.length, send]);

  function submit(text: string) {
    if (!text.trim() || isStreaming) return;
    void send(text);
    setInput("");
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <PageHeader
        title="AI Stylist"
        badge={<Badge variant="secondary">Chat</Badge>}
        description="Ask about your wardrobe in plain language. The stylist answers only via Wardrobe OS tools — it never guesses your data."
        actions={
          <>
            <Button
              variant={debug ? "default" : "outline"}
              onClick={() => setDebug((v) => !v)}
              aria-pressed={debug}
            >
              <BugIcon />
              Debug
            </Button>
            <Button variant="outline" onClick={reset} disabled={messages.length === 0}>
              <Trash2Icon />
              Clear
            </Button>
          </>
        }
      />

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border bg-muted/10 p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <SparklesIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ask me anything about your wardrobe. Try one of these:
            </p>
            <div className="flex max-w-md flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  size="sm"
                  variant="outline"
                  onClick={() => submit(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} debug={debug} />
          ))
        )}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          placeholder="Ask your stylist…  (Enter to send, Shift+Enter for a new line)"
          className="max-h-40 min-h-[2.75rem] flex-1 resize-none"
          disabled={isStreaming}
        />
        <Button type="submit" disabled={isStreaming || !input.trim()}>
          {isStreaming ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          Send
        </Button>
      </form>
    </div>
  );
}
