export type EnvironmentVariable = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
};

export type LocalEnvironment = {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
  updatedAt: string;
  cloudOwnerId?: string;
};

const STORAGE_KEY = "devlens.environments.v1";

export function readGuestEnvironments(): LocalEnvironment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value as LocalEnvironment[] : [];
  } catch {
    return [];
  }
}

export function writeGuestEnvironments(environments: LocalEnvironment[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(environments));
}

export function resolveEnvironmentVariables(source: string, environment?: LocalEnvironment): string {
  const variables = new Map(
    (environment?.variables || []).filter(item => item.enabled && item.key.trim()).map(item => [item.key, item.value])
  );
  return source.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key: string) => variables.get(key.trim()) ?? match);
}

const ACTIVE_STORAGE_KEY = "devlens.environments.active.v1";

export function readActiveEnvironmentId(environments: LocalEnvironment[]): string | null {
  try {
    const stored = localStorage.getItem(ACTIVE_STORAGE_KEY);
    return stored && environments.some(item => item.id === stored) ? stored : environments[0]?.id ?? null;
  } catch {
    return environments[0]?.id ?? null;
  }
}

export function writeActiveEnvironmentId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_STORAGE_KEY, id);
    else localStorage.removeItem(ACTIVE_STORAGE_KEY);
  } catch {
    // Environment data remains usable in the current session.
  }
}
