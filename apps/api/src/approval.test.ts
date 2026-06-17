import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import type { ModelProvider } from "@clarityloop/qwen";

const fakeProvider: ModelProvider = { async complete() { return "ok"; } };

describe("POST /approvals/resolve", () => {
  it("approved resolves to a committed outcome and records the approval", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/approvals/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        approvalPayload: {
          runId: "run_1",
          riskClass: "L3",
          reason: "high value",
          summary: "audit narrative",
          evidence: [],
          proposedArtifactId: "art_1",
          failedChecks: [],
        },
        decision: "approved",
        approver: "manager@acme.com",
        note: null,
        traceId: "trace_1",
        artifactId: "art_1",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome.type).toBe("committed");
    expect(body.record.decision).toBe("approved");
    expect(body.record.approver).toBe("manager@acme.com");
  });

  it("rejected resolves to a rejected outcome", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/approvals/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        approvalPayload: {
          runId: "run_2",
          riskClass: "L3",
          reason: "policy",
          summary: "s",
          evidence: [],
          proposedArtifactId: null,
          failedChecks: [],
        },
        decision: "rejected",
        approver: "manager@acme.com",
        note: "not this quarter",
        traceId: "trace_2",
        artifactId: null,
      }),
    });
    const body = await res.json();
    expect(body.outcome.type).toBe("rejected");
  });

  it("400s on a malformed body", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/approvals/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "maybe" }),
    });
    expect(res.status).toBe(400);
  });
});
