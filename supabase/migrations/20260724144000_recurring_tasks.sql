-- Existing databases created before recurring tasks need an expanded strategy check.
alter table public.tasks drop constraint if exists tasks_strategy_check;
alter table public.tasks
  add constraint tasks_strategy_check
  check (strategy in ('converging', 'exponential', 'recurring'));
