# ADR 008 — Contexto (humano) separado de Memória (aprendida)

- **Status:** aceito · **Data:** Fase 0
- **Decisão:** **Contexto** = conhecimento curado/versionado por humanos (`ContextDoc`). **Memória** = conhecimento aprendido em uso (`Memory`, 4 tipos). Modelos, páginas e ciclos de vida separados.
- **Motivo:** governança (só humano altera o que é "verdade oficial") e defesa contra envenenamento (entrada externa vira `EXTERNAL_UNTRUSTED`, nunca regra).
- **Consequências:** o pacote de contexto (`context/pack`) junta os dois com precedência clara: `hard` > RUN > AGENT > TEAM > WORKSPACE.
