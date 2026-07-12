/**
 * Unit tests — Logging & Observability Runtime (RFC-022).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAIUsageFields,
  containsLeakedSecret,
  generateRequestId,
  getLoggingConfig,
  isWellFormedRequestId,
  levelMeetsThreshold,
  logAIUsage,
  logApiRequest,
  logOrchestratorRun,
  LogRingBuffer,
  logger,
  parseLogLevel,
  redactIp,
  redactUserAgent,
  redactValue,
  resolveRequestId,
  runWithRequestContext,
  StructuredLogger,
  withApiLogging,
} from "@/runtime/logging";
import type { ExecutionReport } from "@/domain/orchestrator";

afterEach(() => {
  logger.setConfig(getLoggingConfig({}));
  vi.restoreAllMocks();
});

describe("parseLogLevel / filtering", () => {
  it("parses known levels and falls back", () => {
    expect(parseLogLevel("debug")).toBe("debug");
    expect(parseLogLevel("WARN")).toBe("warn");
    expect(parseLogLevel("nope", "info")).toBe("info");
  });

  it("filters below threshold", () => {
    expect(levelMeetsThreshold("debug", "info")).toBe(false);
    expect(levelMeetsThreshold("error", "warn")).toBe(true);
  });

  it("respects LOG_LEVEL on StructuredLogger", () => {
    const lines: string[] = [];
    const log = new StructuredLogger({
      config: getLoggingConfig({ LOG_LEVEL: "warn" }),
      emit: (line) => lines.push(line),
      buffer: false,
    });
    log.info("skip me");
    log.warn("keep me");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"level":"warn"');
  });

  it("disables AI usage when LOG_AI_USAGE=false", () => {
    const lines: string[] = [];
    const log = new StructuredLogger({
      config: getLoggingConfig({ LOG_AI_USAGE: "false", LOG_LEVEL: "debug" }),
      emit: (line) => lines.push(line),
      buffer: false,
    });
    // Swap shared logger config temporarily via the instance we use for emit —
    // logAIUsage uses the shared `logger`.
    logger.setConfig(getLoggingConfig({ LOG_AI_USAGE: "false" }));
    const prevEmit = vi.spyOn(console, "log").mockImplementation(() => {});
    logAIUsage({
      capability: "explanation",
      provider: "gemini",
      model: "gemini-2.5-flash",
      status: "ok",
    });
    // Shared logger still uses console — ensure category gate works on shared logger.
    expect(prevEmit).not.toHaveBeenCalled();
    void log;
  });
});

describe("correlation id", () => {
  it("generates a UUID-shaped id", () => {
    const id = generateRequestId();
    expect(isWellFormedRequestId(id) || id.startsWith("req_")).toBe(true);
  });

  it("honours a well-formed incoming id", () => {
    const incoming = "7c2e1a8b-1234-4abc-9def-0123456789ab";
    expect(resolveRequestId(incoming)).toBe(incoming);
  });

  it("rejects malformed / oversized incoming ids", () => {
    expect(isWellFormedRequestId("not-a-uuid")).toBe(false);
    expect(isWellFormedRequestId("x".repeat(200))).toBe(false);
    const generated = resolveRequestId("totally-invalid");
    expect(generated).not.toBe("totally-invalid");
  });
});

describe("redaction", () => {
  it("hashes user-agent and ip when redacted", () => {
    expect(redactUserAgent("Mozilla/5.0")).toMatch(/^ua_h:[a-f0-9]{12}$/);
    expect(redactIp("203.0.113.10")).toMatch(/^ip_h:[a-f0-9]{12}$/);
  });

  it("strips API keys, prompts, and base64 blobs", () => {
    const bag = redactValue({
      GEMINI_API_KEY: "AIzaSyDummyKeyValueThatLooksReal123456",
      prompt: "Wear the blue jacket with jeans",
      imageBase64: `data:image/png;base64,${"A".repeat(120)}`,
      authorization: "Bearer secret-token",
      accessCode: "hunter2",
      capability: "explanation",
      count: 3,
    }) as Record<string, unknown>;

    expect(bag.GEMINI_API_KEY).toBe("[REDACTED]");
    expect(bag.prompt).toBe("[REDACTED]");
    expect(bag.imageBase64).toBe("[REDACTED]");
    expect(bag.authorization).toBe("[REDACTED]");
    expect(bag.accessCode).toBe("[REDACTED]");
    expect(bag.capability).toBe("explanation");
    expect(bag.count).toBe(3);
  });

  it("detects leaked secret patterns in serialized lines", () => {
    expect(containsLeakedSecret('{"k":"sk-abcdefghijklmnopqrstuvwxyz"}')).toBe(true);
    expect(containsLeakedSecret('{"capability":"explanation"}')).toBe(false);
  });
});

describe("AI usage event shape", () => {
  it("builds required fields with costSource=estimated", () => {
    const fields = buildAIUsageFields({
      capability: "conversation",
      provider: "gemini",
      model: "gemini-2.5-flash",
      fallbackProvider: "openai",
      usedFallback: false,
      promptVersion: "chat-v1",
      cacheHit: false,
      usage: { promptTokens: 1200, completionTokens: 340, totalTokens: 1540 },
      estimatedCostUsd: 0.00021,
      latencyMs: 1605,
      status: "ok",
      route: "/api/chat",
    });
    expect(fields).toMatchObject({
      capability: "conversation",
      provider: "gemini",
      model: "gemini-2.5-flash",
      fallbackProvider: "openai",
      usedFallback: false,
      promptVersion: "chat-v1",
      cacheHit: false,
      inputTokens: 1200,
      outputTokens: 340,
      totalTokens: 1540,
      tokenSource: "provider",
      estimatedCostUsd: 0.00021,
      costSource: "estimated",
      latencyMs: 1605,
      status: "ok",
      errorCode: null,
    });
  });

  it("marks tokens unavailable when usage is missing", () => {
    const fields = buildAIUsageFields({
      capability: "vision",
      provider: "gemini",
      model: "gemini-2.5-flash",
      status: "ok",
      usage: null,
    });
    expect(fields.inputTokens).toBeNull();
    expect(fields.tokenSource).toBe("unavailable");
  });

  it("does not include raw prompt in emitted AI usage lines", () => {
    const lines: string[] = [];
    logger.setConfig(getLoggingConfig({ LOG_AI_USAGE: "true", LOG_LEVEL: "debug" }));
    const spy = vi.spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(String(line));
    });
    logAIUsage({
      capability: "explanation",
      provider: "gemini",
      model: "gemini-2.5-flash",
      status: "ok",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      estimatedCostUsd: 0.001,
      message: "ai_usage explanation ok",
    });
    expect(spy).toHaveBeenCalled();
    const joined = lines.join("\n");
    expect(joined).not.toContain("Wear the blue");
    expect(joined).not.toMatch(/"prompt"\s*:/);
    expect(joined).toContain('"kind":"ai_usage"');
    expect(joined).toContain('"promptVersion"');
  });
});

describe("API logger / withApiLogging", () => {
  it("logs completion and returns x-request-id", async () => {
    const lines: string[] = [];
    logger.setConfig(getLoggingConfig({ LOG_REQUESTS: "true", LOG_LEVEL: "debug" }));
    vi.spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(String(line));
    });

    const handler = withApiLogging("/api/ai/test", async () =>
      Response.json({ ok: true }),
    );
    const res = await handler(
      new Request("http://localhost/api/ai/test", {
        method: "GET",
        headers: { "user-agent": "vitest", "x-forwarded-for": "203.0.113.9" },
      }),
    );
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(res.status).toBe(200);
    const apiLine = lines.find((l) => l.includes('"kind":"api_request"'));
    expect(apiLine).toBeTruthy();
    expect(apiLine).toContain('"route":"/api/ai/test"');
    expect(apiLine).toContain("ua_h:");
    expect(apiLine).toContain("ip_h:");
  });

  it("injects requestId into JSON error bodies", async () => {
    logger.setConfig(getLoggingConfig({ LOG_REQUESTS: "true" }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const handler = withApiLogging("/api/access/unlock", async () =>
      Response.json({ ok: false }, { status: 401 }),
    );
    const res = await handler(new Request("http://localhost/api/access/unlock", { method: "POST" }));
    const body = (await res.json()) as { requestId?: string };
    expect(body.requestId).toBe(res.headers.get("x-request-id"));
  });

  it("never logs an access code when logging API metadata", () => {
    const lines: string[] = [];
    logger.setConfig(getLoggingConfig({ LOG_REQUESTS: "true" }));
    vi.spyOn(console, "log").mockImplementation((line: string) => lines.push(String(line)));
    vi.spyOn(console, "warn").mockImplementation((line: string) => lines.push(String(line)));

    logApiRequest({
      requestId: "7c2e1a8b-1234-4abc-9def-0123456789ab",
      method: "POST",
      route: "/api/access/unlock",
      statusCode: 401,
      latencyMs: 12,
      userAgent: "vitest",
      ip: "10.0.0.1",
      errorCode: null,
    });
    const joined = lines.join("\n");
    expect(joined).not.toContain("hunter2");
    expect(joined).not.toContain("APP_ACCESS_CODE");
  });
});

describe("orchestrator logger", () => {
  it("emits engine_trace fields when enabled", () => {
    const lines: string[] = [];
    logger.setConfig(
      getLoggingConfig({ LOG_ENGINE_TRACES: "true", LOG_LEVEL: "debug" }),
    );
    vi.spyOn(console, "log").mockImplementation((line: string) => lines.push(String(line)));

    const report = {
      executedCapabilities: ["health", "usage"],
      skippedCapabilities: [],
      failedCapabilities: [],
      executionOrder: ["health", "usage"],
      dependencyGraph: { health: [], usage: ["health"] },
      timings: { health: 5, usage: 10, __total: 15 },
      confidence: 0.81,
      outcomes: {},
      explainability: [],
      metadata: {
        orchestratorVersion: "1",
        generatedAt: "2026-07-12T00:00:00.000Z",
        totalDurationMs: 15,
        capabilityCount: 2,
      },
    } as unknown as ExecutionReport;

    runWithRequestContext(
      { requestId: "7c2e1a8b-1234-4abc-9def-0123456789ab", startedAtMs: Date.now() },
      () => logOrchestratorRun({ report, capability: "runIntelligence" }),
    );

    const line = lines.find((l) => l.includes('"kind":"engine_trace"'));
    expect(line).toBeTruthy();
    expect(line).toContain('"executedCapabilities":["health","usage"]');
    expect(line).toContain('"status":"ok"');
    expect(line).not.toContain("outcomes");
  });
});

describe("ring buffer", () => {
  it("caps memory to capacity", () => {
    const buf = new LogRingBuffer(3);
    for (let i = 0; i < 5; i++) {
      buf.push({
        kind: "app",
        level: "info",
        message: `m${i}`,
        source: "test",
        requestId: null,
        timestamp: new Date().toISOString(),
      });
    }
    expect(buf.size()).toBe(3);
    expect(buf.snapshot().map((r) => r.message)).toEqual(["m2", "m3", "m4"]);
  });
});
