-- Phase F performance pass: two admin-side query patterns introduced
-- earlier this project had no supporting index, unlike every other
-- frequently-filtered column in this schema (see e.g. animals_farm_species_idx,
-- support_tickets_farm_idx). Both are genuinely exercised today, not
-- speculative — User 360 (users/view) filters admin_audit_logs by
-- target_type+target_id on every page load, and Error Monitoring/System
-- Health both count client_error_logs by resolved status.
create index admin_audit_logs_target_idx on public.admin_audit_logs (target_type, target_id);
create index client_error_logs_resolved_idx on public.client_error_logs (resolved) where resolved = false;
