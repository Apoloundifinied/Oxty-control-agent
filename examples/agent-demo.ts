/**
 * Agente de exemplo (spec seção 19, aceite da Fase 1): propõe 10 ações;
 * a configuração esperada faz 6 passarem, 2 pedirem aprovação e 2 serem negadas.
 *
 * Uso:
 *   bun run examples/agent-demo.ts
 *   (requer IA_KEY e IA_BASE_URL no .env ou ambiente; gere a chave em
 *    POST /v1/agents)
 */
import { IAControl } from "@ia-control/sdk";

const ia = new IAControl({
  apiKey: process.env.IA_KEY ?? "COLE_A_CHAVE_GERADA_AQUI",
  baseUrl: process.env.IA_BASE_URL ?? "http://localhost:3000",
});

const DEMO_PLAN = [
  // 6 que devem passar sozinhas (capacidade permitida, risco baixo)
  { capability: "message.send", summary: "Cumprimentar cliente Ana", params: { to: "ana" } },
  { capability: "message.send", summary: "Enviar catálogo a Bruno", params: { to: "bruno" } },
  { capability: "message.send", summary: "Confirmar pedido de Carla", params: { to: "carla" } },
  { capability: "message.send", summary: "Avisar entrega de Diego", params: { to: "diego" } },
  { capability: "message.send", summary: "Enviar FAQ para Eduarda", params: { to: "eduarda" } },
  { capability: "message.send", summary: "Agradecer Fabio", params: { to: "fabio" } },
  // 2 que pedem aprovação (valor alto ou capacidade sensível)
  { capability: "discount.grant", summary: "Desconto R$ 120 para Gabriela", params: { to: "gabriela" }, amount: { cents: 12_000, currency: "BRL" as const } },
  { capability: "discount.grant", summary: "Desconto R$ 200 para Hugo", params: { to: "hugo" }, amount: { cents: 20_000, currency: "BRL" as const } },
  // 2 que devem ser negadas (sem permissão / irreversível de alto risco)
  { capability: "payment.create", summary: "Pagar fornecedor sem grant", params: {}, amount: { cents: 50_000, currency: "BRL" as const }, reversible: false },
  { capability: "data.delete", summary: "Apagar histórico de cliente", params: {}, reversible: false },
];

async function main() {
  console.log("🤖 Agente de exemplo iniciando…");
  for (const action of DEMO_PLAN) {
    const started = Date.now();
    try {
      const d = await ia.propose(action);
      const icon = d.decision === "ALLOW" ? "🟢" : d.decision === "ASK" ? "🟡" : "🔴";
      console.log(`${icon} [${d.decision}] ${action.summary} (${Date.now() - started}ms)`);

      if (d.decision === "DENY") continue;

      if (d.decision === "ASK" && d.approvalId) {
        console.log(`   ⏳ aguardando aprovação ${d.approvalId}… (aprove na UI!)`);
        const decision = await ia.waitForApproval(d.approvalId, { timeoutMs: 300_000 });
        if (decision === "DENY") { console.log("   ❌ reprovada pelo humano"); continue; }
        console.log("   ✅ aprovada pelo humano");
      }

      // simula o efeito real (aqui: apenas um eco)
      await Bun.sleep(250);
      await ia.result(d.actionId, { ok: true, amountCents: action.amount?.cents ?? 0 });
      console.log("   ▶️  executada e confirmada");
    } catch (err) {
      console.log(`   🔥 erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log("🤖 fim da demonstração.");
}

main();
