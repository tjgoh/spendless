"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Calendar as CalendarIcon, ArrowRight, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatCurrency, getCategoryColorClass } from "@/lib/utils";
import {
  useTransactionsInfinite,
  useCategories,
  useUpdateTransaction,
  useBulkUpdateTransaction,
} from "@/lib/hooks";
import type { PaginatedTransactions } from "@/types";
import { toast } from "sonner";

function toDateString(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .split("T")[0];
}

export function TransactionsTable() {
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [endDateOpen, setEndDateOpen] = React.useState(false);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const endDateButtonRef = React.useRef<HTMLButtonElement>(null);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  const parsedStartDate = startDate ? new Date(startDate) : undefined;
  const parsedEndDate = endDate ? new Date(endDate) : undefined;

  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTransactionsInfinite({
    limit: 50,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    categories: selectedCategories.length > 0 ? selectedCategories.join(",") : undefined,
  });
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const updateMutation = useUpdateTransaction();
  const bulkMutation = useBulkUpdateTransaction();

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const [selectedTransaction, setSelectedTransaction] = React.useState<{
    id: number;
    description: string;
    provider_merchant_name: string | null;
    category_id: number | null;
    amount: number;
    timestamp: string;
  } | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("");
  const [bulkConfirmClicked, setBulkConfirmClicked] = React.useState(false);

  React.useEffect(() => {
    if (selectedTransaction) {
      setSelectedCategoryId(selectedTransaction.category_id?.toString() || "");
    }
  }, [selectedTransaction]);

  const allTransactions = React.useMemo(() => {
    const pages = transactionsData?.pages as
      | PaginatedTransactions[]
      | undefined;
    return pages?.flatMap((page) => page.data) || [];
  }, [transactionsData]);

  const totalTransactions = React.useMemo(() => {
    const pages = transactionsData?.pages as
      | PaginatedTransactions[]
      | undefined;
    const lastPage = pages?.[pages.length - 1];
    return lastPage ? parseInt(lastPage.total) : 0;
  }, [transactionsData]);

  const getCategoryLabel = (categoryId: number | null) => {
    if (!categoryId) return null;
    return categories?.find((c) => c.id === categoryId)?.label || null;
  };

  const handleSaveCategory = async () => {
    if (!selectedTransaction || !selectedCategoryId) return;

    const catId = parseInt(selectedCategoryId);
    if (isNaN(catId)) return;

    try {
      await updateMutation.mutateAsync({
        id: selectedTransaction.id,
        categoryId: catId,
      });
      toast.success("Category updated");
      setSelectedTransaction(null);
    } catch {
      toast.error("Failed to update category");
    }
  };

  const handleBulkUpdate = async () => {
    if (!selectedTransaction || !selectedCategoryId) return;

    try {
      const result = await bulkMutation.mutateAsync({
        category_id: parseInt(selectedCategoryId),
        description: selectedTransaction.description,
        provider_merchant_name: selectedTransaction.provider_merchant_name,
      });

      toast.success(`Updated ${result.updated_count} transactions`);
      setSelectedTransaction(null);
      setBulkConfirmClicked(false);
    } catch {
      toast.error("Failed to bulk update transactions");
      setBulkConfirmClicked(false);
    }
  };

  const handleBulkClick = () => {
    if (!bulkConfirmClicked) {
      setBulkConfirmClicked(true);
    } else {
      handleBulkUpdate();
    }
  };

  const isLoading = transactionsLoading && !allTransactions.length;
  const isLoadingMore = isFetchingNextPage;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-slate-400" />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[150px] justify-start text-left font-normal",
                  !parsedStartDate && "text-muted-foreground",
                )}
              >
                {parsedStartDate
                  ? format(parsedStartDate, "MMM d, yyyy")
                  : "Start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parsedStartDate}
                onSelect={(date) => {
                  setStartDate(date ? toDateString(date) : "");
                  setEndDate("");
                  setTimeout(() => endDateButtonRef.current?.click(), 0);
                }}
              />
            </PopoverContent>
          </Popover>
          <span className="text-slate-400">to</span>
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={endDateButtonRef}
                variant={"outline"}
                className={cn(
                  "w-[150px] justify-start text-left font-normal",
                  !parsedEndDate && "text-muted-foreground",
                )}
                disabled={!parsedStartDate}
              >
                {parsedEndDate
                  ? format(parsedEndDate, "MMM d, yyyy")
                  : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parsedEndDate}
                onSelect={(date) => {
                  setEndDate(date ? toDateString(date) : "");
                  setEndDateOpen(false);
                }}
                fromDate={parsedStartDate}
              />
            </PopoverContent>
          </Popover>
        </div>
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear
          </Button>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[180px]">
              {selectedCategories.length > 0
                ? `${selectedCategories.length} selected`
                : "Filter by category"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-2" align="start">
            <div className="space-y-1">
              <button
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left ${selectedCategories.includes("uncategorized") ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                onClick={() => {
                  if (selectedCategories.includes("uncategorized")) {
                    setSelectedCategories(selectedCategories.filter((c) => c !== "uncategorized"));
                  } else {
                    setSelectedCategories([...selectedCategories, "uncategorized"]);
                  }
                }}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${selectedCategories.includes("uncategorized") ? "bg-slate-800 dark:bg-slate-200" : "border-slate-400"}`}>
                  {selectedCategories.includes("uncategorized") && <Check className="w-3 h-3 text-white dark:text-slate-900" />}
                </span>
                Uncategorised
              </button>
              {categories?.map((cat) => (
                <button
                  key={cat.id}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left ${selectedCategories.includes(cat.id.toString()) ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                  onClick={() => {
                    const catId = cat.id.toString();
                    if (selectedCategories.includes(catId)) {
                      setSelectedCategories(selectedCategories.filter((c) => c !== catId));
                    } else {
                      setSelectedCategories([...selectedCategories, catId]);
                    }
                  }}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${selectedCategories.includes(cat.id.toString()) ? "bg-slate-800 dark:bg-slate-200" : "border-slate-400"}`}>
                    {selectedCategories.includes(cat.id.toString()) && <Check className="w-3 h-3 text-white dark:text-slate-900" />}
                  </span>
                  {cat.label}
                </button>
              ))}
            </div>
            {selectedCategories.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setSelectedCategories([])}
              >
                Clear all
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1 -mx-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : allTransactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No transactions found
          </div>
        ) : (
          allTransactions.map((transaction) => {
            const categoryLabel = getCategoryLabel(transaction.category_id);
            return (
              <button
                key={transaction.id}
                onClick={() => setSelectedTransaction(transaction)}
                className="w-full flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {transaction.provider_merchant_name ||
                        transaction.description}
                    </span>
                    {categoryLabel && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getCategoryColorClass(categoryLabel)}`}
                      >
                        {categoryLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    {transaction.description}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    {format(
                      new Date(transaction.timestamp),
                      "MMM d, yyyy 'at' HH:mm",
                    )}
                    <span>•</span>
                    <span>{transaction.display_name}</span>
                    <span>({transaction.provider})</span>
                  </div>
                </div>
                <div className="ml-4">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {transaction.amount >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </span>
                </div>
              </button>
            );
          })
        )}
        <div ref={loadMoreRef} className="flex justify-center">
          {isLoadingMore && (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          )}
        </div>
      </div>

      <div className="text-sm text-slate-500">
        Showing {allTransactions.length} of {totalTransactions} transactions
      </div>

      <Dialog
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  {selectedTransaction.provider_merchant_name || "Unknown"}
                </div>
                <div className="text-sm text-slate-500 mb-2">
                  {selectedTransaction.description}
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedTransaction.amount >= 0 ? "+" : "-"}
                  {formatCurrency(Math.abs(selectedTransaction.amount))}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {format(
                    new Date(selectedTransaction.timestamp),
                    "MMM d, yyyy 'at' HH:mm",
                  )}
                </div>
              </div>

              <div>
                <Label>Category</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleBulkClick}
                disabled={!selectedCategoryId || bulkMutation.isPending}
              >
                {bulkConfirmClicked ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Click again to confirm
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Apply to similar transactions
                  </>
                )}
              </Button>
            </div>
          )}
          <DialogFooter className="gap-4 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedTransaction(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={updateMutation.isPending || !selectedCategoryId}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
