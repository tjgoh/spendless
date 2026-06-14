"use client";

import * as React from "react";
import { ScoreCards } from "@/components/ScoreCards";
import { NetIncomeChart } from "@/components/NetIncomeChart";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { TransactionsTable } from "@/components/TransactionsTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { PeriodType, ChartRangeType, Connection } from "@/types";
import { accountsApi } from "@/lib/api";
import { toast } from "sonner";

function SearchParamsWrapper() {
  const searchParams = useSearchParams();
  return <DashboardContent searchParams={searchParams} />;
}

export default function Dashboard() {
  return (
    <Suspense>
      <SearchParamsWrapper />
    </Suspense>
  );
}

function toDateString(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .split("T")[0];
}

function DashboardContent({ searchParams }: { searchParams: URLSearchParams }) {
  const currentYear = new Date().getUTCFullYear();
  const [period, setPeriod] = React.useState<PeriodType>("this_month");
  const [chartRange, setChartRange] = React.useState<ChartRangeType>(
    currentYear.toString(),
  );

  const [customStartDate, setCustomStartDate] = React.useState<
    Date | undefined
  >();
  const [customEndDate, setCustomEndDate] = React.useState<Date | undefined>();
  const [endDateOpen, setEndDateOpen] = React.useState(false);
  const endDateButtonRef = React.useRef<HTMLButtonElement>(null);
  const [connections, setConnections] = React.useState<Connection[]>([]);
  const [loadingConnections, setLoadingConnections] = React.useState(false);

  const expiringConnections = connections.filter((conn) => {
    const created = new Date(conn.created_at);
    const daysAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo > 83;
  });

  React.useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      accountsApi
        .link(code)
        .then(() => {
          window.history.replaceState({}, "", window.location.pathname);
          toast.success("Bank reconnected successfully");
          return accountsApi.getAll();
        })
        .then(setConnections);
    }
    accountsApi.getAll().then(setConnections);
  }, [searchParams]);

  const authUrl = "/api/accounts/connect";

  return (
    <div className="min-h-screen bg-background">
      <header>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Spendless
          </h1>
          <div className="flex items-center gap-2">
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 cursor-default"
            >
              Connect Bank
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {expiringConnections.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/50 text-sm text-amber-800 dark:text-amber-200">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between">
            <span>
              {expiringConnections.length === 1
                ? `${expiringConnections[0].display_name} (${expiringConnections[0].provider}) is`
                : `${expiringConnections.map((c) => `${c.display_name} (${c.provider})`).join(", ")} are`}{" "}
              expiring soon.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setLoadingConnections(true);
                  accountsApi
                    .getAll()
                    .then(setConnections)
                    .finally(() => {
                      setTimeout(() => setLoadingConnections(false), 1000);
                    });
                }}
                disabled={loadingConnections}
                className="border border-amber-600 text-amber-800 dark:text-amber-200 px-3 py-1 rounded text-sm hover:bg-amber-100 dark:hover:bg-amber-800 cursor-pointer disabled:opacity-50"
              >
                {loadingConnections ? "Checking..." : "Check again"}
              </button>
              <button
                onClick={() => window.open(authUrl, "_blank")}
                className="bg-orange-600 text-white hover:bg-orange-700 h-9 px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
              >
                Reconnect
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 pt-2 pb-6 space-y-8">
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl font-semibold">Overview</h2>
            <div className="flex items-center gap-2">
              <Select
                value={period}
                onValueChange={(value) => setPeriod(value as PeriodType)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="custom">Select date</SelectItem>
                </SelectContent>
              </Select>

              {period === "custom" && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !customStartDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate
                          ? format(customStartDate, "MMM d, yyyy")
                          : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={(date) => {
                          setCustomStartDate(date);
                          setCustomEndDate(undefined);
                          setTimeout(
                            () => endDateButtonRef.current?.click(),
                            0,
                          );
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        ref={endDateButtonRef}
                        variant={"outline"}
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !customEndDate && "text-muted-foreground",
                        )}
                        disabled={!customStartDate}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate
                          ? format(customEndDate, "MMM d, yyyy")
                          : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={(date) => {
                          setCustomEndDate(date);
                          setEndDateOpen(false);
                        }}
                        fromDate={customStartDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>

          <ScoreCards
            period={period}
            customStartDate={
              customStartDate ? toDateString(customStartDate) : undefined
            }
            customEndDate={
              customEndDate ? toDateString(customEndDate) : undefined
            }
          />
        </section>

        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold">Analytics</h2>
            <Select
              value={chartRange}
              onValueChange={(value) => setChartRange(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {[
                  currentYear,
                  currentYear - 1,
                  currentYear - 2,
                  currentYear - 3,
                  currentYear - 4,
                ].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NetIncomeChart range={chartRange} />
            <CategoryBreakdown range={chartRange} />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-6">Transactions</h2>
          <div className="max-w-xl">
            <TransactionsTable />
          </div>
        </section>
      </main>
    </div>
  );
}
