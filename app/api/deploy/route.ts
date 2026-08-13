import { runDeployAgent } from "@/lib/deploy-agent";
import type { AgentTraceEntry } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string;
    service?: string;
    version?: string;
  };
  const prompt =
    body.prompt?.trim() ||
    `Deploy ${body.service ?? "checkout"} v${body.version ?? "2.4"}.`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        const result = await runDeployAgent(prompt, (entry: AgentTraceEntry) => {
          send({ type: "trace", entry });
        });
        send({ type: "result", result });
      } catch (error) {
        console.error("DeployAgent failed:", error);
        send({ type: "error", error: "DeployAgent failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
