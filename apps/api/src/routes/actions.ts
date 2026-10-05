import { Elysia, t } from "elysia";
import { ProposeAction } from "@ia-control/shared";
import { evaluate, PolicyRule } from "@ia-control/policy";
import { agentAuth } from "../agent-auth";
import { prisma } from "../db";
import { emitEvent } from "../events";

const APPROVAL_TTL_HOURS = 24;

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Gateway de ações (spec seções 6, 7): rotas finas — carregam dados,
 * chamam o motor puro `packages/policy` e persistem o resultado.
 */
export const actionRoutes = new Elysia({ prefix: "/actions" })
  .use(agentAuth)

  .post("/propose", async ({ agentKey, body, set }) => {
    const input = ProposeAction.parse(body);
    const agent = await prisma.agent.findUnique({
      where: { id: agentKey!.agentId ?? "" },
      include: { grants: true },
    });
    if (!agent) {
      set.status = 403;
      return { code: "AGENT_KEY_REQUIRED", message: "Chave não vinculada a um agente" };
    }

    // Idempotência: mesma chave + agente devolve a ação original (spec 7.3)
    const existing = await prisma.action.findUnique({
      where: {
        workspaceId_agentId_idempotencyKey: {
          workspaceId: agent.workspaceId,
          agentId: agent.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      return {
        actionId: existing.id, decision: existing.decision,
        reasons: existing.reason ? [existing.reason] : [],
      };
    }

    const period = currentPeriod();
    const [workspace, policiesRaw, runsLastHour] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: agent.workspaceId } }),
      prisma.policy.findMany({
        where: { workspaceId: agent.workspaceId, enabled: true, OR: [{ agentId: agent.id }, { agentId: null }] },
      }),
      prisma.action.count({ where: { agentId: agent.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } } }),
    ]);
    let budget = await prisma.budget.findFirst({ where: { workspaceId: agent.workspaceId, agentId: agent.id, period } });
    // Sem orçamento explícito: usa o do workspace; sem nenhum, limite "infinito" documentado em settings
    budget ??= await prisma.budget.findFirst({ where: { workspaceId: agent.workspaceId, agentId: null, period } });

    const lastHealth = await prisma.healthSnapshot.findFirst({
      where: { agentId: agent.id }, orderBy: { windowEnd: "desc" },
    });

    const entityIds = input.entityRefs.map((e) => `${e.type}:${e.id}`);
    const sameEntity = entityIds.length
      ? await prisma.action.count({
          where: {
            workspaceId: agent.workspaceId, agentId: { not: agent.id },
            createdAt: { gte: new Date(Date.now() - 60_000) },
            // filtro simples: params contendo a referência; refinado na fase 4 (E3)
            summary: { contains: entityIds[0] },
          },
        })
      : 0;

    const out = evaluate({
      agent: {
        id: agent.id, state: agent.state, autonomy: agent.autonomy,
        healthLevel: lastHealth?.level ?? "STABLE",
      },
      grants: Object.fromEntries(agent.grants.map((g) => [
        g.capability,
        {
          enabled: g.enabled,
          maxAmountCents: g.maxAmountCents ?? undefined,
          rateLimitPerHour: g.rateLimitPerHour ?? undefined,
        },
      ])),
      budget: budget
        ? { limitCents: budget.limitCents, spentCents: budget.spentCents, reservedCents: budget.reservedCents }
        : { limitCents: BigInt(Number.MAX_SAFE_INTEGER), spentCents: 0n, reservedCents: 0n },
      action: {
        capability: input.capability,
        amountCents: BigInt(input.amount?.cents ?? 0),
        reversible: input.reversible,
        entityRefs: input.entityRefs,
        params: input.params,
      },
      workspace: { globalPause: workspace.globalPause },
      rules: policiesRaw.map((p) =>
        PolicyRule.parse({ ...(p.rule as Record<string, unknown>), priority: p.priority, enabled: p.enabled }),
      ),
      counters: { actionsLastHour: runsLastHour, sameEntityActionsLastMinute: sameEntity },
    });

    return prisma.$transaction(async (tx) => {
      const action = await tx.action.create({
        data: {
          workspaceId: agent.workspaceId,
          agentId: agent.id,
          runId: input.runId,
          idempotencyKey: input.idempotencyKey,
          capability: input.capability,
          summary: input.summary,
          params: input.params,
          riskScore: out.riskScore,
          amountCents: BigInt(input.amount?.cents ?? 0),
          reversible: input.reversible,
          decision: out.decision,
          status: out.decision === "ALLOW" ? "APPROVED" : out.decision === "ASK" ? "PENDING_APPROVAL" : "DENIED",
          reason: out.reasons.join("; ") || null,
        },
      });

      // Reserva de orçamento atômica (spec 6.7) quando a decisão libera/pede aprovação
      if (out.decision !== "DENY" && out.budgetReservationCents > 0n && budget) {
        const updated = await tx.$executeRaw`
          UPDATE "Budget"
          SET "reservedCents" = "reservedCents" + ${out.budgetReservationCents}
          WHERE id = ${budget.id}
            AND "spentCents" + "reservedCents" + ${out.budgetReservationCents} <= "limitCents"`;
        if (updated === 0) {
          // corrida: alguém reservou primeiro → negar esta ação
          throw Object.assign(new Error("Limite de gasto atingido"), { code: "BUDGET_EXCEEDED", actionId: action.id });
        }
        await tx.ledgerEntry.create({
          data: {
            workspaceId: agent.workspaceId, agentId: agent.id, actionId: action.id,
            kind: "RESERVE", amountCents: out.budgetReservationCents,
          },
        });
      }

      let approvalId: string | undefined;
      let expiresAt: string | undefined;
      if (out.decision === "ASK") {
        const approval = await tx.approval.create({
          data: {
            actionId: action.id,
            required: out.requiredApprovals,
            expiresAt: new Date(Date.now() + APPROVAL_TTL_HOURS * 3_600_000),
          },
        });
        approvalId = approval.id;
        expiresAt = approval.expiresAt.toISOString();
      }

      await emitEvent(tx, {
        workspaceId: agent.workspaceId, agentId: agent.id, runId: input.runId ?? null,
        type: out.decision === "ASK" ? "action.pending_approval" : out.decision === "ALLOW" ? "action.allowed" : "action.denied",
        payload: {
          actionId: action.id, capability: input.capability, summary: input.summary,
          riskScore: out.riskScore, reasons: out.reasons, reasonCodes: out.reasonCodes,
        },
      });

      set.status = out.decision === "DENY" ? 403 : 201;
      return {
        actionId: action.id, decision: out.decision, reasons: out.reasons,
        approvalId, expiresAt,
      };
    }).catch((err) => {
      if (err?.code === "BUDGET_EXCEEDED") {
        set.status = 403;
        return { code: "BUDGET_EXCEEDED", message: err.message, actionId: err.actionId };
      }
      throw err;
    });
  }, { body: t.Record(t.String(), t.Unknown()) })

  .post("/:id/result", async ({ agentKey, params, body, set }) => {
    const action = await prisma.action.findUnique({ where: { id: params.id } });
    if (!action || action.agentId !== agentKey!.agentId) {
      set.status = 404;
      return { code: "NOT_FOUND", message: "Ação não encontrada" };
    }
    const ok = (body as { ok?: boolean }).ok === true;
    const amount = BigInt((body as { amountCents?: number }).amountCents ?? 0) || action.amountCents;

    await prisma.$transaction(async (tx) => {
      const status = ok ? "DONE" : "FAILED";
      await tx.action.update({ where: { id: action.id }, data: { status, result: body as object } });
      // COMMIT: reserva vira gasto. RELEASE: reserva liberada (spec 6.7)
      const kind = ok && action.amountCents > 0n ? "COMMIT" : "RELEASE";
      if (action.amountCents > 0n) {
        const budgetRow = await tx.budget.findFirst({
          where: { workspaceId: action.workspaceId, agentId: action.agentId, period: currentPeriod() },
        });
        if (budgetRow) {
          await tx.$executeRaw`
            UPDATE "Budget"
            SET "reservedCents" = "reservedCents" - ${action.amountCents},
                "spentCents" = "spentCents" + ${ok ? (amount || action.amountCents) : 0n}
            WHERE id = ${budgetRow.id}`;
          await tx.ledgerEntry.create({
            data: {
              workspaceId: action.workspaceId, agentId: action.agentId, actionId: action.id,
              kind, amountCents: ok ? (amount || action.amountCents) : action.amountCents,
            },
          });
        }
      }
      await emitEvent(tx, {
        workspaceId: action.workspaceId, agentId: action.agentId, runId: action.runId,
        type: ok ? "action.executed" : "action.failed",
        payload: { actionId: action.id, ok, amountCents: Number(amount || action.amountCents) },
      });
    });
    return { ok: true as const };
  }, { body: t.Unknown() });
