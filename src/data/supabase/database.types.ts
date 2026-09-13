import type {
  BudgetMonth,
  BudgetMonthItem,
  BudgetTemplate,
  Category,
  Profile,
  TemplateItem,
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
