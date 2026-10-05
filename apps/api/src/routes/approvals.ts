import { Elysia, t } from "elysia";
import { prisma } from "../db";
import { emitEvent } from "../events";

/**
 * Fila de aprovações do dono (spec 6.6) — JWT exigido (guarda em index.ts).
 */
export const approvalRoutes = new Elysia({ prefix: "/approvals" })
  .get("/", async ({ query }) => {
    const now = new Date();
    const approvals = await prisma.approval.findMany({
      where: { action: { workspaceId: query.workspaceId, status: "PENDING_APPROVAL" }, expiresAt: { gt: now } },
      include: {
        action: {
          select: {
            id: true, capability: true, summary: true, riskScore: true,
            amountCents: true, reversible: true, reason: true, createdAt: true,
            agent: { select: { id: true, name: true, slug: true } },
          },
        },
        decisions: { select: { userId: true, approved: true } },
      },
      orderBy: { expiresAt: "asc" },
    });
    return approvals.map((a) => ({
      approvalId: a.id, required: a.required, expiresAt: a.expiresAt,
      approvalsSoFar: a.decisions.filter((d) => d.approved).length,
      status: "PENDING" as const,
      action: a.action,
    }));
  }, { query: t.Object({ workspaceId: t.String() }) })

  // usado pelo SDK no waitForApproval (polling)
  .get("/:id", async ({ params, set }) => {
    const approval = await prisma.approval.findUnique({
      where: { id: params.id },
      include: { action: true, decisions: true },
    });
    if (!approval) {
      set.status = 404;
      return { code: "NOT_FOUND", message: "Aprovação não encontrada" };
    }
    if (approval.expiresAt < new Date() && approval.action.status === "PENDING_APPROVAL") {
      return { status: "EXPIRED" as const };
    }
    if (["APPROVED", "EXECUTING", "DONE", "FAILED"].includes(approval.action.status)) {
      return { status: "DECIDED" as const, decision: "ALLOW" as const };
    }
    if (["DENIED", "CANCELLED"].includes(approval.action.status)) {
      return { status: "DECIDED" as const, decision: "DENY" as const };
    }
    return { status: "PENDING" as const };
  })

  .post("/:id/decide", async ({ params, body, set }) => {
    const approval = await prisma.approval.findUnique({
      where: { id: params.id },
      include: { action: true, decisions: true },
    });
    if (!approval) {
      set.status = 404;
      return { code: "NOT_FOUND", message: "Aprovação não encontrada" };
    }
    if (approval.expiresAt < new Date()) {
      await prisma.$transaction(async (tx) => {
        await tx.action.update({ where: { id: approval.actionId }, data: { status: "EXPIRED" } });
        await emitEvent(tx, {
          workspaceId: approval.action.workspaceId, agentId: approval.action.agentId,
          runId: approval.action.runId, type: "action.expired", payload: { actionId: approval.actionId },
        });
      });
      set.status = 410;
      return { code: "EXPIRED", message: "Aprovação expirada — expirada é negada, nunca aprovada por omissão" };
    }

    // mesmo humano não decide duas vezes (dupla exige usuários distintos — spec 6.6)
    const already = approval.decisions.some((d) => d.userId === body.userId);
    if (already) {
      set.status = 409;
      return { code: "ALREADY_DECIDED", message: "Este usuário já decidiu esta aprovação" };
    }

    return prisma.$transaction(async (tx) => {
      await tx.approvalDecision.create({
        data: {
          approvalId: approval.id, userId: body.userId,
          approved: body.approved, comment: body.comment, channel: body.channel ?? "web",
        },
      });

      if (!body.approved) {
        await tx.action.update({
          where: { id: approval.actionId },
          data: { status: "DENIED", decision: "DENY", reason: body.comment ?? "reprovado pelo humano" },
        });
        if (approval.action.amountCents > 0n) {
          const budget = await tx.budget.findFirst({
            where: {
              workspaceId: approval.action.workspaceId, agentId: approval.action.agentId,
              period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
            },
          });
          if (budget) {
            await tx.$executeRaw`
              UPDATE "Budget" SET "reservedCents" = "reservedCents" - ${approval.action.amountCents}
              WHERE id = ${budget.id}`;
            await tx.ledgerEntry.create({
              data: {
                workspaceId: approval.action.workspaceId, agentId: approval.action.agentId,
                actionId: approval.actionId, kind: "RELEASE", amountCents: approval.action.amountCents,
              },
            });
          }
        }
        await emitEvent(tx, {
          workspaceId: approval.action.workspaceId, agentId: approval.action.agentId,
          runId: approval.action.runId, type: "action.denied",
          payload: { actionId: approval.actionId, by: body.userId },
        });
        return { status: "DECIDED" as const, decision: "DENY" as const };
      }

      const approvals = approval.decisions.filter((d) => d.approved).length + 1;
      if (approvals < approval.required) {
        return { status: "PENDING" as const, approvalsSoFar: approvals, required: approval.required };
      }
      await tx.action.update({ where: { id: approval.actionId }, data: { status: "APPROVED", decision: "ALLOW" } });
      await emitEvent(tx, {
        workspaceId: approval.action.workspaceId, agentId: approval.action.agentId,
        runId: approval.action.runId, type: "action.approved",
        payload: { actionId: approval.actionId, by: body.userId, approvals },
      });
      return { status: "DECIDED" as const, decision: "ALLOW" as const };
    });
  }, {
    body: t.Object({
      userId: t.String(),
      approved: t.Boolean(),
      comment: t.Optional(t.String()),
      channel: t.Optional(t.String()),
    }),
  });
