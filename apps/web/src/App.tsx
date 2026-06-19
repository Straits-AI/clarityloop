import { useState, useEffect } from "react";
import type { EntropyScore, EntropyUpdate } from "@clarityloop/core";
import type { StreamStatus } from "./hooks/useEntropyStream";
import { useLiveRun } from "./hooks/useLiveRun";
import { EntropyHeatmap } from "./components/EntropyHeatmap";
import { RequestPanel } from "./components/RequestPanel";
import { WorkflowPanel } from "./components/WorkflowPanel";
import { NextBestAction } from "./components/NextBestAction";
import { TraceView } from "./components/TraceView";
import { ModelOutputPanel } from "./components/ModelOutputPanel";
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

const HERO_STATS = [
  { v: "0%", l: "false-commit", sub: "vs 36% capability-only", tone: "go" },
  { v: "86%", l: "task completion", sub: "+55pp over a fixed gate", tone: "amber" },
  { v: "0.00pp", l: "entropy ablation", sub: "authorization drives safety", tone: "cyan" },
  { v: "36k", l: "attack-trials", sub: "graceful under emission corruption", tone: "go" },
] as const;

function SectionHeader({ index, title, blurb }: { index: string; title: string; blurb?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-line/60 pb-3">
      <div className="flex items-baseline gap-3">
        <span className="data text-amber text-xs">{index}</span>
        <h2 className="display text-xl sm:text-2xl">{title}</h2>
      </div>
      {blurb ? <p className="hidden max-w-md text-right text-xs leading-relaxed text-dim sm:block">{blurb}</p> : null}
    </div>
  );
}

/** Real commit-gate decision, computed from the live extracted state (no mock). */
function GateVerdict({ latest, status, note }: { latest: EntropyUpdate | null; status: StreamStatus; note: string }) {
  const e = latest?.entropy.commitEntropy ?? 0;
  const done = latest?.phase === "done";
  const missingReq = (latest?.state.missingFields ?? []).filter((m) => m.necessity === "required");
  const highRisk = (latest?.state.riskFlags ?? []).filter((r) => r.severity === "high");
  let label = "STANDBY", cls = "v-hold", reason = "Awaiting a request.";
  if (status === "error") { label = "ERROR"; cls = "v-stop"; reason = note; }
  else if (status === "streaming" && !done) { label = "RUNNING"; cls = "v-hold"; reason = note || "Qwen extracting the latent state…"; }
  else if (done && missingReq.length > 0) { label = "NEEDS MORE INFO"; cls = "v-hold"; reason = `Missing required: ${missingReq.map((m) => m.name).join("; ")}.`; }
  else if (done && highRisk.length > 0) { label = "ESCALATE"; cls = "v-hold"; reason = `Unmitigated high-severity risk: ${highRisk.map((r) => r.kind).join(", ")}.`; }
  else if (done && e < 0.3) { label = "CLEAR TO COMMIT"; cls = "v-go"; reason = "Authority boundary clear · risk within ceiling · evidence sufficient."; }
  else if (done) { label = "ESCALATE"; cls = "v-hold"; reason = "Residual uncertainty above threshold — routed to human approval."; }
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Commit Gate</span>
        <span className="data text-[11px] text-dim">deterministic</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={`verdict ${cls}`}>{label}</span>
        <div className="text-right">
          <div className="data text-2xl text-hi">{e.toFixed(2)}</div>
          <div className="eyebrow mt-0.5 !tracking-[0.18em]">residual</div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-dim">{reason}</p>
    </div>
  );
}

export function BenchmarkPanel() {
  const [vm, setVm] = useState<DemoViewModel | null>(null);
  useEffect(() => {
    const provider = new DeterministicProvider();
    Promise.all([runBenchAndScore(ALL_CASES, provider), runPromotionComparison(ALL_CASES, provider)]).then(
      ([{ report }, promotion]) => setVm(buildDemoViewModel(report, promotion)),
    );
  }, []);
  if (!vm) return <p className="data text-sm text-dim">Running ClarityLoopBench…</p>;
  return <ThreeColumnDemo viewModel={vm} />;
}

