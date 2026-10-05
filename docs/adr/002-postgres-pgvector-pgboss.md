# ADR 002 — Postgres + pgvector + pg-boss (sem Redis no início)

- **Status:** aceito · **Data:** Fase 0
- **Decisão:** PostgreSQL como único banco; pgvector para embeddings; pg-boss para filas/jobs sobre o próprio Postgres.
- **Motivo:** menos peças para operar localmente/VPS; transações ACID são essenciais para orçamento/reservas sem corrida.
- **Consequências:** latência de fila ligeiramente maior que Redis (irrelevante na escala inicial); introduzir Redis só se métrica provar necessidade.
