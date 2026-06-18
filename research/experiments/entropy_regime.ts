/**
 * Experiment: entropy-regime-v1 — the "fix entropy" probe.
 *
 * 003-poc-entropy-ablation showed the commit-entropy branch is DECORATIVE on the 36-case bench:
 * every uncertain case there also trips a HARD branch (reject / needs_more_info / risk / authority)
 * that decides before entropy is consulted. The honest follow-up (user-chosen path): is there a
 * realistic regime where an *aggregate soft-uncertainty* signal is the ONLY mechanism that can act?
 *
 * The regime: a commit that passes every INDIVIDUAL hard check (no missing-required field, no
 * blocking verifier, risk <= L1, no high-severity risk flag, coverage above the approval floor) but
 * is collectively shaky from several SOFT signals (unsupported optional claims, ambiguous policy,
 * stale memory, tool failure). By construction the only gate branch that can fire here is the
 * commit-entropy branch. We test, using the REAL runCommitGate + scoreEntropy (no reimplementation):
 *
 *   D  (diffuse doubt, ground-truth = escalate): several soft signals, sum >= 0.3.
 *   B  (benign,        ground-truth = commit):    0-1 soft signal, sum < 0.3.
 *   W  (minor pile-up, ground-truth = commit):    2-3 LOW-weight signals, sum < 0.3 but count >= 2.
 *
 * Three deciders, all reading the same states:
 *   entropy-ON  : real gate, commitEntropyThreshold = 0.3
 *   entropy-OFF : real gate, commitEntropyThreshold = 1.0 (entropy branch can never fire — the ablation)
 *   count>=2    : escalate iff #soft-signals >= 2 (a naive unweighted aggregate — the Occam baseline)
 *
 * Metrics: false-commit (committed a should-escalate case) and over-escalation (escalated a
 * should-commit case). The decisive comparison is entropy-ON vs entropy-OFF on corpus D.
 */
import {
  scoreEntropy,
  runCommitGate,
  type LatentWorkflowState,
  type CommitPolicy,
  type AuthorityBoundary,
} from "@clarityloop/core";

type Label = "escalate" | "commit";
type SoftSpec = {
  id: string;
  corpus: "D" | "B" | "W";
  truth: Label;
  claims: number; // total claims
  unsupported: number; // of which unsupported (evidencePointer null)
  ambiguousPolicy: boolean;
  staleMemory: boolean;
  toolFailure: boolean;
};

function buildState(s: SoftSpec): LatentWorkflowState {
  const claims = Array.from({ length: s.claims }, (_, i) => ({
    id: `c${i}`,
    text: `claim ${i}`,
    evidencePointer: i < s.unsupported ? null : `ev${i}`,
  }));
  return {
    goal: s.id,
    workflowVersion: "v1",
    knownFacts: [{ id: "f0", text: "fact", confidence: 0.55 }],
    missingFields: [], // NO required-missing -> needs_more_info branch never fires
    claims,
    riskFlags: [], // NO high-severity flag -> high-risk branch never fires
    policyFlags: s.ambiguousPolicy ? [{ id: "p0", rule: "r", ambiguous: true }] : [],
    staleMemoryRefs: s.staleMemory ? ["m0"] : [],
    toolFailures: s.toolFailure ? ["t0"] : [],
  };
}

// A deliberately permissive policy + authority so the ONLY gate branch that can fire is entropy.
function policy(threshold: number): CommitPolicy {
  return {
    autoCommitAllowed: true,
    requireApprovalIf: {
      quoteValueAbove: null,
      discountAbovePct: null,
      evidenceCoverageBelow: null, // coverage never forces approval
      deliveryUnconfirmed: null,
      externalSend: null,
      policyException: null,
    },
    forbiddenActions: [],
    commitEntropyThreshold: threshold,
  };
}
const authority: AuthorityBoundary = {
  autoCommitMaxRiskClass: "L1",
  approvalRequiredFor: [],
  forbiddenActions: [],
  allowedTools: [],
};

function softCount(s: SoftSpec): number {
  return (
    (s.unsupported > 0 ? 1 : 0) +
    (s.ambiguousPolicy ? 1 : 0) +
    (s.staleMemory ? 1 : 0) +
    (s.toolFailure ? 1 : 0)
  );
}

function gateCommits(state: LatentWorkflowState, threshold: number): boolean {
  const decision = runCommitGate({
    state,
    entropy: scoreEntropy(state),
    checks: [],
    evidenceCoverage: 1, // above any floor
    commitPolicy: policy(threshold),
    authorityBoundary: authority,
    riskClass: "L1",
  });
  return decision.type === "commit";
}

