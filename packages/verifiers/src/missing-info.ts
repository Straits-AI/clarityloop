import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";

export const missingInfoVerifier: Verifier = {
  name: "missing_info",
  run(input: VerifierInput): Check[] {
    const required = input.state.missingFields.filter((m) => m.necessity === "required");
    if (required.length === 0) {
      return [
        {
          name: "all_required_fields_present",
          verifier: "missing_info",
          passed: true,
          severity: "info",
          detail: "no required fields outstanding",
        },
      ];
    }
    return required.map((m) => ({
      name: `required_field_missing:${m.name}`,
      verifier: "missing_info",
      passed: false,
      severity: "blocking",
      detail: `required field "${m.name}" is unresolved`,
    }));
  },
};
