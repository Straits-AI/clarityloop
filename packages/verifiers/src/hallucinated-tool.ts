import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";

export const hallucinatedToolVerifier: Verifier = {
  name: "hallucinated_tool",
  run(input: VerifierInput): Check[] {
    const declared = new Set(input.workflowSpec.allowedTools.map((t) => t.toolName));
    const checks: Check[] = [];
    for (const step of input.workflowSpec.steps) {
      if (step.action.type === "tool" && !declared.has(step.action.toolName)) {
        checks.push({
          name: `unauthorized_tool:${step.action.toolName}`,
          verifier: "hallucinated_tool",
          passed: false,
          severity: "blocking",
          detail: `step "${step.id}" calls undeclared tool "${step.action.toolName}"`,
        });
      }
    }
    if (checks.length === 0) {
      checks.push({ name: "all_tools_declared", verifier: "hallucinated_tool", passed: true, severity: "info", detail: "every tool step is declared in allowedTools" });
    }
    return checks;
  },
};
