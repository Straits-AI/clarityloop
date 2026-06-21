import { useState, useCallback } from "react";
import type { StreamStatus } from "./useEntropyStream";

export type SupplierQuote = {
  lineItems: { sku: string; description: string; quantity: number; unitPrice: number }[];
  total: number;
  currency: string;
};

export type ParseDocumentRun = {
  run: () => Promise<void>;
  output: string;
  quote: SupplierQuote | null;
  status: StreamStatus;
};

/**
 * Drives POST /parse-document/stream: qwen-vl-plus reads the supplier price-sheet IMAGE
 * (sent as a real image_url content part) and streams its structured extraction.
 */
export function useParseDocument(apiBase: string): ParseDocumentRun {
  const [output, setOutput] = useState("");
  const [quote, setQuote] = useState<SupplierQuote | null>(null);
  const [status, setStatus] = useState<StreamStatus>("idle");

  const run = useCallback<ParseDocumentRun["run"]>(async () => {
    setOutput("");
    setQuote(null);
    setStatus("streaming");
    try {
      const res = await fetch(`${apiBase}/parse-document/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.body) throw new Error("no stream body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const lines = frame.split("\n");
          const ev = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(5).trim());
          if (ev === "token") setOutput((p) => p + data.token);
          else if (ev === "quote") setQuote(data as SupplierQuote);
        }
      }
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setOutput((p) => p + `\n\n// parse failed: ${(e as Error).message}`);
    }
  }, [apiBase]);

  return { run, output, quote, status };
}
