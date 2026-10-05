# IA-Control — Especificação do Ecossistema de Agentes de IA

> **Versão:** 0.1 (documento vivo) · **Idioma:** pt-BR · **Status:** pronto para iniciar a Fase 0
> **Ponto de partida:** protótipo visual 3D (`ia-control.html`) com motor de políticas simulado e API `window.IAControl`.
> **Objetivo deste documento:** ser a única fonte de verdade para construir o sistema de verdade, sem que a ideia se perca no meio do caminho.

---

## 0. Como usar este documento

1. **Você (dono do projeto):** leia as seções 1, 2, 19 e 20. Elas dizem *o que* e *em que ordem*. O resto é referência.
2. **IA de código (Claude Code, Cursor, etc.):** leia o documento inteiro, depois execute apenas **a fase atual** (seção 19). Use o prompt da seção 23.
3. **Regra de ouro:** nada entra no código sem estar aqui; nada muda aqui sem registrar na seção 24 (Registro de decisões).
4. Itens marcados com **[a validar]** dependem de checar documentação de terceiros ou de uma decisão sua. Estão listados na seção 22.

---

## 1. Visão, problema e princípios

### 1.1 Problema
Quem coloca vários agentes de IA para trabalhar (atendimento, cobrança, financeiro, redes, e-mail) enfrenta quatro dores:

| Dor | Consequência |
|---|---|
| Não saber **o que cada agente está fazendo agora** | Perda de controle e de confiança |
| Não ter **limites reais** (gasto, permissões, autonomia) | Risco financeiro e reputacional |
| Agentes **degradam em silêncio** (loops, alucinação, deriva, contexto saturado) | Erros acumulam até virar incidente |
| Cada agente tem seu contexto e memória isolados, sem governança | Respostas inconsistentes, conhecimento perdido |

### 1.2 Visão
**IA-Control é o plano de controle de um ecossistema de agentes.** Ele não executa o trabalho dos agentes: ele **governa**. Decide o que pode acontecer, pede sua aprovação quando importa, guarda contexto e memória compartilhados, mede a saúde de cada agente e do conjunto, e mostra tudo de forma calma e legível.

### 1.3 Princípios de produto
1. **Calma por padrão.** A tela só mostra o necessário; detalhe sob demanda (divulgação progressiva).
2. **Controle antes de autonomia.** Todo agente começa restrito; autonomia é conquistada com histórico.
3. **Tudo é evento.** Nada acontece sem registro imutável e rastreável.
4. **O humano decide o que é irreversível.** Dinheiro, exclusão e comunicação em massa exigem portão.
5. **Falhar de forma segura.** Em dúvida, o sistema degrada a autonomia em vez de seguir adiante.
6. **Transparência cognitiva.** Sempre dá para ver *o que o agente sabia* quando decidiu.
7. **Agnóstico de agente.** Funciona com qualquer agente (Claude, GPT, scripts, n8n) via contrato simples.

### 1.4 Não objetivos (por enquanto)
- Não é um framework para *construir* agentes (LangChain etc.).
- Não hospeda modelos de linguagem.
- Não substitui CRM/ERP; integra-se a eles.
- Não promete detectar 100% das falhas de IA: a saúde cognitiva é **heurística calibrável** (seção 11).

---

## 2. Personas e jornadas

| Persona | Quer | Telas principais |
|---|---|---|
| **Dono** (você/cliente) | Ver, aprovar, pausar. Sem surpresas. | Mapa, Aprovações, Resumo |
| **Gestor** | Ajustar limites, contexto, autonomia; ler relatórios | Agentes, Contexto, Relatórios |
| **Auditor** | Provar o que aconteceu e quem aprovou | Histórico, Trilha de auditoria |
| **Integrador (dev)** | Conectar agentes e sistemas | API, Chaves, Webhooks, SDK |

### Jornadas-chave
1. **Primeira ação real:** dev registra um agente → recebe chave → agente propõe ação → política decide → dono aprova na UI → agente executa → gasto e evento aparecem no mapa 3D.
2. **Alerta de degradação:** agente começa a repetir respostas → Índice de Colapso sobe → sistema reduz autonomia → dono recebe aviso com causa provável → dono reinicia contexto ou reverte versão.
3. **Mudança de contexto:** gestor edita a política de descontos → revisão → publica → agentes recebem a nova versão → relatório mostra impacto.
4. **Manhã do dono:** abre o app → vê o resumo de gestão (o que mudou, o que precisa de decisão, riscos) em menos de 30 segundos.

---

## 3. Glossário

| Termo | Definição |
|---|---|
| **Workspace** | Organização isolada (multi-tenant). Tudo pertence a um workspace. |
| **Agente** | Processo externo que executa trabalho. Tem identidade, versão, permissões, orçamento e autonomia. |
| **Run** | Uma execução/tarefa de um agente (agrupa eventos e ações). |
| **Ação** | Efeito colateral que o agente quer causar (enviar mensagem, pagar, publicar). |
| **Capacidade** | Tipo de ação permitida (ex.: `message.send`, `payment.create`). |
| **Portão (Gate)** | Ponto de decisão da política: permitir, pedir aprovação ou negar. |
| **Autonomia** | `auto`, `approve`, `double` (dupla aprovação, dois humanos diferentes). |
| **Contexto** | Conhecimento curado e versionado que o agente recebe (empresa, regras, FAQ). |
| **Memória** | Conhecimento aprendido durante o uso (fatos, episódios, procedimentos). |
| **ICC** | Índice de Colapso Cognitivo de um agente (0 a 1). |
| **IEE** | Índice de Estresse do Ecossistema (0 a 1). |
| **Quarentena** | Agente isolado: não executa ações, mas continua observável. |

---

## 4. Arquitetura

### 4.1 Visão geral

```
 ┌───────────────┐   propose/result/heartbeat   ┌────────────────────────────────────────┐
 │ Agentes       │ ───────────────────────────► │ API (Bun + Elysia)                     │
 │ (externos)    │ ◄─── decisão / aprovação ─── │  ├─ Gateway de Ações                   │
 │ SDK ou REST   │                              │  ├─ Motor de Políticas   (pacote puro) │
 └───────────────┘                              │  ├─ Contexto & Memória                 │
        ▲                                       │  ├─ Saúde (ICC / IEE)                  │
        │ tool proxy (fase 6)                   │  ├─ Gestão (relatórios, mudanças)      │
        ▼                                       │  └─ Auditoria (append-only)            │
 ┌───────────────┐                              └───────┬─────────────────┬──────────────┘
 │ Integrações   │ ◄────────── adapters ────────────────┘                 │
 │ WhatsApp, etc │                                       ┌────────────────▼───────────┐
 └───────────────┘                                       │ PostgreSQL + pgvector      │
                                                         │ pg-boss (filas/jobs)       │
 ┌─────────────────────────┐   SSE / WebSocket           │ LISTEN/NOTIFY (tempo real) │
 │ Web (RSBuild + TanStack)│ ◄───────────────────────────┴────────────────────────────┘
 │ Mapa 3D (Three.js) + UI │
 └─────────────────────────┘
```

### 4.2 Stack recomendada (alinhada ao que você já domina)

