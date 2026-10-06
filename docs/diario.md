# Diário do projeto IA-Control

> Ritual semanal (30 min): (a) o que rodou, (b) o que travou, (c) próxima fatia pequena. 3 linhas por entrada.

## 2026-XX-XX — Início do projeto
- Criado o repositório, spec movida para `docs/IA-CONTROL-SPEC.md`.
- Decisões respondidas: **D1** multi-tenant no modelo, uso interno no início · **D2** local (Docker Compose) agora, VPS no lançamento · **D3** 1º agente = script de exemplo com SDK.
- Fase 0 em andamento: monorepo, Docker Compose, Prisma, auth básica, `packages/shared` com 5 testes OK.
- **Bloqueio resolvido:** sem acesso admin para Docker/WSL2, adotamos **PostgreSQL portátil local** (ADR 009); pgvector fica para a Fase 3 (alinha com a D4).
- ✅ **Fase 0 CONCLUÍDA:** `bun test` (28 testes) e `bun run dev` funcionam; migrações aplicadas; **usuário e workspace criados por API** (aceite validado).

## 2026-XX-XX — Antecipando o coração da Fase 1
- Escrito `packages/policy` (PURO): motor de decisão completo da seção 6 — ordem de avaliação 6.2, regras declarativas 6.3, risco 6.4, autonomia 6.5 efetiva.
- TDD seguido: **23 testes da tabela de decisão passando** antes de qualquer rota de API depender dele.
- Próximo: com Docker no ar, subir Postgres, migrar e fechar o aceite da Fase 0; depois ligar `propose/result` na API.
