revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.user_preferences,
  public.categories,
  public.budget_templates,
  public.template_items,
  public.budget_months,
  public.budget_month_items
to authenticated;

grant select on
  public.financial_accounts,
  public.budget_transactions,
  public.transaction_import_batches,
  public.transaction_categorisation_rules,
  public.categorisation_suggestion_dismissals,
  public.payment_schedules,
  public.payment_schedule_occurrences,
  public.financial_goals,
  public.goal_contributions,
  public.goal_month_recommendations,
  public.weekly_checkin_preferences,
  public.notification_deliveries,
  public.budget_month_lifecycle,
  public.month_close_summaries,
  public.month_adjustments,
  public.month_lifecycle_events,
  public.backup_restore_runs,
  public.backup_recovery_snapshots,
  public.households,
  public.household_memberships,
  public.household_activity,
  public.starter_budget_templates,
  public.starter_budget_template_items,
  public.shared_budget_reports,
  public.onboarding_activations,
  public.activation_milestones,
  public.shared_template_links,
  public.shared_template_copies
to authenticated;

do $$
declare routine regprocedure;
begin
  for routine in
    select procedure.oid::regprocedure
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public, anon', routine);
  end loop;
end $$;

revoke execute on function
  public.validate_payment_schedule(),
  public.snapshot_payment_schedules_for_month(),
  public.link_payment_occurrence_budget_item(),
  public.schedule_date_matches(date,date,text,smallint[]),
  public.refresh_payment_schedule_occurrences(uuid,date),
  public.validate_financial_goal(),
  public.validate_goal_contribution(),
  public.snapshot_goal_recommendations_for_month(),
  public.refresh_goal_recommendations(uuid),
  public.claim_due_weekly_checkins(integer),
  public.assign_active_household(),
  public.record_household_activity(),
  public.prevent_household_activity_changes(),
  public.prevent_adviser_event_changes()
from authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;
