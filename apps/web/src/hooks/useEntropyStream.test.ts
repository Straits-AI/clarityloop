import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEntropyStream } from "./useEntropyStream";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: unknown) => void)[]> = {};
  onerror: ((e: unknown) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: unknown) => void) {
    (this.listeners[type] ||= []).push(cb);
  }
  emit(type: string, data: unknown) {
    for (const cb of this.listeners[type] ?? []) cb({ data: JSON.stringify(data) });
  }
  close() {
    this.closed = true;
  }
}

const update = (step: number, phase: string, commit: number) => ({
  step,
  phase,
  state: {
    goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [], claims: [],
    riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
  },
  entropy: {
    taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0,
    policyEntropy: 0, memoryEntropy: 0, commitEntropy: commit,
  },
  nextBestAction: null,
  note: null,
});

describe("useEntropyStream", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  });

  it("accumulates updates and ends on the done phase", async () => {
    const { result } = renderHook(() => useEntropyStream("/demo/entropy-stream"));
    const es = FakeEventSource.instances[0];
    act(() => es.emit("entropy", update(0, "scored", 0.82)));
    act(() => es.emit("entropy", update(1, "done", 0.18)));
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.updates.length).toBe(2);
    expect(result.current.latest?.entropy.commitEntropy).toBe(0.18);
    expect(es.closed).toBe(true);
  });

  it("is idle and opens no connection for a null url", () => {
    const { result } = renderHook(() => useEntropyStream(null));
    expect(result.current.status).toBe("idle");
    expect(FakeEventSource.instances.length).toBe(0);
  });
});
