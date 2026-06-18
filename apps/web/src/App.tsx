import { useState, useEffect } from "react";
import type { EntropyScore } from "@clarityloop/core";
import { useEntropyStream } from "./hooks/useEntropyStream";
import { EntropyHeatmap } from "./components/EntropyHeatmap";
import { RequestPanel } from "./components/RequestPanel";
import { WorkflowPanel } from "./components/WorkflowPanel";
import { NextBestAction } from "./components/NextBestAction";
import { TraceView } from "./components/TraceView";
import { ReplayBenchmarkPanel } from "./components/ReplayBenchmarkPanel";
import { VersionLineagePanel } from "./components/VersionLineagePanel";
import { AgentDojoPanel } from "./components/AgentDojoPanel";
import { DEMO_PROMOTION_DECISION, DEMO_PROMOTION_REPORT, DEMO_VERSIONS } from "./lib/promotion-demo";
import { ThreeColumnDemo } from "./demo/ThreeColumnDemo";
import { buildDemoViewModel, type DemoViewModel } from "./demo/demoViewModel";
import { ALL_CASES, runBenchAndScore, runPromotionComparison, DeterministicProvider } from "@clarityloop/evals";

const ZERO_ENTROPY: EntropyScore = {
  taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0,
  policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0,
};

// Empty base => same-origin (Vite dev proxy). Set VITE_API_BASE to the deployed Alibaba
// Function Compute endpoint to stream the live entropy loop straight from the cloud.
const API_BASE = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE ?? "";

const DEMO_WORKFLOW = [
  { id: "s1", name: "parse_request" },
  { id: "s2", name: "retrieve_memory" },
  { id: "s3", name: "lookup_catalog + check_stock" },
  { id: "s4", name: "compare_quote" },
  { id: "s5", name: "draft_quote" },
  { id: "s6", name: "commit_gate" },
];

export function BenchmarkPanel() {
  const [vm, setVm] = useState<DemoViewModel | null>(null);
  useEffect(() => {
    const provider = new DeterministicProvider();
    Promise.all([runBenchAndScore(ALL_CASES, provider), runPromotionComparison(ALL_CASES, provider)]).then(
      ([{ report }, promotion]) => setVm(buildDemoViewModel(report, promotion)),
    );
  }, []);
  if (!vm) return <p>Running ClarityLoopBench…</p>;
  return <ThreeColumnDemo viewModel={vm} />;
}

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
          <RequestPanel onRun={() => setStreamUrl(`${API_BASE}/demo/entropy-stream?ts=${Date.now()}`)} status={status} />
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
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Procedure improvement &amp; promotion</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReplayBenchmarkPanel report={DEMO_PROMOTION_REPORT} decision={DEMO_PROMOTION_DECISION} />
          <VersionLineagePanel versions={DEMO_VERSIONS} />
        </div>
      </section>
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Benchmark</h2>
        <BenchmarkPanel />
      </section>
      <section className="mt-6">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">vs HarnessX — different axes</h2>
        <p className="mb-3 text-sm text-slate-500">
          HarnessX raises <strong>task success</strong> (capability); ClarityLoop drives{" "}
          <strong>attack success rate</strong> to 0 (safety). They compose — wrap an evolved harness
          to keep its capability and remove its unsafe commits.
        </p>
        <AgentDojoPanel />
      </section>
    </main>
  );
}
