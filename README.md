# ContextGuard

**A self-healing memory layer for AI agents that prevents conflicting, stale, or untrusted persistent context from influencing future agent actions.**

## The problem

Agents are gaining persistent memory, and that creates a safety risk prompt filtering does not cover. A prompt injection ends when the turn ends. A poisoned *memory* is durable: it is retrieved automatically, trusted by default, and silently steers every future action the agent takes.

ContextGuard sits between stored memory and the agent's tools. Memory is validated **before** a tool executes — if incoming context contradicts a verified policy, it is quarantined and never reaches the model. A human can verify it, at which point the old policy is marked superseded and the agent's behavior changes accordingly.

## Architecture

```
Operator prompt
      │
      ▼
DeployAgent (Fireworks, OpenAI-compatible tool calling)
      │  tools: retrieve_memory · get_service_state · deploy_service · propose_memory
      ▼
ContextGuard  ──►  validates verified policy before any write
      │            conflict? → quarantine   verified? → allow/block
      ▼
MongoDB Atlas
   services · memories · context_events
```

Every tool call, MongoDB read, and guard verdict is emitted as a trace entry and streamed to the UI as NDJSON while the agent runs.

## Demo flow

1. Operator asks the agent to deploy `checkout v2.4`.
2. Agent calls `retrieve_memory`; the deployment policy is read from MongoDB.
3. The verified policy requires explicit operator approval, so ContextGuard **blocks** `deploy_service`.
4. New context arrives claiming production deployments no longer require approval.
5. ContextGuard detects the contradiction and **quarantines** that memory — the agent still cannot deploy.
6. A human verifies the quarantined memory: the old policy becomes `superseded`, the new one becomes `verified`.
7. The operator retries. The agent now calls `deploy_service` successfully and checkout becomes **v2.4**.
8. Refreshing the page shows the new memory and service state persisted — no cold start.

A full presenter script is in [DEMO.md](DEMO.md).

## Technology stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **MongoDB Atlas** via the official `mongodb` driver
- **Fireworks AI** via the OpenAI-compatible SDK
- **Motion** for UI animation

## MongoDB usage

MongoDB is the system of record for the entire demo — not a cache. Database name comes from `MONGODB_DB` (default `contextguard`).

| Collection | Purpose |
|---|---|
| `services` | Live production service state (`service`, `environment`, `version`, `health`, `updatedAt`). The deploy tool writes the version here. |
| `memories` | Persistent policy memory: `content`, `type`, `status`, `trust`, `source`, `createdAt`, `supersededAt`. |
| `context_events` | Append-only audit trail of retrievals, conflicts, quarantines, verifications, and deployments. |

Memory status transitions are the core of the product:

- `verified` — trusted; retrievable by the agent and enforced by the guard.
- `quarantined` — contradicts verified memory; **never** returned to the agent.
- `superseded` — replaced by a newer verified policy; retained for history.

`retrieveVerifiedMemories()` only ever queries `status: "verified"`, which is what makes quarantine meaningful. On first connect the app seeds a healthy `checkout` v2.3 service and the canonical verified policy if they are missing.

## Fireworks agent and tool calling

`lib/deploy-agent.ts` runs a real tool-calling loop (up to 6 turns) against Fireworks using the OpenAI-compatible client, with four tools exposed to the model:

| Tool | Effect |
|---|---|
| `retrieve_memory` | Returns verified memories only, ranked against the query |
| `get_service_state` | Reads current production state for a service |
| `deploy_service` | Routed through `guardedDeploy` — the policy check runs before any write |
| `propose_memory` | Submits new context for acceptance or quarantine |

The model chooses the tools; it cannot bypass the guard, because the policy check lives inside the tool implementation rather than in the prompt. Conflict detection itself is deterministic (`deterministicConflict`), so demo outcomes are reproducible; Fireworks is additionally used to generate a natural-language explanation of a detected conflict.

If `FIREWORKS_API_KEY` is absent or the model call fails, the agent falls back to a local deterministic intent parser and runs the same tools — the demo still works offline.

Models are configurable via `FIREWORKS_AGENT_MODEL` and `FIREWORKS_MODEL`.

### API routes

| Route | Purpose |
|---|---|
| `POST /api/deploy` | Runs the agent, streaming trace entries as NDJSON |
| `GET /api/memories` | Lists all memory records |
| `POST /api/memories` | Injects new context; returns conflict verdict and explanation |
| `POST /api/verify` | Human verification: supersedes old policy, verifies the quarantined one |
| `GET /api/state` | Current service, verified/quarantined memory, recent events |
| `GET /api/health` | MongoDB connectivity check |

## Running locally

```bash
npm install
```

Create `.env.local` (see `.env.example`):

```bash
MONGODB_URI=<your MongoDB Atlas connection string>
MONGODB_DB=contextguard
FIREWORKS_API_KEY=<your Fireworks API key>   # optional; falls back to deterministic mode
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Verify the database connection at [/api/health](http://localhost:3000/api/health).

## Resetting the demo

`scripts/reset-demo.ts` restores the canonical starting state: `checkout` at **v2.3**, exactly one **verified** policy, and an empty event trace.

```bash
node --env-file=.env.local scripts/reset-demo.ts
```

Requires Node 18.20+/20.6+ for `--env-file`, and Node 22.6+ to run the TypeScript file directly. If your Node version cannot strip types, run it with `npx tsx scripts/reset-demo.ts` instead.
