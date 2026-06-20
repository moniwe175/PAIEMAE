# Marketing Engine — Clínica

Engine de automação de marketing via WhatsApp, com lógica híbrida:
disparo automático por regras fixas, ou fila de aprovação para ações que
exigem julgamento de uma IA (ou um humano).

## Estrutura

```
marketing_engine/
├── main.py                  # Orquestrador + scheduler (APScheduler)
├── requirements.txt
├── schema.sql                # Tabelas a criar no Supabase
├── config/
│   ├── settings.py           # Carrega .env num único lugar
│   └── .env.example
└── engine/
    ├── database.py           # Toda query ao Supabase passa por aqui
    ├── whatsapp.py            # Conector WhatsApp (QR Code persistente)
    ├── rules.py                # As 14 ferramentas + registro central
    └── marketing_engine.py     # Classe MarketingEngine (orquestração)
```

## Setup

1. **Banco**: rode `schema.sql` no SQL Editor do Supabase (cria
   `marketing_approval_queue` e `marketing_log`; assume que `patients` e
   `appointments` já existem).
2. **WhatsApp**: suba um [wppconnect-server](https://github.com/wppconnect-team/wppconnect-server)
   (Node.js) localmente ou em um container — é ele quem fala com o
   WhatsApp Web de fato. O Python só consome a API REST dele.
3. **Variáveis de ambiente**: copie `config/.env.example` para `config/.env`
   e preencha com suas credenciais do Supabase e do wppconnect-server.
4. **Instalar dependências**:
   ```bash
   pip install -r requirements.txt
   ```
5. **Primeira execução** (gera o QR Code uma única vez):
   ```bash
   python main.py
   ```
   Depois de escaneado, o token fica salvo em `config/tokens/` e os
   próximos restarts reconectam sem pedir QR Code novamente.

## As 14 ferramentas

| # | Ferramenta | Fluxo | Observação |
|---|---|---|---|
| 1 | Aniversário | Automático | **Implementada em detalhe** |
| 2 | NPS pós-atendimento | Automático | stub |
| 3 | Escassez de vagas | Automático | stub |
| 4 | Lembrete de agendamento | Automático | stub |
| 5 | Confirmação de agendamento | Automático | stub |
| 6 | Cuidados pós-procedimento | Automático | stub |
| 7 | Pacote próximo do fim | Automático | stub |
| 8 | Indicação / Referral | Automático | stub |
| 9 | Reaquecimento de leads frios | **Aprovação** | **Implementada em detalhe** |
| 10 | Upsell / Cross-sell | Aprovação | stub |
| 11 | Recuperação de no-show | Aprovação | stub |
| 12 | Reativação de inativos | Aprovação | stub |
| 13 | Recuperação de orçamento | Aprovação | stub |
| 14 | Pós-reclamação | Aprovação | stub, sempre revisão humana |

Os "stubs" têm `finder()` retornando `[]` e `build_message()` já no
formato esperado — é só preencher a query/lógica de negócio. Nenhuma
mudança no `MarketingEngine` é necessária para ativá-los.

## Por que essa arquitetura

- **`rules.py` desacoplado do engine**: o `MarketingEngine` não sabe o que
  é "aniversário" ou "reaquecimento" — ele só sabe iterar um `TOOL_REGISTRY`
  de objetos `Tool(finder, flow, build_message)`. Adicionar a ferramenta 15
  não toca em `marketing_engine.py`.
- **Idempotência (`already_notified_today`)**: como o scheduler roda a
  cada N minutos, sem esse controle um paciente receberia a mesma
  mensagem várias vezes no dia.
- **Fluxo de aprovação nunca chama `whatsapp.send_message` diretamente**:
  isso é proposital — é a garantia estrutural de que nada gerado/sugerido
  por IA sai sem revisão. A camada de IA/painel humano consome
  `marketing_approval_queue` (status `pending`), decide o texto final,
  atualiza `status` para `approved`/`rejected`, e um worker separado
  (não incluído aqui) envia o `final_message` aprovado.
- **`DRY_RUN=true`**: permite rodar o ciclo inteiro em homologação sem
  enviar nenhuma mensagem real — só loga o que seria enviado.

## Pontos de atenção para produção

- **Opt-out (LGPD)**: adicione uma coluna `whatsapp_opt_out` em
  `patients` e filtre nos `finder()` (comentado em `schema.sql`).
  Mensagens de marketing a paciente que pediu para não receber é risco
  jurídico e reputacional real para a clínica.
- **Rate limiting**: o WhatsApp pode banir números que enviam em massa
  muito rápido. Considere um delay (ex: 2-5s) entre envios dentro de
  `send_message`, ou um throttle no `_process_tool`.
- **Worker de aprovação**: este projeto entrega a fila e a inserção nela;
  falta o serviço que lê `marketing_approval_queue`, chama a IA (ou expõe
  um painel para humano aprovar) e efetivamente dispara via
  `WhatsAppConnector.send_message` os itens `approved`. É um processo
  separado deste engine, propositalmente — mantém a responsabilidade de
  "decidir o que enviar" fora da automação de regras fixas.
- **Observabilidade**: `marketing_log` já serve como auditoria básica;
  para produção, vale plugar em algo como Sentry para os `except` do
  `_process_tool`.
