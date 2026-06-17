import { z } from "zod";
import { WorkflowStepSchema } from "./workflow";
import type { WorkflowSpec } from "./types";

/** One structural edit to a WorkflowSpec. Qwen proposes these; code applies them. */
export const WorkflowPatchOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("insert_step"),
    afterStepId: z.string().nullable(), // null => insert at the front
    step: WorkflowStepSchema,
  }),
  z.object({ op: z.literal("remove_step"), stepId: z.string() }),
  z.object({ op: z.literal("replace_step"), stepId: z.string(), step: WorkflowStepSchema }),
  z.object({ op: z.literal("set_commit_threshold"), commitEntropyThreshold: z.number().min(0).max(1) }),
]);
export type WorkflowPatchOp = z.infer<typeof WorkflowPatchOpSchema>;

/** A Qwen-proposed, schema-validated workflow improvement (design spec §5 improvement loop). */
export const WorkflowPatchSchema = z.object({
  id: z.string(),
  rationale: z.string(),
  triggerCondition: z.string(), // NL condition, e.g. "inquiry contains 'same as last time'"
  sourceTraceId: z.string().nullable(),
  ops: z.array(WorkflowPatchOpSchema).min(1),
  expectedEntropyReduction: z.number(),
});
export type WorkflowPatch = z.infer<typeof WorkflowPatchSchema>;

/** Bump a trailing integer version: "v1" -> "v2", "1.2.0" -> "1.2.1". */
function bumpVersion(v: string): string {
  const m = v.match(/^(.*?)(\d+)$/);
  if (!m) return `${v}.1`;
  const [, prefix, num] = m;
  return `${prefix}${Number(num) + 1}`;
}

/**
 * Deterministically apply a WorkflowPatch to a WorkflowSpec, returning a NEW spec
 * (immutable) with a bumped version. Throws on an op that references a missing step.
 */
export function applyPatch(spec: WorkflowSpec, patch: WorkflowPatch): WorkflowSpec {
  let steps = [...spec.steps];
  let commitPolicy = { ...spec.commitPolicy };

  for (const op of patch.ops) {
    switch (op.op) {
      case "insert_step": {
        if (op.afterStepId === null) {
          steps = [op.step, ...steps];
          break;
        }
        const idx = steps.findIndex((s) => s.id === op.afterStepId);
        if (idx === -1) throw new Error(`insert_step: afterStepId '${op.afterStepId}' not found`);
        steps = [...steps.slice(0, idx + 1), op.step, ...steps.slice(idx + 1)];
        break;
      }
      case "remove_step": {
        const idx = steps.findIndex((s) => s.id === op.stepId);
        if (idx === -1) throw new Error(`remove_step: stepId '${op.stepId}' not found`);
        steps = steps.filter((s) => s.id !== op.stepId);
        break;
      }
      case "replace_step": {
        const idx = steps.findIndex((s) => s.id === op.stepId);
        if (idx === -1) throw new Error(`replace_step: stepId '${op.stepId}' not found`);
        steps = steps.map((s) => (s.id === op.stepId ? op.step : s));
        break;
      }
      case "set_commit_threshold": {
        commitPolicy = { ...commitPolicy, commitEntropyThreshold: op.commitEntropyThreshold };
        break;
      }
    }
  }

  return { ...spec, version: bumpVersion(spec.version), steps, commitPolicy };
}
