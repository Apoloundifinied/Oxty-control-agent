# ADR 009 — pgvector adiado para a Fase 3; dev local pode usar Postgres portátil

- **Status:** aceito · **Data:** Fase 0
- **Contexto:** a máquina de desenvolvimento (Windows 10 LTSC) não tinha Docker/WSL2 e a instalação exige elevação manual. O pgvector não distribui binários Windows prontos (compilar exige MSVC).
- **Decisão:**
  1. A extensão `vector` entra **na Fase 3**, junto com a decisão D4 (provedor/dimensão de embeddings) — exatamente quando se torna necessária (memória semântica). As colunas `embedding` são adicionadas por migração nessa fase.
  2. Para desenvolvimento local **hoje**, usa-se PostgreSQL portátil (zip EDB, sem admin) em `infra/postgres/`. O `infra/docker-compose.yml` (Postgres+pgvector) continua sendo o caminho oficial para produção/VPS e para a Fase 3.
- **Consequências:** schema sem colunas `vector` até a Fase 3; `bun run db:up` adapta-se ao ambiente. Nenhuma outra decisão da spec muda.
