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
