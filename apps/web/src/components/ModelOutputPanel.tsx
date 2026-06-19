import type { StreamStatus } from "../hooks/useEntropyStream";

/** Live raw model output — the tokens Qwen streams while writing the latent state. */
export function ModelOutputPanel({ output, status }: { output: string; status: StreamStatus }) {
  const streaming = status === "streaming";
  return (
    <section className="panel flex h-full flex-col p-5" data-testid="model-output">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="eyebrow text-body">Model Output</h2>
        <span className="data flex items-center gap-2 text-[10px] text-dim">
          {streaming && <span className="live-dot" />}
          qwen · streaming
        </span>
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-[3px] border border-line bg-ink-900/60 p-3 font-mono text-[11.5px] leading-relaxed text-cyan">
        {output || (streaming ? "" : "run to stream the model's structured extraction…")}
        {streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-amber" style={{ animation: "blink 1s steps(2) infinite" }} />}
      </pre>
    </section>
  );
}
