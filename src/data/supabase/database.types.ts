import type {
  BudgetTransaction,
  BudgetMonth,
  BudgetMonthItem,
  BudgetMonthLifecycle,
  BudgetInsights,
  BudgetTemplate,
  CategorisationRule,
  CategorisationRuleSuggestion,
  Category,
  FinancialAccount,
  FinancialAccountWithBalance,
  FinancialGoal,
  GoalContribution,
  GoalMonthRecommendation,
  NotificationDelivery,
  MonthAdjustment,
  MonthCloseSummary,
  MonthLifecycleEvent,
  PaymentSchedule,
  PaymentScheduleOccurrence,
  Profile,
  StarterTemplate,
  StarterTemplateItem,
  TemplateItem,
  TransactionImportBatch,
  UserPreferences,
  WeeklyCheckInPreferences,
} from '../../shared/types/domain';

type OptionalInsert<T, OptionalKeys extends keyof T> = Omit<T, OptionalKeys> &
  Partial<Pick<T, OptionalKeys>>;
type UpdateShape<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      activation_milestones: {
        Row: {
          id: string;
          milestone_key:
            | 'first_budget'
            | 'first_categorisation'
            | 'first_month_close'
            | 'first_goal_contribution'
            | 'first_export'
            | 'first_restore';
          scope_type: 'user' | 'household';
          scope_id: string;
          user_id: string;
          household_id: string | null;
          completed_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: OptionalInsert<
          Profile,
          'display_name' | 'currency_code' | 'locale' | 'timezone' | 'created_at' | 'updated_at'
        >;
        Update: UpdateShape<Profile>;
        Relationships: [];
      };
      user_preferences: {
        Row: UserPreferences;
        Insert: OptionalInsert<
          UserPreferences,
          'last_budget_month_id' | 'last_route' | 'theme' | 'onboarding_completed_at' | 'updated_at'
        >;
        Update: UpdateShape<UserPreferences>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: OptionalInsert<
          Category,
          'id' | 'sort_order' | 'archived_at' | 'created_at' | 'updated_at'
        >;
        Update: UpdateShape<Category>;
        Relationships: [];
      };
      budget_templates: {
        Row: BudgetTemplate;
        Insert: OptionalInsert<
          BudgetTemplate,
          | 'id'
          | 'is_default'
          | 'starter_template_id'
          | 'starter_template_version'
          | 'starter_copy_key'
          | 'archived_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<BudgetTemplate>;
        Relationships: [];
      };
      starter_budget_templates: {
        Row: Omit<StarterTemplate, 'items'>;
        Insert: Omit<StarterTemplate, 'items'>;
        Update: UpdateShape<Omit<StarterTemplate, 'items'>>;
        Relationships: [];
      };
      starter_budget_template_items: {
        Row: StarterTemplateItem;
        Insert: StarterTemplateItem;
        Update: UpdateShape<StarterTemplateItem>;
        Relationships: [];
      };
      template_items: {
        Row: TemplateItem;
        Insert: OptionalInsert<
          TemplateItem,
          | 'id'
          | 'category_id'
          | 'default_amount'
          | 'sort_order'
          | 'archived_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<TemplateItem>;
        Relationships: [];
      };
      budget_months: {
        Row: BudgetMonth;
        Insert: OptionalInsert<
          BudgetMonth,
          | 'id'
          | 'source_template_id'
          | 'currency_code'
          | 'status'
          | 'notes'
          | 'last_opened_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<BudgetMonth>;
        Relationships: [];
      };
      budget_month_items: {
        Row: BudgetMonthItem;
        Insert: OptionalInsert<
          BudgetMonthItem,
          | 'id'
          | 'source_template_item_id'
          | 'category_id'
          | 'default_amount_snapshot'
          | 'amount'
          | 'is_disabled'
          | 'sort_order'
          | 'archived_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<BudgetMonthItem>;
        Relationships: [];
      };
      financial_accounts: {
        Row: FinancialAccount;
        Insert: OptionalInsert<
          FinancialAccount,
          'id' | 'opening_balance_minor' | 'archived_at' | 'created_at' | 'updated_at'
        >;
        Update: UpdateShape<FinancialAccount>;
        Relationships: [];
      };
      budget_transactions: {
        Row: BudgetTransaction;
        Insert: OptionalInsert<
          BudgetTransaction,
          | 'id'
          | 'budget_month_item_id'
          | 'category_id'
          | 'account_id'
          | 'is_refund'
          | 'notes'
          | 'source'
          | 'status'
          | 'external_fingerprint'
          | 'external_reference'
          | 'import_batch_id'
          | 'category_snapshot'
          | 'budget_item_snapshot'
          | 'is_recurring_candidate'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<BudgetTransaction>;
        Relationships: [];
      };
      transaction_import_batches: {
        Row: TransactionImportBatch;
        Insert: OptionalInsert<
          TransactionImportBatch,
          | 'id'
          | 'account_id'
          | 'mapping_metadata'
          | 'accepted_count'
          | 'duplicate_count'
          | 'invalid_count'
          | 'excluded_count'
          | 'status'
          | 'created_at'
          | 'updated_at'
          | 'undone_at'
        >;
        Update: UpdateShape<TransactionImportBatch>;
        Relationships: [];
      };
      transaction_categorisation_rules: {
        Row: CategorisationRule;
        Insert: OptionalInsert<
          CategorisationRule,
          | 'id'
          | 'sort_order'
          | 'enabled'
          | 'days_of_week'
          | 'match_count'
          | 'last_matched_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<CategorisationRule>;
        Relationships: [];
      };
      payment_schedules: {
        Row: PaymentSchedule;
        Insert: OptionalInsert<
          PaymentSchedule,
          | 'id'
          | 'amount_is_approximate'
          | 'end_date'
          | 'selected_days'
          | 'next_occurrence'
          | 'enabled'
          | 'template_id'
          | 'template_item_id'
          | 'category_id'
          | 'notes'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<PaymentSchedule>;
        Relationships: [];
      };
      payment_schedule_occurrences: {
        Row: PaymentScheduleOccurrence;
        Insert: OptionalInsert<
          PaymentScheduleOccurrence,
          | 'id'
          | 'budget_month_item_id'
          | 'category_id'
          | 'amount_is_approximate'
          | 'status'
          | 'matched_transaction_id'
          | 'confirmed_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<PaymentScheduleOccurrence>;
        Relationships: [];
      };
      financial_goals: {
        Row: FinancialGoal;
        Insert: OptionalInsert<
          FinancialGoal,
          | 'id'
          | 'starting_balance_minor'
          | 'desired_monthly_contribution_minor'
          | 'desired_contribution_minor'
          | 'contribution_frequency'
          | 'contribution_start_mode'
          | 'contribution_start_date'
          | 'target_date'
          | 'priority'
          | 'status'
          | 'category_id'
          | 'account_id'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<FinancialGoal>;
        Relationships: [];
      };
      goal_contributions: {
        Row: GoalContribution;
        Insert: OptionalInsert<
          GoalContribution,
          'id' | 'transaction_id' | 'notes' | 'created_at' | 'updated_at'
        >;
        Update: UpdateShape<GoalContribution>;
        Relationships: [];
      };
      goal_month_recommendations: {
        Row: GoalMonthRecommendation;
        Insert: OptionalInsert<GoalMonthRecommendation, 'id' | 'created_at' | 'updated_at'>;
        Update: UpdateShape<GoalMonthRecommendation>;
        Relationships: [];
      };
      weekly_checkin_preferences: {
        Row: WeeklyCheckInPreferences;
        Insert: OptionalInsert<
          WeeklyCheckInPreferences,
          | 'opted_in'
          | 'weekday'
          | 'delivery_time'
          | 'timezone'
          | 'in_app_enabled'
          | 'email_enabled'
          | 'email_detail_enabled'
          | 'paused'
          | 'email_delivery_state'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<WeeklyCheckInPreferences>;
        Relationships: [];
      };
      notification_deliveries: {
        Row: NotificationDelivery;
        Insert: OptionalInsert<
          NotificationDelivery,
          | 'id'
          | 'delivery_kind'
          | 'status'
          | 'attempt_count'
          | 'last_attempt_at'
          | 'delivered_at'
          | 'next_attempt_at'
          | 'error_code'
          | 'error_summary'
          | 'provider_message_id'
          | 'action_path'
          | 'summary_payload'
          | 'read_at'
          | 'created_at'
          | 'updated_at'
        >;
        Update: UpdateShape<NotificationDelivery>;
        Relationships: [];
      };
      budget_month_lifecycle: {
        Row: BudgetMonthLifecycle;
        Insert: BudgetMonthLifecycle;
        Update: UpdateShape<BudgetMonthLifecycle>;
        Relationships: [];
      };
      month_close_summaries: {
        Row: MonthCloseSummary;
        Insert: MonthCloseSummary;
        Update: never;
        Relationships: [];
      };
      month_adjustments: {
        Row: MonthAdjustment;
        Insert: MonthAdjustment;
        Update: never;
        Relationships: [];
      };
      month_lifecycle_events: {
        Row: MonthLifecycleEvent;
        Insert: MonthLifecycleEvent;
        Update: never;
        Relationships: [];
      };
      categorisation_suggestion_dismissals: {
        Row: {
          user_id: string;
          normalized_description: string;
          transaction_type: string;
          category_id: string | null;
          budget_item_name: string | null;
          dismissed_at: string;
        };
        Insert: {
          user_id: string;
          normalized_description: string;
          transaction_type: string;
          category_id: string | null;
          budget_item_name: string | null;
          dismissed_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      shared_budget_reports: {
        Row: {
          id: string;
          household_id: string;
          created_by: string;
          token_hash: string;
          access_code_hash: string | null;
          snapshot: Record<string, unknown>;
          expires_at: string;
          max_views: number | null;
          view_count: number;
          last_viewed_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      shared_template_links: {
        Row: {
          id: string;
          household_id: string;
          created_by: string;
          source_template_id: string;
          version: number;
          token_hash: string;
          snapshot: Record<string, unknown>;
          includes_amounts: boolean;
          created_at: string;
          expires_at: string;
          revoked_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      shared_template_rate_limits: {
        Row: {
          link_id: string;
          visitor_hash: string;
          window_start: string;
          request_count: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      shared_template_copies: {
        Row: {
          link_id: string;
          recipient_user_id: string;
          recipient_household_id: string;
          copy_key: string;
          created_template_id: string;
          copied_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_adviser_grant: {
        Args: {
          requested_email: string;
          requested_token_hash: string;
          requested_date_from: string;
          requested_date_to: string;
          requested_sections: string[];
          requested_starts_at: string;
          requested_expires_at: string;
          requested_allow_export: boolean;
          requested_renewed_from_id?: string | null;
        };
        Returns: string;
      };
      respond_to_adviser_grant: {
        Args: { requested_token: string; requested_accept: boolean };
        Returns: string;
      };
      revoke_adviser_grant: {
        Args: { requested_grant_id: string };
        Returns: boolean;
      };
      retrieve_adviser_grants: {
        Args: Record<string, never>;
        Returns: import('../../shared/types/domain').AdviserGrant[];
      };
      retrieve_adviser_data: {
        Args: { requested_grant_id: string };
        Returns: import('../../shared/types/domain').AdviserData;
      };
      claim_activation_milestone: {
        Args: { requested_key: string };
        Returns: boolean;
      };
      restore_backup: {
        Args: {
          requested_payload: Record<string, unknown>;
          requested_mode: 'merge' | 'replace';
          requested_fingerprint: string;
          requested_confirmation: string;
        };
        Returns: import('../../data/repositories/budgetRepository').BackupRestoreReport;
      };
      retrieve_household_context: {
        Args: Record<string, never>;
        Returns: import('../../shared/types/domain').HouseholdContext;
      };
      session_meets_mfa_requirement: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      switch_household: {
        Args: { requested_household_id: string };
        Returns: undefined;
      };
      update_household_name: {
        Args: { requested_name: string };
        Returns: undefined;
      };
      create_household_invitation: {
        Args: { requested_email: string; requested_role: string };
        Returns: { invitation_id: string; invitation_token: string; expires_at: string }[];
      };
      respond_to_household_invitation: {
        Args: { requested_token: string; requested_accept: boolean };
        Returns: string;
      };
      revoke_household_invitation: {
        Args: { requested_invitation_id: string };
        Returns: undefined;
      };
      manage_household_member: {
        Args: {
          requested_action: string;
          requested_user_id: string;
          requested_role: string | null;
        };
        Returns: undefined;
      };
      retrieve_budget_insights: {
        Args: {
          requested_from_month: string;
          requested_to_month: string;
          requested_category_id?: string | null;
        };
        Returns: BudgetInsights;
      };
      consume_shared_budget_report: {
        Args: { requested_token_hash: string; requested_access_code_hash?: string | null };
        Returns: {
          snapshot: Record<string, unknown>;
          expires_at: string;
          remaining_views: number | null;
        } | null;
      };
      create_shared_template_link: {
        Args: {
          requested_user_id: string;
          requested_template_id: string;
          requested_token_hash: string;
          requested_include_amounts: boolean;
          requested_expires_at: string;
        };
        Returns: { id: string; expires_at: string }[];
      };
      consume_shared_template_link: {
        Args: { requested_token_hash: string; requested_visitor_hash: string };
        Returns: { snapshot: Record<string, unknown>; expires_at: string } | null;
      };
      copy_shared_template_link: {
        Args: {
          requested_user_id: string;
          requested_token_hash: string;
          requested_copy_key: string;
          requested_template_name: string;
          requested_items: Record<string, unknown>[];
        };
        Returns: BudgetTemplate[];
      };
      retrieve_shared_template_links: {
        Args: { requested_user_id: string };
        Returns: Record<string, unknown>[];
      };
      revoke_shared_template_link: {
        Args: { requested_user_id: string; requested_link_id: string };
        Returns: boolean;
      };
      create_month_from_template: {
        Args: { requested_month_start: string; requested_template_id: string };
        Returns: BudgetMonth[];
      };
      set_default_template: {
        Args: { requested_template_id: string };
        Returns: undefined;
      };
      update_profile_and_preferences: {
        Args: {
          requested_display_name: string;
          requested_currency_code: string;
          requested_locale: string;
          requested_timezone: string;
          requested_theme: string;
        };
        Returns: undefined;
      };
      move_category: {
        Args: { requested_category_id: string; requested_direction: number };
        Returns: undefined;
      };
      move_template_item: {
        Args: { requested_item_id: string; requested_direction: number };
        Returns: undefined;
      };
      create_category: {
        Args: { requested_name: string; requested_item_type: string };
        Returns: Category[];
      };
      create_template_item: {
        Args: {
          requested_template_id: string;
          requested_name: string;
          requested_item_type: string;
          requested_amount: string;
          requested_category_id: string | null;
        };
        Returns: TemplateItem[];
      };
      create_month_item: {
        Args: {
          requested_month_id: string;
          requested_name: string;
          requested_item_type: string;
          requested_amount: string;
          requested_category_id: string | null;
        };
        Returns: BudgetMonthItem[];
      };
      create_financial_account: {
        Args: {
          requested_name: string;
          requested_account_type: string;
          requested_currency_code: string;
          requested_opening_balance_minor: number;
        };
        Returns: FinancialAccount[];
      };
      retrieve_financial_accounts: {
        Args: { requested_include_archived?: boolean };
        Returns: FinancialAccountWithBalance[];
      };
      retrieve_budget_month_summaries: {
        Args: Record<string, never>;
        Returns: Array<
          BudgetMonth & {
            income: number;
            expenses: number;
            remaining: number;
            actual_income: number;
            actual_expenses: number;
            actual_remaining: number;
            lifecycle_state: 'open' | 'closed';
            closed_at: string | null;
          }
        >;
      };
      close_budget_month: {
        Args: { requested_month_id: string; requested_acknowledged: boolean };
        Returns: MonthCloseSummary[];
      };
      reopen_budget_month: {
        Args: { requested_month_id: string };
        Returns: BudgetMonthLifecycle[];
      };
      create_month_adjustment: {
        Args: {
          requested_original_month_id: string;
          requested_applied_month_id: string;
          requested_item_type: string;
          requested_direction: string;
          requested_amount_minor: number;
          requested_reason: string;
          requested_idempotency_key: string;
        };
        Returns: MonthAdjustment[];
      };
      update_financial_account: {
        Args: {
          requested_account_id: string;
          requested_name: string;
          requested_account_type: string;
          requested_currency_code: string;
          requested_opening_balance_minor: number;
          requested_archived: boolean;
        };
        Returns: FinancialAccount[];
      };
      create_budget_transaction: {
        Args: {
          requested_budget_month_id: string;
          requested_transaction_date: string;
          requested_description: string;
          requested_amount_minor: number;
          requested_transaction_type: string;
          requested_is_refund: boolean;
          requested_account_id: string | null;
          requested_budget_month_item_id: string | null;
          requested_category_id: string | null;
          requested_notes: string;
          requested_status: string;
        };
        Returns: BudgetTransaction[];
      };
      update_budget_transaction: {
        Args: {
          requested_transaction_id: string;
          requested_budget_month_id: string;
          requested_transaction_date: string;
          requested_description: string;
          requested_amount_minor: number;
          requested_transaction_type: string;
          requested_is_refund: boolean;
          requested_account_id: string | null;
          requested_budget_month_item_id: string | null;
          requested_category_id: string | null;
          requested_notes: string;
          requested_status: string;
        };
        Returns: BudgetTransaction[];
      };
      delete_budget_transaction: {
        Args: { requested_transaction_id: string };
        Returns: undefined;
      };
      import_budget_transactions: {
        Args: {
          requested_budget_month_id: string;
          requested_account_id: string | null;
          requested_file_name: string;
          requested_batch_key: string;
          requested_mapping_metadata: Record<string, unknown>;
          requested_rows: Array<{
            transaction_date: string;
            description: string;
            amount_minor: number;
            transaction_type: string;
            external_reference: string | null;
            external_fingerprint: string;
          }>;
          requested_invalid_count: number;
          requested_excluded_count: number;
        };
        Returns: Array<{
          batch_id: string;
          accepted_count: number;
          duplicate_count: number;
          invalid_count: number;
          excluded_count: number;
          was_existing: boolean;
        }>;
      };
      undo_transaction_import_batch: {
        Args: { requested_batch_id: string };
        Returns: TransactionImportBatch[];
      };
      import_budget_transactions_with_rules: Database['public']['Functions']['import_budget_transactions'];
      upsert_categorisation_rule: {
        Args: { requested_rule: Record<string, unknown> };
        Returns: CategorisationRule[];
      };
      move_categorisation_rule: {
        Args: { requested_rule_id: string; requested_direction: number };
        Returns: undefined;
      };
      delete_categorisation_rule: {
        Args: { requested_rule_id: string };
        Returns: undefined;
      };
      process_categorisation_rules: {
        Args: { requested_transaction_ids: string[]; requested_dry_run?: boolean };
        Returns: Record<string, unknown>;
      };
      retrieve_categorisation_suggestions: {
        Args: Record<string, never>;
        Returns: CategorisationRuleSuggestion[];
      };
      dismiss_categorisation_suggestion: {
        Args: {
          requested_description: string;
          requested_transaction_type: string;
          requested_category_id: string | null;
          requested_budget_item_name: string | null;
        };
        Returns: undefined;
      };
      create_payment_schedule: {
        Args: { requested_schedule: Record<string, unknown> };
        Returns: PaymentSchedule[];
      };
      update_payment_schedule: {
        Args: { requested_schedule_id: string; requested_schedule: Record<string, unknown> };
        Returns: PaymentSchedule[];
      };
      refresh_payment_schedule_occurrences: {
        Args: { requested_schedule_id: string; requested_through?: string };
        Returns: number;
      };
      confirm_payment_occurrence: {
        Args: {
          requested_occurrence_id: string;
          requested_status: string;
          requested_transaction_id?: string | null;
        };
        Returns: PaymentScheduleOccurrence[];
      };
      create_financial_goal: {
        Args: { requested_goal: Record<string, unknown> };
        Returns: FinancialGoal[];
      };
      update_financial_goal: {
        Args: { requested_goal_id: string; requested_goal: Record<string, unknown> };
        Returns: FinancialGoal[];
      };
      create_goal_contribution: {
        Args: {
          requested_goal_id: string;
          requested_budget_month_id: string;
          requested_transaction_id: string | null;
          requested_contribution_date: string;
          requested_amount_minor: number;
          requested_notes?: string | null;
        };
        Returns: GoalContribution[];
      };
      delete_goal_contribution: {
        Args: { requested_contribution_id: string };
        Returns: undefined;
      };
      delete_expired_budget_month_items: {
        Args: Record<string, never>;
        Returns: number;
      };
      update_weekly_checkin_preferences: {
        Args: { requested_preferences: Record<string, unknown> };
        Returns: WeeklyCheckInPreferences[];
      };
      claim_due_weekly_checkins: {
        Args: { requested_limit?: number };
        Returns: NotificationDelivery[];
      };
      create_test_checkin_delivery: {
        Args: { requested_channel: string };
        Returns: NotificationDelivery[];
      };
      mark_notification_delivery_read: {
        Args: { requested_delivery_id: string };
        Returns: undefined;
      };
      setup_first_budget: {
        Args: {
          requested_display_name: string;
          requested_currency_code: string;
          requested_locale: string;
          requested_timezone: string;
          requested_theme: string;
          requested_template_name: string;
          requested_template_items: unknown;
        };
        Returns: BudgetMonth[];
      };
      complete_first_budget_onboarding: {
        Args: {
          requested_setup_key: string;
          requested_path: string;
          requested_display_name: string;
          requested_currency_code: string;
          requested_locale: string;
          requested_timezone: string;
          requested_template_name: string;
          requested_template_items: unknown;
          requested_starter_id?: string;
          requested_starter_version?: number;
          requested_starter_copy_key?: string;
          requested_import?: unknown;
        };
        Returns: BudgetMonth[];
      };
      setup_first_budget_from_starter: {
        Args: {
          requested_display_name: string;
          requested_currency_code: string;
          requested_locale: string;
          requested_timezone: string;
          requested_theme: string;
          requested_template_name: string;
          requested_template_items: unknown;
          requested_starter_id: string;
          requested_starter_version: number;
          requested_copy_key: string;
        };
        Returns: BudgetMonth[];
      };
      copy_starter_budget_template: {
        Args: {
          requested_starter_id: string;
          requested_starter_version: number;
          requested_template_name: string;
          requested_items: unknown;
          requested_copy_key: string;
          requested_make_default?: boolean;
        };
        Returns: BudgetTemplate[];
      };
      delete_own_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
