import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { type ChatMessage, type ModelProvider, type QwenTask, modelForTask } from "./provider";

// Our ChatMessage content (string | text/image parts) matches the OpenAI content-part shape, but
// OpenAI's type is a per-role discriminated union (e.g. system messages forbid image parts). The
// DashScope-compatible endpoint accepts the parts on user messages, so we pass them through with a
// single cast at the boundary instead of fighting the stricter per-role types.
const asOpenAI = (messages: ChatMessage[]): ChatCompletionMessageParam[] =>
  messages as unknown as ChatCompletionMessageParam[];

export type DashScopeConfig = {
  apiKey: string;
  // International endpoint by default; override for China region.
  baseURL?: string;
};

export class DashScopeProvider implements ModelProvider {
  private readonly client: OpenAI;
  constructor(cfg: DashScopeConfig) {
    this.client = new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    });
  }
  async complete(messages: ChatMessage[], opts: { task: QwenTask }): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: modelForTask(opts.task),
      messages: asOpenAI(messages),
      temperature: 0.2,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  async *completeStream(messages: ChatMessage[], opts: { task: QwenTask }): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: modelForTask(opts.task),
      messages: asOpenAI(messages),
      temperature: 0.2,
      stream: true,
    });
    for await (const chunk of stream) {
      const tok = chunk.choices?.[0]?.delta?.content;
      if (tok) yield tok;
    }
  }
}
