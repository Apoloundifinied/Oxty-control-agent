# ADR 004 — Núcleo de domínio em pacotes puros

- **Status:** aceito · **Data:** Fase 0
- **Decisão:** `packages/policy`, `health`, `context` e `memory` são funções puras sobre dados (sem I/O, sem banco, sem rede). A API carrega dados → chama o pacote → persiste o resultado. Rotas são finas, sem regra de negócio.
- **Motivo:** núcleo testável sem banco (meta: cobertura ~100% em `policy` com testes baseados em propriedades); confiança nas decisões críticas.
- **Consequências:** contratos de entrada/saída explícitos em cada pacote; mais disciplina na API.
