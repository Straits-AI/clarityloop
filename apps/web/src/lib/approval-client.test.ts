import { describe, it, expect } from "vitest";
import { submitApproval } from "./approval-client";
import type { ApprovalPayload } from "@clarityloop/core";

const payload: ApprovalPayload = {
  runId: "run_1",
  riskClass: "L3",
  reason: "high value",
  summary: "s",
  evidence: [],
  proposedArtifactId: "art_1",
  failedChecks: [],
};

describe("submitApproval", () => {
  it("posts the approval and returns the run outcome", async () => {
    let captured: { url: string; body: any } | null = null;
    const fakeFetch = (async (url: string, init: any) => {
      captured = { url, body: JSON.parse(init.body) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          record: { id: "appr_run_1" },
          outcome: { type: "committed", runId: "run_1", traceId: "t1", artifactId: "art_1" },
        }),
      };
    }) as unknown as typeof fetch;

    const outcome = await submitApproval({
      baseUrl: "http://api.test",
      approvalPayload: payload,
      decision: "approved",
      approver: "manager@acme.com",
      note: null,
      traceId: "t1",
      artifactId: "art_1",
      fetchImpl: fakeFetch,
    });

    expect(outcome).toEqual({ type: "committed", runId: "run_1", traceId: "t1", artifactId: "art_1" });
    expect(captured!.url).toBe("http://api.test/approvals/resolve");
    expect(captured!.body.decision).toBe("approved");
  });

  it("throws when the endpoint returns a non-ok status", async () => {
    const fakeFetch = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(
      submitApproval({
        baseUrl: "http://api.test",
        approvalPayload: payload,
        decision: "rejected",
        approver: "x",
        note: null,
        traceId: "t1",
        artifactId: null,
        fetchImpl: fakeFetch,
      }),
    ).rejects.toThrow();
  });
});
