export function NextBestAction({ action, note }: { action: string | null; note: string | null }) {
  const idle = !action;
  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="eyebrow text-body">Next Best Action</h2>
        <span className="data text-[10px] text-dim">argmax · value − cost</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 shrink-0 rounded-full ${idle ? "bg-dim" : "bg-cyan"}`} style={idle ? {} : { boxShadow: "0 0 9px var(--cyan)" }} />
        <p className={`font-mono text-[15px] ${idle ? "text-dim" : "text-hi"}`}>{action ?? "— loop idle"}</p>
      </div>
      {note ? <p className="mt-2 pl-5 text-[13px] leading-relaxed text-body">{note}</p> : null}
    </section>
  );
}
