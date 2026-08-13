import {
  CONFLICTING_POLICY,
  getCollections,
  proposePersistentMemory,
  readState,
} from "@/lib/contextguard";
import { explainConflict } from "@/lib/fireworks";

export async function GET() {
  try {
    const { memories } = await getCollections();
    const documents = await memories.find().sort({ createdAt: -1 }).toArray();
    return Response.json(
      documents.map((memory) => ({
        ...memory,
        _id: memory._id.toHexString(),
      })),
    );
  } catch (error) {
    console.error("Memory retrieval failed:", error);
    return Response.json({ error: "Memory retrieval failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { content?: string };
    const content = body.content?.trim() || CONFLICTING_POLICY;
    const { memories } = await getCollections();
    const existing = await memories.findOne(
      { type: "policy", status: "verified" },
      { sort: { createdAt: -1 } },
    );
    if (!existing) throw new Error("No verified policy found");

    const result = await proposePersistentMemory(content, "Unverified instruction");
    const conflict = result.outcome === "quarantined";

    let analysis = null;
    if (conflict) {
      analysis = await explainConflict(existing.content, content);
    }

    return Response.json({ conflict, analysis, state: await readState() }, { status: 201 });
  } catch (error) {
    console.error("Memory injection failed:", error);
    return Response.json({ error: "Memory injection failed" }, { status: 500 });
  }
}
