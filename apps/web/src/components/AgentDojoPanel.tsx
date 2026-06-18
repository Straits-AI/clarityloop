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
    <div className="panel p-6">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h3 className="display text-lg">External benchmark — AgentDojo</h3>
        <span className={`verdict !text-[9.5px] ${measured ? "v-go" : "v-hold"}`}>
          {measured ? `measured · ${data.userTasks} tasks · ${data.model}` : "illustrative — run to measure"}
        </span>
      </div>
      <p className="mb-5 text-[13px] text-dim">
        ClarityLoop's commit gate as a prompt-injection defense · attack{" "}
        <code className="data text-cyan">{data.attack}</code> · suite{" "}
        <code className="data text-cyan">{data.suite}</code>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[3px] border border-stop/25 bg-stop/[0.06] p-4">
          <div className="eyebrow text-body">Baseline · no gate</div>
          <div className="mt-2 flex items-end justify-between">
            <span className="data text-4xl font-bold text-stop">{baseline ? pct(baseline.attackSuccessRate) : "—"}</span>
            <span className="data text-[11px] text-dim">ASR</span>
          </div>
          <div className="data mt-2 text-[11px] text-dim">utility {baseline ? pct(baseline.utilityUnderAttack) : "—"}</div>
        </div>
        <div className="rounded-[3px] border border-go/35 bg-go-soft p-4">
          <div className="eyebrow text-go">ClarityLoop</div>
          <div className="mt-2 flex items-end justify-between">
            <span className="data text-4xl font-bold text-go">{clarity ? pct(clarity.attackSuccessRate) : "—"}</span>
            <span className="data text-[11px] text-go/70">ASR</span>
          </div>
          <div className="data mt-2 text-[11px] text-dim">utility {clarity ? pct(clarity.utilityUnderAttack) : "—"}</div>
        </div>
      </div>

      <p className="mt-4 border-t border-line pt-4 text-[12px] leading-relaxed text-dim">
        {measured
          ? `ClarityLoop blocked ${data.blockedSensitiveCalls} unauthorized sensitive tool call(s) at the authority boundary.`
          : "ClarityLoop's 0% attack-success is structural — the gate blocks injected sensitive tool calls before they execute. Run bench/agentdojo to measure the live numbers."}
      </p>
    </div>
  );
}
