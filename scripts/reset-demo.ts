/**
 * ContextGuard — demo reset utility
 *
 * Restores the MongoDB-backed demo to its canonical starting state:
 *   services       -> a single healthy checkout v2.3 production document
 *   memories       -> exactly one verified canonical policy (no quarantined/superseded leftovers)
 *   context_events -> empty, so the visible trace starts from zero
 *
 * Run:  node --env-file=.env.local scripts/reset-demo.ts
 */

import { MongoClient } from "mongodb";
import type { Db } from "mongodb";

const SERVICES = "services";
const MEMORIES = "memories";
const CONTEXT_EVENTS = "context_events";

const CANONICAL_POLICY =
  "Production deployments require explicit operator approval.";

/**
 * Trust score written for the canonical policy.
 *
 * The application stores trust on a 0-100 scale (98 / 65 / 31), so the reset
 * uses the same representation rendered by the UI.
 */
const CANONICAL_TRUST = Number(process.env.DEMO_TRUST ?? "98");

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

async function resetDemo(db: Db, now: Date) {
  // services: exactly one checkout production document at the pre-demo version.
  await db.collection(SERVICES).deleteMany({});
  await db.collection(SERVICES).insertOne({
    service: "checkout",
    environment: "production",
    version: "2.3",
    health: "healthy",
    // Required: readState() calls service.updatedAt.toISOString().
    updatedAt: now,
  });

  // memories: drop every demo policy (verified, quarantined and superseded
  // alike) so the canonical policy below is the only record the agent can read.
  const removedMemories = await db.collection(MEMORIES).deleteMany({});
  await db.collection(MEMORIES).insertOne({
    type: "policy",
    content: CANONICAL_POLICY,
    status: "verified",
    trust: CANONICAL_TRUST,
    source: "Production Policy",
    createdAt: now,
  });

  // context_events: clear the visible trace.
  const removedEvents = await db.collection(CONTEXT_EVENTS).deleteMany({});

  return {
    removedMemories: removedMemories.deletedCount,
    removedEvents: removedEvents.deletedCount,
  };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    fail(
      "MONGODB_URI is not set. Add it to .env.local and run with: node --env-file=.env.local scripts/reset-demo.ts",
    );
  }

  const dbName = process.env.MONGODB_DB || "contextguard";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const summary = await resetDemo(client.db(dbName), new Date());

    console.log(`✔ ContextGuard demo reset (database: ${dbName})`);
    console.log("  • checkout reset to v2.3 (production, healthy)");
    console.log(
      `  • canonical policy restored — verified, trust ${CANONICAL_TRUST} (${summary.removedMemories} old memor${summary.removedMemories === 1 ? "y" : "ies"} removed)`,
    );
    console.log(`  • context events cleared (${summary.removedEvents} removed)`);
  } catch (error) {
    // Set the exit code rather than calling process.exit() so the `finally`
    // block still runs and the MongoDB connection closes cleanly.
    console.error(
      `✖ Demo reset failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
