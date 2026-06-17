/// <reference types="vite/client" />
import type { BusinessProcedureVersion, PromotionDecision, PromotionReport, WorkflowPatch } from "@clarityloop/core";

const BASE = import.meta.env.VITE_API_BASE ?? "";

export async function fetchVersions(name: string): Promise<BusinessProcedureVersion[]> {
  const res = await fetch(`${BASE}/procedures/${encodeURIComponent(name)}/versions`);
  if (!res.ok) throw new Error(`fetchVersions failed: ${res.status}`);
  return (await res.json()).versions as BusinessProcedureVersion[];
}

export async function promote(
  versionId: string,
  patch: WorkflowPatch,
): Promise<{ decision: PromotionDecision; report: PromotionReport; newVersionId: string | null }> {
  const res = await fetch(`${BASE}/procedures/${encodeURIComponent(versionId)}/promote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ patch }),
  });
  if (!res.ok) throw new Error(`promote failed: ${res.status}`);
  return res.json();
}
