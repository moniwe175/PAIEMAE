-- PAIEMAE - metas editaveis de saude e prontidao da unidade-piloto.
-- Execute depois de franchise_management_migration.sql.
-- Idempotente: metas ja personalizadas nao sao sobrescritas.

BEGIN;

INSERT INTO public.franchise_targets
  (unit_id, metric_key, target_value, warning_value, critical_value, direction, valid_from)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'data_quality_score', 90, 75, 50, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'history_months', 6, 3, 1, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'profitable_months_pct', 80, 60, 40, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'ebitda_margin_pct', 15, 10, 0, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'net_cash_margin_pct', 10, 5, 0, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'contribution_margin_pct', 40, 30, 20, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'safety_margin_pct', 20, 10, 0, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'cash_reserve_months', 6, 3, 1, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'debt_coverage_ratio', 1.5, 1.2, 1, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'payback_months', 36, 48, 60, 'lower_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'ltv_cac_ratio', 3, 2, 1, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'returning_share_pct', 30, 20, 10, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'no_show_rate_pct', 5, 8, 12, 'lower_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'cancellation_rate_pct', 10, 15, 20, 'lower_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'occupancy_pct', 70, 55, 40, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'audit_score', 85, 70, 50, 'higher_better', '2026-01-01'),
  ('00000000-0000-4000-8000-000000000001', 'required_documents_pct', 100, 75, 50, 'higher_better', '2026-01-01')
ON CONFLICT (unit_id, metric_key, valid_from) DO NOTHING;

COMMIT;
