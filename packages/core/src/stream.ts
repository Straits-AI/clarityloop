import { z } from "zod";
import { LatentWorkflowStateSchema } from "./schemas";
import { EntropyScoreSchema } from "./trace";

/**
 * One frame streamed by the run loop over SSE.
 * Crosses the SSE boundary, so it is zod-validated on both ends.
 * `nextBestAction` is a nullable placeholder until Plan 4's selectNextBestAction.
 * `phase` covers the full loop lifecycle; Plan 3 emits only "scored" and "done",
 * Plans 4–5 begin emitting "extracted" / "acted" / "commit_decided".
 */
export const EntropyUpdateSchema = z.object({
  step: z.number().int().nonnegative(),
  phase: z.enum(["extracted", "scored", "acted", "commit_decided", "done"]),
  state: LatentWorkflowStateSchema,
  entropy: EntropyScoreSchema,
  nextBestAction: z.string().nullable(),
  note: z.string().nullable(),
});
export type EntropyUpdate = z.infer<typeof EntropyUpdateSchema>;
