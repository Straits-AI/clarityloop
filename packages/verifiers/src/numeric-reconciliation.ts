import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";
import { QuoteArtifactSchema } from "./artifact";

const TOLERANCE = 0.01;

export const numericReconciliationVerifier: Verifier = {
  name: "numeric_reconciliation",
  run(input: VerifierInput): Check[] {
    const parsed = QuoteArtifactSchema.safeParse(input.draftArtifact);
    if (!parsed.success) {
      return [{ name: "numeric_skipped", verifier: "numeric_reconciliation", passed: true, severity: "info", detail: "no valid quote artifact to reconcile" }];
    }
    const quote = parsed.data;
    const checks: Check[] = [];
    for (const item of quote.lineItems) {
      const expected = item.quantity * item.unitPrice;
      const ok = Math.abs(expected - item.lineTotal) <= TOLERANCE;
      checks.push({
        name: `line_total:${item.sku}`,
        verifier: "numeric_reconciliation",
        passed: ok,
        severity: ok ? "info" : "blocking",
        detail: ok
          ? `${item.sku} line total reconciles`
          : `${item.sku}: ${item.quantity} x ${item.unitPrice} = ${expected}, got ${item.lineTotal}`,
      });
    }
    const sum = quote.lineItems.reduce((acc, i) => acc + i.lineTotal, 0);
    const totalOk = Math.abs(sum - quote.total) <= TOLERANCE;
    checks.push({
      name: "quote_total",
      verifier: "numeric_reconciliation",
      passed: totalOk,
      severity: totalOk ? "info" : "blocking",
      detail: totalOk ? "quote total equals sum of line items" : `sum of line items ${sum} != total ${quote.total}`,
    });
    return checks;
  },
};
