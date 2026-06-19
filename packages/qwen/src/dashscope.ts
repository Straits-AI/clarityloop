import OpenAI from "openai";
import { type ChatMessage, type ModelProvider, type QwenTask, modelForTask } from "./provider";

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
      messages,
      temperature: 0.2,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  async *completeStream(messages: ChatMessage[], opts: { task: QwenTask }): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: modelForTask(opts.task),
      messages,
      temperature: 0.2,
      stream: true,
    });
    for await (const chunk of stream) {
      const tok = chunk.choices?.[0]?.delta?.content;
      if (tok) yield tok;
    }
  }
}
