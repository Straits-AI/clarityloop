import type { ToolName } from "./primitives";
import type { WorkflowSpec } from "./workflow";

export class UnauthorizedToolError extends Error {
  constructor(public readonly unauthorizedTools: ToolName[]) {
    super(`workflow requests unauthorized tools: ${unauthorizedTools.join(", ")}`);
    this.name = "UnauthorizedToolError";
  }
}

/**
 * Deterministic allow-list gate. Collects every ToolName the spec references —
 * declared `allowedTools` plus any `tool` step — and throws if any is absent from
 * `allowed`. The model proposes tools; code decides whether they are permitted.
 */
export function assertWorkflowToolsAuthorized(spec: WorkflowSpec, allowed: ToolName[]): void {
  const allowedSet = new Set<ToolName>(allowed);
  const referenced = new Set<ToolName>();
  for (const ref of spec.allowedTools) referenced.add(ref.toolName);
  for (const step of spec.steps) {
    if (step.action.type === "tool") referenced.add(step.action.toolName);
  }
  const unauthorized = [...referenced].filter((t) => !allowedSet.has(t));
  if (unauthorized.length > 0) throw new UnauthorizedToolError(unauthorized);
}
