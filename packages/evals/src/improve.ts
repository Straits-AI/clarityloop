import { z } from "zod";
import { generateStructured } from "@clarityloop/qwen";
import type { ChatMessage, ModelProvider } from "@clarityloop/qwen";
import {
  applyPatch,
  EntropyScoreSchema,
  runPromotionGate,
  WorkflowPatchSchema,
  WorkflowStepSchema,
  WorkflowDomainSchema,
} from "@clarityloop/core";
import type {
  BusinessProcedureVersion,
  PromotionDecision,
  PromotionReport,
  WorkflowPatch,
  WorkflowSpec,
} from "@clarityloop/core";
import { runReplay } from "./replay";
import type { BenchmarkCase } from "./cases";

/** Compact failure summary handed to Qwen for analysis (built from a failed Trace). */
export const FailureContextSchema = z.object({
  procedureVersionId: z.string(),
  domain: WorkflowDomainSchema,
  traceId: z.string(),
  failureSummary: z.string(),
  finalEntropy: EntropyScoreSchema,
  outcomeType: z.enum(["committed", "needs_approval", "needs_more_info", "rejected", "sandbox_only"]),
  currentSteps: z.array(WorkflowStepSchema),
});
export type FailureContext = z.infer<typeof FailureContextSchema>;

function buildMessages(ctx: FailureContext): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a workflow-improvement analyst. Given a failed business-workflow run, propose a " +
        "STRUCTURED WorkflowPatch (insert_step / remove_step / replace_step / set_commit_threshold) " +
        "that would reduce future operational uncertainty. Reply with ONLY a JSON object matching the " +
        "WorkflowPatch schema. Do not include scores or promotion decisions — those are computed by code.",
    },
    {
      role: "user",
      content: JSON.stringify({
        domain: ctx.domain,
        failureSummary: ctx.failureSummary,
        finalEntropy: ctx.finalEntropy,
        outcomeType: ctx.outcomeType,
        currentSteps: ctx.currentSteps,
      }),
    },
  ];
}

/** Qwen proposes; zod validates. Returns a structurally-valid WorkflowPatch or throws. */
export async function proposeWorkflowPatch(
  provider: ModelProvider,
  ctx: FailureContext,
): Promise<WorkflowPatch> {
  return generateStructured(provider, WorkflowPatchSchema, {
    task: "failure_analysis",
    messages: buildMessages(ctx),
  });
}

/** Full offline improvement loop: propose -> apply -> replay -> promotion gate. */
export async function improveAndEvaluate(input: {
  provider: ModelProvider;
  oldVersion: BusinessProcedureVersion;
  failureContext: FailureContext;
  cases: BenchmarkCase[];
}): Promise<{
  patch: WorkflowPatch;
  newSpec: WorkflowSpec;
  report: PromotionReport;
  decision: PromotionDecision;
}> {
  const patch = await proposeWorkflowPatch(input.provider, input.failureContext);
  const oldSpec = input.oldVersion.workflowSpec;
  const newSpec = applyPatch(oldSpec, patch);
  const report = runReplay({
    fromVersion: oldSpec.version,
    toVersion: newSpec.version,
    oldSpec,
    newSpec,
    cases: input.cases,
  });
  const decision = runPromotionGate({
    fromVersion: oldSpec.version,
    toVersion: newSpec.version,
    baseline: report.baseline,
    candidate: report.candidate,
    caseCount: report.caseCount,
  });
  return { patch, newSpec, report, decision };
}
