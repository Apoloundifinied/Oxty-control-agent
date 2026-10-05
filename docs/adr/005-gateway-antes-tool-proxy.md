# ADR 005 — Gateway no MVP, Tool proxy para dinheiro depois

- **Status:** aceito · **Data:** Fase 0
- **Decisão:** Fases 1–5 usam o modo **Gateway** (agente chama `propose` e coopera). A **Fase 6** introduz o **Tool proxy** (IA-Control executa a ação com credenciais que o agente nunca vê), obrigatório para capacidades de dinheiro.
- **Motivo:** entrega rápida da fatia vertical sem abrir mão de segurança real onde importa (pagamentos, e-mail em massa).
- **Consequências:** honestidade documentada (spec 4.4): no Gateway, um agente mal-comportado pode ignorar o portão; credenciais sensíveis só entram na Fase 6.
