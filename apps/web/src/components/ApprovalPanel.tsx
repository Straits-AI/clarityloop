import { useState } from "react";
import type { ApprovalPayload, CommitDecision, RunOutcome } from "@clarityloop/core";
import { commitDecisionView } from "../lib/commit-view";
import { submitApproval } from "../lib/approval-client";

export type ApprovalPanelProps = {
  baseUrl: string;
  decision: CommitDecision;
  traceId: string;
  approver: string;
};

const TONE_CLASS: Record<string, string> = {
  success: "border-green-500 bg-green-50 text-green-900",
  warning: "border-amber-500 bg-amber-50 text-amber-900",
  info: "border-sky-500 bg-sky-50 text-sky-900",
  danger: "border-red-500 bg-red-50 text-red-900",
};

export function ApprovalPanel({ baseUrl, decision, traceId, approver }: ApprovalPanelProps) {
  const view = commitDecisionView(decision);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const payload: ApprovalPayload | null = decision.type === "needs_approval" ? decision.approvalPayload : null;

  async function resolve(d: "approved" | "rejected") {
    if (!payload) return;
    setBusy(true);
    try {
      setOutcome(
        await submitApproval({
          baseUrl,
          approvalPayload: payload,
          decision: d,
          approver,
          note: null,
          traceId,
          artifactId: payload.proposedArtifactId,
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`rounded-lg border p-4 ${TONE_CLASS[view.tone]}`} data-testid="approval-panel">
      <h2 className="text-lg font-semibold">{view.title}</h2>
      {payload && payload.summary ? <p className="mt-1 text-sm italic">{payload.summary}</p> : null}
      <ul className="mt-2 space-y-1 text-sm">
        {view.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {payload && !outcome ? (
        <div className="mt-4 flex gap-2">
          <button
            disabled={busy}
            onClick={() => resolve("approved")}
            className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => resolve("rejected")}
            className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : null}
      {outcome ? (
        <p className="mt-3 text-sm font-medium" data-testid="approval-outcome">
          Outcome: {outcome.type}
        </p>
      ) : null}
    </section>
  );
}