export default function App() {
  const [request, setRequest] = useState("");
  const { run, updates, latest, status, workflow, phaseNote, modelOutput } = useLiveRun(API_BASE);
  const history = updates.map((u) => u.entropy.commitEntropy);
  const onRun = () => {
    if (!request.trim()) return;
    run({ request, domain: "quote", goal: "draft a customer quote", workflowVersion: "quote-v1" });
  };
  const workflowSteps = (workflow?.steps ?? []).map((s) => ({
    id: s.id,
    name: s.action?.type === "tool" ? s.action.toolName : s.name,
  }));

  return (
    <main className="relative z-10 mx-auto min-h-screen max-w-7xl px-5 py-7 sm:px-8">
      {/* ── status bar ─────────────────────────────────────────────────── */}
      <header className="reveal mb-9 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[3px] border border-amber/60 bg-amber-soft">
            <div className="h-3.5 w-3.5 rotate-45 border-2 border-amber" />
          </div>
          <div>
            <h1 className="display text-lg leading-none tracking-[0.04em]">ClarityLoop</h1>
            <p className="eyebrow mt-1">Authority-Boundary Release Control</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-2 rounded-[3px] border border-go/30 bg-go-soft px-2.5 py-1.5">
            <span className="live-dot" />
            <span className="data text-[10.5px] tracking-[0.14em] text-go">LIVE · ALIBABA FC · ap-southeast-1</span>
          </span>
          <span className="data hidden rounded-[3px] border border-line px-2.5 py-1.5 text-[10.5px] tracking-[0.14em] text-dim sm:inline">
            QWEN / DASHSCOPE
          </span>
        </div>
      </header>

      {/* ── hero ───────────────────────────────────────────────────────── */}
      <section className="reveal mb-7" style={{ animationDelay: "60ms" }}>
        <p className="eyebrow mb-3 text-amber">Track 4 · Autopilot Agent</p>
        <h2 className="display max-w-4xl text-4xl leading-[1.04] sm:text-6xl">
          The model proposes.
          <br />
          <span className="text-amber">Deterministic code</span> decides what ships.
        </h2>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-body">
          ClarityLoop governs the autonomy boundary for agent-authored workflows — checking every action
          against an <span className="text-hi">authority boundary</span> and a{" "}
          <span className="text-hi">risk class</span>, re-deriving each safety signal with{" "}
          <span className="text-hi">independent verifiers</span>, and looping for evidence before it commits.
          <span className="text-dim"> Harnesses evolve; ClarityLoop decides what ships.</span>
        </p>

        <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line lg:grid-cols-4">
          {HERO_STATS.map((s, i) => (
            <div
              key={s.l}
              className="reveal bg-ink-850 px-5 py-4"
              style={{ animationDelay: `${140 + i * 70}ms` }}
            >
              <div className={`display text-3xl sm:text-4xl text-${s.tone}`}>{s.v}</div>
              <div className="eyebrow mt-1.5 text-body">{s.l}</div>
              <div className="mt-1 text-[11px] leading-tight text-dim">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── I · live loop ──────────────────────────────────────────────── */}
      <section className="reveal mb-10 mt-12" style={{ animationDelay: "120ms" }}>
        <SectionHeader
          index="01"
          title="Live commit loop"
          blurb={<>Streamed from the deployed Alibaba Function Compute endpoint via Qwen — the model returns structured state; the gate decides.</>}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <RequestPanel value={request} onChange={setRequest} onRun={onRun} status={status} />
            <WorkflowPanel steps={workflowSteps} status={status} />
          </div>
          <div className="space-y-4">
            <EntropyHeatmap entropy={latest?.entropy ?? ZERO_ENTROPY} history={history} />
            <GateVerdict latest={latest} status={status} note={phaseNote} />
            <NextBestAction action={latest?.nextBestAction ?? null} note={latest?.note ?? null} />
          </div>
          <div className="space-y-4">
            <ModelOutputPanel output={modelOutput} status={status} />
            <TraceView updates={updates} />
          </div>
        </div>
      </section>

      {/* ── II · improvement & promotion ───────────────────────────────── */}
      <section className="mb-10">
        <SectionHeader
          index="02"
          title="Improvement & promotion"
          blurb={<>Promote a procedure version only when replay shows it is <span className="text-hi">safer than the incumbent</span> — safety-weighted regression gating.</>}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReplayBenchmarkPanel report={DEMO_PROMOTION_REPORT} decision={DEMO_PROMOTION_DECISION} />
          <VersionLineagePanel versions={DEMO_VERSIONS} />
        </div>
      </section>

      {/* ── III · benchmark ────────────────────────────────────────────── */}
      <section className="mb-10">
        <SectionHeader
          index="03"
          title="ClarityLoopBench"
          blurb={<>One uniform scorer across all baselines. Fixed Gate and ClarityLoop share the same predicate — so the completion gain is provably the evidence loop.</>}
        />
        <BenchmarkPanel />
      </section>

      {/* ── IV · vs HarnessX / external ────────────────────────────────── */}
      <section className="mb-12">
        <SectionHeader
          index="04"
          title="Different axis from HarnessX"
          blurb={<>HarnessX raises <span className="text-hi">task success</span> (capability). ClarityLoop drives <span className="text-hi">attack-success</span> to zero (safety). They compose.</>}
        />
        <AgentDojoPanel />
      </section>

      <footer className="hairline flex flex-wrap items-center justify-between gap-3 py-6 text-[11px] text-dim">
        <span className="data tracking-[0.12em]">CLARITYLOOP · QWEN CLOUD HACKATHON · TRACK 4</span>
        <span className="data tracking-[0.12em]">DETERMINISTIC · AUDITABLE · CAPABILITY-AGNOSTIC</span>
      </footer>
    </main>
  );
}
