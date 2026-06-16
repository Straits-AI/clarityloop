export type QwenTask =
  | "extraction"
  | "workflow_generation"
  | "failure_analysis"
  | "document_parse"
  | "audit_narrative";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface ModelProvider {
  complete(messages: ChatMessage[], opts: { task: QwenTask }): Promise<string>;
}

/** Model routing per spec §8. Overridable for tests. */
export function modelForTask(task: QwenTask): string {
  switch (task) {
    case "extraction": return "qwen-flash";
    case "workflow_generation": return "qwen-plus";
    case "failure_analysis": return "qwen-max";
    case "document_parse": return "qwen-vl-plus";
    case "audit_narrative": return "qwen-plus";
  }
}
