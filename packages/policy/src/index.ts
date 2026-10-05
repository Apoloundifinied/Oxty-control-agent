import { z } from "zod";
import { AgentState, Autonomy, Decision, EntityRef, HealthLevel } from "@ia-control/shared";

// ─── Regras declarativas (spec 6.3) ───────────────────────────────────────────
const Operator = z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "matches"]);

const ConditionValue = z.object({
  eq: z.unknown().optional(),
  ne: z.unknown().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  in: z.array(z.unknown()).optional(),
  nin: z.array(z.unknown()).optional(),
  matches: z.string().optional(),
}).refine(
  (v) => Object.values(v).some((x) => x !== undefined),
  "Condição precisa de ao menos um operador",
);

export const PolicyRule = z.object({
  id: z.string(),
  when: z.object({
    capability: z.string().optional(),
    riskGte: z.number().optional(),
    amountCents: ConditionValue.optional(),
    reversible: z.boolean().optional(),
    "params": z.record(ConditionValue).optional(),
  }).passthrough(),
  then: z.object({
    require: Autonomy.optional(),
    deny: z.boolean().optional(),
    reason: z.string().optional(),
  }),
  hard: z.boolean().default(false),
  priority: z.number().default(100),
  enabled: z.boolean().default(true),
});
export type PolicyRule = z.infer<typeof PolicyRule>;

// ─── Entrada e saída (spec 6.1) ────────────────────────────────────────────────
export type PolicyInput = {
  agent: { id: string; state: AgentState; autonomy: Autonomy; healthLevel: HealthLevel };
  grants: Record<string, { enabled: boolean; maxAmountCents?: number; rateLimitPerHour?: number }>;
  budget: { limitCents: bigint; spentCents: bigint; reservedCents: bigint };
  action: {
    capability: string;
    amountCents: bigint;
    reversible: boolean;
    entityRefs: EntityRef[];
    params: Record<string, unknown>;
  };
  workspace: { globalPause: boolean };
  rules: PolicyRule[];
  counters: { actionsLastHour: number; sameEntityActionsLastMinute: number };
};

export type PolicyOutput = {
  decision: Decision;
  riskScore: number; // 0-100
  requiredApprovals: 0 | 1 | 2;
  reasons: string[];
  reasonCodes: string[];
  budgetReservationCents: bigint;
};

// ─── 6.4 Risco (0-100) ─────────────────────────────────────────────────────────
const CAPABILITY_BASE_RISK: Record<string, number> = {
  read: 0,
  "message.send": 10,
  publish: 25,
  "discount.grant": 40,
  delete: 60,
  "payment.create": 70,
};

function baseRisk(capability: string): number {
  if (capability in CAPABILITY_BASE_RISK) return CAPABILITY_BASE_RISK[capability]!;
  // Heurística por prefixo para capacidades desconhecidas
  if (capability.includes("read") || capability.includes("get")) return 0;
  if (capability.includes("message")) return 10;
  if (capability.includes("publish")) return 25;
  if (capability.includes("discount")) return 40;
  if (capability.includes("delete")) return 60;
  if (capability.includes("pay")) return 70;
  return 20; // desconhecido = médio-baixo
}

export function computeRisk(input: PolicyInput): number {
  const cap = input.action.capability;
  let risk = baseRisk(cap);

  // f(valor): 0-25 pontos conforme montante
  const amount = Number(input.action.amountCents ?? 0n);
  risk += Math.min(25, Math.floor(amount / 10_000)); // +1 a cada R$ 100, teto 25

  // g(irreversível)
  if (!input.action.reversible) risk += 20;

  // h(destinatário novo): sem histórico = +10
  if (input.action.entityRefs.length === 0) risk += 0; // sem entidade não soma
  else if (input.counters.sameEntityActionsLastMinute === 0) risk += 10;

  // i(saúde do agente)
  const healthPenalty: Record<HealthLevel, number> = {
    STABLE: 0, WATCH: 5, DEGRADING: 15, COLLAPSE: 30,
  };
  risk += healthPenalty[input.agent.healthLevel];

  // j(horário incomum 00h-05h) = +5
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) risk += 5;

  return Math.min(100, Math.max(0, risk));
}

// ─── 6.5 Autonomia efetiva ─────────────────────────────────────────────────────
export function effectiveAutonomy(agent: PolicyInput["agent"]): Autonomy {
  // Se DEGRADING, cai um degrau (spec 6.5); COLLAPSE é tratado antes como quarentena
  if (agent.healthLevel === "DEGRADING") {
    if (agent.autonomy === "AUTO") return "APPROVE";
    if (agent.autonomy === "APPROVE") return "DOUBLE";
  }
  return agent.autonomy;
}

function riskBand(risk: number): "low" | "medium" | "high" {
  if (risk < 30) return "low";
  if (risk < 60) return "medium";
  return "high";
}

function approvalsFor(autonomy: Autonomy, risk: number): { decision: Decision; requiredApprovals: 0 | 1 | 2 } {
  const band = riskBand(risk);
  if (autonomy === "AUTO" && band !== "high") return { decision: "ALLOW", requiredApprovals: 0 };
  if (autonomy === "AUTO") return { decision: "ASK", requiredApprovals: 1 };
  if (autonomy === "APPROVE") return { decision: "ASK", requiredApprovals: 1 };
  return { decision: "ASK", requiredApprovals: 2 }; // DOUBLE
}

