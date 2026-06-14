"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useCategoryBreakdown } from "@/lib/hooks";
import { formatMonth, formatCurrency } from "@/lib/utils";
import type { ChartRangeType } from "@/types";

interface NetIncomeChartProps {
  range: ChartRangeType;
}

export function NetIncomeChart({ range }: NetIncomeChartProps) {
  const year = parseInt(range);
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  const { data, isLoading } = useCategoryBreakdown(startDate, endDate);

  const chartData = React.useMemo(() => {
    if (!data) return [];

    return data
      .filter((month) => {
        const date = new Date();
        if (
          month.month ===
          `${String(date.getMonth() + 1).padStart(2, "0")}-${year}`
        ) {
          return false;
        }

        return true;
      })
      .map((month) => {
        let income = 0;
        let spent = 0;

        month.categories.forEach((cat) => {
          if (cat.type === "Income") {
            income += cat.amount;
          } else if (cat.type === "Expense") {
            spent += cat.amount;
          }
        });

        return {
          month: formatMonth(month.month),
          netIncome: income - Math.abs(spent),
        };
      });
  }, [data]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
        Net Income
      </h3>
      {isLoading ? (
        <div className="h-[380px] flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      ) : (
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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
                itemStyle={{ color: "#1e293b" }}
                formatter={(value) => [
                  formatCurrency(Number(value)),
                  "Net Income",
                ]}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="netIncome"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
