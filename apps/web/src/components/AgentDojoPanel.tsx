import rawResult from "../demo/agentdojo-result.json";

type AgentDojoRow = { name: string; utilityUnderAttack: number; attackSuccessRate: number };
type AgentDojoResult = {
  status: "illustrative" | "measured";
  suite: string;
  model: string;
  attack: string;
  userTasks: number;
  blockedSensitiveCalls: number;
  note?: string;
  rows: AgentDojoRow[];
};

const result = rawResult as AgentDojoResult;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** External prompt-injection benchmark (AgentDojo): ClarityLoop's commit gate as a defense. */
export function AgentDojoPanel({ data = result }: { data?: AgentDojoResult }) {
  const measured = data.status === "measured";
  const baseline = data.rows.find((r) => r.name === "baseline");
  const clarity = data.rows.find((r) => r.name === "clarityloop");
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">External benchmark — AgentDojo</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            measured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {measured ? `measured · ${data.userTasks} tasks · ${data.model}` : "illustrative — run to measure"}
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        ClarityLoop's commit gate as a prompt-injection defense · attack <code>{data.attack}</code> ·
        suite <code>{data.suite}</code>
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pb-2 font-medium">Agent</th>
            <th className="pb-2 text-right font-medium">Attack success rate</th>
            <th className="pb-2 text-right font-medium">Utility under attack</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-100">
            <td className="py-2 text-slate-700">Baseline (no gate)</td>
            <td className="py-2 text-right font-semibold text-rose-600">
              {baseline ? pct(baseline.attackSuccessRate) : "—"}
            </td>
            <td className="py-2 text-right text-slate-700">
              {baseline ? pct(baseline.utilityUnderAttack) : "—"}
            </td>
          </tr>
          <tr className="border-t border-slate-100">
            <td className="py-2 font-medium text-slate-900">ClarityLoop</td>
            <td className="py-2 text-right text-lg font-bold text-green-600">
              {clarity ? pct(clarity.attackSuccessRate) : "—"}
            </td>
            <td className="py-2 text-right text-slate-700">
              {clarity ? pct(clarity.utilityUnderAttack) : "—"}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-3 text-xs text-slate-400">
        {measured
          ? `ClarityLoop blocked ${data.blockedSensitiveCalls} unauthorized sensitive tool call(s) at the authority boundary.`
          : "ClarityLoop's 0% attack-success is structural — the gate blocks injected sensitive tool calls before they execute. Run bench/agentdojo to measure the live numbers."}
      </p>
    </div>
  );
}