| Camada | Escolha | Motivo |
|---|---|---|
| Runtime/API | **Bun + ElysiaJS** | Velocidade, tipos ponta a ponta |
| Validação | **Zod** (pacote compartilhado) | Um schema serve API, SDK e front |
| Banco | **PostgreSQL + Prisma** | Relacional forte; auditoria; transações para orçamento |
| Vetores | **pgvector** | Memória semântica sem outro serviço |
| Filas/jobs | **pg-boss** (sobre Postgres) | Evita Redis no começo; menos peças |
| Tempo real | **SSE** (UI) + **WebSocket** opcional (agentes) | SSE é simples e atravessa proxies |
| Front | **RSBuild, TanStack Router/Query/Form, UnoCSS, Kobalte** | Stack conhecida |
| 3D | **Three.js** (pacote `ui3d` isolado) | Reaproveita o protótipo |
| Testes | `bun test`, Playwright | Unitário + E2E |
| Observabilidade | OpenTelemetry + logs estruturados (pino) | Diagnóstico |

### 4.3 Estrutura do monorepo (Bun workspaces)

```
ia-control/
├─ apps/
│  ├─ api/            # Elysia: rotas finas, sem regra de negócio
│  └─ web/            # RSBuild + TanStack: telas e orquestração de dados
├─ packages/
│  ├─ shared/         # Schemas Zod, tipos, enums, contratos de evento
│  ├─ policy/         # Motor de políticas PURO (sem I/O) + testes pesados
│  ├─ health/         # Cálculo de sinais, ICC, IEE (puro)
│  ├─ context/        # Montagem de pacote de contexto (token budget)
│  ├─ memory/         # Ciclo de vida da memória, ranking, consolidação
│  ├─ sdk/            # SDK TypeScript para agentes (e spec para outras linguagens)
│  ├─ ui3d/           # Cena Three.js (recebe eventos, emite interações)
│  └─ integrations/   # Adaptadores (um por serviço)
├─ prisma/            # schema + migrações + seeds
├─ docs/              # esta spec, ADRs, runbooks
└─ infra/             # docker-compose, CI, scripts
```

**Regra de arquitetura:** `policy`, `health`, `context` e `memory` são **funções puras** sobre dados. A API só carrega dados, chama o pacote e persiste o resultado. Isso torna o núcleo testável sem banco.

### 4.4 Duas formas de integrar um agente

| Modo | Como funciona | Garantia | Quando |
|---|---|---|---|
| **Gateway** | O agente chama `propose` antes de agir e respeita a resposta | Depende da cooperação do agente | **MVP (fase 1)** |
| **Tool proxy** | O agente chama as ferramentas *através* do IA-Control, que executa com credenciais que o agente nunca vê | **Imposta pelo sistema** | **Fase 6** (obrigatório para ações de dinheiro) |

> Honestidade de projeto: no modo Gateway, um agente mal-comportado pode ignorar o portão. Por isso credenciais sensíveis (pagamentos, e-mail em massa) só entram via Tool proxy.

---

## 5. Modelo de domínio e banco (Prisma)

Convenções: `id` cuid, `workspaceId` em toda tabela de negócio (isolamento), `createdAt/updatedAt`, valores monetários em **centavos (Int/BigInt)** com `currency`.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role        { OWNER ADMIN APPROVER VIEWER AUDITOR }
enum Autonomy    { AUTO APPROVE DOUBLE }
enum AgentState  { ACTIVE PAUSED QUARANTINED RETIRED }
enum Decision    { ALLOW ASK DENY }
enum ActionStatus{ PROPOSED PENDING_APPROVAL APPROVED DENIED EXPIRED EXECUTING DONE FAILED CANCELLED }
enum HealthLevel { STABLE WATCH DEGRADING COLLAPSE }
enum MemoryKind  { WORKING EPISODIC SEMANTIC PROCEDURAL }
enum MemoryStatus{ ACTIVE PENDING_REVIEW SUPERSEDED FORGOTTEN QUARANTINED }

model Workspace {
  id String @id @default(cuid())
  name String
  timezone String @default("America/Sao_Paulo")
  currency String @default("BRL")
  settings Json   @default("{}")      // limites globais, retenção, canais
  globalPause Boolean @default(false) // kill switch
  createdAt DateTime @default(now())
}

model User {
  id String @id @default(cuid())
  email String @unique
  name String
  memberships Membership[]
}
model Membership {
  id String @id @default(cuid())
  workspaceId String
  userId String
  role Role
  @@unique([workspaceId, userId])
}

model Agent {
  id String @id @default(cuid())
  workspaceId String
  slug String                       // "atendimento", "cobranca"
  name String
  icon String?
  color String?
  state AgentState @default(ACTIVE)
  autonomy Autonomy @default(APPROVE)   // começa restrito
  currentVersionId String?
  versions AgentVersion[]
  budgets Budget[]
  grants CapabilityGrant[]
  @@unique([workspaceId, slug])
}
model AgentVersion {                // prompt/modelo/ferramentas versionados
  id String @id @default(cuid())
  agentId String
  number Int
  model String
  promptHash String
  config Json
  note String?
  createdAt DateTime @default(now())
  @@unique([agentId, number])
}
model ApiKey {
  id String @id @default(cuid())
  workspaceId String
  agentId String?                   // null = chave de integração geral
  prefix String                     // exibido na UI
  hash String                       // argon2/sha256 do segredo; nunca guardar o segredo
  scopes String[]
  lastUsedAt DateTime?
  revokedAt DateTime?
}

model CapabilityGrant {             // permissões por agente
  id String @id @default(cuid())
  agentId String
  capability String                 // "payment.create"
  enabled Boolean
  maxAmountCents Int?               // teto por ação
  rateLimitPerHour Int?
  @@unique([agentId, capability])
}
model Policy {                      // regras globais ou por agente (JSON declarativo)
  id String @id @default(cuid())
  workspaceId String
  agentId String?
  priority Int @default(100)
  rule Json                         // ver seção 6.3
  enabled Boolean @default(true)
  versionNo Int @default(1)
}

model Budget {
  id String @id @default(cuid())
  workspaceId String
  agentId String?                   // null = orçamento total do workspace
  period String                     // "2026-10"
  limitCents BigInt
  spentCents BigInt @default(0)
  reservedCents BigInt @default(0)  // reservas de ações pendentes
  @@unique([workspaceId, agentId, period])
}
model LedgerEntry {                 // livro-razão imutável
  id String @id @default(cuid())
  workspaceId String
  agentId String
  actionId String?
  kind String                       // RESERVE | COMMIT | RELEASE | ADJUST
  amountCents BigInt
  createdAt DateTime @default(now())
}

model Run {
  id String @id @default(cuid())
  workspaceId String
  agentId String
  agentVersionId String?
  status String
  contextPackId String?             // o que o agente "sabia" (seção 9.5)
  tokensIn Int @default(0)
  tokensOut Int @default(0)
  costCents Int @default(0)
  startedAt DateTime @default(now())
  endedAt DateTime?
}
model Action {
  id String @id @default(cuid())
  workspaceId String
  agentId String
  runId String?
  idempotencyKey String
  capability String
  summary String
  params Json
  riskScore Int                     // 0-100, calculado no servidor
  amountCents BigInt @default(0)
  reversible Boolean @default(true)
  decision Decision
  status ActionStatus
  reason String?
  result Json?
  createdAt DateTime @default(now())
  @@unique([workspaceId, agentId, idempotencyKey])
}
model Approval {
  id String @id @default(cuid())
  actionId String
  required Int @default(1)          // 2 = dupla
  expiresAt DateTime
  decisions ApprovalDecision[]
}
model ApprovalDecision {
  id String @id @default(cuid())
  approvalId String
  userId String
  approved Boolean
  comment String?
  channel String                    // web, push, whatsapp
  createdAt DateTime @default(now())
  @@unique([approvalId, userId])    // mesmo humano não conta duas vezes
}

