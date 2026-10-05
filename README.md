# 🛡️ IA-Control

**Plano de controle para ecossistemas de agentes de IA.** O IA-Control não executa o trabalho dos agentes — ele **governa**: decide o que pode acontecer, pede aprovação humana quando importa, guarda contexto e memória, mede a saúde de cada agente e mostra tudo num mapa 3D em tempo real.

📖 **Fonte de verdade:** [`docs/IA-CONTROL-SPEC.md`](docs/IA-CONTROL-SPEC.md)

## Começar em 5 minutos (Fase 0)

Pré-requisitos: [Bun](https://bun.sh) ≥ 1.2 e Docker Desktop rodando.

```powershell
cp .env.example .env          # configurações locais
bun install                   # instala tudo (monorepo)
bun run db:up                 # sobe Postgres + pgvector no Docker
bun run db:migrate            # cria as tabelas (primeira vez: --name init)
bun test                      # testes unitários
bun run dev                   # API (3000) + Web (5173) juntos
```

**Aceite da Fase 0** — criar usuário e workspace por API:

```powershell
# 1. Criar usuário
curl -X POST http://localhost:3000/v1/users -H "Content-Type: application/json" `
  -d '{"email":"voce@exemplo.com","name":"Você","password":"senha-forte-123"}'

# 2. Login → copie o token
curl -X POST http://localhost:3000/v1/sessions -H "Content-Type: application/json" `
  -d '{"email":"voce@exemplo.com","password":"senha-forte-123"}'

# 3. Criar workspace (com o token)
curl -X POST http://localhost:3000/v1/workspaces -H "Content-Type: application/json" `
  -H "Authorization: Bearer SEU_TOKEN" -d '{"name":"Meu Ecossistema"}'
```

## Estrutura

```
apps/api        API (Bun + Elysia) — rotas finas, sem regra de negócio
apps/web        Web (RSBuild + Solid + TanStack)
packages/shared Schemas Zod — única fonte de verdade dos contratos
packages/*      policy, health, context, memory (PUROS — chegam na Fase 1/3/4)
prisma/         Schema e migrações (Postgres + pgvector)
infra/          docker-compose
docs/           Spec, ADRs, diário, parking-lot
```

## Governança do projeto

- Nada entra no código sem estar na spec; mudanças na spec vão para a seção 24.
- Ideias novas → [`docs/parking-lot.md`](docs/parking-lot.md). Progresso → [`docs/diario.md`](docs/diario.md).
- Decisões → [`docs/adr/`](docs/adr/).
