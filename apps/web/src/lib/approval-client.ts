import type { ApprovalPayload, RunOutcome } from "@clarityloop/core";

export type SubmitApprovalArgs = {
  baseUrl: string;
  approvalPayload: ApprovalPayload;
  decision: "approved" | "rejected";
  approver: string;
  note: string | null;
  traceId: string;
  artifactId: string | null;
  fetchImpl?: typeof fetch;
};

export async function submitApproval(args: SubmitApprovalArgs): Promise<RunOutcome> {
  const f = args.fetchImpl ?? fetch;
  const res = await f(`${args.baseUrl}/approvals/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      approvalPayload: args.approvalPayload,
      decision: args.decision,
      approver: args.approver,
      note: args.note,
      traceId: args.traceId,
      artifactId: args.artifactId,
    }),
  });
  if (!res.ok) throw new Error(`approval failed: ${res.status}`);
  const body = (await res.json()) as { record: unknown; outcome: RunOutcome };
  return body.outcome;
}
