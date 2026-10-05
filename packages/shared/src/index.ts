import { z } from "zod";

// ─── Enums (espelham o schema Prisma — spec seção 5) ──────────────────────────
export const Role = z.enum(["OWNER", "ADMIN", "APPROVER", "VIEWER", "AUDITOR"]);
export const Autonomy = z.enum(["AUTO", "APPROVE", "DOUBLE"]);
export const AgentState = z.enum(["ACTIVE", "PAUSED", "QUARANTINED", "RETIRED"]);
export const Decision = z.enum(["ALLOW", "ASK", "DENY"]);
export const ActionStatus = z.enum([
  "PROPOSED", "PENDING_APPROVAL", "APPROVED", "DENIED", "EXPIRED",
  "EXECUTING", "DONE", "FAILED", "CANCELLED",
]);
export const HealthLevel = z.enum(["STABLE", "WATCH", "DEGRADING", "COLLAPSE"]);
export const MemoryKind = z.enum(["WORKING", "EPISODIC", "SEMANTIC", "PROCEDURAL"]);
export const MemoryStatus = z.enum(["ACTIVE", "PENDING_REVIEW", "SUPERSEDED", "FORGOTTEN", "QUARANTINED"]);

export type Role = z.infer<typeof Role>;
export type Autonomy = z.infer<typeof Autonomy>;
export type AgentState = z.infer<typeof AgentState>;
export type Decision = z.infer<typeof Decision>;
export type ActionStatus = z.infer<typeof ActionStatus>;
export type HealthLevel = z.infer<typeof HealthLevel>;
export type MemoryKind = z.infer<typeof MemoryKind>;
export type MemoryStatus = z.infer<typeof MemoryStatus>;

// ─── Protocolo de eventos (spec seção 7.2) ─────────────────────────────────────
export const EventType = z.enum([
  "agent.registered", "agent.heartbeat", "agent.state_changed", "agent.autonomy_changed",
  "run.started", "run.finished",
  "action.proposed", "action.allowed", "action.pending_approval", "action.approved",
  "action.denied", "action.expired", "action.executed", "action.failed",
  "budget.threshold", "budget.exhausted",
  "context.published", "memory.written", "memory.forgotten",
  "health.changed", "incident.opened", "incident.resolved",
  "change.stage_changed", "report.generated", "system.global_pause",
]);
export type EventType = z.infer<typeof EventType>;

export const EventEnvelope = z.object({
  id: z.string(),
  workspaceId: z.string(),
  type: EventType,
  agentId: z.string().nullable(),
  runId: z.string().nullable(),
  payload: z.record(z.unknown()),
  at: z.string().datetime(),
});
export type EventEnvelope = z.infer<typeof EventEnvelope>;

// ─── Contrato do agente: propose (spec seção 7.3) ─────────────────────────────
export const EntityRef = z.object({ type: z.string(), id: z.string() });
export type EntityRef = z.infer<typeof EntityRef>;

export const ProposeAction = z.object({
  idempotencyKey: z.string().min(8),
  runId: z.string().optional(),
  capability: z.string(),
  summary: z.string().max(200),
  params: z.record(z.unknown()),
  amount: z.object({
    cents: z.number().int().nonnegative(),
    currency: z.literal("BRL"),
  }).optional(),
  reversible: z.boolean().default(true),
  entityRefs: z.array(EntityRef).default([]),
  telemetry: z.object({
    tokensIn: z.number().optional(),
    tokensOut: z.number().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
});
export type ProposeAction = z.infer<typeof ProposeAction>;

export const ProposeResponse = z.object({
  actionId: z.string(),
  decision: Decision,
  reasons: z.array(z.string()),
  approvalId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  retryAfterMs: z.number().optional(),
});
export type ProposeResponse = z.infer<typeof ProposeResponse>;

// ─── Erros da API (spec seção 8) ───────────────────────────────────────────────
export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiError>;
