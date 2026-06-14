import axios from "axios";
import type {
  Category,
  Connection as Account,
  Transaction,
  PaginatedTransactions,
  BulkUpdateResult,
  AnalyticsSummary,
  MonthlyBreakdown,
} from "@/types";

const API_BASE = "/api";

const api = axios.create({
  baseURL: API_BASE,
});

export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const { data } = await api.get<Category[]>("/categories");
    return data;
  },
};

export const accountsApi = {
  getAll: async (): Promise<Account[]> => {
    const { data } = await api.get<Account[]>("/accounts");
    return data;
  },

  link: async (code: string): Promise<void> => {
    await api.post("/accounts/link", { code });
  },
};

export const transactionsApi = {
  getAll: async (params: {
    page?: number;
    limit?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedTransactions> => {
    const { data } = await api.get<PaginatedTransactions>("/transactions", {
      params,
    });
    return data;
  },

  update: async (id: number, categoryId: number): Promise<void> => {
    await api.patch(`/transactions/${id}`, { category_id: categoryId });
  },

  bulkUpdate: async (params: {
    category_id: number;
    description: string;
    provider_merchant_name: string | null;
  }): Promise<BulkUpdateResult> => {
    const { data } = await api.patch<BulkUpdateResult>(
      "/transactions/bulk",
      params,
    );
    return data;
  },
};

export const analyticsApi = {
  getSummary: async (params: {
    start_date: string;
    end_date: string;
  }): Promise<AnalyticsSummary> => {
    const { data } = await api.get<AnalyticsSummary>("/analytics/summary", {
      params,
    });
    return data;
  },

  getCategoryBreakdown: async (params: {
    start_date: string;
    end_date: string;
  }): Promise<MonthlyBreakdown[]> => {
    const { data } = await api.get<MonthlyBreakdown[]>(
      "/analytics/category-breakdown",
      { params },
    );
    return data;
  },
};
