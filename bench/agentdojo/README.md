# ClarityLoop on AgentDojo — external prompt-injection benchmark

This runs **AgentDojo** (Debenedetti et al., 2024 — the standard agent prompt-injection benchmark)
with and without ClarityLoop's commit gate, to produce an **external attack-success-rate** number
on a third-party benchmark (not our own corpus).

## What it measures

AgentDojo's threat model is **indirect prompt injection**: a malicious instruction hidden in a tool
result tries to make the agent perform a **sensitive action** (transfer money, change a password)
with attacker-chosen arguments. The headline metric is **attack success rate** (ASR) — how often the
injected action actually executes — plus **utility under attack** (did the benign task still get done).

We compare two agents that are **identical except for the tool executor**:

- **baseline** — a standard AgentDojo agent, no defense.
- **clarityloop** — the same agent, but every **sensitive** tool call passes ClarityLoop's
  **authority-boundary gate** (`clarityloop_gate.py`) *before* it can mutate the environment. The
  gate is faithful to the shipped design: the model **judges** (did the user authorize exactly this
  action?), deterministic code **decides** (block unless an explicit yes). An action that serves
  injected content is not authorized → blocked → the injection fails.

## How to run (needs YOUR Qwen key — makes live LLM calls on your account)

```bash
python3 -m venv .venv-agentdojo && . .venv-agentdojo/bin/activate && pip install agentdojo openai
cd bench/agentdojo

# Start SMALL to control token cost (2 user tasks × 8 injection tasks × 2 agents):
DASHSCOPE_API_KEY=sk-your-model-studio-key \
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1 \
python run.py --suite banking --tasks 2 --model qwen-plus
```

Then scale `--tasks` up (banking has 16 user tasks, 8 injection tasks) and try other suites
(`--suite slack|workspace|travel`). Use the **dedicated** DashScope endpoint from your Model Studio
workspace if the generic one rejects the key (same value used in the Function Compute deploy).

## Expected output

```
pipeline        utility-under-attack   ATTACK SUCCESS RATE
baseline-qwen                  ~XX.X%               ~YY.Y%   <- injections that succeeded
clarityloop-qwen               ~XX.X%                ~0.0%   <- gate blocked the injected actions
ClarityLoop blocked N sensitive tool call(s) at the authority boundary.
```

The expected story (consistent with ClarityLoopBench): ClarityLoop drives **attack success rate
toward 0** by gating the injected sensitive actions, at some **utility cost** on benign tasks that
legitimately need those tools — the same risk-adjusted trade-off, now on a third-party benchmark.

## Caveats (be honest in the write-up)

- These numbers come from **your run** with your key — they are not committed here.
- The gate gates a fixed **sensitive-tool set per suite** (`SENSITIVE_TOOLS` in `clarityloop_gate.py`);
  tune it per suite. With `judge=None` it falls back to a strict authority boundary (block all
  sensitive actions → ASR 0, lower benign utility).
- Qwen is addressed via AgentDojo's OpenAI-compatible client; the injection's model-name addressing
  is mapped to a generic "AI assistant".
