import { Elysia, t } from "elysia";
import { prisma } from "../db";

/**
 * Tempo real para a UI (spec seções 8, 17; ADR 003).
 * SSE alimentado por LISTEN/NOTIFY do Postgres + reenvio por Last-Event-ID.
 */
export const streamRoutes = new Elysia()
  .get("/stream", async ({ query, request }) => {
    const { workspaceId } = query;
    const lastId = BigInt(query.lastEventId ?? request.headers.get("last-event-id") ?? "0");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const send = (id: bigint | string, evt: unknown) => {
          controller.enqueue(encoder.encode(`id: ${id}\ndata: ${JSON.stringify(evt)}\n\n`));
        };

        // 1) reenvia o que o cliente perdeu desde Last-Event-ID (reconexão)
        const backlog = await prisma.event.findMany({
          where: { workspaceId, id: { gt: lastId } },
          orderBy: { id: "asc" },
          take: 200,
        });
        for (const e of backlog) {
          send(e.id, {
            id: String(e.id), workspaceId: e.workspaceId, type: e.type,
            agentId: e.agentId, runId: e.runId, payload: e.payload, at: e.createdAt.toISOString(),
          });
        }

        // 2) tailing a cada 1 s (v1 pragmático; ADR 003 prevê LISTEN/NOTIFY —
        //    substituição direta quando migrarmos o transporte, contrato SSE não muda)
        let cursor = backlog.length ? backlog[backlog.length - 1]!.id : lastId;
        const interval = setInterval(async () => {
          try {
            const fresh = await prisma.event.findMany({
              where: { workspaceId, id: { gt: cursor } },
              orderBy: { id: "asc" },
              take: 200,
            });
            for (const e of fresh) {
              cursor = e.id;
              send(e.id, {
                id: String(e.id), workspaceId: e.workspaceId, type: e.type,
                agentId: e.agentId, runId: e.runId, payload: e.payload, at: e.createdAt.toISOString(),
              });
            }
          } catch { /* conexão fechando */ }
        }, 1_000);

        const keepalive = setInterval(() => {
          try { controller.enqueue(encoder.encode(`: ping\n\n`)); } catch { /* fechado */ }
        }, 15_000);

        request.signal.addEventListener("abort", () => {
          clearInterval(interval);
          clearInterval(keepalive);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  }, {
    query: t.Object({ workspaceId: t.String(), lastEventId: t.Optional(t.String()) }),
  });
