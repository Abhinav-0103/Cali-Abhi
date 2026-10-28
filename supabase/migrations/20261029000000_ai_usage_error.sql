-- Record why an AI call failed (HTTP status + API message), for cost/ops monitoring.
alter table public.ai_usage add column error text check (char_length(error) <= 500);
