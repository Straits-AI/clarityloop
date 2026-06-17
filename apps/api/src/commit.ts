import { z } from "zod";
import {
  AuthorityBoundarySchema,
  EvidenceRefSchema,
  LatentWorkflowStateSchema,
  WorkflowSpecSchema,
  classifyRiskClass,
  commitDecisionToOutcome,
  runCommitGate,
  scoreEntropy,
  type CommitDecision,
  type RunOutcome,
} from "@clarityloop/core";
import { computeEvidenceCoverage, runAllVerifiers } from "@clarityloop/verifiers";
import type { ModelProvider } from "@clarityloop/qwen";
import { authorityCategoryChecks } from "./authority-checks";

export const RiskSignalsSchema = z.object({
  structuralChange: z.boolean(),
  legalSensitive: z.boolean(),
  policyException: z.boolean(),
  quoteValue: z.number().nullable(),
  discountPct: z.number().nullable(),
  externalSend: z.boolean(),
  producesArtifact: z.boolean(),
  reversible: z.boolean(),
});

export const CommitRequestSchema = z.object({
  runId: z.string(),
  traceId: z.string(),
  state: LatentWorkflowStateSchema,
  evidence: z.array(EvidenceRefSchema),
  workflowSpec: WorkflowSpecSchema,
  authorityBoundary: AuthorityBoundarySchema,
  riskSignals: RiskSignalsSchema,
  draftArtifact: z.unknown().nullable(),
  proposedArtifactId: z.string().nullable(),
});
export type CommitRequest = z.infer<typeof CommitRequestSchema>;

export type CommitResponse = {
  decision: CommitDecision;
  outcome: RunOutcome;
  riskClass: string;
  evidenceCoverage: number;
};

/** Compose verifiers + entropy + risk classification + commit gate; enrich any approval payload. */
export async function runCommitPipeline(provider: ModelProvider, req: CommitRequest): Promise<CommitResponse> {
  const checks = [
    ...runAllVerifiers({
      state: req.state,
      evidence: req.evidence,
      workflowSpec: req.workflowSpec,
      draftArtifact: req.draftArtifact ?? null,
    }),
    ...authorityCategoryChecks(req.riskSignals, req.workflowSpec.commitPolicy),
  ];
  const entropy = scoreEntropy(req.state);
  const evidenceCoverage = computeEvidenceCoverage(req.state, req.evidence);
  const riskClass = classifyRiskClass(req.riskSignals, req.workflowSpec.commitPolicy);

  let decision = runCommitGate({
    state: req.state,
    entropy,
    checks,
    evidenceCoverage,
    commitPolicy: req.workflowSpec.commitPolicy,
    authorityBoundary: req.authorityBoundary,
    riskClass,
  });

  if (decision.type === "needs_approval") {
    const summary = await provider.complete(
      [
        { role: "system", content: "You write a concise audit narrative for a human approver. 2-3 sentences." },
        { role: "user", content: `Goal: ${req.state.goal}. Reason approval is required: ${decision.reason}.` },
      ],
      { task: "audit_narrative" },
    );
    decision = {
      ...decision,
      approvalPayload: {
        ...decision.approvalPayload,
        runId: req.runId,
        summary,
        evidence: req.evidence,
        proposedArtifactId: req.proposedArtifactId,
      },
    };
  }

  const outcome = commitDecisionToOutcome(decision, {
    runId: req.runId,
    traceId: req.traceId,
    artifactId: req.proposedArtifactId,
  });
  return { decision, outcome, riskClass, evidenceCoverage };
}
