import type {
  BudgetTransaction,
  BudgetMonth,
  BudgetMonthItem,
  BudgetTemplate,
  Category,
  FinancialAccount,
  FinancialAccountWithBalance,
  Profile,
  TemplateItem,
  TransactionImportBatch,
  UserPreferences,
} from '../../shared/types/domain';

type OptionalInsert<T, OptionalKeys extends keyof T> = Omit<T, OptionalKeys> &
  Partial<Pick<T, OptionalKeys>>;
type UpdateShape<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
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
          'id' | 'is_default' | 'archived_at' | 'created_at' | 'updated_at'
        >;
        Update: UpdateShape<BudgetTemplate>;
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
    };
    Views: Record<string, never>;
    Functions: {
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
          }
        >;
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
            category_name: string | null;
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
      delete_own_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
