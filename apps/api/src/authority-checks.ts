import type { Check, CommitPolicy, RiskSignals } from "@clarityloop/core";

/**
 * Surface the authority-boundary action categories (memo §17) that are ACTIVE for this commit as
 * `Check`s whose `name` equals the category. The deterministic commit gate consults these against
 * `AuthorityBoundary.approvalRequiredFor`, so e.g. an external send always routes to a human even
 * when entropy is low and the risk class is within the auto-commit ceiling.
 *
 * Emitted as severity "info" (these are governance signals, not verifier failures) so only the
 * gate's approvalRequiredFor logic acts on them — never the generic policy-warn / blocking paths.
 */
export function authorityCategoryChecks(signals: RiskSignals, policy: CommitPolicy): Check[] {
  const r = policy.requireApprovalIf;
  const out: Check[] = [];
  const flag = (name: string, detail: string) =>
    out.push({ name, verifier: "policy", passed: false, severity: "info", detail });

  if (signals.externalSend) flag("external_send", "commit performs an external send");
  if (signals.legalSensitive) flag("legal_sensitive", "commit is legally sensitive");
  if (signals.policyException) flag("policy_exception", "commit relies on a policy exception");
  if (r.quoteValueAbove !== null && signals.quoteValue !== null && signals.quoteValue > r.quoteValueAbove) {
    flag("high_value_quote", `quote value ${signals.quoteValue} exceeds ${r.quoteValueAbove}`);
  }
  if (r.discountAbovePct !== null && signals.discountPct !== null && signals.discountPct > r.discountAbovePct) {
    flag("discount_above_threshold", `discount ${signals.discountPct}% exceeds ${r.discountAbovePct}%`);
  }
  return out;
}
