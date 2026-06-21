export type QwenTask =
  | "extraction"
  | "workflow_generation"
  | "failure_analysis"
  | "document_parse"
  | "audit_narrative";

/** A multimodal content part — text, or an image (data URL or https) for qwen-vl-* models. */
export type TextPart = { type: "text"; text: string };
export type ImagePart = { type: "image_url"; image_url: { url: string } };
export type MessageContent = string | Array<TextPart | ImagePart>;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: MessageContent };

/** Build a user message that sends an image (base64 data URL or URL) to a vision model. */
export function imageMessage(text: string, imageUrl: string): ChatMessage {
  return { role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: imageUrl } }] };
}

export interface ModelProvider {
  complete(messages: ChatMessage[], opts: { task: QwenTask }): Promise<string>;
  /** Optional token stream of the same generation, for showing live model output. */
  completeStream?(messages: ChatMessage[], opts: { task: QwenTask }): AsyncIterable<string>;
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
