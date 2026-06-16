import type { z } from "zod";
import type { ChatMessage, ModelProvider, QwenTask } from "./provider";

/** Extracts the first JSON object from a model reply, tolerating ```json fences. */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object found in model reply");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generateStructured<T>(
  provider: ModelProvider,
  schema: z.ZodType<T, any, any>,
  args: { task: QwenTask; messages: ChatMessage[] },
): Promise<T> {
  const reply = await provider.complete(args.messages, { task: args.task });
  return schema.parse(extractJson(reply));
}
