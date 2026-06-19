import { useState, useCallback } from "react";
import { EntropyUpdateSchema, type EntropyUpdate, type WorkflowSpec } from "@clarityloop/core";
import type { StreamStatus } from "./useEntropyStream";

export type LiveRun = {
  run: (req: { request: string; domain?: string; goal: string; workflowVersion: string }) => Promise<void>;
  updates: EntropyUpdate[];
  latest: EntropyUpdate | null;
  status: StreamStatus;
  workflow: WorkflowSpec | null;
  phaseNote: string;
  modelOutput: string;
};

/**
 * Production run against the live backend: POST /workflow (Qwen generates the governed
 * WorkflowSpec) then POST /runs/stream (Qwen extracts the latent state and the server streams
 * scored entropy over SSE). No mock data — every value comes from the deployed model + gate.
 */
export function useLiveRun(apiBase: string): LiveRun {
  const [updates, setUpdates] = useState<EntropyUpdate[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [workflow, setWorkflow] = useState<WorkflowSpec | null>(null);
  const [phaseNote, setPhaseNote] = useState("");
  const [modelOutput, setModelOutput] = useState("");

  const run = useCallback<LiveRun["run"]>(
    async ({ request, domain, goal, workflowVersion }) => {
      setUpdates([]);
      setWorkflow(null);
      setModelOutput("");
      setStatus("streaming");
      try {
        setPhaseNote("Qwen is generating the governed workflow…");
        const wfRes = await fetch(`${apiBase}/workflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request, domain }),
        });
        if (wfRes.ok) {
          const wf = await wfRes.json();
          if (wf.workflowSpec) setWorkflow(wf.workflowSpec as WorkflowSpec);
        }

        setPhaseNote("Qwen is reading the request and writing the latent state…");
        const res = await fetch(`${apiBase}/extract/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request, workflowVersion, goal }),
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
            if (ev === "token") {
              setModelOutput((prev) => prev + data.token);
            } else if (ev === "entropy") {
              const parsed = EntropyUpdateSchema.safeParse(data);
              if (parsed.success) setUpdates((prev) => [...prev, parsed.data]);
            }
          }
        }
        setPhaseNote("Latent state scored — the commit gate decides.");
        setStatus("done");
      } catch (e) {
        setPhaseNote(`Live run failed: ${(e as Error).message}`);
        setStatus("error");
      }
    },
    [apiBase],
  );

  const latest = updates.length > 0 ? updates[updates.length - 1] : null;
  return { run, updates, latest, status, workflow, phaseNote, modelOutput };
}
