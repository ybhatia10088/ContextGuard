import client from "@/lib/mongodb";

export async function GET() {
  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });

    return Response.json({
      ok: true,
      database: process.env.MONGODB_DB ?? "contextguard",
      message: "MongoDB connected",
    });
  } catch (error) {
    console.error("MongoDB health check failed:", error);

    return Response.json(
      {
        ok: false,
        message: "MongoDB connection failed",
      },
      { status: 500 }
    );
  }
}