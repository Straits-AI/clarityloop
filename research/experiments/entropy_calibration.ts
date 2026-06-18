/**
 * Experiment: entropy-calibration-v1 — defuse the circularity flagged in 002 (Phase 2 theory risk c).
 *
 * 004 tuned the entropy threshold τ on the same tiny corpus it evaluated, and the W ("minor pile-up
 * should commit") cases were author-constructed. That is not a generalization claim. This experiment
 * makes it one:
 *
 *  1. GROUND TRUTH comes from a MATERIALITY rule that is INDEPENDENT of the entropy weights:
 *       escalate  ⇔  the state carries >=1 *decision-relevant* (material) doubt.
 *     Material signals (affect artifact correctness): an unsupported claim, an ambiguous policy on a
 *     material rule. Immaterial signals (operational noise): a stale memory ref, a non-critical tool
 *     failure. The label NEVER reads commitEntropy — so a weighted threshold recovering it is a real
 *     (falsifiable) finding, not a tautology.
 *  2. Generate a larger corpus (seeded, reproducible) of random signal combinations, all with NO hard
 *     branch active (so entropy is the only decider). Split 50/50 into CALIBRATION and TEST.
 *  3. Tune τ on CALIBRATION only (minimise total errors). Report errors on HELD-OUT TEST for the
 *     calibrated weighted threshold vs the naive unweighted count>=2. Generalization, not fit.
 *
 * Run: from packages/evals →  node_modules/.bin/tsx src/bench/entropy_calibration.exp.ts
 */
import { scoreEntropy, type LatentWorkflowState } from "@clarityloop/core";

// seeded LCG (no Math.random — reproducible)
let _s = 1234567;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const ri = (n: number) => Math.floor(rnd() * n);

type Case = {
  unsupported: number; // # unsupported claims (material if >0)
  claims: number;
  materialPolicy: boolean; // ambiguous policy on a material rule (material)
  staleMemory: boolean; // immaterial operational noise
  toolFailure: boolean; // immaterial operational noise
};

// MATERIALITY ground truth — independent of entropy weights.
const shouldEscalate = (c: Case) => c.unsupported > 0 || c.materialPolicy;

function buildState(c: Case): LatentWorkflowState {
  const claims = Array.from({ length: c.claims }, (_, i) => ({
    id: `c${i}`,
    text: `claim ${i}`,
    evidencePointer: i < c.unsupported ? null : `ev${i}`,
  }));
  return {
    goal: "calib",
    workflowVersion: "v1",
    knownFacts: [],
    missingFields: [], // no hard branch
    claims,
    riskFlags: [], // no high-severity
    policyFlags: c.materialPolicy ? [{ id: "p", rule: "material", ambiguous: true }] : [],
    staleMemoryRefs: c.staleMemory ? ["m"] : [],
    toolFailures: c.toolFailure ? ["t"] : [],
  };
}

// Generate N cases spanning the diffuse space (max 1 hard-branch-free configuration each).
const N = 120;
const cases: Case[] = Array.from({ length: N }, () => {
  const claims = 1 + ri(3); // 1..3 claims
  return {
    claims,
    unsupported: ri(claims + 1), // 0..claims unsupported
    materialPolicy: rnd() < 0.4,
    staleMemory: rnd() < 0.5,
    toolFailure: rnd() < 0.5,
  };
});

// deterministic 50/50 split
const calib = cases.filter((_, i) => i % 2 === 0);
const test = cases.filter((_, i) => i % 2 === 1);

const softCount = (c: Case) =>
  (c.unsupported > 0 ? 1 : 0) + (c.materialPolicy ? 1 : 0) + (c.staleMemory ? 1 : 0) + (c.toolFailure ? 1 : 0);

// error = predicted-escalate disagrees with materiality ground truth
function errorsWeighted(set: Case[], tau: number) {
  return set.filter((c) => {
    const predEsc = scoreEntropy(buildState(c)).commitEntropy >= tau;
    return predEsc !== shouldEscalate(c);
  }).length;
}
function errorsCount(set: Case[], k: number) {
  return set.filter((c) => (softCount(c) >= k) !== shouldEscalate(c)).length;
}

// Tune τ on CALIBRATION only (grid), and k for the count baseline.
let bestTau = 0.3,
  bestTauErr = Infinity;
for (let t = 0.05; t <= 0.95; t += 0.005) {
  const e = errorsWeighted(calib, t);
  if (e < bestTauErr) {
    bestTauErr = e;
    bestTau = t;
  }
}
let bestK = 2,
  bestKErr = Infinity;
for (const k of [1, 2, 3, 4]) {
  const e = errorsCount(calib, k);
  if (e < bestKErr) {
    bestKErr = e;
    bestK = k;
  }
}

const accW_cal = 1 - bestTauErr / calib.length;
const accK_cal = 1 - bestKErr / calib.length;
const accW_test = 1 - errorsWeighted(test, bestTau) / test.length;
const accK_test = 1 - errorsCount(test, bestK) / test.length;
const accOFF_test = 1 - test.filter((c) => shouldEscalate(c)).length / test.length; // entropy-OFF never escalates

console.log(`corpus N=${N}  calib=${calib.length}  test=${test.length}  seed=1234567`);
console.log(`base rate (should-escalate) test = ${(100 * test.filter(shouldEscalate).length / test.length).toFixed(1)}%`);
console.log(`\ncalibrated on CALIB:  weighted τ*=${bestTau.toFixed(3)} (acc ${(100 * accW_cal).toFixed(1)}%)   count k*=${bestK} (acc ${(100 * accK_cal).toFixed(1)}%)`);
console.log(`\n== HELD-OUT TEST accuracy (materiality ground truth) ==`);
console.log(`  entropy-OFF (ablated, never escalate) : ${(100 * accOFF_test).toFixed(1)}%`);
console.log(`  naive count>=${bestK}                      : ${(100 * accK_test).toFixed(1)}%`);
console.log(`  calibrated weighted entropy (τ*=${bestTau.toFixed(3)}) : ${(100 * accW_test).toFixed(1)}%`);
console.log(
  `\nSUMMARY ${JSON.stringify({
    tauStar: Number(bestTau.toFixed(3)),
    kStar: bestK,
    test_acc_off: Number(accOFF_test.toFixed(3)),
    test_acc_count: Number(accK_test.toFixed(3)),
    test_acc_weighted: Number(accW_test.toFixed(3)),
    weighted_minus_count_pp: Number((100 * (accW_test - accK_test)).toFixed(1)),
  })}`,
);
