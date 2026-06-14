"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { formatCurrency, getDateRangeForPeriod } from "@/lib/utils";
import { useAnalyticsSummary } from "@/lib/hooks";
import type { PeriodType } from "@/types";

interface ScoreCardsProps {
  period: PeriodType;
  customStartDate?: string;
  customEndDate?: string;
}

export function ScoreCards({ period, customStartDate, customEndDate }: ScoreCardsProps) {
  const { startDate, endDate } = getDateRangeForPeriod(period, customStartDate, customEndDate);
  const { data, isLoading } = useAnalyticsSummary(startDate, endDate);

  const cards = [
    {
      title: "Total Spent",
      value: data?.total_spent ?? 0,
      icon: TrendingDown,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Total Income",
      value: data?.total_income ?? 0,
      icon: TrendingUp,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Total Saved",
      value: data?.total_saved ?? 0,
      icon: PiggyBank,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {card.title}
            </span>
            <div className={`p-2 rounded-full ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </div>
          <div className="mt-4">
            {isLoading ? (
              <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
            ) : (
              <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(card.value)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}