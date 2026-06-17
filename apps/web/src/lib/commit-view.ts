import type { CommitDecision } from "@clarityloop/core";

export type CommitDecisionTone = "success" | "warning" | "info" | "danger";

export type CommitDecisionView = {
  title: string;
  tone: CommitDecisionTone;
  lines: string[];
  requiresApproval: boolean;
};

export function commitDecisionView(decision: CommitDecision): CommitDecisionView {
  switch (decision.type) {
    case "commit":
      return { title: "Committed", tone: "success", lines: [decision.reason], requiresApproval: false };
    case "needs_approval":
      return {
        title: "Approval required",
        tone: "warning",
        lines: [decision.reason, `Risk class: ${decision.approvalPayload.riskClass}`],
        requiresApproval: true,
      };
    case "needs_more_info":
      return {
        title: "More information needed",
        tone: "info",
        lines: decision.missingFields.map((f) => `Missing: ${f}`),
        requiresApproval: false,
      };
    case "reject":
      return {
        title: "Rejected",
        tone: "danger",
        lines: decision.failedChecks.map((ch) => `${ch.verifier}: ${ch.detail}`),
        requiresApproval: false,
      };
    case "sandbox_only":
      return { title: "Sandbox only", tone: "info", lines: [decision.reason], requiresApproval: false };
  }
}
