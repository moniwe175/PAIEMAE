-- =============================================================================
-- add_maintenance_flow_templates.sql
-- =============================================================================
-- Insere os templates das novas ferramentas do fluxo de manutenção por serviço:
--   Tool 20 — 2º Lembrete + Geladeira    (Etapa 4: dia = retorno + 15)
--   Tool 21 — Resgate Inteligente         (Etapa 5: dia = retorno + 45)
--
-- COMO USAR:
--   1. Acesse o SQL Editor do Supabase.
--   2. Cole e execute este arquivo.
--   3. Os templates ficarão editáveis na aba "Motor Marketing > Templates" do sistema.
--
-- TAGS DISPONÍVEIS:
--   {{nome_paciente}}  → Primeiro nome da cliente
--   {{nome_servico}}   → Nome do serviço em atraso
--   {{outro_servico}}  → Outro serviço que a cliente fez recentemente (só tool 21)
--   {{dias_retorno}}   → Tempo configurado de manutenção do serviço em dias
-- =============================================================================

INSERT INTO message_templates (tool_id, tool_name, group_type, template_text, active)
VALUES
(
  20,
  '2º Lembrete de Manutenção (Geladeira)',
  'B',
  'Oi, {{nome_paciente}}! 😊

Notei que ainda não conseguimos agendar seu retorno para a *{{nome_servico}}*.

Sei que a rotina é corrida, mas esse procedimento é importante para manter o resultado que você conquistou! ✨

Quer que eu verifique um horário especial para você essa semana?

Me avisa e eu te ajudo! 💕',
  true
),
(
  21,
  'Resgate Inteligente (Oferta Personalizada)',
  'B',
  'Oi, {{nome_paciente}}! 🌸

Vejo que você continua vindo fazer {{outro_servico}} — que ótimo! 💖

Aproveitando sua próxima visita, que tal colocar a *{{nome_servico}}* em dia também? Já faz um tempinho e o resultado fica ainda melhor quando mantemos a regularidade!

🎁 Para facilitar, preparei uma condição especial exclusiva para você. Me conta o que acha?

*[Recepcionista: adicione o desconto ou condição especial antes de enviar esta mensagem!]*',
  true
)
ON CONFLICT (tool_id) DO UPDATE
  SET
    tool_name     = EXCLUDED.tool_name,
    group_type    = EXCLUDED.group_type,
    template_text = EXCLUDED.template_text,
    active        = EXCLUDED.active,
    updated_at    = now();
