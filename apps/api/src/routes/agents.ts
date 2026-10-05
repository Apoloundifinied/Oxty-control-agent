import { Elysia, t } from "elysia";
import { generateApiKey } from "../agent-auth";
import { prisma } from "../db";
import { emitEvent } from "../events";

/**
 * Gestão de agentes pelo humano (JWT) — CRUD essencial da Fase 1 (spec seção 8).
 */
export const agentRoutes = new Elysia({ prefix: "/agents" })
  // registra agente no workspace (agente nasce sem permissões — menor privilégio)
  .post("/", async ({ body, set }) => {
    const key = generateApiKey();
    const agent = await prisma.agent.create({
      data: {
        workspaceId: body.workspaceId,
        slug: body.slug,
        name: body.name,
        autonomy: "APPROVE", // começa restrito (spec 1.3)
        versions: {
          create: { number: 1, model: body.model ?? "unset", promptHash: "", config: {} },
        },
      },
    });
    await prisma.apiKey.create({
      data: {
        workspaceId: body.workspaceId,
        agentId: agent.id,
        prefix: key.prefix,
        hash: key.hash,
        scopes: ["propose", "result", "heartbeat"],
      },
    });
    await emitEvent(prisma, {
      workspaceId: body.workspaceId, agentId: agent.id,
      type: "agent.registered", payload: { agentId: agent.id, slug: agent.slug },
    });
    set.status = 201;
    // o segredo é exibido UMA vez (spec seção 8)
    return { agent, apiKey: key.secret };
  }, {
    body: t.Object({
      workspaceId: t.String(),
      slug: t.String({ pattern: "^[a-z0-9-]+$" }),
      name: t.String({ minLength: 1 }),
      model: t.Optional(t.String()),
    }),
  })

  .get("/", async ({ query }) => {
    return prisma.agent.findMany({
      where: { workspaceId: query.workspaceId },
      select: {
        id: true, slug: true, name: true, state: true, autonomy: true,
        icon: true, color: true, createdAt: true,
      },
    });
  }, { query: t.Object({ workspaceId: t.String() }) })

  // permissões por agente (spec seção 5)
  .put("/:id/grants", async ({ params, body }) => {
    const agentId = params.id;
    await prisma.$transaction(
      body.grants.map((g) =>
        prisma.capabilityGrant.upsert({
          where: { agentId_capability: { agentId, capability: g.capability } },
          create: { agentId, ...g },
          update: { enabled: g.enabled, maxAmountCents: g.maxAmountCents, rateLimitPerHour: g.rateLimitPerHour },
        }),
      ),
    );
    return { ok: true as const };
  }, {
    body: t.Object({
      grants: t.Array(t.Object({
        capability: t.String(),
        enabled: t.Boolean(),
        maxAmountCents: t.Optional(t.Number()),
        rateLimitPerHour: t.Optional(t.Number()),
      })),
    }),
  })

  .post("/:id/pause", async ({ params, query }) => {
    const agent = await prisma.agent.update({ where: { id: params.id }, data: { state: "PAUSED" } });
    await emitEvent(prisma, {
      workspaceId: agent.workspaceId, agentId: agent.id,
      type: "agent.state_changed", payload: { agentId: agent.id, state: "PAUSED" },
    });
    return { ok: true as const };
  }, { query: t.Object({ workspaceId: t.String() }) })

  .post("/:id/resume", async ({ params }) => {
    const agent = await prisma.agent.update({ where: { id: params.id }, data: { state: "ACTIVE" } });
    await emitEvent(prisma, {
      workspaceId: agent.workspaceId, agentId: agent.id,
      type: "agent.state_changed", payload: { agentId: agent.id, state: "ACTIVE" },
    });
    return { ok: true as const };
  });
