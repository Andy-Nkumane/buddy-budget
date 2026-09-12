import type {
  BudgetMonth,
  BudgetMonthItem,
  BudgetTemplate,
  Category,
  Profile,
  TemplateItem,
  UserPreferences,
} from '../../shared/types/domain';

type RowShape<T> = T & Record<string, unknown>;
type InsertShape<T> = Partial<T> & Record<string, unknown>;
type UpdateShape<T> = Partial<T> & Record<string, unknown>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: RowShape<Profile>;
        Insert: InsertShape<Profile>;
        Update: UpdateShape<Profile>;
        Relationships: [];
      };
      user_preferences: {
        Row: RowShape<UserPreferences>;
        Insert: InsertShape<UserPreferences>;
        Update: UpdateShape<UserPreferences>;
        Relationships: [];
      };
      categories: {
        Row: RowShape<Category>;
        Insert: InsertShape<Category>;
        Update: UpdateShape<Category>;
        Relationships: [];
      };
      budget_templates: {
        Row: RowShape<BudgetTemplate>;
        Insert: InsertShape<BudgetTemplate>;
        Update: UpdateShape<BudgetTemplate>;
        Relationships: [];
      };
      template_items: {
        Row: RowShape<TemplateItem>;
        Insert: InsertShape<TemplateItem>;
        Update: UpdateShape<TemplateItem>;
        Relationships: [];
      };
      budget_months: {
        Row: RowShape<BudgetMonth>;
        Insert: InsertShape<BudgetMonth>;
        Update: UpdateShape<BudgetMonth>;
        Relationships: [];
      };
      budget_month_items: {
        Row: RowShape<BudgetMonthItem>;
        Insert: InsertShape<BudgetMonthItem>;
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
