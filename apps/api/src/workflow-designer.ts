import {
  WorkflowSpecSchema, assertWorkflowToolsAuthorized,
  type ToolName, type WorkflowDomain, type WorkflowSpec,
} from "@clarityloop/core";
import { generateStructured, type ChatMessage, type ModelProvider } from "@clarityloop/qwen";

export function buildWorkflowDesignerMessages(
  request: string,
  domain: WorkflowDomain | undefined,
  allowedTools: ToolName[],
): ChatMessage[] {
  const system = [
    "You are ClarityLoop's Workflow Designer.",
    "Turn a messy business request into a single WorkflowSpec JSON object that matches the schema.",
    `You MUST only reference tools from this allow-list: ${allowedTools.join(", ")}.`,
    "Return ONLY the JSON object. Never emit an entropy value, a score, or a commit decision —",
    "those are computed by deterministic code, not by you.",
  ].join(" ");
  const user = domain ? `Domain: ${domain}\nRequest: ${request}` : `Request: ${request}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Qwen generates the structure; deterministic code validates the schema and the allow-list. */
export async function designWorkflow(
  provider: ModelProvider,
  args: { request: string; domain?: WorkflowDomain; allowedTools: ToolName[] },
): Promise<WorkflowSpec> {
  const spec = await generateStructured(provider, WorkflowSpecSchema, {
    task: "workflow_generation",
    messages: buildWorkflowDesignerMessages(args.request, args.domain, args.allowedTools),
  });
  assertWorkflowToolsAuthorized(spec, args.allowedTools);
  return spec;
}
