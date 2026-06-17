import type { MemoryPolicy, OperationalMemory } from "@clarityloop/core";
import type { MemoryRepository } from "@clarityloop/storage";

export type MemoryWriteCandidate = {
  memory: OperationalMemory;
  value: number; // scoreMemoryValue() output
  evidenceSupported: boolean; // false => reject (unsupported)
  reusable: boolean; // false => one-off trivia => reject
};

export type MemoryWriteDecision =
  | { type: "write"; memory: OperationalMemory }
  | { type: "reject"; reason: string }
  | { type: "supersede"; memory: OperationalMemory; replacedId: string };

/** A stable conflict key per memory type (scope + the identifying dimension). */
function conflictKey(m: OperationalMemory): string {
  switch (m.type) {
    case "CustomerPreference":
      return `CustomerPreference:${m.scope}:${m.entity}`;
    case "EvidenceSource":
      return `EvidenceSource:${m.scope}:${m.claimCategory}`;
    case "PolicyException":
      return `PolicyException:${m.scope}:${m.rule}`;
    case "VerifierFinding":
      return `VerifierFinding:${m.scope}:${m.verifierName}`;
    case "WorkflowFailurePatch":
      return `WorkflowFailurePatch:${m.scope}:${m.trigger}`;
  }
}

/**
 * Deterministic memory write gate (memo §16). Write iff: writes enabled, type allowed,
 * evidence-supported, reusable, value >= threshold, and no stronger conflict. Pure —
 * the caller supplies the existing same-scope/type memories.
 */
export function memoryWriteGate(
  candidate: MemoryWriteCandidate,
  policy: MemoryPolicy,
  existing: OperationalMemory[],
): MemoryWriteDecision {
  if (!policy.writeEnabled) return { type: "reject", reason: "memory writes disabled by policy" };
  if (!policy.allowedTypes.includes(candidate.memory.type))
    return { type: "reject", reason: `memory type '${candidate.memory.type}' not allowed by policy` };
  if (!candidate.evidenceSupported) return { type: "reject", reason: "unsupported by evidence" };
  if (!candidate.reusable) return { type: "reject", reason: "one-off trivia; does not change future action selection" };
  if (candidate.value < policy.minMemoryValueToWrite)
    return { type: "reject", reason: "memory value below policy threshold" };

  const key = conflictKey(candidate.memory);
  const conflict = existing.find((e) => conflictKey(e) === key && e.id !== candidate.memory.id);
  if (conflict) {
    switch (policy.conflictResolution) {
      case "reject_on_conflict":
        return { type: "reject", reason: "conflicts with an existing memory" };
      case "prefer_higher_confidence":
        return candidate.memory.confidence > conflict.confidence
          ? { type: "supersede", memory: candidate.memory, replacedId: conflict.id }
          : { type: "reject", reason: "weaker than the existing conflicting memory" };
      case "prefer_newer":
        return { type: "supersede", memory: candidate.memory, replacedId: conflict.id };
    }
  }
  return { type: "write", memory: candidate.memory };
}

/** TTL invalidation (memo §16): true once now > createdAt + ttlDays. */
export function isExpired(memory: OperationalMemory, now: Date = new Date()): boolean {
  const created = new Date(memory.createdAt).getTime();
  const ttlMs = memory.ttlDays * 24 * 60 * 60 * 1000;
  return now.getTime() > created + ttlMs;
}

/** Apply the gate against the repository: query conflicts, then write/supersede/skip. */
export async function commitMemory(
  repo: MemoryRepository,
  candidate: MemoryWriteCandidate,
  policy: MemoryPolicy,
): Promise<MemoryWriteDecision> {
  const existing = await repo.query({ scope: candidate.memory.scope, type: candidate.memory.type });
  const decision = memoryWriteGate(candidate, policy, existing);
  if (decision.type === "write") {
    await repo.put(decision.memory);
  } else if (decision.type === "supersede") {
    await repo.invalidate(decision.replacedId);
    await repo.put(decision.memory);
  }
  return decision;
}
