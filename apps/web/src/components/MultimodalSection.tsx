import { useParseDocument } from "../hooks/useParseDocument";

/** Multimodal beat: qwen-vl-plus reads the supplier price-sheet IMAGE and extracts structured lines. */
export function MultimodalSection({ apiBase }: { apiBase: string }) {
  const { run, output, quote, status } = useParseDocument(apiBase);
  const streaming = status === "streaming";

  return (
    <section className="reveal">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-line/60 pb-3">
        <div className="flex items-baseline gap-3">
          <span className="data text-amber text-xs">◇</span>
          <h2 className="display text-xl sm:text-2xl">Qwen-VL reads the attached price sheet</h2>
        </div>
        <p className="hidden max-w-md text-right text-xs leading-relaxed text-dim sm:block">
          The customer attaches a supplier price sheet as an <span className="text-hi">image</span>. It is sent to{" "}
          <span className="text-hi">qwen-vl-plus</span> as a real image — not text.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* the image */}
        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="eyebrow text-body">Attached Document</h2>
            <span className="data text-[10px] text-dim">image · supplier quote</span>
          </div>
          <div className="overflow-hidden rounded-[3px] border border-line bg-white">
            <img src="/price-sheet.png" alt="supplier price sheet" className="w-full" />
          </div>
          <button onClick={run} disabled={streaming} className="btn-console mt-3 w-full">
            {streaming ? "▶ Qwen-VL reading…" : "▶ Parse with Qwen-VL"}
          </button>
        </section>

        {/* the live VL extraction */}
        <div className="space-y-4">
          <section className="panel flex flex-col p-5" data-testid="vl-output">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="eyebrow text-body">Qwen-VL Output</h2>
              <span className="data flex items-center gap-2 text-[10px] text-dim">
                {streaming && <span className="live-dot" />}
                qwen-vl-plus · streaming
              </span>
            </div>
            <pre className="max-h-56 flex-1 overflow-auto whitespace-pre-wrap rounded-[3px] border border-line bg-ink-900/60 p-3 font-mono text-[11.5px] leading-relaxed text-cyan">
              {output || (streaming ? "" : "parse the image to read the supplier quote…")}
              {streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-amber" style={{ animation: "blink 1s steps(2) infinite" }} />}
            </pre>
          </section>

          {quote && (
            <section className="panel p-5" data-testid="vl-quote">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="eyebrow text-body">Extracted Line Items</h2>
                <span className="data text-[10px] text-go">read from the image</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="eyebrow text-dim">
                    <th className="pb-1.5 text-left font-normal">SKU</th>
                    <th className="pb-1.5 text-right font-normal">Qty</th>
                    <th className="pb-1.5 text-right font-normal">Unit</th>
                  </tr>
                </thead>
                <tbody className="data text-hi">
                  {quote.lineItems.map((li, i) => (
                    <tr key={i} className="border-t border-line/50">
                      <td className="py-1.5">{li.sku}</td>
                      <td className="py-1.5 text-right">{li.quantity}</td>
                      <td className="py-1.5 text-right">{li.unitPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <span className="eyebrow text-body">Total</span>
                <span className="data text-lg text-hi">{quote.total.toLocaleString()} {quote.currency}</span>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
