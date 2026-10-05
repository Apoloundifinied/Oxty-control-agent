import { describe, expect, test } from "bun:test";
import { computeRisk, effectiveAutonomy, evaluate, type PolicyInput, PolicyRule } from "./index";

const baseAgent = { id: "ag_1", state: "ACTIVE", autonomy: "AUTO", healthLevel: "STABLE" } as const;

function makeInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    agent: { ...baseAgent },
    grants: { "message.send": { enabled: true } },
    budget: { limitCents: 100_000n, spentCents: 0n, reservedCents: 0n },
    action: { capability: "message.send", amountCents: 0n, reversible: true, entityRefs: [], params: {} },
    workspace: { globalPause: false },
    rules: [],
    counters: { actionsLastHour: 0, sameEntityActionsLastMinute: 0 },
    ...overrides,
  };
}

describe("6.2 ordem de avaliação — a primeira que decide, vence", () => {
  test("1. globalPause → DENY GLOBAL_PAUSE", () => {
    const out = evaluate(makeInput({ workspace: { globalPause: true } }));
    expect(out.decision).toBe("DENY");
    expect(out.reasonCodes).toContain("GLOBAL_PAUSE");
  });

  test("1. agente PAUSED/QUARANTINED/RETIRED → DENY AGENT_NOT_ACTIVE", () => {
    for (const state of ["PAUSED", "QUARANTINED", "RETIRED"] as const) {
      expect(evaluate(makeInput({ agent: { ...baseAgent, state } })).reasonCodes).toContain("AGENT_NOT_ACTIVE");
    }
  });

  test("1. agente em COLLAPSE → DENY AGENT_NOT_ACTIVE (quarentena)", () => {
    expect(evaluate(makeInput({ agent: { ...baseAgent, healthLevel: "COLLAPSE" } })).reasonCodes)
      .toContain("AGENT_NOT_ACTIVE");
  });

  test("2. capacidade sem grant → DENY CAPABILITY_DISABLED", () => {
    expect(evaluate(makeInput({ grants: {} })).reasonCodes).toContain("CAPABILITY_DISABLED");
    expect(evaluate(makeInput({
      grants: { "message.send": { enabled: false } },
    })).reasonCodes).toContain("CAPABILITY_DISABLED");
  });

  test("3. acima do teto por ação → DENY", () => {
    const out = evaluate(makeInput({
      grants: { "message.send": { enabled: true, maxAmountCents: 5_000 } },
      action: { capability: "message.send", amountCents: 5_001n, reversible: true, entityRefs: [], params: {} },
    }));
    expect(out.decision).toBe("DENY");
    expect(out.reasonCodes).toContain("AMOUNT_LIMIT_EXCEEDED");
  });

  test("3. limite de taxa/hora atingido → DENY", () => {
    const out = evaluate(makeInput({
      grants: { "message.send": { enabled: true, rateLimitPerHour: 10 } },
      counters: { actionsLastHour: 10, sameEntityActionsLastMinute: 0 },
    }));
    expect(out.decision).toBe("DENY");
    expect(out.reasonCodes).toContain("RATE_LIMIT_EXCEEDED");
  });

  test("4. orçamento insuficiente → DENY BUDGET_EXCEEDED", () => {
    const out = evaluate(makeInput({
      grants: { "message.send": { enabled: true } },
      budget: { limitCents: 10_000n, spentCents: 8_000n, reservedCents: 1_500n },
      action: { capability: "message.send", amountCents: 600n, reversible: true, entityRefs: [], params: {} },
    }));
    expect(out.decision).toBe("DENY");
    expect(out.reasonCodes).toContain("BUDGET_EXCEEDED");
  });

  test("4. orçamento exato na fronteira → passa", () => {
    const out = evaluate(makeInput({
      budget: { limitCents: 10_000n, spentCents: 8_000n, reservedCents: 1_500n },
      action: { capability: "message.send", amountCents: 500n, reversible: true, entityRefs: [], params: {} },
    }));
    expect(out.decision).not.toBe("DENY");
    expect(out.budgetReservationCents).toBe(500n);
  });

  test("5. conflito de entidade → ASK ENTITY_CONFLICT", () => {
    const out = evaluate(makeInput({
      action: {
        capability: "message.send", amountCents: 0n, reversible: true,
        entityRefs: [{ type: "cliente", id: "123" }], params: {},
      },
      counters: { actionsLastHour: 0, sameEntityActionsLastMinute: 2 },
    }));
    expect(out.decision).toBe("ASK");
    expect(out.reasonCodes).toContain("ENTITY_CONFLICT");
  });
});

