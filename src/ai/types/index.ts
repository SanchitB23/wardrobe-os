/**
 * AI Infrastructure Layer — core contracts.
 *
 * Pure TypeScript: no React, no database, no provider SDKs, no API keys. This
 * file defines the vendor-neutral interfaces every part of the AI layer speaks.
 * Concrete providers (Gemini/OpenAI/Claude) are stubs today; see src/ai/README.md
 * for the documented extension points.
 */

export * from "@/ai/types/errors";

/**
 * Known provider identifiers. The `(string & {})` keeps the union open so new
 * providers can be added without editing this file (extension point).
 */
export type AIProviderId = "gemini" | "openai" | "claude" | (string & {});

/** What a provider can do — the orchestrator uses this to route requests. */
export interface AICapabilities {
  generate: boolean;
  stream: boolean;
  vision: boolean;
  structuredOutput: boolean;
}

export type AIMessageRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

/** An image input for vision requests. `data` is a URL or base64 string. */
export interface AIImageInput {
  kind: "url" | "base64";
  data: string;
  mimeType: string;
}

/** A vendor-neutral request. Providers translate this into their own SDK shape. */
export interface AIRequest {
  /** Rendered user prompt. */
  prompt: string;
  /** Optional system instruction. */
  system?: string;
  /** Optional multi-turn history (alternative to `prompt`). */
  messages?: AIMessage[];
  /** Provider-agnostic model hint; a provider maps it to a concrete model id. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Requested output shape. "json" asks the provider to emit strict JSON
   * (e.g. Gemini's responseMimeType) — vendor-neutral, providers map it. A
   * ResponseParser still validates the text; this just improves the odds.
   */
  responseFormat?: "text" | "json";
  /** Images for vision() calls. */
  images?: AIImageInput[];
  /** Free-form, provider-specific passthrough (kept opaque here). */
  metadata?: Record<string, unknown>;
}

export type FinishReason =
  | "stop"
  | "length"
  | "content_filter"
  | "error"
  | "unknown";

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** A vendor-neutral response. `parsed` is populated when a parser is supplied. */
export interface AIResponse<T = unknown> {
  text: string;
  parsed?: T;
  provider: AIProviderId;
  model: string;
  finishReason: FinishReason;
  usage?: AIUsage;
  latencyMs?: number;
  /** Opaque provider payload for debugging; never depended on by callers. */
  raw?: unknown;
  /** True when this response was served from the cache rather than the provider. */
  cached?: boolean;
}

export interface AIStreamChunk {
  delta: string;
  done: boolean;
}

/**
 * A single LLM provider. Vendor SDKs live behind this interface only.
 * Requirement 1: generate / stream / vision.
 */
export interface AIProvider {
  readonly id: AIProviderId;
  readonly capabilities: AICapabilities;
  generate(request: AIRequest): Promise<AIResponse>;
  stream(request: AIRequest): AsyncIterable<AIStreamChunk>;
  vision(request: AIRequest): Promise<AIResponse>;
}

// ---------------------------------------------------------------------------
// Prompt building (independent of providers — requirement 4).
// ---------------------------------------------------------------------------

/** Task-shaped input a prompt builder turns into a prompt. */
export interface PromptContext {
  /** Task identifier, e.g. "outfit-suggestion". */
  task: string;
  /** Arbitrary structured data the builder renders into the prompt. */
  data: Record<string, unknown>;
  locale?: string;
  /** Injected timestamp for deterministic prompts. */
  now?: string;
}

/** The prompt a builder produces, ready to become an {@link AIRequest}. */
export interface BuiltPrompt {
  system?: string;
  prompt: string;
  /** Optional schema the model should conform to (drives ResponseParser). */
  schema?: ResponseSchema;
}

/**
 * Turns a {@link PromptContext} into a {@link BuiltPrompt}. Has no knowledge of
 * any provider — the orchestrator wraps its output in an AIRequest.
 */
export interface PromptBuilder<C extends PromptContext = PromptContext> {
  readonly id: string;
  build(context: C): BuiltPrompt;
}

// ---------------------------------------------------------------------------
// Structured output (requirement 5).
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

/** A named schema + validator for structured model output. */
export interface ResponseSchema<T = unknown> {
  name: string;
  description?: string;
  /** Human/model-readable hint appended to prompts (e.g. an example JSON). */
  jsonHint?: string;
  validate(value: unknown): ValidationResult;
  /** Phantom marker for the parsed type; never read at runtime. */
  readonly __type?: T;
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

/** Extracts + validates structured output from raw model text. */
export interface ResponseParser<T> {
  readonly schema: ResponseSchema<T>;
  parse(raw: string): ParseResult<T>;
}

// ---------------------------------------------------------------------------
// Cross-cutting: cache, logging, retry.
// ---------------------------------------------------------------------------

/**
 * A cached AI response plus the metadata needed to persist and expire it.
 * `response` is the stored {@link AIResponse}; `metadata` is opaque raw provider
 * data. `expiresAt` is an ISO timestamp, or null for "never expires".
 */
export interface AICacheEntry {
  key: string;
  provider: AIProviderId;
  model: string;
  promptBuilder: string;
  promptVersion: string;
  inputHash: string;
  response: AIResponse;
  metadata?: unknown;
  createdAt: string;
  expiresAt: string | null;
}

/**
 * Response cache. Implementations MUST NOT return expired entries from `get`.
 * In-memory and Supabase-backed implementations both satisfy this interface.
 */
export interface AICache {
  get(key: string): Promise<AICacheEntry | undefined>;
  set(entry: AICacheEntry): Promise<void>;
}

/**
 * What a caller supplies to make a call cacheable. The orchestrator derives the
 * deterministic cache key from prompt builder + version + model + input, and
 * expires the entry after `ttlSeconds` (omit/0 ⇒ never expires).
 */
export interface AICacheRequest {
  promptBuilder: string;
  promptVersion: string;
  /** Model the key is bound to. Falls back to the request/response model. */
  model?: string;
  /** Structured input payload; hashed into the key. */
  input: unknown;
  ttlSeconds?: number;
}

export type AILogLevel = "debug" | "info" | "warn" | "error";

export interface AILogRecord {
  level: AILogLevel;
  message: string;
  data?: Record<string, unknown>;
}

/** Structured logger the orchestrator emits through. */
export interface AILogger {
  log(record: AILogRecord): void;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
}

// ---------------------------------------------------------------------------
// The service the app consumes (implemented by the orchestrator).
// ---------------------------------------------------------------------------

export interface AICallOptions<T = unknown> {
  /** Force a specific provider; otherwise the orchestrator chooses. */
  provider?: AIProviderId;
  /** Parse + validate structured output into `response.parsed`. */
  parser?: ResponseParser<T>;
  /** Override the retry attempts for this call. */
  retries?: number;
  /** When set, generate() reads/writes the cache (keyed off this descriptor). */
  cache?: AICacheRequest;
  /** Bypass a cache hit and overwrite it with a fresh provider response. */
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

/**
 * The high-level façade the rest of Wardrobe OS will call. The orchestrator is
 * the reference implementation; features depend on this interface, not on any
 * provider.
 */
export interface AIService {
  generate<T = unknown>(
    request: AIRequest,
    options?: AICallOptions<T>,
  ): Promise<AIResponse<T>>;
  stream(
    request: AIRequest,
    options?: AICallOptions,
  ): AsyncIterable<AIStreamChunk>;
  vision<T = unknown>(
    request: AIRequest,
    options?: AICallOptions<T>,
  ): Promise<AIResponse<T>>;
}
