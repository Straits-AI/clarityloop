import { useEffect, useState } from "react";
import { EntropyUpdateSchema, type EntropyUpdate } from "@clarityloop/core";

export type StreamStatus = "idle" | "streaming" | "done" | "error";

export function useEntropyStream(url: string | null) {
  const [updates, setUpdates] = useState<EntropyUpdate[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");

  useEffect(() => {
    if (!url) {
      setStatus("idle");
      return;
    }
    setUpdates([]);
    setStatus("streaming");
    const es = new EventSource(url);
    es.addEventListener("entropy", (event) => {
      const parsed = EntropyUpdateSchema.safeParse(JSON.parse((event as MessageEvent).data));
      if (!parsed.success) return;
      setUpdates((prev) => [...prev, parsed.data]);
      if (parsed.data.phase === "done") {
        setStatus("done");
        es.close();
      }
    });
    es.onerror = () => {
      setStatus("error");
      es.close();
    };
    return () => es.close();
  }, [url]);

  const latest = updates.length > 0 ? updates[updates.length - 1] : null;
  return { updates, latest, status };
}
