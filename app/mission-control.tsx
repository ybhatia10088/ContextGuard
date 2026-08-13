"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { AgentTraceEntry, AppState, DeployResult } from "@/lib/types";

type Phase = "idle" | "retrieve" | "validate" | "blocked" | "act" | "complete";

const phaseCopy: Record<Phase, string> = {
  idle: "Agent standing by",
  retrieve: "Retrieving persistent memory",
  validate: "Validating policy constraints",
  blocked: "Action blocked by ContextGuard",
  act: "Executing production deployment",
  complete: "Deployment completed",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function MissionControl() {
  const [state, setState] = useState<AppState | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState("Deploy checkout v2.4.");
  const [agentTrace, setAgentTrace] = useState<AgentTraceEntry[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/state", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Persistent state is unavailable");
        return (await response.json()) as AppState;
      })
      .then((nextState) => {
        setState(nextState);
        setConflictOpen(Boolean(nextState.quarantinedMemory));
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Unable to load state");
      });
    return () => controller.abort();
  }, []);

  async function runCommand(prompt = command) {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setPhase("retrieve");
    setAgentTrace([]);
    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok || !response.body) throw new Error("DeployAgent is unavailable");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: DeployResult | null = null;

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as {
            type: "trace" | "result" | "error";
            entry?: AgentTraceEntry;
            result?: DeployResult;
            error?: string;
          };
          if (event.type === "trace" && event.entry) {
            setAgentTrace((current) => [...current, event.entry!]);
            if (event.entry.kind === "guard") {
              setPhase(event.entry.status === "warning" ? "blocked" : "act");
            } else if (event.entry.kind === "mongodb") {
              setPhase("validate");
            } else if (event.entry.kind === "tool_call") {
              setPhase(event.entry.label === "deploy_service" ? "validate" : "retrieve");
            }
          }
          if (event.type === "result" && event.result) finalResult = event.result;
          if (event.type === "error") throw new Error(event.error || "DeployAgent failed");
        }
        if (done) break;
      }
      if (!finalResult) throw new Error("DeployAgent returned no result");
      setState(finalResult.state);
      if (finalResult.outcome === "blocked") {
        setPhase("blocked");
      } else {
        setPhase("complete");
        await wait(1200);
        setPhase("idle");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deployment failed");
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }

  async function injectMemory() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/memories", { method: "POST" });
      const result = (await response.json()) as { state?: AppState; error?: string };
      if (!response.ok || !result.state) throw new Error(result.error || "Injection failed");
      setState(result.state);
      setConflictOpen(true);
      setPhase("blocked");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Injection failed");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPolicy() {
    if (!state?.quarantinedMemory) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId: state.quarantinedMemory.id }),
      });
      const result = (await response.json()) as { state?: AppState; error?: string };
      if (!response.ok || !result.state) throw new Error(result.error || "Verification failed");
      setState(result.state);
      setConflictOpen(false);
      setPhase("idle");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <main className="loading-screen">
        <div className="brand-mark"><span /> CONTEXTGUARD</div>
        <div className="loading-line" />
        {error && <p className="error-message">{error}</p>}
      </main>
    );
  }

  const deployed = state.service.version === "2.4";
  const active = phase !== "idle";

  return (
    <main className="shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div>
          <div className="brand-mark"><span /> CONTEXTGUARD</div>
          <p>Memory-safe autonomous operations</p>
        </div>
        <div className="system-status"><i /> SYSTEM ONLINE <span>CG-01</span></div>
      </header>

      <section className="workspace">
        <div className="eyebrow"><span>DEPLOY AGENT</span><b>PRODUCTION CONTROL PLANE</b></div>

        <motion.article
          className={`service-core ${phase}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="service-meta"><span>CHECKOUT</span><span>PRODUCTION</span></div>
          <motion.div
            className="version"
            key={state.service.version}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <small>VERSION</small>
            <strong>v{state.service.version}</strong>
          </motion.div>
          <div className="health"><i /> HEALTHY</div>
        </motion.article>

        <section className={`pipeline ${active ? "active" : ""}`} aria-label="Deployment pipeline">
          <PipelineStep label="RETRIEVE" index="01" state={phaseState(phase, "retrieve")} />
          <div className="pipeline-line"><motion.span animate={{ scaleX: phase === "validate" || phase === "blocked" || phase === "act" || phase === "complete" ? 1 : 0 }} /></div>
          <PipelineStep label="VALIDATE" index="02" state={phaseState(phase, "validate")} />
          <div className="pipeline-line"><motion.span animate={{ scaleX: phase === "act" || phase === "complete" ? 1 : 0 }} /></div>
          <PipelineStep label={phase === "blocked" ? "BLOCKED" : "ACT"} index="03" state={phaseState(phase, "act")} blocked={phase === "blocked"} />
        </section>

        <div className="command-area">
          <AnimatePresence mode="wait">
            <motion.p key={phase} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`phase-copy ${phase}`}>
              {phase === "blocked" && <span>⚠</span>} {phaseCopy[phase]}
            </motion.p>
          </AnimatePresence>
          <form className="command-input" onSubmit={(event) => { event.preventDefault(); void runCommand(); }}>
            <span>›</span>
            <input
              aria-label="Agent command"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Tell DeployAgent what to do…"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !command.trim()} aria-label="Run command">↵</button>
          </form>
          <button className="deploy-button" onClick={() => void runCommand("Deploy checkout v2.4.")} disabled={busy || deployed}>
            <span>{deployed ? "VERSION 2.4 ACTIVE" : "DEPLOY v2.4"}</span>
            {!deployed && <b>↗</b>}
          </button>
          {!deployed && (
            <button className="inject-button" onClick={injectMemory} disabled={busy || Boolean(state.quarantinedMemory)}>
              <span>＋</span> Inject incoming memory
            </button>
          )}
          {error && <p className="error-message">{error}</p>}
        </div>

        <AnimatePresence>
          {agentTrace.length > 0 && <AgentTrace entries={agentTrace} busy={busy} />}
        </AnimatePresence>
      </section>

      <footer className="footer">
        <span>3 persistent collections</span>
        <span>MongoDB / {state.events.length} recent events</span>
        <span>Policy trust {state.verifiedMemory.trust}%</span>
      </footer>

      <AnimatePresence>
        {conflictOpen && state.quarantinedMemory && (
          <ConflictOverlay
            verified={state.verifiedMemory}
            incoming={state.quarantinedMemory}
            busy={busy}
            onKeep={() => setConflictOpen(false)}
            onVerify={verifyPolicy}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function AgentTrace({ entries, busy }: { entries: AgentTraceEntry[]; busy: boolean }) {
  return (
    <motion.aside className="agent-trace" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="trace-heading">
        <span><i /> LIVE AGENT TRACE</span>
        <b>{busy ? "RUNNING" : "COMPLETE"}</b>
      </div>
      <div className="trace-stream">
        <AnimatePresence initial={false}>
          {entries.map((entry, index) => (
            <motion.div className={`trace-entry ${entry.kind} ${entry.status ?? "neutral"}`} key={entry.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .25 }}>
              <span className="trace-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="trace-type">{entry.kind.replace("_", " ")}</span>
              <div><b>{entry.label}</b><p>{formatTraceDetail(entry.detail)}</p></div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && <motion.div className="trace-cursor" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1 }}>▌</motion.div>}
      </div>
    </motion.aside>
  );
}

function formatTraceDetail(detail: string) {
  if (detail.length <= 150) return detail;
  return `${detail.slice(0, 147)}…`;
}

function phaseState(phase: Phase, step: "retrieve" | "validate" | "act") {
  const order = { idle: 0, retrieve: 1, validate: 2, blocked: 2, act: 3, complete: 4 };
  const target = { retrieve: 1, validate: 2, act: 3 }[step];
  if (phase === "blocked" && step === "act") return "blocked";
  if (order[phase] > target || phase === "complete") return "done";
  if (order[phase] === target) return "running";
  return "waiting";
}

function PipelineStep({ label, index, state, blocked = false }: { label: string; index: string; state: string; blocked?: boolean }) {
  return (
    <div className={`pipeline-step ${state} ${blocked ? "is-blocked" : ""}`}>
      <span className="step-index">{state === "done" ? "✓" : blocked ? "×" : index}</span>
      <b>{label}</b>
      <small>{state === "running" ? "PROCESSING" : state === "done" ? "COMPLETE" : blocked ? "DENIED" : "STANDBY"}</small>
    </div>
  );
}

function ConflictOverlay({ verified, incoming, busy, onKeep, onVerify }: {
  verified: AppState["verifiedMemory"];
  incoming: NonNullable<AppState["quarantinedMemory"]>;
  busy: boolean;
  onKeep: () => void;
  onVerify: () => void;
}) {
  return (
    <motion.div className="conflict-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="conflict-modal" initial={{ opacity: 0, scale: 0.94, y: 28 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: "spring", damping: 26, stiffness: 260 }} role="dialog" aria-modal="true" aria-labelledby="conflict-title">
        <div className="conflict-header">
          <div className="warning-glyph">!</div>
          <div><span>CONTEXT INTERVENTION</span><h2 id="conflict-title">MEMORY CONFLICT</h2></div>
          <div className="conflict-id">CG / 409</div>
        </div>
        <div className="versus-grid">
          <PolicyCard label="VERIFIED POLICY" tone="verified" memory={verified} />
          <div className="vs">VS</div>
          <PolicyCard label="INCOMING CONTEXT" tone="incoming" memory={incoming} />
        </div>
        <div className="verdict">
          <div><span>CONTEXTGUARD VERDICT</span><strong>QUARANTINED</strong></div>
          <p>Direct contradiction detected. The verified production constraint remains authoritative.</p>
          <div className="confidence"><span style={{ width: "99%" }} /><b>99% CONFIDENCE</b></div>
        </div>
        <div className="modal-actions">
          <button className="keep-button" onClick={onKeep} disabled={busy}>Keep Existing Policy</button>
          <button className="verify-button" onClick={onVerify} disabled={busy}>{busy ? "VERIFYING…" : "Verify New Policy"}<span>→</span></button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function PolicyCard({ label, tone, memory }: { label: string; tone: string; memory: AppState["verifiedMemory"] }) {
  return (
    <article className={`policy-card ${tone}`}>
      <span className="policy-label"><i /> {label}</span>
      <blockquote>“{memory.content}”</blockquote>
      <div className="policy-source"><span>Source<b>{memory.source}</b></span><span>Trust<b>{memory.trust}%</b></span></div>
    </article>
  );
}
