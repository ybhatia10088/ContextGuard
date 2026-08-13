import { readState } from "@/lib/contextguard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await readState());
  } catch (error) {
    console.error("State retrieval failed:", error);
    return Response.json({ error: "Unable to retrieve persistent state" }, { status: 500 });
  }
}
