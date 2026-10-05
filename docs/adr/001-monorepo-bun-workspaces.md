# ADR 001 — Monorepo com Bun workspaces

- **Status:** aceito · **Data:** Fase 0
- **Decisão:** todo o código em um monorepo Bun workspaces (`apps/*`, `packages/*`).
- **Motivo:** tipos compartilhados ponta a ponta (Zod em `packages/shared`), um comando para instalar/testar/rodar tudo.
- **Consequências:** versionamento único; releases do sistema inteiro juntos.
