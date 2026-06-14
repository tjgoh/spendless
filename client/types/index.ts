export interface Category {
  id: number;
  label: string;
}

export interface Connection {
  id: number;
  created_at: string;
  display_name: string;
  provider: string;
  account_type: string;
  account_number: string | null;
}

export interface Transaction {
  id: number;
  transaction_id: string;
  display_name: string | null;
  provider: string;
  account_type: string | null;
  timestamp: string;
  provider_merchant_name: string | null;
  description: string;
  amount: number;
  category_id: number | null;
}

export interface PaginatedTransactions {
  page: number;
  limit: number;
  total: string;
  data: Transaction[];
}

export interface BulkUpdateResult {
  updated_count: number;
  data: Transaction[];
}

export interface AnalyticsSummary {
  total_spent: number;
  total_income: number;
  total_saved: number;
}

export interface CategoryAmount {
  type: string;
  label: string;
  amount: number;
}

export interface MonthlyBreakdown {
  month: string;
  categories: CategoryAmount[];
}

export type PeriodType = "this_month" | "last_month" | "custom";

export type ChartRangeType = string;
