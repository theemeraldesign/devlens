import type { HttpMethod } from "./request";

export type RequestHistoryItem = {
  id: string;
  method: HttpMethod;
  url: string;
  status: number | null;
  duration: number | null;
  createdAt: string;
  cloudOwnerId?: string;
};

const STORAGE_KEY = "devlens.history.v1";

export function readRequestHistory(): RequestHistoryItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item.url === "string" && typeof item.method === "string")
      .slice(0, 100) as RequestHistoryItem[];
  } catch {
    return [];
  }
}

export function writeRequestHistory(items: RequestHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter(item => !item.cloudOwnerId).slice(0, 100)));
  } catch {
    // History remains available in memory for this session.
  }
}
