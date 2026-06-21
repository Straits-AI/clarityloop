import { useState, useCallback } from "react";
import type { StreamStatus } from "./useEntropyStream";

export type ExecStep = { index: number; action: string | null; phase: string; note: string; residual: number };
export type DraftQuote = { artifactKey: string; total: number; doc: string | null };
export type ExecVerdict = {
  gate: "on" | "off";
  committed: boolean;
  outcome: "committed" | "escalated";
  gateWouldHave: "commit" | "needs_approval" | "needs_more_info" | "sandbox_only" | "reject";
  residual: number;
  riskFlags: { id: string; kind: string; severity: "low" | "medium" | "high" }[];
  missingFields: { id: string; name: string; necessity: "required" | "optional" }[];
  draftQuote: DraftQuote | null;
  reason: string;
};

export type ExecuteRun = {
  run: (req: { request: string; gate: "on" | "off" }) => Promise<void>;
  steps: ExecStep[];
  modelOutput: string;
  verdict: ExecVerdict | null;
  status: StreamStatus;
};

/**
 * Drives POST /execute/stream: the SAME real Qwen extraction + real tool loop both ways; the
 * only difference is `gate`. gate="off" (capability-only) ships the drafted quote regardless;
 * gate="on" (ClarityLoop) commits only if the deterministic gate clears it, else escalates.
 */
export function useExecuteRun(apiBase: string): ExecuteRun {
  const [steps, setSteps] = useState<ExecStep[]>([]);
  const [modelOutput, setModelOutput] = useState("");
  const [verdict, setVerdict] = useState<ExecVerdict | null>(null);
  const [status, setStatus] = useState<StreamStatus>("idle");

  const run = useCallback<ExecuteRun["run"]>(
    async ({ request, gate }) => {
      setSteps([]);
      setModelOutput("");
      setVerdict(null);
      setStatus("streaming");
      try {
        const res = await fetch(`${apiBase}/execute/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request, gate, goal: "draft a customer quote", workflowVersion: "quote-v1", domain: "quote" }),
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
            if (ev === "token") setModelOutput((p) => p + data.token);
            else if (ev === "step") setSteps((p) => [...p, data as ExecStep]);
            else if (ev === "verdict") setVerdict(data as ExecVerdict);
          }
        }
        setStatus("done");
      } catch (e) {
        setStatus("error");
        setVerdict({
          gate, committed: false, outcome: "escalated", gateWouldHave: "reject", residual: 0,
          riskFlags: [], missingFields: [], draftQuote: null, reason: `run failed: ${(e as Error).message}`,
        });
      }
    },
    [apiBase],
  );

  return { run, steps, modelOutput, verdict, status };
}
