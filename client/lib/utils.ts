import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export function getDateRangeForPeriod(
  period: "this_month" | "last_month" | "custom",
  customStart?: string,
  customEnd?: string,
): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  switch (period) {
    case "this_month": {
      const startDate = new Date(Date.UTC(year, month, 1));
      const endDate = new Date(Date.UTC(year, month + 1, 1));
      return {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      };
    }
    case "last_month": {
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 1));
      return {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      };
    }
    case "custom": {
      return {
        startDate: customStart || "",
        endDate: customEnd || "",
      };
    }
    default:
      return { startDate: "", endDate: "" };
  }
}

export function getLast12MonthsRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const endDate = new Date(Date.UTC(year, month + 1, 1));
  const startDate = new Date(Date.UTC(year - 1, month, 1));

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

export function getYTDRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const endDate = new Date(Date.UTC(year, now.getUTCMonth() + 1, 1));
  const startDate = new Date(Date.UTC(year, 0, 1));

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

const CATEGORY_COLOR_PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6366f1",
  "#06b6d4",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getCategoryColor(label: string): string {
  const hash = hashString(label);
  const colorIndex = hash % CATEGORY_COLOR_PALETTE.length;
  return CATEGORY_COLOR_PALETTE[colorIndex];
}

export function getCategoryColorClass(label: string): string {
  const hash = hashString(label);
  const colorIndex = hash % CATEGORY_COLOR_PALETTE.length;
  const color = CATEGORY_COLOR_PALETTE[colorIndex];

  const colorMap: Record<
    string,
    { bg: string; text: string; darkBg: string; darkText: string }
  > = {
    "#ef4444": {
      bg: "bg-red-100",
      text: "text-red-700",
      darkBg: "bg-red-900",
      darkText: "text-red-300",
    },
    "#f97316": {
      bg: "bg-orange-100",
      text: "text-orange-700",
      darkBg: "bg-orange-900",
      darkText: "text-orange-300",
    },
    "#eab308": {
      bg: "bg-yellow-100",
      text: "text-yellow-700",
      darkBg: "bg-yellow-900",
      darkText: "text-yellow-300",
    },
    "#22c55e": {
      bg: "bg-green-100",
      text: "text-green-700",
      darkBg: "bg-green-900",
      darkText: "text-green-300",
    },
    "#14b8a6": {
      bg: "bg-teal-100",
      text: "text-teal-700",
      darkBg: "bg-teal-900",
      darkText: "text-teal-300",
    },
    "#3b82f6": {
      bg: "bg-blue-100",
      text: "text-blue-700",
      darkBg: "bg-blue-900",
      darkText: "text-blue-300",
    },
    "#8b5cf6": {
      bg: "bg-purple-100",
      text: "text-purple-700",
      darkBg: "bg-purple-900",
      darkText: "text-purple-300",
    },
    "#ec4899": {
      bg: "bg-pink-100",
      text: "text-pink-700",
      darkBg: "bg-pink-900",
      darkText: "text-pink-300",
    },
    "#6366f1": {
      bg: "bg-indigo-100",
      text: "text-indigo-700",
      darkBg: "bg-indigo-900",
      darkText: "text-indigo-300",
    },
    "#06b6d4": {
      bg: "bg-cyan-100",
      text: "text-cyan-700",
      darkBg: "bg-cyan-900",
      darkText: "text-cyan-300",
    },
  };

  const { bg, text, darkBg, darkText } = colorMap[color] || {
    bg: "bg-slate-100",
    text: "text-slate-700",
    darkBg: "bg-slate-800",
    darkText: "text-slate-300",
  };
  return `${bg} ${text} dark:${darkBg} dark:${darkText}`;
}

export function formatMonth(monthStr: string): string {
  const [month, year] = monthStr.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}
