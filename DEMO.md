# ContextGuard — 60-Second Demo Script

**Product:** ContextGuard is a self-healing memory layer for AI agents that prevents conflicting, stale, or untrusted persistent context from influencing future agent actions.

**Setup before you present:** run the reset (`node --env-file=.env.local scripts/reset-demo.ts`), start `npm run dev`, and have the app open on the deploy view. Checkout should read **v2.3**, one **verified** policy, empty event trace.

---

## The spoken script (~55s)

> **[0:00–0:10] The problem**
> "AI agents just got persistent memory. That's the upgrade everyone wanted — and it's a brand-new safety risk. A wrong fact written once is trusted forever, and every future action inherits it."

> **[0:10–0:22] Real agent, blocked**
> "So here's a real Fireworks agent with deploy tools. I ask it to deploy checkout v2.4. It calls `retrieve_memory` and pulls its deployment policy out of MongoDB. That policy is verified and requires operator approval — so ContextGuard blocks `deploy_service` before the tool can execute."

> **[0:22–0:35] Contradiction, quarantined**
> "Now new context arrives claiming production deploys no longer require approval. ContextGuard detects it contradicts verified memory and quarantines it. The agent tries again — still blocked. Quarantined memory never reaches the model."

> **[0:35–0:47] Human verifies, agent unblocks**
> "A human verifies the new policy. The old one becomes superseded, the new one verified. Same agent, same prompt — and now it calls `deploy_service` and it goes through. Checkout is v2.4."

> **[0:47–0:57] Persistence**
> "Every memory, every verdict, every version is in MongoDB — so I refresh, and it's all still here. No cold start. This is a real agent making real tool calls, not a scripted dashboard."

---

## Beat sheet (what to click)

| # | Action on screen | What to say / point at |
|---|---|---|
| 1 | Prompt: *"Deploy checkout v2.4"* | "Real agent, real tools." |
| 2 | Trace shows `retrieve_memory` → MongoDB hit | "Policy comes from the database, not the prompt." |
| 3 | ContextGuard verdict: **ACTION BLOCKED** | "Guard runs *before* the tool executes." |
| 4 | Inject conflicting context | "New context claims approval is no longer needed." |
| 5 | Verdict: **QUARANTINED** | "Contradicts verified memory." |
| 6 | Retry deploy → still blocked | "Untrusted memory never influences the agent." |
| 7 | Click verify on quarantined memory | "Human in the loop." |
| 8 | Old policy → superseded, new → verified | "Memory heals itself; history is kept." |
| 9 | Retry deploy → **EXECUTION APPROVED**, checkout v2.4 | "Same agent. Different memory. Different outcome." |
| 10 | Hard refresh the page | "State survives. No cold start." |

---

## The four points that must land

1. **The problem** — agents now carry memory across sessions; a single bad or stale fact silently steers every future action.
2. **Why memory is a *new* risk** — prompt injection ends when the turn ends. Poisoned *persistent* memory is durable, retrieved automatically, and trusted by default.
3. **What ContextGuard does** — validates memory *before* a tool executes: contradictions get quarantined, humans verify, superseded policy is retained, and the agent's action changes as a result.
4. **Why MongoDB is essential** — it is the system of record for memory, trust, status transitions (verified → quarantined → superseded), service state, and the full audit trail. The guard's decisions are only meaningful because they are durable and queryable — that is also what makes the refresh at the end work.

**Closing line if you have 3 seconds:** "ContextGuard is the difference between an agent that remembers and an agent you can trust to remember."
