import type { Check, EvidenceRef, LatentWorkflowState, VerifierName, WorkflowSpec } from "@clarityloop/core";

export interface VerifierInput {
  state: LatentWorkflowState;
  evidence: EvidenceRef[];
  workflowSpec: WorkflowSpec;
  draftArtifact: unknown | null;
}

export interface Verifier {
  name: VerifierName;
  run(input: VerifierInput): Check[]; // deterministic, synchronous
}
