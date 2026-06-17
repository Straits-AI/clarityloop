import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";
import { schemaVerifier } from "./schema";
import { numericReconciliationVerifier } from "./numeric-reconciliation";
import { evidenceCoverageVerifier } from "./evidence-coverage";
import { policyVerifier } from "./policy";
import { hallucinatedToolVerifier } from "./hallucinated-tool";
import { missingInfoVerifier } from "./missing-info";

export const allVerifiers: Verifier[] = [
  schemaVerifier,
  numericReconciliationVerifier,
  evidenceCoverageVerifier,
  policyVerifier,
  hallucinatedToolVerifier,
  missingInfoVerifier,
];

export function runAllVerifiers(input: VerifierInput): Check[] {
  return allVerifiers.flatMap((v) => v.run(input));
}
