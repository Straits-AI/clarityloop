import type { Hono } from "hono";
import { z } from "zod";
import { ApprovalPayloadSchema, applyApprovalDecision, type ApprovalRecord } from "@clarityloop/core";

export const ApprovalResolveSchema = z.object({
  approvalPayload: ApprovalPayloadSchema,
  decision: z.enum(["approved", "rejected"]),
  approver: z.string(),
  note: z.string().nullable(),
  traceId: z.string(),
  artifactId: z.string().nullable(),
});

export function registerApprovalRoutes(app: Hono): void {
  app.post("/approvals/resolve", async (c) => {
    const parsed = ApprovalResolveSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const { approvalPayload, decision, approver, note, traceId, artifactId } = parsed.data;

    const outcome = applyApprovalDecision(decision, approvalPayload, {
      runId: approvalPayload.runId,
      traceId,
      artifactId,
    });

    const record: ApprovalRecord = {
      id: `appr_${approvalPayload.runId}`,
      payload: approvalPayload,
      decision,
      approver,
      decidedAt: new Date().toISOString(),
      note,
    };

    return c.json({ record, outcome });
  });
}
