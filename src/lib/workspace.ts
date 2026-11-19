export type SavedRequest = {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  body: string;
  bodyType?: "json" | "text" | "urlencoded";
  createdAt: string;
};

export type LocalCollection = {
  id: string;
  name: string;
  requests: SavedRequest[];
  updatedAt: string;
  cloudOwnerId?: string;
};

const STORAGE_KEY = "devlens.guest.v1";

export function readGuestCollections(): LocalCollection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value as LocalCollection[] : [];
  } catch {
    return [];
  }
}

export function writeGuestCollections(collections: LocalCollection[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
}

export function createLocalCollection(name: string): LocalCollection {
  const collection: LocalCollection = {
    id: crypto.randomUUID(),
    name: name.trim(),
    requests: [],
    updatedAt: new Date().toISOString()
  };
  const current = readGuestCollections();
  writeGuestCollections([collection, ...current]);
  return collection;
}