model Event {                       // append-only; fonte do mapa 3D e da auditoria
  id BigInt @id @default(autoincrement())
  workspaceId String
  agentId String?
  runId String?
  type String                       // "action.proposed", "health.changed"...
  payload Json
  prevHash String?                  // encadeamento para detectar adulteração
  hash String
  createdAt DateTime @default(now())
  @@index([workspaceId, createdAt])
}

model ContextDoc {
  id String @id @default(cuid())
  workspaceId String
  kind String                       // company|policy|playbook|glossary|faq|persona|tooling
  scope String                      // WORKSPACE|TEAM|AGENT
  agentId String?
  title String
  hard Boolean @default(false)     // invariante: não pode ser sobrescrito
  currentVersionId String?
  reviewDueAt DateTime?
  versions ContextVersion[]
}
model ContextVersion {
  id String @id @default(cuid())
  docId String
  number Int
  body String
  tokens Int
  status String                     // DRAFT|IN_REVIEW|PUBLISHED|ARCHIVED
  authorId String
  publishedAt DateTime?
  embedding Unsupported("vector(1536)")?
}

model Memory {
  id String @id @default(cuid())
  workspaceId String
  agentId String?                   // null = memória compartilhada
  kind MemoryKind
  subject String                    // "cliente:123", "regra:desconto"
  content String
  embedding Unsupported("vector(1536)")?
  confidence Float @default(0.7)
  trust String @default("INTERNAL") // INTERNAL | EXTERNAL_UNTRUSTED
  sourceEventId BigInt?             // proveniência
  status MemoryStatus @default(PENDING_REVIEW)
  supersedesId String?
  expiresAt DateTime?
  hits Int @default(0)
  lastUsedAt DateTime?
  createdAt DateTime @default(now())
}

model HealthSnapshot {
  id String @id @default(cuid())
  workspaceId String
  agentId String?                   // null = ecossistema
  windowStart DateTime
  windowEnd DateTime
  signals Json                      // cada sinal 0..1 + valor bruto
  index Float                       // ICC ou IEE
  level HealthLevel
  topCauses Json
}
model Incident {
  id String @id @default(cuid())
  workspaceId String
  agentId String?
  severity Int
  title String
  status String                     // OPEN|ACK|MITIGATED|RESOLVED
  timeline Json
  postmortem String?
}
model Alert {
  id String @id @default(cuid())
  workspaceId String
  type String
  severity Int
  title String
  body String
  dedupeKey String
  channelsSent String[]
  ackedBy String?
  createdAt DateTime @default(now())
}

model ChangeRequest {               // gestão de mudanças
  id String @id @default(cuid())
  workspaceId String
  target String                     // agent_version|context|policy|budget
  targetId String
  diff Json
  stage String                      // DRAFT|REVIEW|CANARY|PROMOTED|ROLLED_BACK
  canaryPercent Int?
  authorId String
  autoRollbackReason String?
}
model Report {
  id String @id @default(cuid())
  workspaceId String
  kind String                       // DAILY|WEEKLY|MONTHLY|INCIDENT
  periodStart DateTime
  periodEnd DateTime
  content Json
  markdown String
}

model Integration {
  id String @id @default(cuid())
  workspaceId String
  kind String                       // whatsapp|gmail|instagram|pix|calendar|telegram|slack
  status String
  config Json                       // não sensível
  secretRef String                  // aponta para o cofre; nunca o segredo em si
  lastHealthAt DateTime?
}
```

**Índices obrigatórios:** `Event(workspaceId, createdAt)`, `Action(workspaceId, status)`, `Memory` com índice vetorial (HNSW/IVFFlat) e `(workspaceId, agentId, status)`.
**Row-Level Security** do Postgres por `workspaceId` desde o início (defesa em profundidade contra vazamento entre clientes).

---

## 6. Motor de políticas (do protótipo ao servidor)

O protótipo já tem a lógica em miniatura (`handle()`): limite → permissão → autonomia. No servidor ela vira o pacote `packages/policy`, **puro e determinístico**.

### 6.1 Entrada e saída

```ts
// packages/policy
type PolicyInput = {
  agent: { id: string; state: AgentState; autonomy: Autonomy; healthLevel: HealthLevel };
  grants: Record<string, { enabled: boolean; maxAmountCents?: number; rateLimitPerHour?: number }>;
  budget: { limitCents: bigint; spentCents: bigint; reservedCents: bigint };
  action: { capability: string; amountCents: bigint; reversible: boolean; entityRefs: EntityRef[]; params: unknown };
  workspace: { globalPause: boolean };
  rules: PolicyRule[];
  counters: { actionsLastHour: number; sameEntityActionsLastMinute: number };
};
type PolicyOutput = {
  decision: 'ALLOW' | 'ASK' | 'DENY';
  riskScore: number;                  // 0-100
  requiredApprovals: 0 | 1 | 2;
  reasons: string[];                  // texto para o usuário ("Limite de gasto atingido")
  reasonCodes: string[];              // para máquina ("BUDGET_EXCEEDED")
  budgetReservationCents: bigint;
};
```

### 6.2 Ordem de avaliação (a primeira que decide, vence)

1. `globalPause` ou agente `PAUSED/QUARANTINED/RETIRED` → **DENY** (`AGENT_NOT_ACTIVE`)
2. Capacidade sem permissão → **DENY** (`CAPABILITY_DISABLED`)
3. Acima do teto por ação ou limite de taxa → **DENY**
4. Orçamento insuficiente (gasto + reservas + valor > limite) → **DENY** (`BUDGET_EXCEEDED`)
5. Conflito (outro agente agindo na mesma entidade) → **ASK** (`ENTITY_CONFLICT`)
6. Regras declarativas (6.3) → podem **elevar** exigência, nunca rebaixar regra `hard`
7. Cálculo de risco (6.4) e autonomia (6.5) → ALLOW / ASK

### 6.3 Regras declarativas (JSON)

```json
{
  "id": "desconto-alto",
  "when": { "capability": "discount.grant", "amountCents": { "gt": 5000 } },
  "then": { "require": "DOUBLE", "reason": "Desconto acima de R$ 50 exige dupla aprovação" },
  "hard": true
}
```
Operadores: `eq, ne, gt, gte, lt, lte, in, nin, matches`. Sem código arbitrário nas regras (segurança).

### 6.4 Risco (0 a 100)

`risco = base(capacidade) + f(valor) + g(irreversível) + h(destinatário novo) + i(saúde do agente) + j(horário incomum)`

Exemplo de bases: leitura 0 · mensagem a cliente 10 · publicação 25 · desconto 40 · exclusão 60 · pagamento 70. Faixas: **0–29 baixo · 30–59 médio · 60+ alto**.

### 6.5 Autonomia

| Autonomia | Risco baixo | Risco médio | Risco alto |
|---|---|---|---|
| `AUTO` | ALLOW | ALLOW | ASK (1) |
| `APPROVE` | ASK (1) | ASK (1) | ASK (1) |
| `DOUBLE` | ASK (2) | ASK (2) | ASK (2) |

Se `healthLevel` do agente é `DEGRADING`, a autonomia efetiva **cai um degrau** (AUTO→APPROVE). Se `COLLAPSE`, vira quarentena (6.2 item 1).

### 6.6 Aprovações
- Expiram (padrão 24 h; configurável). Expirada = **negada**, nunca aprovada por omissão.
- `DOUBLE` exige **dois usuários diferentes** (restrição única no banco).
- O aprovador só vê aprovação para a qual tem papel `APPROVER+`.
- Cada decisão grava canal, IP/dispositivo e comentário (auditoria).

### 6.7 Orçamento sem corrida (race condition)
Reserva atômica na proposta:
```sql
UPDATE "Budget"
SET "reservedCents" = "reservedCents" + $valor
WHERE id = $id AND "spentCents" + "reservedCents" + $valor <= "limitCents";
-- 0 linhas afetadas => BUDGET_EXCEEDED
```
No `result`: `COMMIT` (reserva vira gasto real) ou `RELEASE` (falha/negação/expiração). Tudo registrado no `LedgerEntry`.

---

## 7. Protocolo de eventos e contrato do agente

### 7.1 Ciclo de uma ação

```
Agente                          IA-Control                         Humano
  │ POST /v1/actions/propose ─────►│ policy.evaluate()                │
  │◄── {decision:"ALLOW"} ─────────│ reserva orçamento                │
  │ executa o efeito               │                                  │
  │ POST /v1/actions/:id/result ──►│ COMMIT ledger, evento            │
  │                                │                                  │
  │ propose (risco alto) ─────────►│ decision=ASK, cria Approval ────►│ notificação
  │◄── {decision:"ASK",approvalId} │                                  │ aprova/recusa
  │ aguarda: SSE/poll/webhook ◄────│◄───────────────────────────────── │
