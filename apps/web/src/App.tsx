import { useState } from "react";
import type { EntropyScore } from "@clarityloop/core";
import { useEntropyStream } from "./hooks/useEntropyStream";
import { EntropyHeatmap } from "./components/EntropyHeatmap";
import { RequestPanel } from "./components/RequestPanel";
import { WorkflowPanel } from "./components/WorkflowPanel";
import { NextBestAction } from "./components/NextBestAction";
import { TraceView } from "./components/TraceView";

const ZERO_ENTROPY: EntropyScore = {
  taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0,
  policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0,
};

const DEMO_WORKFLOW = [
  { id: "s1", name: "parse_request" },
  { id: "s2", name: "retrieve_memory" },
  { id: "s3", name: "lookup_catalog + check_stock" },
  { id: "s4", name: "compare_quote" },
  { id: "s5", name: "draft_quote" },
  { id: "s6", name: "commit_gate" },
];

export default function App() {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const { updates, latest, status } = useEntropyStream(streamUrl);
  const history = updates.map((u) => u.entropy.commitEntropy);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">ClarityLoop</h1>
        <p className="text-slate-500">Uncertainty-guided autopilot — live entropy loop</p>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          {/* cache-busting query forces the effect to reconnect on each Run */}
          <RequestPanel onRun={() => setStreamUrl(`/demo/entropy-stream?ts=${Date.now()}`)} status={status} />
          <WorkflowPanel steps={DEMO_WORKFLOW} />
        </div>
        <div className="space-y-4">
          <EntropyHeatmap entropy={latest?.entropy ?? ZERO_ENTROPY} history={history} />
          <NextBestAction action={latest?.nextBestAction ?? null} note={latest?.note ?? null} />
        </div>
        <div className="space-y-4">
          <TraceView updates={updates} />
        </div>
      </div>
    </main>
  );
}