// ── Corpus ──────────────────────────────────────────────────────────────────
const corpus: SoftSpec[] = [
  // D: diffuse doubt, should ESCALATE. >=2 signals incl. a higher-weight one (unsupported claim).
  { id: "D1", corpus: "D", truth: "escalate", claims: 2, unsupported: 1, ambiguousPolicy: true,  staleMemory: false, toolFailure: false }, // 0.125+0.15 = .275? -> below; fix below
  { id: "D2", corpus: "D", truth: "escalate", claims: 2, unsupported: 1, ambiguousPolicy: true,  staleMemory: true,  toolFailure: false },
  { id: "D3", corpus: "D", truth: "escalate", claims: 4, unsupported: 2, ambiguousPolicy: true,  staleMemory: true,  toolFailure: true  },
  { id: "D4", corpus: "D", truth: "escalate", claims: 2, unsupported: 1, ambiguousPolicy: true,  staleMemory: true,  toolFailure: true  },
  { id: "D5", corpus: "D", truth: "escalate", claims: 1, unsupported: 1, ambiguousPolicy: true,  staleMemory: false, toolFailure: false }, // 0.25+0.15 = .40
  { id: "D6", corpus: "D", truth: "escalate", claims: 4, unsupported: 3, ambiguousPolicy: false, staleMemory: true,  toolFailure: false }, // .1875+.10
  // B: benign, should COMMIT. 0-1 soft signal, entropy < 0.3.
  { id: "B1", corpus: "B", truth: "commit", claims: 2, unsupported: 0, ambiguousPolicy: false, staleMemory: false, toolFailure: false }, // clean
  { id: "B2", corpus: "B", truth: "commit", claims: 2, unsupported: 0, ambiguousPolicy: true,  staleMemory: false, toolFailure: false }, // .15
  { id: "B3", corpus: "B", truth: "commit", claims: 2, unsupported: 1, ambiguousPolicy: false, staleMemory: false, toolFailure: false }, // .125
  { id: "B4", corpus: "B", truth: "commit", claims: 0, unsupported: 0, ambiguousPolicy: false, staleMemory: true,  toolFailure: false }, // .10
  // W: minor pile-up, should COMMIT (individually-negligible signals), but count>=2 would escalate.
  { id: "W1", corpus: "W", truth: "commit", claims: 0, unsupported: 0, ambiguousPolicy: false, staleMemory: true,  toolFailure: true  }, // .10+.05 = .15, count=2
  { id: "W2", corpus: "W", truth: "commit", claims: 2, unsupported: 0, ambiguousPolicy: true,  staleMemory: false, toolFailure: true  }, // .15+.05 = .20, count=2
];

const deciders: { name: string; commits: (s: SoftSpec, st: LatentWorkflowState) => boolean }[] = [
  { name: "entropy-ON ", commits: (_s, st) => gateCommits(st, 0.3) },
  { name: "entropy-OFF", commits: (_s, st) => gateCommits(st, 1.0) },
  { name: "count>=2   ", commits: (s, _st) => softCount(s) < 2 }, // escalate iff >=2 signals
];

console.log("id   corpus truth     entropy  count  | entropy-ON entropy-OFF count>=2");
const rows = corpus.map((s) => {
  const st = buildState(s);
  const e = scoreEntropy(st).commitEntropy;
  const c = softCount(s);
  const acts = deciders.map((d) => (d.commits(s, st) ? "commit  " : "escalate"));
  console.log(
    `${s.id.padEnd(4)} ${s.corpus}      ${s.truth.padEnd(8)} ${e.toFixed(3)}    ${c}      | ${acts.join("    ")}`,
  );
  return { s, e, c, acts };
});

function rate(filter: (s: SoftSpec) => boolean, wrong: (act: string, s: SoftSpec) => boolean, di: number) {
  const subset = rows.filter((r) => filter(r.s));
  const bad = subset.filter((r) => wrong(r.acts[di], r.s)).length;
  return subset.length === 0 ? 0 : (100 * bad) / subset.length;
}
const isD = (s: SoftSpec) => s.corpus === "D";
const shouldCommit = (s: SoftSpec) => s.truth === "commit";
const falseCommit = (act: string) => act.startsWith("commit"); // committed a should-escalate case
const overEsc = (act: string) => act.startsWith("escalate"); // escalated a should-commit case

console.log("\n== metrics (%) ==");
console.log("decider        falseCommit(D)  overEscalation(B+W)");
deciders.forEach((d, i) => {
  const fc = rate(isD, falseCommit, i);
  const oe = rate(shouldCommit, overEsc, i);
  console.log(`${d.name}      ${fc.toFixed(1).padStart(6)}          ${oe.toFixed(1).padStart(6)}`);
});

// ── Threshold calibration sweep ───────────────────────────────────────────────
// The 33% leak at threshold 0.3 is a CALIBRATION failure (lit: 2603.06317 — raw entropy is
// uncalibrated). Sweep the threshold to find the operating point that separates diffuse doubt (D)
// from minor pile-up (W). If such a point exists, the WEIGHTING earns its keep over a naive count.
console.log("\n== threshold calibration sweep ==");
console.log("threshold  falseCommit(D)  overEscalation(B+W)");
for (const t of [0.1, 0.15, 0.2, 0.225, 0.25, 0.275, 0.3]) {
  const fcBad = corpus.filter(isD).filter((s) => gateCommits(buildState(s), t)).length;
  const oeBad = corpus.filter(shouldCommit).filter((s) => !gateCommits(buildState(s), t)).length;
  const fc = (100 * fcBad) / corpus.filter(isD).length;
  const oe = (100 * oeBad) / corpus.filter(shouldCommit).length;
  const dom = fc === 0 && oe === 0 ? "  <- dominates count>=2 (0 / 0)" : "";
  console.log(`${t.toFixed(3)}      ${fc.toFixed(1).padStart(6)}          ${oe.toFixed(1).padStart(6)}${dom}`);
}

// machine-readable summary line for the ledger
const m = (i: number) => ({ fc: rate(isD, falseCommit, i), oe: rate(shouldCommit, overEsc, i) });
console.log(
  "\nSUMMARY",
  JSON.stringify({
    entropyON: m(0),
    entropyOFF: m(1),
    countGE2: m(2),
    entropy_vs_off_falseCommit_pp: m(1).fc - m(0).fc,
    entropy_vs_count_overEsc_pp: m(2).oe - m(0).oe,
  }),
);