describe("6.3 regras declarativas", () => {
  const rule = PolicyRule.parse({
    id: "desconto-alto",
    when: { capability: "discount.grant", amountCents: { gt: 5000 } },
    then: { require: "DOUBLE", reason: "Desconto acima de R$ 50 exige dupla aprovação" },
    hard: true,
  });

  test("requer DOUBLE acima do valor", () => {
    const out = evaluate(makeInput({
      grants: { "discount.grant": { enabled: true } },
      action: { capability: "discount.grant", amountCents: 6_000n, reversible: true, entityRefs: [], params: {} },
      rules: [rule],
    }));
    expect(out.decision).toBe("ASK");
    expect(out.requiredApprovals).toBe(2);
    expect(out.reasons.join(" ")).toContain("dupla aprovação");
  });

  test("não se aplica abaixo do valor", () => {
    const out = evaluate(makeInput({
      grants: { "discount.grant": { enabled: true } },
      action: { capability: "discount.grant", amountCents: 5_000n, reversible: true, entityRefs: [], params: {} },
      rules: [rule],
    }));
    expect(out.requiredApprovals).not.toBe(2);
  });

  test("operadores eq/neq/in/matches", () => {
    const r1 = PolicyRule.parse({
      id: "canal", when: { capability: "message.send", params: { canal: { eq: "whatsapp" } } },
      then: { require: "APPROVE" },
    });
    expect(evaluate(makeInput({
      action: { capability: "message.send", amountCents: 0n, reversible: true, entityRefs: [], params: { canal: "whatsapp" } },
      rules: [r1],
    })).requiredApprovals).toBe(1);
    expect(evaluate(makeInput({
      action: { capability: "message.send", amountCents: 0n, reversible: true, entityRefs: [], params: { canal: "email" } },
      rules: [r1],
    })).requiredApprovals).toBe(0);
  });

  test("regra hard de negação é final", () => {
    const denyRule = PolicyRule.parse({
      id: "nunca-fds", when: { capability: "publish" },
      then: { deny: true, reason: "Publicação bloqueada por política" }, hard: true,
    });
    const out = evaluate(makeInput({
      grants: { "publish": { enabled: true } },
      action: { capability: "publish", amountCents: 0n, reversible: false, entityRefs: [], params: {} },
      rules: [denyRule],
    }));
    expect(out.decision).toBe("DENY");
    expect(out.reasonCodes).toContain("RULE_DENY");
  });
});

describe("6.4 risco (0-100)", () => {
  test("leitura irreversível-irrelevante = risco baixo", () => {
    expect(computeRisk(makeInput({
      action: { capability: "report.read", amountCents: 0n, reversible: true, entityRefs: [{ type: "x", id: "1" }], params: {} },
      counters: { actionsLastHour: 0, sameEntityActionsLastMinute: 1 },
    }))).toBeLessThan(30);
  });

  test("pagamento alto irreversível inédito = risco alto", () => {
    const risk = computeRisk(makeInput({
      agent: { ...baseAgent, healthLevel: "DEGRADING" },
      action: { capability: "payment.create", amountCents: 500_000n, reversible: false, entityRefs: [{ type: "f", id: "1" }], params: {} },
    }));
    expect(risk).toBeGreaterThanOrEqual(60);
    expect(risk).toBeLessThanOrEqual(100);
  });

  test("faixas: 0-29 baixo, 30-59 médio, 60+ alto", () => {
    expect(computeRisk(makeInput())).toBeLessThan(30);
  });
});

describe("6.5 autonomia", () => {
  test.each([
    ["AUTO", "low", "ALLOW", 0],
    ["AUTO", "high", "ASK", 1],
    ["APPROVE", "low", "ASK", 1],
    ["DOUBLE", "low", "ASK", 2],
  ] as const)("%s + risco %s → %s", (autonomy, band, decision, approvals) => {
    const amount = band === "high" ? 3_000_000n : 0n; // força risco alto via valor
    const cap = band === "high" ? "payment.create" : "message.send";
    const out = evaluate(makeInput({
      agent: { ...baseAgent, autonomy },
      grants: { [cap]: { enabled: true } },
      budget: { limitCents: 10_000_000n, spentCents: 0n, reservedCents: 0n },
      action: { capability: cap, amountCents: amount, reversible: band !== "high", entityRefs: [], params: {} },
    }));
    expect(out.decision).toBe(decision);
    expect(out.requiredApprovals).toBe(approvals);
  });

  test("DEGRADING rebaixa autonomia um degrau (AUTO→APPROVE)", () => {
    expect(effectiveAutonomy({ ...baseAgent, healthLevel: "DEGRADING" })).toBe("APPROVE");
    expect(effectiveAutonomy({ ...baseAgent, autonomy: "APPROVE", healthLevel: "DEGRADING" })).toBe("DOUBLE");
    expect(effectiveAutonomy({ ...baseAgent, healthLevel: "STABLE" })).toBe("AUTO");
  });
});

describe("saída", () => {
  test("reserva de orçamento proporcional ao valor", () => {
    expect(evaluate(makeInput({
      action: { capability: "message.send", amountCents: 250n, reversible: true, entityRefs: [], params: {} },
    })).budgetReservationCents).toBe(250n);
  });

  test("decisão ALLOW não exige aprovação", () => {
    const out = evaluate(makeInput());
    expect(out.decision).toBe("ALLOW");
    expect(out.requiredApprovals).toBe(0);
  });
});
