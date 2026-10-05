import { createHash, randomBytes } from "node:crypto";
import { Elysia } from "elysia";
import { prisma } from "./db";

export function hashApiKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateApiKey() {
  const secret = `iak_${randomBytes(24).toString("hex")}`;
  return { secret, prefix: secret.slice(0, 10), hash: hashApiKey(secret) };
}

/**
 * Autenticação de agente/integração por chave de API (spec seção 8).
 * Segredo nunca é guardado em claro — apenas sha256 (determinístico, permite
 * lookup; chaves são aleatórias de 192 bits, inviáveis de força bruta).
 * Uso: app.use(agentAuth) antes das rotas de agente.
 */
export const agentAuth = new Elysia({ name: "agentAuth" })
  .derive({ as: "scoped" }, async ({ headers }) => {
    const key = headers["x-api-key"];
    if (!key) return { agentKey: null };
    const found = await prisma.apiKey.findFirst({
      where: { hash: hashApiKey(key), revokedAt: null },
    });
    if (found) {
      prisma.apiKey.update({ where: { id: found.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }
    return { agentKey: found ?? null };
  })
  .onBeforeHandle({ as: "scoped" }, ({ agentKey, set }) => {
    if (!agentKey) {
      set.status = 401;
      return { code: "UNAUTHORIZED", message: "Chave de API ausente ou inválida" };
    }
  });
