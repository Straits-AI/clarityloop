import type { ChatMessage, ModelProvider, QwenTask } from "@clarityloop/qwen";

/**
 * Deterministic stand-in for the real DashScope provider. Used by every benchmark
 * runner so the harness runs offline with no live API calls (design spec §11).
 * Runners do not depend on the reply content — case ground-truth drives behaviour —
 * but every runner still exercises the ModelProvider seam for the model step.
 */
export class DeterministicProvider implements ModelProvider {
  async complete(_messages: ChatMessage[], opts: { task: QwenTask }): Promise<string> {
    return JSON.stringify({ ok: true, task: opts.task });
  }
}
