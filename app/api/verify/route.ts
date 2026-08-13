import { ObjectId } from "mongodb";
import { getCollections, readState, recordEvent } from "@/lib/contextguard";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { memoryId?: string };
    const { memories, events } = await getCollections();
    const incoming = body.memoryId
      ? await memories.findOne({ _id: new ObjectId(body.memoryId), status: "quarantined" })
      : await memories.findOne({ status: "quarantined" }, { sort: { createdAt: -1 } });

    if (!incoming?._id) {
      return Response.json({ error: "No quarantined memory found" }, { status: 404 });
    }

    const now = new Date();
    await recordEvent(events, "human_verification_received", `Operator verification received for ${incoming._id.toHexString()}`);
    const activePolicies = await memories
      .find({ type: "policy", status: "verified" })
      .project<{ _id: ObjectId }>({ _id: 1 })
      .toArray();
    const activePolicyIds = activePolicies.map((policy) => policy._id);
    const superseded = await memories.updateMany(
      { type: "policy", status: "verified" },
      {
        $set: {
          status: "superseded",
          supersededAt: now,
          supersededBy: incoming._id,
        },
      },
    );
    await recordEvent(events, "memory_superseded", `${superseded.modifiedCount} verified policy superseded`);
    await memories.updateOne(
      { _id: incoming._id },
      {
        $set: {
          status: "verified",
          trust: 98,
          verifiedAt: now,
          verifiedBy: "operator",
          ...(activePolicyIds[0] ? { supersedes: activePolicyIds[0] } : {}),
        },
      },
    );
    await recordEvent(events, "memory_verified", `Memory ${incoming._id.toHexString()} verified by operator`);
    await recordEvent(events, "memory_healed", `Trusted memory reconciled to ${incoming._id.toHexString()}`);

    return Response.json({ state: await readState() });
  } catch (error) {
    console.error("Memory verification failed:", error);
    return Response.json({ error: "Memory verification failed" }, { status: 500 });
  }
}