// ─── Avaliação de regra declarativa ────────────────────────────────────────────
function checkCondition(value: unknown, cond: z.infer<typeof ConditionValue>): boolean {
  if (cond.eq !== undefined && value !== cond.eq) return false;
  if (cond.ne !== undefined && value === cond.ne) return false;
  if (cond.gt !== undefined && !(typeof value === "number" && value > cond.gt)) return false;
  if (cond.gte !== undefined && !(typeof value === "number" && value >= cond.gte)) return false;
  if (cond.lt !== undefined && !(typeof value === "number" && value < cond.lt)) return false;
  if (cond.lte !== undefined && !(typeof value === "number" && value <= cond.lte)) return false;
  if (cond.in !== undefined && !cond.in.includes(value)) return false;
  if (cond.nin !== undefined && cond.nin.includes(value)) return false;
  if (cond.matches !== undefined && !(typeof value === "string" && new RegExp(cond.matches).test(value))) return false;
  return true;
}

function ruleMatches(rule: PolicyRule, input: PolicyInput, risk: number): boolean {
  const w = rule.when;
  if (w.capability && w.capability !== input.action.capability) return false;
  if (w.riskGte !== undefined && risk < w.riskGte) return false;
  if (w.amountCents && !checkCondition(Number(input.action.amountCents ?? 0n), w.amountCents)) return false;
  if (w.reversible !== undefined && w.reversible !== input.action.reversible) return false;
  if (w.params) {
    for (const [key, cond] of Object.entries(w.params)) {
      if (!checkCondition(input.action.params[key], cond)) return false;
    }
  }
  return true;
}

// ─── Motor principal (spec 6.2 — ordem de avaliação) ───────────────────────────
export function evaluate(input: PolicyInput): PolicyOutput {
  const reasons: string[] = [];
  const reasonCodes: string[] = [];
  const deny = (reason: string, code: string): PolicyOutput => ({
    decision: "DENY", riskScore: 0, requiredApprovals: 0,
    reasons: [...reasons, reason], reasonCodes: [...reasonCodes, code],
    budgetReservationCents: 0n,
  });

  // 1. Pausa global ou agente inativo → DENY
  if (input.workspace.globalPause) return deny("Workspace em pausa global", "GLOBAL_PAUSE");
  if (input.agent.state !== "ACTIVE") return deny(`Agente em estado ${input.agent.state}`, "AGENT_NOT_ACTIVE");
  if (input.agent.healthLevel === "COLLAPSE") return deny("Agente em colapso cognitivo (quarentena)", "AGENT_NOT_ACTIVE");

  const grant = input.grants[input.action.capability];

  // 2. Capacidade sem permissão → DENY
  if (!grant || !grant.enabled) {
    return deny(`Capacidade "${input.action.capability}" não autorizada`, "CAPABILITY_DISABLED");
  }

  const amount = input.action.amountCents ?? 0n;

  // 3. Acima do teto por ação ou limite de taxa → DENY
  if (grant.maxAmountCents !== undefined && amount > BigInt(grant.maxAmountCents)) {
    return deny(`Acima do teto por ação (máx ${grant.maxAmountCents} centavos)`, "AMOUNT_LIMIT_EXCEEDED");
  }
  if (grant.rateLimitPerHour !== undefined && input.counters.actionsLastHour >= grant.rateLimitPerHour) {
    return deny("Limite de taxa por hora atingido", "RATE_LIMIT_EXCEEDED");
  }

  // 4. Orçamento insuficiente → DENY
  const { limitCents, spentCents, reservedCents } = input.budget;
  if (spentCents + reservedCents + amount > limitCents) {
    return deny("Limite de gasto atingido", "BUDGET_EXCEEDED");
  }

  const risk = computeRisk(input);

  // 5. Conflito de entidade → ASK
  if (input.action.entityRefs.length > 0 && input.counters.sameEntityActionsLastMinute > 0) {
    reasons.push("Outro agente agindo na mesma entidade");
    reasonCodes.push("ENTITY_CONFLICT");
    return {
      decision: "ASK", riskScore: risk, requiredApprovals: 1,
      reasons, reasonCodes, budgetReservationCents: amount,
    };
  }

  // 6. Regras declarativas: podem elevar exigência, nunca rebaixar regra hard
  let requiredAutonomy = effectiveAutonomy(input.agent);
  let forceDeny: { reason: string; code: string } | null = null;
  const sorted = [...input.rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (!ruleMatches(rule, input, risk)) continue;
    if (rule.then.deny) {
      if (rule.hard) {
        forceDeny = { reason: rule.then.reason ?? `Negado pela regra ${rule.id}`, code: "RULE_DENY" };
        break; // regra hard de negação é final
      }
      forceDeny ??= { reason: rule.then.reason ?? `Negado pela regra ${rule.id}`, code: "RULE_DENY" };
    }
    if (rule.then.require) {
      const order: Autonomy[] = ["AUTO", "APPROVE", "DOUBLE"];
      if (order.indexOf(rule.then.require) > order.indexOf(requiredAutonomy)) {
        requiredAutonomy = rule.then.require;
        if (rule.then.reason) reasons.push(rule.then.reason);
      }
    }
  }
  if (forceDeny) return deny(forceDeny.reason, forceDeny.code);

  // 7. Risco + autonomia → ALLOW / ASK
  const { decision, requiredApprovals } = approvalsFor(requiredAutonomy, risk);

  let budgetReservationCents = 0n;
  if (amount > 0n) budgetReservationCents = amount;

  return { decision, riskScore: risk, requiredApprovals, reasons, reasonCodes, budgetReservationCents };
}