```

### 7.2 Envelope de evento (Zod, em `packages/shared`)

```ts
export const EventEnvelope = z.object({
  id: z.string(),
  workspaceId: z.string(),
  type: z.enum([
    'agent.registered','agent.heartbeat','agent.state_changed','agent.autonomy_changed',
    'run.started','run.finished',
    'action.proposed','action.allowed','action.pending_approval','action.approved',
    'action.denied','action.expired','action.executed','action.failed',
    'budget.threshold','budget.exhausted',
    'context.published','memory.written','memory.forgotten',
    'health.changed','incident.opened','incident.resolved',
    'change.stage_changed','report.generated','system.global_pause'
  ]),
  agentId: z.string().nullable(),
  runId: z.string().nullable(),
  payload: z.record(z.unknown()),
  at: z.string().datetime(),
});
```

### 7.3 `propose` (requisição)

```ts
export const ProposeAction = z.object({
  idempotencyKey: z.string().min(8),          // reenvio seguro
  runId: z.string().optional(),
  capability: z.string(),                      // "message.send"
  summary: z.string().max(200),                // texto humano para a UI
  params: z.record(z.unknown()),
  amount: z.object({ cents: z.number().int().nonnegative(), currency: z.literal('BRL') }).optional(),
  reversible: z.boolean().default(true),
  entityRefs: z.array(z.object({ type: z.string(), id: z.string() })).default([]),
  telemetry: z.object({ tokensIn: z.number().optional(), tokensOut: z.number().optional(), confidence: z.number().min(0).max(1).optional() }).optional(),
});
```
**Resposta:** `{ actionId, decision, reasons[], approvalId?, expiresAt?, retryAfterMs? }`. O risco é **sempre recalculado no servidor**; o valor enviado pelo agente é só dica.

### 7.4 Telemetria que o agente deve enviar (alimenta a saúde)
`heartbeat` a cada 30 s com: `tokensUsed`, `contextWindow`, `queueDepth`, `version`. Em cada run: tokens, latência, número de tentativas, falhas de ferramenta, e (opcional) `confidence`.

### 7.5 SDK mínimo (TypeScript)

```ts
const ia = new IAControl({ apiKey: process.env.IA_KEY!, baseUrl });
const ctx = await ia.context.pack({ task: 'responder cliente', maxTokens: 3000 });  // seção 9
const d = await ia.propose({ capability: 'message.send', summary: 'Enviar catálogo', params });
if (d.decision === 'ASK') await ia.waitForApproval(d.approvalId, { timeoutMs: 600_000 });
if (d.decision === 'DENY') return;
await send(...); await ia.result(d.actionId, { ok: true, amountCents: 0 });
await ia.memory.write({ subject: 'cliente:123', content: 'Prefere contato à tarde', kind: 'SEMANTIC' });
```

---

## 8. API

Base: `/v1` · Autenticação: **chave de API** (agentes/integrações) ou **sessão/JWT** (humanos) · Erros: `{ code, message, details? }` · Paginação por cursor · `Idempotency-Key` em escritas.

| Grupo | Método e rota | Função |
|---|---|---|
| **Agentes** | `POST /agents` · `GET /agents` · `GET/PATCH /agents/:id` | CRUD, estado, autonomia |
| | `POST /agents/:id/pause` · `/resume` · `/quarantine` | Controle |
| | `POST /agents/:id/keys` · `DELETE /keys/:id` | Chaves (segredo exibido uma vez) |
| | `GET/PUT /agents/:id/grants` | Permissões e tetos |
| **Ações** | `POST /actions/propose` · `GET /actions/:id` · `POST /actions/:id/result` | Gateway |
| **Aprovações** | `GET /approvals?status=pending` · `POST /approvals/:id/decide` | Fila do dono |
| **Orçamento** | `GET/PUT /budgets` · `GET /ledger` | Limites e razão |
| **Contexto** | `GET/POST /context/docs` · `POST /context/docs/:id/versions` · `POST .../publish` · `POST /context/pack` | Seção 9 |
| **Memória** | `POST /memory/search` · `POST /memory` · `PATCH /memory/:id` · `DELETE /memory/:id` · `GET /memory/review` | Seção 10 |
| **Saúde** | `GET /health/agents/:id` · `GET /health/ecosystem` · `GET /incidents` | Seções 11–12 |
| **Gestão** | `GET /reports` · `POST /reports/generate` · `GET/POST /changes` · `POST /changes/:id/advance` | Seção 13 |
| **Integrações** | `GET/POST /integrations` · `POST /integrations/:id/test` | Seção 14 |
| **Webhooks** | `GET/POST /webhooks` | Saída para sistemas do cliente |
| **Tempo real** | `GET /stream` (SSE) | Alimenta o mapa 3D |
| **Auditoria** | `GET /audit?from&to&agent&type` · `GET /audit/verify` | Trilha e verificação de integridade |
| **Config** | `GET/PATCH /workspace` · `POST /workspace/global-pause` | Configurações |

**Webhooks de saída (assinados com HMAC):** `approval.requested`, `action.denied`, `health.degrading`, `incident.opened`, `report.generated`.
**Limites de taxa:** por chave e por workspace; resposta `429` com `Retry-After`.

---

## 9. Contexto (página e motor)

### 9.1 O que é
Conhecimento **curado por humanos**, versionado, entregue aos agentes. É diferente de memória (9 vs. 10): contexto é *"o que a empresa diz que é verdade"*; memória é *"o que o sistema aprendeu"*.

### 9.2 Tipos e escopo

| Tipo | Exemplo |
|---|---|
| `company` | Quem somos, produtos, horários, tom de voz |
| `policy` | Regras de desconto, reembolso, o que nunca prometer |
| `playbook` | Passo a passo de cobrança, de reclamação |
| `glossary` | Termos internos |
| `faq` | Perguntas frequentes com resposta oficial |
| `persona` | Papel e estilo de cada agente |
| `tooling` | Como e quando usar cada ferramenta |

**Escopos e precedência:** `RUN` > `AGENT` > `TEAM` > `WORKSPACE` (o mais específico vence), **exceto** documentos `hard=true`, que são invariantes e nunca são sobrescritos.

### 9.3 Página "Contexto" (UI)
- **Árvore** por escopo, com busca e filtros (tipo, agente, desatualizado).
- **Editor** em Markdown com contagem de tokens ao vivo e orçamento por agente.
- **Versões:** diff lado a lado, rascunho → revisão → publicado; **reverter com um clique**.
- **Vínculos:** quais agentes consomem cada documento; pré-visualização "como o agente vê".
- **Saúde do contexto:** documentos vencidos (`reviewDueAt`), contradições detectadas entre documentos, documentos nunca usados.
- **Publicar = mudança de gestão:** gera `ChangeRequest` e evento `context.published` (seção 13).

### 9.4 Montagem do pacote de contexto (`packages/context`)
`POST /context/pack { agentId, task, maxTokens }`:
1. Seleciona documentos `hard` + persona do agente (sempre entram).
2. Busca semântica (pgvector) por documentos e memórias relevantes à tarefa.
3. Ordena por prioridade: `hard` > playbook da tarefa > FAQ > memória > resto.
4. Corta pelo **orçamento de tokens**, resumindo o excedente em vez de descartar às cegas.
5. Salva um **ContextPack** imutável (ids + versões + trechos) e devolve o texto.

### 9.5 Transparência
Cada `Run` guarda `contextPackId`. Na tela do Run: **"O que o agente sabia quando decidiu"** — lista exata de documentos, versões e memórias. É a base do diagnóstico de alucinação e da auditoria.

---

## 10. Memória

### 10.1 Tipos

| Tipo | Função | Exemplo | Vida útil |
|---|---|---|---|
| `WORKING` | Estado da tarefa em curso | "Cliente pediu 2ª via" | Fim do run |
| `EPISODIC` | O que aconteceu | "Em 12/10 negociamos parcelamento" | Meses, com decaimento |
| `SEMANTIC` | Fatos estáveis | "Maria prefere WhatsApp à tarde" | Longa, revisável |
| `PROCEDURAL` | Lições e como fazer | "Cliente X só aceita boleto" | Longa, validada |

Escopo: **privada do agente** ou **compartilhada** do workspace.

### 10.2 Ciclo de vida
```
escrita pelo agente → CANDIDATA → [filtros] → ATIVA ──► usada (hits++) ──► decaimento ──► ESQUECIDA
                          │                    ▲
                          └─► REVISÃO HUMANA ──┘        (substituída ⇒ SUPERSEDED, mantém histórico)
