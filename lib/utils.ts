import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Decimal } from "@prisma/client/runtime/library";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toNumber(value: number | Decimal | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  return parseFloat(value.toString()) || 0;
}

export function formatCurrency(value: number | Decimal | null | undefined): string {
  const num = toNumber(value);
  // Para valores muy pequeños (precio por g/ml) aumentar decimales para no mostrar 0,00
  let fractionDigits = 2;
  if (num > 0 && num < 0.005) fractionDigits = 4;
  else if (num > 0 && num < 0.05) fractionDigits = 3;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(num);
}

export function formatDecimal(value: number | Decimal | null | undefined, decimals = 2): string {
  const num = toNumber(value);
  return num.toFixed(decimals);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateUniqueCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${timestamp}-${random}`;
}

export function getDaysUntilExpiry(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = d.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(date: Date | string | null | undefined): "expired" | "warning" | "ok" | null {
  const days = getDaysUntilExpiry(date);
  if (days === null) return null;
  if (days < 0) return "expired";
  if (days <= 7) return "warning";
  return "ok";
}
