import type {
  AuthorityBoundary,
  BusinessProcedureVersion,
  CommitPolicy,
  EvidencePolicy,
  MemoryPolicy,
  PromotionDecision,
  PromotionReport,
  WorkflowSpec,
} from "@clarityloop/core";

// Static demo data so the dashboard surfaces the replay-benchmark and version-lineage
// panels without any live network. The real values come from the /procedures API
// (apps/web/src/api/procedures.ts) when wired to a backend.

const evidencePolicy: EvidencePolicy = { requiredForClaims: {}, minimumCoverageForCommit: 0.8 };

const commitPolicy: CommitPolicy = {
  autoCommitAllowed: true,
  requireApprovalIf: {
    quoteValueAbove: null,
    discountAbovePct: null,
    evidenceCoverageBelow: null,
    deliveryUnconfirmed: null,
    externalSend: null,
    policyException: null,
  },
  forbiddenActions: [],
  commitEntropyThreshold: 0.3,
};

const memoryPolicy: MemoryPolicy = {
  writeEnabled: true,
  allowedTypes: ["CustomerPreference"],
  minMemoryValueToWrite: 0.1,
  defaultTtlDays: 180,
  maxEntriesPerScope: 50,
  conflictResolution: "prefer_higher_confidence",
};

const authorityBoundary: AuthorityBoundary = {
  autoCommitMaxRiskClass: "L2",
  approvalRequiredFor: [],
  forbiddenActions: [],
  allowedTools: [],
};

const makeSpec = (version: string): WorkflowSpec => ({
  id: `spec-${version}`,
  name: "customer-quote",
  goal: "produce a safe quote",
  version,
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote"] },
  steps: [],
  allowedTools: [],
  evidencePolicy,
  commitPolicy,
  memoryPolicy,
  budgetPolicy: { maxLoopIterations: 8, maxTokens: 20000, maxToolCalls: 12, maxHumanAsks: 2, maxLatencyMs: 60000 },
});

const makeVersion = (
  over: Pick<BusinessProcedureVersion, "id" | "parentVersion" | "createdAt" | "promotedAt"> & {
    workflowVersion: string;
  },
): BusinessProcedureVersion => ({
  id: over.id,
  parentVersion: over.parentVersion,
  name: "customer-quote",
  goal: "produce a safe quote",
  workflowSpec: makeSpec(over.workflowVersion),
  allowedTools: [],
  authorityBoundary,
  evidencePolicy,
  riskClass: "L1",
  commitPolicy,
  memoryPolicy,
  evalResults: [],
  approvalRecord: null,
  rollbackPointer: null,
  runTraces: [],
  createdAt: over.createdAt,
  promotedAt: over.promotedAt,
});

export const DEMO_VERSIONS: BusinessProcedureVersion[] = [
  makeVersion({ id: "pv-1", parentVersion: null, workflowVersion: "v1", createdAt: "2026-06-16T00:00:00Z", promotedAt: "2026-06-16T00:00:00Z" }),
  makeVersion({ id: "pv-1-v2", parentVersion: "pv-1", workflowVersion: "v2", createdAt: "2026-06-17T00:00:00Z", promotedAt: null }),
];

export const DEMO_PROMOTION_REPORT: PromotionReport = {
  fromVersion: "v1",
  toVersion: "v2",
  caseCount: 4,
  baseline: {
    safeCompletionRate: 0.25,
    falseCommitRate: 0.25,
    policyViolationRate: 0,
    approvalBurden: 0.5,
    evidenceCoverage: 0.75,
    costPerSafeCompletion: 800,
    latencyPerSafeCompletion: 400,
    memoryBloatRate: 0,
  },
  candidate: {
    safeCompletionRate: 1,
    falseCommitRate: 0,
    policyViolationRate: 0,
    approvalBurden: 0,
    evidenceCoverage: 1,
    costPerSafeCompletion: 500,
    latencyPerSafeCompletion: 250,
    memoryBloatRate: 0,
  },
};

export const DEMO_PROMOTION_DECISION: PromotionDecision = {
  type: "promote",
  fromVersion: "v1",
  toVersion: "v2",
  report: DEMO_PROMOTION_REPORT,
};