```
- **Auto-aceite** só se: `trust=INTERNAL`, `confidence ≥ 0,8`, sem dado sensível e sem conflito.
- Caso contrário, vai para a **fila de revisão** (`GET /memory/review`).
- **Consolidação noturna (job):** funde duplicatas, resume episódios antigos em fatos, rebaixa o que não é usado, detecta contradição (fato novo vs. antigo → marca o antigo `SUPERSEDED` ou abre revisão).
- **Recuperação:** ranking = `similaridade × confiança × recência × (1 + log(hits))`.

### 10.3 Defesas
- **Envenenamento de memória:** conteúdo vindo de entrada externa (e-mail de cliente, comentário) entra como `EXTERNAL_UNTRUSTED`, **nunca vira regra** e nunca altera política ou permissão.
- **Proveniência:** toda memória aponta para o evento de origem; dá para responder "por que o agente acha isso?".
- **PII / LGPD (e GDPR para clientes na Europa):** detecção de dados pessoais, retenção por tipo, **direito de esquecer** (`DELETE /memory/:id` apaga conteúdo e embedding; mantém só o registro de que foi apagado).
- **Edição humana:** a página de memória permite corrigir, fixar (pin) ou apagar.

### 10.4 Página "Memória" (UI)
Linha do tempo + busca semântica · filtros por agente/tipo/confiança · fila de revisão com aprovar/editar/descartar · "memórias mais usadas" e "memórias que causaram erro" · botão **Esquecer** com confirmação.

---

## 11. Saúde cognitiva — o "aviso de colapso mental" das IAs

> **Aviso de método:** isto **mede sintomas observáveis**, não "pensamento". Os limiares abaixo são **pontos de partida** e devem ser calibrados com dados reais (seção 11.6).

### 11.1 Sinais por agente (janela móvel: últimos N runs ou 1 h)

| # | Sinal | Como medir | Risco (0–1) sobe quando… |
|---|---|---|---|
| S1 | **Loop/repetição** | Similaridade entre saídas/ações consecutivas; mesma chamada com mesmos argumentos ≥3× | similaridade > 0,92 ou repetição ≥ 3 |
| S2 | **Saturação de contexto** | `tokensUsados / janelaDoModelo` | > 0,75 (aviso) · > 0,90 (crítico) |
| S3 | **Deriva (drift)** | Distância entre embeddings das saídas recentes e o centroide da persona/baseline | z-score > 2 |
| S4 | **Ancoragem em entidades** | % de IDs citados (cliente, pedido) que **existem** no sistema | queda abaixo de 98% |
| S5 | **Contradição** | Saída conflita com contexto `hard` ou memória ativa (verificador leve) | qualquer conflito com `hard` |
| S6 | **Erro de ferramenta** | falhas / chamadas | > 10% |
| S7 | **Rejeição humana** | recusadas / pedidos de aprovação | > 30% e em alta |
| S8 | **Tentativas bloqueadas** | ações negadas por política / total | > 15% (agente "forçando a porta") |
| S9 | **Custo/latência anômalos** | z-score vs. baseline do agente | z > 3 |
| S10 | **Retentativas e autocorreção** | retries por tarefa | > 2,5 em média |
| S11 | **Confiança declarada** | `confidence` média e variância (se o agente informar) | queda abrupta |
| S12 | **Silêncio** | ausência de heartbeat / fila crescendo | > 3 heartbeats perdidos |

Cada sinal vira `s_i ∈ [0,1]` por função linear por trechos entre `ok` e `crítico` (configurável).

### 11.2 Índice de Colapso Cognitivo (ICC)

```
ICC = max( 0,6 × max(s_i) ,  Σ(w_i × s_i) / Σ(w_i) )
```
- O `max` garante que **um sinal gravíssimo** (ex.: citar IDs inexistentes) não seja diluído pela média.
- Pesos iniciais: S4=3, S5=3, S1=2, S3=2, S7=2, S2=1,5, S6=1,5, S8=1,5, demais=1.

### 11.3 Níveis e histerese

| Nível | ICC | Significado | Cor/UI |
|---|---|---|---|
| **STABLE** | < 0,30 | Normal | verde |
| **WATCH** | 0,30–0,55 | Atenção; sem ação automática | âmbar suave |
| **DEGRADING** | 0,55–0,75 | Qualidade em queda | âmbar forte |
| **COLLAPSE** | > 0,75 | Risco de dano | vermelho |

- Para **subir** de nível: ICC acima do limiar em **2 janelas seguidas**. Para **descer**: abaixo do limiar **− 0,10** em 3 janelas (evita oscilação).

### 11.4 Escada de resposta automática

| Nível | Ação do sistema | Reversão |
|---|---|---|
| WATCH | Alerta discreto no card do agente; sinal destacado | Automática |
| DEGRADING | **Rebaixa autonomia um degrau**; reduz limite de taxa; sugere "reiniciar contexto"; abre incidente de severidade baixa | Automática se voltar a STABLE |
| COLLAPSE | **Quarentena**: nega novas ações; cancela aprovações pendentes do agente; abre incidente; notifica todos os aprovadores | **Só humano** libera |

Sugestões de remediação exibidas ao dono (ranqueadas pela causa dominante): reiniciar contexto · reverter versão (se subiu logo após uma mudança) · reduzir o pacote de contexto · revisar memórias recentes (possível envenenamento) · trocar de modelo.

### 11.5 Experiência (UI)
- **No mapa 3D:** o anel do agente "respira" mais devagar e muda de cor conforme o nível; em COLLAPSE o nó fica acinzentado com borda vermelha e a conexão se apaga. Nada de números na cena.
- **No card/painel:** um termômetro simples (4 estados) + **"Por que?"** com os 2 sinais principais em linguagem humana. Ex.: *"Repetindo respostas (5 vezes nos últimos 10 minutos)"*.
- **Aviso:** só uma notificação por mudança de nível (deduplicada por `dedupeKey`).

### 11.6 Calibração (obrigatória antes de confiar nos alertas)
1. **Modo sombra** (2 semanas): calcula e registra, **não age**.
2. Rotular incidentes reais (verdadeiro/falso positivo) na UI.
3. Ajustar limiares/pesos por agente; guardar versão da configuração de saúde.
4. Meta inicial: **< 1 falso alarme por agente por semana** e **0 colapsos não detectados** nos incidentes rotulados.

---

## 12. Saúde do ecossistema (como o conjunto se comporta)

### 12.1 Sinais coletivos

| # | Sinal | Detecta |
|---|---|---|
| E1 | **Fila de aprovação** (idade do item mais antigo, tamanho) | Gargalo humano; agentes parados esperando |
| E2 | **Cascata** | Erro num agente seguido de erros em dependentes em Δt curto |
| E3 | **Conflito de entidade** | Dois agentes agindo no mesmo cliente/pedido |
| E4 | **Queima de orçamento** | Gasto projetado até o fim do mês > limite |
| E5 | **Deriva coletiva** | Vários agentes subindo ICC ao mesmo tempo (causa comum: contexto/modelo/integração) |
| E6 | **Vazão vs. baseline** | Queda ou pico anormal de ações |
| E7 | **Saúde das integrações** | Falha de WhatsApp/e-mail/pagamento afetando vários agentes |
| E8 | **Concentração** | Dependência excessiva de um agente ou integração |

### 12.2 IEE e níveis
`IEE = max(0,6 × max(e_i), média ponderada)`; mesmos níveis e histerese do ICC. Pergunta que ele responde: **"o sistema como um todo está saudável?"**

### 12.3 Respostas
- **Causa comum (E5/E7):** um único incidente de ecossistema, não N alertas; aponta a causa provável ("3 agentes degradaram após publicar o contexto v12").
- **Gargalo humano (E1):** sugere delegar aprovação, aumentar autonomia onde o histórico é bom, ou agrupar aprovações.
- **IEE alto:** liga o **modo cauteloso** — todos os agentes sobem um degrau de exigência de aprovação até normalizar.
- **Kill switch** (pausa global) sempre disponível, um toque, com confirmação.

### 12.4 Níveis de contenção (do suave ao total)
`L0` normal → `L1` reduzir taxa → `L2` exigir aprovação em tudo → `L3` quarentena do(s) agente(s) → `L4` pausa global.

---

## 13. Gestão: relatórios, mudanças e versionamento

### 13.1 Relatórios de gestão (gerados por job + resumo escrito por um modelo, com números calculados pelo sistema)

| Relatório | Cadência | Conteúdo |
|---|---|---|
| **Resumo da manhã** | Diário | Pendências de decisão · o que mudou · riscos · gasto vs. ritmo |
| **Gestão semanal** | Semanal | Vazão, taxa de aprovação/rejeição, custo por agente, saúde (ICC/IEE), incidentes, recomendações |
| **Mensal/Custos** | Mensal | Orçamento, tendência, custo por tarefa, economia estimada |
| **Pós-incidente** | Por incidente | Linha do tempo, causa provável, impacto, ações corretivas |

**Regra:** números vêm de consultas do sistema; o modelo só **redige e prioriza**. Nunca deixar o modelo inventar métrica. Cada afirmação do relatório aponta para os dados que a sustentam.
Formato do resumo (≤ 200 palavras): **1) Precisa de você · 2) Mudou · 3) Atenção · 4) Recomendação**.

### 13.2 Gestão de mudanças (`ChangeRequest`)
Mudam o comportamento do ecossistema: versão do agente (prompt/modelo/ferramentas), documento de contexto, política, orçamento, autonomia.

```
DRAFT → REVIEW → CANARY (ex.: 10% das tarefas) → PROMOTED
                     └─► ROLLED_BACK  (manual, ou automático se ICC do canário > ICC base + 0,15)
