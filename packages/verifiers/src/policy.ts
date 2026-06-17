import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";
import { QuoteArtifactSchema } from "./artifact";

export const policyVerifier: Verifier = {
  name: "policy",
  run(input: VerifierInput): Check[] {
    const policy = input.workflowSpec.commitPolicy;
    const checks: Check[] = [];

    for (const flag of input.state.policyFlags) {
      if (policy.forbiddenActions.includes(flag.rule)) {
        checks.push({
          name: `forbidden_action:${flag.rule}`,
          verifier: "policy",
          passed: false,
          severity: "blocking",
          detail: `forbidden action "${flag.rule}" is present`,
        });
      } else if (flag.ambiguous) {
        checks.push({
          name: `ambiguous_policy:${flag.rule}`,
          verifier: "policy",
          passed: false,
          severity: "warn",
          detail: `policy "${flag.rule}" is ambiguous and needs human judgement`,
        });
      }
    }

    const quote = QuoteArtifactSchema.safeParse(input.draftArtifact);
    if (
      quote.success &&
      policy.requireApprovalIf.quoteValueAbove !== null &&
      quote.data.total > policy.requireApprovalIf.quoteValueAbove
    ) {
      checks.push({
        name: "high_value_quote",
        verifier: "policy",
        passed: false,
        severity: "warn",
        detail: `quote total ${quote.data.total} exceeds approval threshold ${policy.requireApprovalIf.quoteValueAbove}`,
      });
    }

    if (checks.length === 0) {
      checks.push({ name: "policy_clear", verifier: "policy", passed: true, severity: "info", detail: "no policy violations or approval triggers" });
    }
    return checks;
  },
};
