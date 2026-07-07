"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  PlayIcon,
  RotateCcwIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";

import { PageHeader } from "@/features/layout";
import { PLAYGROUND_BUILDERS } from "@/features/playground/builders";
import { runPlaygroundRequest } from "@/features/playground/client";
import type { PlaygroundRunResult } from "@/features/playground/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PROVIDERS = ["gemini", "openai", "claude"] as const;

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
      {children}
    </pre>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function PlaygroundView() {
  const [builderId, setBuilderId] = useState(PLAYGROUND_BUILDERS[0].id);
  const builder = useMemo(
    () => PLAYGROUND_BUILDERS.find((b) => b.id === builderId) ?? PLAYGROUND_BUILDERS[0],
    [builderId],
  );

  const [provider, setProvider] = useState<string>("gemini");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [inputText, setInputText] = useState(() => pretty(builder.sampleInput));
  const [cacheEnabled, setCacheEnabled] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  function selectBuilder(id: string) {
    const next = PLAYGROUND_BUILDERS.find((b) => b.id === id);
    if (!next) return;
    setBuilderId(id);
    setInputText(pretty(next.sampleInput));
    setInputError(null);
  }

  function loadSample() {
    setInputText(pretty(builder.sampleInput));
    setInputError(null);
  }

  const run = useMutation<PlaygroundRunResult, Error>({
    mutationFn: async () => {
      let input: unknown;
      try {
        input = JSON.parse(inputText);
      } catch {
        throw new Error("Input is not valid JSON.");
      }
      return runPlaygroundRequest({
        builderId,
        provider: provider as (typeof PROVIDERS)[number],
        model: model.trim() || undefined,
        input,
        cacheEnabled,
        forceRefresh,
      });
    },
    onError: (error) => setInputError(error.message),
  });

  const result = run.data;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="AI Playground"
        badge={<Badge variant="secondary">Developer tool</Badge>}
        description="Test prompt builders against the AI service in isolation — prompts, structured input, response, validation, latency, and cache status. Not linked from the app nav."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Config */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>{builder.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Prompt builder">
              <Select
                value={builderId}
                onValueChange={(value) => value && selectBuilder(value)}
              >
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 truncate text-left">{builder.label}</span>
                </SelectTrigger>
                <SelectContent>
                  {PLAYGROUND_BUILDERS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label} ({b.version})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Provider">
                <Select
                  value={provider}
                  onValueChange={(value) => value && setProvider(value)}
                >
                  <SelectTrigger className="w-full">
                    <span className="flex flex-1 truncate text-left capitalize">{provider}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Model">
                <input
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gemini-2.5-flash"
                />
              </Field>
            </div>

            <Field label="Structured input payload (JSON)">
              <Textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setInputError(null);
                }}
                spellCheck={false}
                className="h-56 font-mono text-xs"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <Toggle active={cacheEnabled} onClick={() => setCacheEnabled((v) => !v)}>
                <DatabaseIcon />
                Cache {cacheEnabled ? "on" : "off"}
              </Toggle>
              <Toggle active={forceRefresh} onClick={() => setForceRefresh((v) => !v)}>
                Force refresh
              </Toggle>
              <Button type="button" size="sm" variant="ghost" onClick={loadSample}>
                <RotateCcwIcon />
                Reset sample
              </Button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={() => run.mutate()} disabled={run.isPending}>
                <PlayIcon />
                {run.isPending ? "Running…" : "Run"}
              </Button>
              {inputError ? (
                <span className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircleIcon className="size-4" />
                  {inputError}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {!result && !run.isPending ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <SparklesIcon className="size-7" />
                <p>Configure a builder and press Run to see prompts, response, and validation.</p>
              </CardContent>
            </Card>
          ) : null}

          {result ? <ResultPanels result={result} /> : null}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ result }: { result: PlaygroundRunResult }) {
  const validation = result.validation;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {result.provider ? (
        <Badge variant="secondary" className="capitalize">
          {result.provider}
        </Badge>
      ) : null}
      {result.model ? <Badge variant="secondary">{result.model}</Badge> : null}
      {typeof result.latencyMs === "number" ? (
        <Badge variant="secondary" className="tabular-nums">
          {result.latencyMs} ms
        </Badge>
      ) : null}
      {result.cached === undefined ? (
        <Badge variant="outline">cache off</Badge>
      ) : (
        <Badge variant="secondary" className="gap-1">
          {result.cached ? <DatabaseIcon className="size-3" /> : <SparklesIcon className="size-3" />}
          {result.cached ? "cache hit" : "cache miss"}
        </Badge>
      )}
      {validation ? (
        <Badge
          variant="secondary"
          className={cn(
            "gap-1",
            validation.valid
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive",
          )}
        >
          {validation.valid ? (
            <CheckCircle2Icon className="size-3" />
          ) : (
            <XCircleIcon className="size-3" />
          )}
          {validation.valid ? "valid" : "invalid"}
        </Badge>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ResultPanels({ result }: { result: PlaygroundRunResult }) {
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MetaRow result={result} />
          {result.error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              <span className="break-words">{result.error}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {result.systemPrompt ? (
        <Section title="System prompt">
          <CodeBlock>{result.systemPrompt}</CodeBlock>
        </Section>
      ) : null}

      <Section title="User prompt">
        <CodeBlock>{result.userPrompt}</CodeBlock>
      </Section>

      <Section title="Structured input payload">
        <CodeBlock>{pretty(result.input)}</CodeBlock>
      </Section>

      {result.responseText ? (
        <Section title="Response (raw)">
          <CodeBlock>{result.responseText}</CodeBlock>
        </Section>
      ) : null}

      {result.responseJson !== undefined ? (
        <Section title="Response JSON (parsed)">
          <CodeBlock>{pretty(result.responseJson)}</CodeBlock>
        </Section>
      ) : null}

      {result.validation && !result.validation.valid ? (
        <Section title="Validation errors">
          <ul className="list-disc space-y-0.5 pl-4 text-sm text-destructive">
            {result.validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