```
- Toda mudança tem **autor, motivo, diff e responsável**; mudanças em itens `hard` exigem dupla aprovação.
- **Correlação:** o sistema marca no gráfico de saúde *quando* cada mudança foi publicada, para ligar causa e efeito.
- **Janela de calma:** opcional — bloquear mudanças em horários críticos.

### 13.3 Versionamento de agente
`AgentVersion` guarda modelo, hash do prompt, configuração e nota. Dá para comparar versões (custo, taxa de rejeição, ICC) e reverter com um clique.

---

## 14. Integrações e configurações

### 14.1 Contrato de integração (`packages/integrations`)

```ts
interface IntegrationAdapter {
  kind: string;                                  // "whatsapp"
  capabilities: string[];                        // ["message.send","message.read"]
  healthCheck(cfg): Promise<{ ok: boolean; latencyMs: number; detail?: string }>;
  execute(action: ExecutableAction, secrets: SecretHandle): Promise<{ ok: boolean; result?: unknown; amountCents?: bigint }>;
  normalizeInbound?(raw: unknown): InboundEvent;  // webhooks de entrada
}
```
Candidatas iniciais **[a validar na hora de implementar: limites, custos e termos de cada API]**: WhatsApp (API oficial), Gmail/IMAP, Instagram/Meta, Google Calendar, Telegram, Slack, provedor de cobrança/Pix.

### 14.2 Cofre de segredos
Segredos **criptografados** (envelope encryption com chave mestra fora do banco), referenciados por `secretRef`. Agentes **nunca** recebem credenciais no modo Tool proxy. Rotação e revogação pela UI.

### 14.3 Página "Configurações"

| Seção | Itens |
|---|---|
| **Geral** | Nome, fuso (`America/Sao_Paulo`), moeda, idioma |
| **Equipe e papéis** | Convites, `OWNER/ADMIN/APPROVER/VIEWER/AUDITOR`, aprovadores de dupla |
| **Agentes** | Registrar, chaves, permissões, tetos, taxa, autonomia padrão |
| **Orçamentos** | Por agente e total; alertas em 50/80/100%; ação ao atingir (pausar/pedir aprovação) |
| **Aprovações** | Prazo de expiração, canais (web/push/WhatsApp/e-mail), horário de silêncio, substitutos |
| **Saúde** | Limiares e pesos por sinal, modo sombra, níveis e respostas automáticas |
| **Contexto e memória** | Retenção por tipo, regras de auto-aceite, sensibilidade a PII |
| **Integrações** | Conectar, testar, ver saúde, rotacionar segredo |
| **API e webhooks** | Chaves, escopos, endpoints de saída, assinatura HMAC, logs de entrega |
| **Segurança** | 2FA, sessões, IPs permitidos, exportar/apagar dados |
| **Zona de perigo** | Pausa global, apagar workspace |

---

## 15. Mapa de telas e o papel do 3D

### 15.1 Navegação (poucas telas, cada uma com um propósito)
1. **Mapa** (home): cena 3D + pílula de status + dock. *É o painel de bordo, não a ferramenta de trabalho.*
2. **Aprovações:** fila com contexto suficiente para decidir em 5 s (o quê, quem, quanto, reversível?, por quê pediu).
3. **Agentes:** lista e detalhe (permissões, autonomia, versão, saúde, runs).
4. **Contexto** (seção 9) · 5. **Memória** (seção 10)
6. **Saúde:** ICC por agente, IEE, incidentes, "por que?" e remediação.
7. **Gestão:** relatórios, mudanças (canário/rollback), calendário de mudanças.
8. **Histórico e auditoria:** busca, filtros, verificação de integridade.
9. **Configurações** (seção 14.3).

### 15.2 Do protótipo ao sistema real

| Protótipo | Sistema real |
|---|---|
| `generate()` simulador | Eventos reais via `/stream` (SSE); simulador vira modo demonstração |
| `handle()` + roteamento local | `POST /actions/propose` → `packages/policy` |
| Partículas = ações simuladas | Partículas = eventos `action.*` (mesma coreografia: seguir / parar no portão / quicar) |
| Portão colorido por autonomia | Idem, vindo de `Agent.autonomy` |
| Chip com barra de gasto | `Budget.spent/limit` em tempo real |
| `IAControl.dispatch/connect` | Substituído pelo SDK; `connect` vira cliente SSE do `/stream` |
| Painel lateral | Rotas TanStack (`/agents/:id`) com *deep link* |

### 15.3 Regras de UX (princípios Apple aplicados)
- **Uma coisa por vez:** a cena mostra estado; o painel mostra uma tarefa.
- **Divulgação progressiva:** nome e barra → painel → histórico → trilha completa.
- **Resposta imediata e física:** toda ação do usuário tem animação com mola e feedback; nada de "carregando" sem esqueleto.
- **Cor só quando significa algo:** verde/âmbar/vermelho/roxo reservados para estado e autonomia.
- **Acessibilidade:** tudo operável por teclado e leitor de tela (Kobalte); `prefers-reduced-motion` troca animação por mudança de estado; contraste AA; a cena 3D tem equivalente em lista.
- **Mobile primeiro para aprovar:** aprovar/recusar em um toque, com notificação push.
- **Desempenho do 3D:** meta 60 fps em notebook comum; limite de partículas; DPR ≤ 2; pausa de render quando a aba está oculta.

---

## 16. Segurança, privacidade e auditoria

| Tema | Requisito |
|---|---|
| **Isolamento** | `workspaceId` em tudo + Row-Level Security + testes automáticos de vazamento entre tenants |
| **Autenticação** | Humanos: e-mail+senha forte/passkey, 2FA. Agentes: chave por agente, escopo mínimo, rotação |
| **Autorização** | RBAC por papel; aprovação dupla exige **usuários distintos** |
| **Auditoria** | `Event` append-only com **hash encadeado**; `GET /audit/verify` recomputa a cadeia e acusa adulteração |
| **Segredos** | Cofre criptografado; nunca em logs; mascaramento em respostas |
| **Entrada não confiável** | Todo texto de terceiros é tratado como dado, **nunca como instrução** (defesa contra *prompt injection* via mensagem/e-mail) |
| **Menor privilégio** | Agente nasce sem permissões; cada capacidade é liberada explicitamente |
| **Privacidade** | LGPD (e GDPR para clientes europeus): base legal, minimização, retenção, exportação, esquecimento |
| **Resiliência** | Falha da API ⇒ agente **não age** (fail-closed) para capacidades de risco; leitura pode continuar |
| **Backups** | PITR do Postgres; teste de restauração trimestral |
| **Webhooks** | HMAC, timestamp anti-replay, retentativa exponencial |

---

## 17. Observabilidade, custo e desempenho

- **Logs estruturados** (pino) com `workspaceId, agentId, runId, actionId`; **traces** OpenTelemetry por ação.
- **Métricas de plataforma:** latência do `propose` (meta p95 < 150 ms), fila de jobs, atraso do SSE, taxa de erro por integração.
- **Custo:** acompanhar tokens e custo por agente/tarefa; alertas de projeção de estouro.
- **Escala inicial:** Postgres único + 1–2 instâncias da API é suficiente; particionar `Event` por mês quando passar de ~50 milhões de linhas.
- **SSE:** `LISTEN/NOTIFY` + reenvio por `Last-Event-ID` para não perder eventos em reconexão.

---

## 18. Estratégia de testes

| Camada | O que testar | Meta |
|---|---|---|
| `policy` | Tabela de decisão completa, bordas de orçamento, dupla aprovação, regras `hard` | **Cobertura ~100%**, incluindo testes baseados em propriedades |
| Orçamento | Concorrência: 100 `propose` simultâneos nunca estouram o limite | Teste de carga |
| `health` | Sinais com séries sintéticas (loop, deriva, saturação); histerese | Casos-ouro versionados |
| API | Contratos Zod, idempotência, autorização por papel, isolamento de tenant | E2E |
| Memória | Auto-aceite, contradição, esquecimento (apaga embedding de verdade) | Integração |
| Auditoria | Alterar uma linha ⇒ `verify` falha | Integração |
| UI/3D | Fluxo "agente propõe → aprovo → partícula conclui"; teclado; reduced-motion | Playwright |
| **Caos** | Matar API durante aprovação; duplicar eventos; relógio atrasado | Antes da Fase 6 |

---

## 19. Roadmap em fases (com critério de pronto)

> **Regra:** cada fase termina com uma **demonstração de aceite** curta. Não se começa a fase seguinte sem ela.

### Fase 0 — Fundação (≈ 1 semana)
Monorepo, CI, Docker Compose (Postgres+pgvector), Prisma + migrações, auth básica (usuário/workspace), `packages/shared` com os schemas, ADRs 001–005.
**Aceite:** `bun test` e `bun run dev` funcionam do zero em máquina limpa; criar workspace e usuário por API.

### Fase 1 — Fatia vertical: a primeira ação real (≈ 2 semanas) ⭐
Registrar agente + chave · `propose/result` · `packages/policy` v1 (permissão, orçamento, autonomia) · aprovação simples na UI · `/stream` SSE · mapa 3D alimentado por eventos reais · agente de exemplo (script) usando o SDK.
**Aceite (o "dia da prova"):** um script real propõe 10 ações; 6 passam sozinhas, 2 pedem aprovação, 2 são negadas; você aprova pelo celular; **tudo aparece no mapa em tempo real**; o gasto bate com o razão.

### Fase 2 — Controle completo (≈ 2 semanas)
Dupla aprovação · tetos e taxa · orçamento com reserva atômica · histórico e auditoria (hash encadeado + verify) · pausa por agente e global · papéis (RBAC) · notificações de aprovação (push/e-mail).
**Aceite:** teste de carga de orçamento sem estouro; `audit/verify` detecta adulteração; kill switch para tudo em < 1 s.

### Fase 3 — Contexto e memória (≈ 3 semanas)
Páginas Contexto e Memória · versões/diff/publicar/reverter · `context.pack` com orçamento de tokens · memória 4 tipos, fila de revisão, esquecimento · `contextPackId` no Run ("o que o agente sabia").
**Aceite:** mudar uma regra no Contexto altera o comportamento do agente de exemplo; apagar uma memória remove também o embedding.

### Fase 4 — Saúde cognitiva e do ecossistema (≈ 3 semanas)
Coleta de telemetria · sinais S1–S12 · ICC/IEE · histerese · **modo sombra** · incidentes · escada de resposta · UI de saúde e "Por que?" · integração visual no 3D.
**Aceite:** agente de teste com *loop injetado* é detectado em < 2 janelas, rebaixado e depois de volta a STABLE; relatório de falsos positivos da semana de sombra.

### Fase 5 — Gestão (≈ 2 semanas)
Resumo da manhã e relatório semanal · `ChangeRequest` com canário e rollback automático · versionamento de agente · correlação mudança × saúde.
**Aceite:** publicar uma mudança ruim em canário e ver o rollback automático.

### Fase 6 — Integrações reais e Tool proxy (≈ 4 semanas)
Cofre de segredos · 1ª integração ponta a ponta (sugestão: WhatsApp ou e-mail) · Tool proxy para capacidades de dinheiro · webhooks de saída · testes de caos.
**Aceite:** agente executa uma ação real **sem nunca ver a credencial**; falha da API ⇒ nenhuma ação de risco ocorre.

### Fase 7 — Endurecimento e produto (contínuo)
Multi-tenant completo, RLS auditada, billing, onboarding guiado, documentação pública da API, SDKs em Python, status page.

---

## 20. Estratégia anti-abandono (para a ideia não morrer)

1. **Estrela-guia:** *"Em 3 semanas, vejo uma ação real de um agente passar pelo meu portão e aparecer no mapa."* Tudo que não serve a isso espera.
2. **Fatia vertical primeiro:** nunca construir "camada por camada". A Fase 1 já atravessa banco, API, política, UI e 3D, ainda que feia.
3. **Ritual semanal de 30 min:** (a) o que rodou, (b) o que travou, (c) próxima fatia pequena. Registrar em `docs/diario.md` (3 linhas).
4. **Estacionamento de ideias:** ideia nova vai para `docs/parking-lot.md`, **não** para o código. Revisar só no fim de cada fase.
5. **Demonstração semanal:** gravar 60–90 s da tela funcionando. Progresso visível alimenta a motivação e serve de prova para clientes.
6. **Tarefas de ≤ 1 dia:** se um item do backlog passa disso, quebrar.
7. **Critérios de parada/pivô (decidir agora, não no desespero):**
   - Fase 1 não concluída em **6 semanas** ⇒ reduzir escopo (cortar 3D da primeira versão, manter só lista).
   - Nenhum usuário real (nem você) usando após a Fase 2 ⇒ conversar com 3 potenciais clientes antes de investir em saúde cognitiva.
8. **Dogfooding:** usar o próprio IA-Control para governar os agentes que você já usa, desde a Fase 1.
9. **Bus factor:** este documento + ADRs + `README` de execução; qualquer pessoa/IA retoma em 1 hora.

---

## 21. Riscos principais

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Escopo gigante | Alta | Alto | Fases com aceite; fatia vertical; estacionamento de ideias |
| Agente ignora o Gateway | Média | Alto | Tool proxy para dinheiro (Fase 6); chaves sem credenciais |
| Falsos alarmes de saúde | Alta | Médio | Modo sombra, histerese, calibração por agente |
| Falso senso de segurança (métrica ≠ verdade) | Média | Alto | Comunicar como "indicador"; auditoria humana; incidentes rotulados |
| Vazamento entre clientes | Baixa | Crítico | RLS + testes de isolamento |
| Injeção de prompt via entrada externa | Alta | Alto | Dados ≠ instruções; memória `UNTRUSTED`; permissões mínimas |
| Dependência de APIs de terceiros (limites/preço/termos) | Média | Médio | Adaptadores isolados; validar na hora; plano B por canal |
| Desempenho do 3D em aparelhos fracos | Média | Médio | Lista equivalente; ajuste de qualidade; reduzir partículas |
| Custo de modelos nos relatórios | Baixa | Baixo | Resumos curtos; cache; só dados agregados ao modelo |

---

## 22. Decisões em aberto (resolver antes da fase indicada)

| # | Pergunta | Preciso antes de | Padrão sugerido |
|---|---|---|---|
| D1 | Produto **interno** (seus agentes) ou **SaaS** multi-cliente desde o início? | Fase 0 | Multi-tenant no modelo, uso interno no início |
| D2 | Hospedagem (VPS, Fly, Railway, nuvem)? | Fase 0 | Docker em VPS simples |
| D3 | Qual o 1º agente real a ser governado? | Fase 1 | Atendimento WhatsApp *ou* e-mail |
| D4 | Provedor de embeddings (dimensão do vetor) | Fase 3 | Definir e fixar (hoje `vector(1536)` é placeholder) |
| D5 | Canais de aprovação no MVP (web+push? WhatsApp?) | Fase 1 | Web + e-mail; push na Fase 2 |
| D6 | Quem é o "modelo redator" dos relatórios e com que limite de custo? | Fase 5 | Modelo barato + dados agregados |
| D7 | Moeda/regras fiscais além de BRL? | Fase 2 | Só BRL no início, `currency` já no modelo |
| D8 | Requisitos de conformidade (LGPD/GDPR) exigidos por clientes | Fase 3 | Esquecimento + exportação desde a Fase 3 |
| D9 | Nome/marca definitivos | Fase 7 | "IA-Control" provisório |

---

## 23. Prompt de bootstrap para IA de código

Cole no Claude Code (ou similar) na raiz do repositório, com este arquivo em `docs/IA-CONTROL-SPEC.md`:

```text
Você é o engenheiro principal do projeto IA-Control. Leia docs/IA-CONTROL-SPEC.md por completo.

