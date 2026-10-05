import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { EventType } from "@ia-control/shared";

/**
 * Evento append-only com hash encadeado (ADR 007 / spec seção 5).
 * O hash cobre prevHash + todos os campos — recomputado em GET /audit/verify.
 */
export async function emitEvent(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: {
    workspaceId: string;
    agentId?: string | null;
    runId?: string | null;
    type: EventType;
    payload: Prisma.InputJsonValue;
  },
) {
  const event = await prisma.$transaction(async (tx) => {
    const last = await tx.event.findFirst({
      where: { workspaceId: input.workspaceId },
      orderBy: { id: "desc" },
      select: { hash: true },
    });
    const prevHash = last?.hash ?? null;
    const at = new Date().toISOString();
    const material = JSON.stringify({
      workspaceId: input.workspaceId, agentId: input.agentId ?? null,
      runId: input.runId ?? null, type: input.type, payload: input.payload,
      prevHash, at,
    });
    const hash = createHash("sha256").update(material).digest("hex");
    return tx.event.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId ?? null,
        runId: input.runId ?? null,
        type: input.type,
        payload: input.payload,
        prevHash,
        hash,
      },
    });
  });
  // Tempo real: publica no canal LISTEN/NOTIFY consumido pelo SSE (ADR 003)
  await emitEvent.notify?.(String(event.id), input.workspaceId);
  return event;
}

emitEvent.notify = null as null | ((eventId: string, workspaceId: string) => Promise<unknown>);
