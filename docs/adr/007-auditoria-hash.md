# ADR 007 — Auditoria com hash encadeado

- **Status:** aceito · **Data:** Fase 0
- **Decisão:** tabela `Event` é append-only; cada evento guarda `hash` e `prevHash` (SHA-256 do conteúdo + hash anterior). `GET /audit/verify` recomputa a cadeia e acusa adulteração.
- **Motivo:** prover prova de integridade para auditor e cliente ("quem aprovou o quê, quando").
- **Consequências:** updates/deletes em `Event` proibidos por regra de banco; particionamento mensal quando passar de ~50M linhas.
