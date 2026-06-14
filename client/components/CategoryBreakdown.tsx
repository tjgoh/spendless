"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCategoryBreakdown, useCategories } from "@/lib/hooks";
import { formatMonth, formatCurrency, getCategoryColor } from "@/lib/utils";
import type { ChartRangeType } from "@/types";

interface CategoryBreakdownProps {
  range: ChartRangeType;
}

export function CategoryBreakdown({ range }: CategoryBreakdownProps) {
  const year = parseInt(range);
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  const { data: breakdownData, isLoading: breakdownLoading } =
    useCategoryBreakdown(startDate, endDate);
  const { data: categoriesData, isLoading: categoriesLoading } =
    useCategories();

  const [enabledCategories, setEnabledCategories] = React.useState<Set<string>>(
    new Set(),
  );

  React.useEffect(() => {
    if (categoriesData) {
      setEnabledCategories(new Set(categoriesData.map((c) => c.label)));
    }
  }, [categoriesData]);

  const toggleCategory = (label: string) => {
    const newSet = new Set(enabledCategories);
    if (newSet.has(label)) {
      newSet.delete(label);
    } else {
      newSet.add(label);
    }
    setEnabledCategories(newSet);
  };

  const chartData = React.useMemo(() => {
    if (!breakdownData) return [];

    return breakdownData.map((month) => {
      const expenses: Record<string, number> = {};

      month.categories.forEach((cat) => {
        if (
          cat.type === "Expense" &&
          enabledCategories.has(cat.label) &&
          cat.amount < 0
        ) {
          expenses[cat.label] = Math.abs(cat.amount);
        }
      });

      return {
        month: formatMonth(month.month),
        ...expenses,
        _categories: month.categories,
      };
    });
  }, [breakdownData, enabledCategories]);

  const categoryList = React.useMemo(() => {
    if (!breakdownData) return [];

    const categories = new Map<string, number>();

    breakdownData.forEach((month) => {
      month.categories.forEach((cat) => {
        if (cat.type === "Expense") {
          const current = categories.get(cat.label) || 0;
          categories.set(cat.label, current + cat.amount);
        }
      });
    });

    const totalEnabled = Array.from(categories.values()).reduce(
      (sum, amt) => sum + amt,
      0,
    );

    return Array.from(categories.entries())
      .map(([label, amount]) => ({
        label,
        amount,
        percentage: totalEnabled > 0 ? (amount / totalEnabled) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .map((cat, idx) => ({
        label: cat.label,
        color: getCategoryColor(cat.label),
        enabled: enabledCategories.has(cat.label),
      }));
  }, [breakdownData, enabledCategories]);

  const totalExpense = React.useMemo(() => {
    if (!breakdownData) return 0;
    return breakdownData.reduce((sum, month) => {
      return (
        sum +
        month.categories.reduce((catSum, cat) => {
          if (cat.type === "Expense" && enabledCategories.has(cat.label)) {
            return catSum + cat.amount;
          }
          return catSum;
        }, 0)
      );
    }, 0);
  }, [breakdownData, enabledCategories]);

  const totalSpent = React.useMemo(() => {
    if (!breakdownData) return 0;
    return breakdownData.reduce((sum, month) => {
      return (
        sum +
        month.categories.reduce((catSum, cat) => {
          if (cat.type === "Expense") {
            return catSum + cat.amount;
          }
          return catSum;
        }, 0)
      );
    }, 0);
  }, [breakdownData]);

  const isLoading = breakdownLoading || categoriesLoading;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold">Expense Breakdown</h3>
        {totalExpense < 0 && (
          <div className="text-sm text-muted-foreground">
            Total: {formatCurrency(Math.abs(totalExpense))}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        {categoryList.map((cat) => (
          <button
            key={cat.label}
            onClick={() => toggleCategory(cat.label)}
            className={`flex items-center gap-2 text-xs cursor-pointer transition-opacity ${
              enabledCategories.has(cat.label) ? "opacity-100" : "opacity-40"
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                tickFormatter={(value) => `£${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  color: "#1e293b",
                }}
                formatter={(value, name, item) => {
                  const val = Number(value);
                  const categories = item.payload._categories as Array<{
                    type: string | null;
                    amount: number;
                  }>;
                  const totalMonthlyExpense = categories.reduce((sum, cat) => {
                    if (cat.type === "Expense") {
                      return sum + cat.amount;
                    }
                    return sum;
                  }, 0);
                  const totalAbs = Math.abs(totalMonthlyExpense);
                  const percentage =
                    totalAbs > 0
                      ? ((val / totalAbs) * 100).toFixed(1)
                      : 0;
                  return [
                    `${formatCurrency(val)} (${percentage}%)`,
                    String(name),
                  ];
                }}
                itemSorter={(item) => {
                  return -(item.value as number);
                }}
                labelFormatter={(label, items) => {
                  const firstItem = items[0];
                  if (!firstItem?.payload?._categories) {
                    const total = items.reduce((sum, i) => {
                      return sum + (i.value as number);
                    }, 0);
                    return (
                      <>
                        <span>{String(label)}</span>
                        <span className="font-semibold mt-1 block">
                          Total: {formatCurrency(total)}
                        </span>
                      </>
                    );
                  }
                  const categories = firstItem.payload._categories as Array<{
                    type: string | null;
                    amount: number;
                    label: string;
                  }>;
                  const total = Math.abs(
                    categories.reduce((sum, cat) => {
                      if (cat.type === "Expense" && enabledCategories.has(cat.label)) {
                        return sum + cat.amount;
                      }
                      return sum;
                    }, 0)
                  );
                  return (
                    <>
                      <span>{String(label)}</span>
                      <span className="font-semibold mt-1 block">
                        Total: {formatCurrency(total)}
                      </span>
                    </>
                  );
                }}
              />
              {categoryList
                .filter((cat) => cat.enabled)
                .map((cat) => (
                  <Bar
                    key={cat.label}
                    dataKey={cat.label}
                    stackId="a"
                    fill={cat.color}
                  />
                ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
