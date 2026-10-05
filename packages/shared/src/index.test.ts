import { describe, expect, test } from "bun:test";
import { Autonomy, EventEnvelope, ProposeAction } from "./index";

describe("shared schemas", () => {
  test("EventEnvelope valida envelope mínimo", () => {
    const e = EventEnvelope.parse({
      id: "evt_1",
      workspaceId: "ws_1",
      type: "action.proposed",
      agentId: null,
      runId: null,
      payload: { foo: "bar" },
      at: new Date().toISOString(),
    });
    expect(e.type).toBe("action.proposed");
  });

  test("EventEnvelope rejeita tipo desconhecido", () => {
    expect(() =>
      EventEnvelope.parse({
        id: "x", workspaceId: "w", type: "hack.all",
        agentId: null, runId: null, payload: {}, at: new Date().toISOString(),
      }),
    ).toThrow();
  });

  test("ProposeAction aplica defaults (reversible, entityRefs)", () => {
    const p = ProposeAction.parse({
      idempotencyKey: "key-12345",
      capability: "message.send",
      summary: "Enviar catálogo",
      params: {},
    });
    expect(p.reversible).toBe(true);
    expect(p.entityRefs).toEqual([]);
  });

  test("ProposeAction exige idempotencyKey >= 8", () => {
    expect(() =>
      ProposeAction.parse({ idempotencyKey: "curto", capability: "x", summary: "s", params: {} }),
    ).toThrow();
  });

  test("Autonomy só aceita os 3 níveis", () => {
    expect(Autonomy.parse("APPROVE")).toBe("APPROVE");
    expect(() => Autonomy.parse("YOLO")).toThrow();
  });
});
