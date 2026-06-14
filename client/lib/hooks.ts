import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoriesApi, transactionsApi, analyticsApi } from "./api";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });
}

export function useAnalyticsSummary(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["analytics-summary", startDate, endDate],
    queryFn: () => analyticsApi.getSummary({ start_date: startDate, end_date: endDate }),
    enabled: !!startDate && !!endDate,
  });
}

export function useCategoryBreakdown(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["category-breakdown", startDate, endDate],
    queryFn: () => analyticsApi.getCategoryBreakdown({ start_date: startDate, end_date: endDate }),
    enabled: !!startDate && !!endDate,
  });
}

export function useTransactions(params: {
  page?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => transactionsApi.getAll(params),
  });
}

export function useTransactionsInfinite(params: {
  limit?: number;
  start_date?: string;
  end_date?: string;
  categories?: string;
}) {
  return useInfiniteQuery({
    queryKey: ["transactions-infinite", params],
    queryFn: ({ pageParam = 1 }) => transactionsApi.getAll({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((acc, page) => acc + page.data.length, 0);
      const total = parseInt(lastPage.total);
      return loadedCount < total ? allPages.length + 1 : undefined;
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, categoryId }: { id: number; categoryId: number }) =>
      transactionsApi.update(id, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
    },
  });
}

export function useBulkUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      category_id: number;
      description: string;
      provider_merchant_name: string | null;
    }) => transactionsApi.bulkUpdate(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
    },
  });
}