Regras:
1. Execute SOMENTE a fase indicada abaixo. Não antecipe fases futuras.
2. Stack fixa: Bun, ElysiaJS, Prisma, PostgreSQL (+pgvector), Zod, RSBuild, TanStack, UnoCSS, Kobalte, Three.js.
3. Arquitetura: packages/policy, health, context e memory são PUROS (sem I/O). Rotas da API são finas.
4. Escreva os testes de packages/policy ANTES da implementação (tabela de decisão da seção 6).
5. Todo contrato (evento, requisição, resposta) é um schema Zod em packages/shared e é a única fonte de tipos.
6. Nunca guarde segredo em claro; nunca logue segredo; valores monetários em centavos.
7. Ao terminar, rode lint, typecheck e testes; entregue o roteiro de "demonstração de aceite" da fase.
8. Se algo na spec for ambíguo, liste a dúvida e proponha o padrão da seção 22; não invente silenciosamente.
9. Registre decisões novas em docs/adr/NNN-titulo.md.

FASE ATUAL: <Fase 0 | Fase 1 | ...>
```

---

## 24. Registro de decisões (ADRs iniciais)

| ADR | Decisão | Motivo |
|---|---|---|
| 001 | Monorepo Bun workspaces | Tipos compartilhados; um comando para tudo |
| 002 | Postgres + pgvector + pg-boss (sem Redis no início) | Menos peças; transações para orçamento |
| 003 | SSE para UI, WS opcional para agentes | Simplicidade e compatibilidade com proxies |
| 004 | Núcleo de domínio em pacotes puros | Testabilidade e confiança |
| 005 | Gateway no MVP, Tool proxy para dinheiro depois | Entrega rápida sem abrir mão de segurança real |
| 006 | Saúde cognitiva por sinais observáveis + modo sombra | Honestidade metodológica; calibração antes de agir |
| 007 | Auditoria com hash encadeado | Provar integridade para auditor e cliente |
| 008 | Contexto (humano) separado de Memória (aprendida) | Governança e defesa contra envenenamento |

---

## 25. Checklist de início (faça hoje)

- [ ] Salvar este arquivo em `docs/IA-CONTROL-SPEC.md` e criar `docs/diario.md` e `docs/parking-lot.md`
- [ ] Responder D1, D2 e D3 (seção 22)
- [ ] Criar o repositório e rodar o prompt da seção 23 com **Fase 0**
- [ ] Agendar o ritual semanal (30 min, mesmo dia e horário)
- [ ] Escolher o 1º agente real a governar
- [ ] Gravar um vídeo de 60 s do protótipo atual como "marco zero"

---

*Fim da especificação v0.1. Alterações futuras: incrementar a versão no topo e registrar o motivo na seção 24.*
