import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";
import { QuoteArtifactSchema } from "./artifact";

export const schemaVerifier: Verifier = {
  name: "schema",
  run(input: VerifierInput): Check[] {
    if (input.draftArtifact === null) {
      return [{ name: "schema_skipped", verifier: "schema", passed: true, severity: "info", detail: "no draft artifact to validate" }];
    }
    const parsed = QuoteArtifactSchema.safeParse(input.draftArtifact);
    if (parsed.success) {
      return [{ name: "artifact_schema_valid", verifier: "schema", passed: true, severity: "info", detail: "draft artifact matches QuoteArtifact schema" }];
    }
    return [
      {
        name: "artifact_schema_invalid",
        verifier: "schema",
        passed: false,
        severity: "blocking",
        detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      },
    ];
  },
};
