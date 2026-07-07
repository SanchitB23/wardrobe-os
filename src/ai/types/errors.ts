/**
 * AI layer error taxonomy. Pure — no provider SDKs, no network.
 */

export type AIErrorCode =
  | "not_implemented"
  | "provider_error"
  | "no_provider"
  | "parse_error"
  | "timeout"
  | "aborted"
  | "all_providers_failed";

/** Base error for everything the AI layer throws. */
export class AIError extends Error {
  readonly code: AIErrorCode;
  /** Whether the orchestrator may retry / fall back past this error. */
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    code: AIErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}

/** Thrown by provider stubs until a real SDK implementation is wired in. */
export class NotImplementedError extends AIError {
  constructor(provider: string, method: string) {
    super(
      "not_implemented",
      `${provider}.${method}() is not implemented yet — this is a stub. See src/ai/README.md.`,
      { retryable: false },
    );
    this.name = "NotImplementedError";
  }
}

/** A concrete failure from a provider call (network, rate-limit, 5xx, …). */
export class ProviderError extends AIError {
  readonly provider: string;
  constructor(
    provider: string,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super("provider_error", message, { retryable: options.retryable ?? true, cause: options.cause });
    this.name = "ProviderError";
    this.provider = provider;
  }
}

/** Structured-output validation failed. */
export class ParseError extends AIError {
  readonly errors: string[];
  constructor(errors: string[]) {
    super("parse_error", `Response failed validation: ${errors.join("; ")}`, {
      retryable: true,
    });
    this.name = "ParseError";
    this.errors = errors;
  }
}
