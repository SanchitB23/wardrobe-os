import { describe, expect, it } from "vitest";

import {
  constantTimeEqual,
  signSession,
  verifySession,
} from "@/lib/access/session";

const SECRET = "test-secret-at-least-32-bytes-long-xxxxx";

describe("signSession / verifySession", () => {
  it("round-trips a valid, unexpired token", async () => {
    const exp = Date.now() + 60_000;
    const token = await signSession(exp, SECRET);
    const result = await verifySession(token, SECRET);
    expect(result).toEqual({ valid: true, exp });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession(Date.now() + 60_000, SECRET);
    expect(await verifySession(token, "some-other-secret")).toEqual({ valid: false });
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession(Date.now() + 60_000, SECRET);
    const [, sig] = token.split(".");
    const forged = `${btoa('{"v":1,"exp":9999999999999}').replace(/=+$/, "")}.${sig}`;
    expect(await verifySession(forged, SECRET)).toEqual({ valid: false });
  });

  it("rejects an expired token", async () => {
    const token = await signSession(Date.now() - 1, SECRET);
    expect(await verifySession(token, SECRET)).toEqual({ valid: false });
  });

  it("rejects missing / malformed tokens", async () => {
    expect(await verifySession(undefined, SECRET)).toEqual({ valid: false });
    expect(await verifySession("", SECRET)).toEqual({ valid: false });
    expect(await verifySession("not-a-token", SECRET)).toEqual({ valid: false });
    expect(await verifySession("only.", SECRET)).toEqual({ valid: false });
  });
});

describe("constantTimeEqual", () => {
  it("matches equal strings and rejects unequal ones", () => {
    expect(constantTimeEqual("hunter2", "hunter2")).toBe(true);
    expect(constantTimeEqual("hunter2", "hunter3")).toBe(false);
    expect(constantTimeEqual("short", "longer-value")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
