import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDown, Bookmark, Braces, Clock3, Code2, Command, Copy, ExternalLink, FileJson, Folder, Globe2, History, Layers3, Moon, MoreHorizontal, Plus, Send, ShieldCheck, Sun, X, Download, UserRound, Menu, ChevronRight } from "lucide-react";
import { sendRequest, type ApiRequest, type ApiResponse, type HeaderPair, type HttpMethod } from "./lib/request";
import { readGuestCollections, writeGuestCollections, type LocalCollection, type SavedRequest } from "./lib/workspace";
import { readActiveEnvironmentId, readGuestEnvironments, resolveEnvironmentVariables, writeActiveEnvironmentId, writeGuestEnvironments, type LocalEnvironment } from "./lib/environments";
import { prettyXml, redactUrl, safeSavedHeaders } from "./lib/utilities";
import { readRequestHistory, writeRequestHistory, type RequestHistoryItem } from "./lib/history";
import { supabase } from "./lib/supabase";
import AuthModal from "./components/AuthModal";
import UtilityModal from "./components/UtilityModal";
import EnvironmentModal from "./components/EnvironmentModal";
import CollectionModal from "./components/CollectionModal";
import SharedCollectionPage from "./components/SharedCollectionPage";
import LandingPage from "./components/LandingPage";

const uid = () => crypto.randomUUID();
const starterHeaders: HeaderPair[] = [{ id: uid(), key: "Accept", value: "application/json", enabled: true }];
const initialRequest: ApiRequest = { method: "GET", url: "https://jsonplaceholder.typicode.com/posts/1", headers: starterHeaders, body: "", bodyType: "json" };
const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const workspaceNav = [{ name: "Collections", icon: Folder }, { name: "Environments", icon: Globe2 }, { name: "History", icon: History }] as const;
type AppPage = "workspace" | "collections" | "environments" | "history" | "tools";
const pageFromPath = (path: string): AppPage => {
  if (path.startsWith("/collections")) return "collections";
  if (path.startsWith("/environments")) return "environments";
  if (path.startsWith("/history")) return "history";
  if (path.startsWith("/tools")) return "tools";
  return "workspace";
};
const pageTitles: Record<AppPage, string> = {
  workspace: "Request studio", collections: "Collections",
  environments: "Environments", history: "Request history", tools: "Developer tools"
};
const guestImportKey = (userId: string) => `devlens.guest-imported.${userId}`;
function importedGuestIds(userId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(guestImportKey(userId)) || "[]");
    return Array.isArray(value) ? new Set(value.filter((id): id is string => typeof id === "string")) : new Set();
  } catch { return new Set(); }
}
function hasUnimportedGuestData(userId: string, collections: LocalCollection[], environments: LocalEnvironment[]): boolean {
  const imported = importedGuestIds(userId);
  return collections.some(item => !item.cloudOwnerId && !imported.has(item.id)) ||
    environments.some(item => !item.cloudOwnerId && !imported.has(item.id));
}


type SelectOption = string | { value: string; label: string };
function SelectMenu({ id, value, options, onChange, className = "", ariaLabel }: { id: string; value: string; options: SelectOption[]; onChange: (value: string) => void; className?: string; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.map(option => typeof option === "string" ? { value: option, label: option } : option).find(option => option.value === value);
  return <div className={`select-menu ${className}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button id={id} type="button" className="select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}><span>{selected?.label ?? value}</span><ChevronRight size={13} className={open ? "select-chevron open" : "select-chevron"}/></button>
    {open && <div className="select-options" role="listbox" aria-label={ariaLabel}>{options.map(option => { const item = typeof option === "string" ? { value: option, label: option } : option; return <button type="button" role="option" aria-selected={item.value === value} className={item.value === value ? "select-option selected" : "select-option"} key={item.value} onClick={() => { onChange(item.value); setOpen(false); }}>{item.label}{item.value === value && <span>✓</span>}</button>; })}</div>}
  </div>;
}

export default function App() {
  const [dark, setDark] = useState(true);
  const [request, setRequest] = useState(initialRequest);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"body" | "headers" | "params" | "auth">("headers");
  const [responseTab, setResponseTab] = useState<"pretty" | "raw" | "headers">("pretty");
  const [activeNav, setActiveNav] = useState(() => { const page = pageFromPath(window.location.pathname); return page === "workspace" ? "Collections" : page === "tools" ? "Utilities" : page[0].toUpperCase()+page.slice(1); });
  const [currentPage, setCurrentPage] = useState<AppPage>(() => pageFromPath(window.location.pathname));
  const [menuOpen, setMenuOpen] = useState(false);
  const [collections, setCollections] = useState<LocalCollection[]>(() => readGuestCollections());
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(() => readGuestCollections()[0]?.id ?? null);
  const [collectionName, setCollectionName] = useState(() => readGuestCollections()[0]?.name ?? "My workspace");
  const [environments, setEnvironments] = useState<LocalEnvironment[]>(() => readGuestEnvironments());
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(() => readActiveEnvironmentId(readGuestEnvironments()));
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [editingEnvironment, setEditingEnvironment] = useState<LocalEnvironment | null>(null);
  const [history, setHistory] = useState<RequestHistoryItem[]>(() => readRequestHistory());
  const [historyFilter, setHistoryFilter] = useState("");
  const [publishedSlugs, setPublishedSlugs] = useState<Record<string, string>>({});
  const [mobilePanel, setMobilePanel] = useState<"collections" | "environments" | "history" | "utilities" | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showAuth, setShowAuth] = useState(() => window.location.search.includes("password-reset=1"));
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [activeUtility, setActiveUtility] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  const [dialogState, setDialogState] = useState<{ kind: "confirm" | "prompt"; title: string; message: string; value: string } | null>(null);
  const dialogResolver = useRef<((value: boolean | string | null) => void) | null>(null);
  function askConfirm(message: string, title = "Confirm action"): Promise<boolean> {
    return new Promise(resolve => { dialogResolver.current = value => resolve(value === true); setDialogState({ kind: "confirm", title, message, value: "" }); });
  }
  function askPrompt(message: string, value = ""): Promise<string | null> {
    return new Promise(resolve => { dialogResolver.current = result => resolve(typeof result === "string" ? result : null); setDialogState({ kind: "prompt", title: "Rename collection", message, value }); });
  }
  function resolveDialog(value: boolean | string | null) {
    dialogResolver.current?.(value); dialogResolver.current = null; setDialogState(null);
  }
  const [params, setParams] = useState([{ id: uid(), key: "", value: "", enabled: true }]);
  const [authType, setAuthType] = useState("No authentication");
  const [authToken, setAuthToken] = useState("");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");
  const [apiKeyName, setApiKeyName] = useState("x-api-key");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyLocation, setApiKeyLocation] = useState<"Header" | "Query">("Header");
  const [formFileKey, setFormFileKey] = useState("file");
  const [formFiles, setFormFiles] = useState<Array<{ id: string; key: string; file: File }>>([]);

  async function syncCloudCollections(userId: string) {
    if (!supabase) return;
    const { data, error: syncError } = await supabase.from("collections").select("id,name,content,updated_at").eq("owner_id", userId).order("updated_at", { ascending: false });
    if (syncError) { setAccountNotice(syncError.message); return; }
    const cloud = (data || []).map(row => {
      const content = row.content as { requests?: LocalCollection["requests"] } | null;
      return { id: row.id, name: row.name, requests: Array.isArray(content?.requests) ? content.requests : [], updatedAt: row.updated_at, cloudOwnerId: userId } as LocalCollection;
    });
    const local = readGuestCollections();
    const cloudIds = new Set(cloud.map(item => item.id));
    const merged = [...cloud, ...local.filter(item => !cloudIds.has(item.id))];
    setCollections(merged);
    if (!activeCollectionId && merged.length) {
      setActiveCollectionId(merged[0].id);
      setCollectionName(merged[0].name);
    }
  }

  async function syncCloudEnvironments(userId: string) {
    if (!supabase) return;
    const { data, error: syncError } = await supabase.from("environments").select("id,guest_id,name,variables,updated_at,is_active").eq("owner_id", userId).order("updated_at", { ascending: false });
    if (syncError) { setAccountNotice(syncError.message); return; }
    const cloud = (data || []).map(row => {
      const variables = row.variables && typeof row.variables === "object" ? Object.entries(row.variables as Record<string,string>).map(([key,value]) => ({ id: uid(), key, value: String(value), enabled: true })) : [];
      return { id: row.guest_id || row.id, name: row.name, variables, updatedAt: row.updated_at, cloudOwnerId: userId } as LocalEnvironment;
    });
    const local = readGuestEnvironments();
    const cloudIds = new Set(cloud.map(item => item.id));
    const merged = [...cloud, ...local.filter(item => !cloudIds.has(item.id))];
    setEnvironments(merged);
    const active = data?.find(row => row.is_active);
    const nextActiveId = active ? (active.guest_id || active.id) : readActiveEnvironmentId(merged);
    setActiveEnvironmentId(nextActiveId);
    writeActiveEnvironmentId(nextActiveId);
  }

  async function clearRequestHistory() {
    if (!(await askConfirm("Clear all saved request history from this workspace and your account?", "Clear request history"))) return;
    setHistory([]);
    writeRequestHistory([]);
    if (supabase && accountId) {
      const { error: clearError } = await supabase.from("request_history").delete().eq("owner_id", accountId);
      if (clearError) setAccountNotice("Local history cleared, but cloud history could not be cleared: " + clearError.message);
    }
  }

  async function syncCloudHistory(userId: string) {
    if (!supabase) return;
    const { data, error: syncError } = await supabase.from("request_history")
      .select("id,method,url,status_code,duration_ms,created_at")
      .eq("owner_id", userId).order("created_at", { ascending: false }).limit(100);
    if (syncError) { setAccountNotice(syncError.message); return; }
    const cloud = (data || []).map(row => ({
      id: row.id, method: row.method as HttpMethod, url: row.url,
      status: row.status_code, duration: row.duration_ms,
      createdAt: row.created_at, cloudOwnerId: userId
    } as RequestHistoryItem));
    const local = readRequestHistory();
    const cloudIds = new Set(cloud.map(item => item.id));
    setHistory([...cloud, ...local.filter(item => !cloudIds.has(item.id))].slice(0, 100));
  }

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const user = data.session?.user;
      setAccountEmail(user?.email ?? null);
      setAccountId(user?.id ?? null);
      setAuthReady(true);
      if (user) { void syncCloudCollections(user.id); void syncCloudEnvironments(user.id); void syncCloudHistory(user.id); if ((collections.some(item => !item.cloudOwnerId) || environments.some(item => !item.cloudOwnerId)) && hasUnimportedGuestData(user.id, collections, environments)) setShowImportPrompt(true); }
    }).catch(() => { if (alive) setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountEmail(session?.user.email ?? null);
      setAccountId(session?.user.id ?? null);
      setAuthReady(true);
      if (session?.user) { void syncCloudCollections(session.user.id); void syncCloudEnvironments(session.user.id); void syncCloudHistory(session.user.id); if ((collections.some(item => !item.cloudOwnerId) || environments.some(item => !item.cloudOwnerId)) && hasUnimportedGuestData(session.user.id, collections, environments)) setShowImportPrompt(true); }
      if (!session) {
        setShowImportPrompt(false);
        const guestCollections = readGuestCollections();
        const guestEnvironments = readGuestEnvironments();
        setCollections(guestCollections);
        setEnvironments(guestEnvironments);
        setHistory(readRequestHistory());
        setActiveCollectionId(guestCollections[0]?.id ?? null);
        setCollectionName(guestCollections[0]?.name ?? "My workspace");
        const activeId = readActiveEnvironmentId(guestEnvironments);
        setActiveEnvironmentId(activeId);
      }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const onPopState = () => { setCurrentPage(pageFromPath(window.location.pathname)); setMenuOpen(false); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigateTo(page: AppPage) {
    const paths: Record<AppPage, string> = { workspace: "/", collections: "/collections", environments: "/environments", history: "/history", tools: "/tools" };
    if (window.location.pathname !== paths[page]) window.history.pushState({}, "", paths[page]);
    setCurrentPage(page);
    setActiveNav(page === "tools" ? "Utilities" : page === "workspace" ? "Collections" : page[0].toUpperCase()+page.slice(1));
    setMenuOpen(false);
    setMobilePanel(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeEnvironment = environments.find(environment => environment.id === activeEnvironmentId);
  async function saveEnvironment(environment: LocalEnvironment) {
    const next = environments.some(item => item.id === environment.id)
      ? environments.map(item => item.id === environment.id ? environment : item)
      : [environment, ...environments];
    setEnvironments(next);
    setActiveEnvironmentId(environment.id);
    writeActiveEnvironmentId(environment.id);
    setShowEnvironmentModal(false);
    setEditingEnvironment(null);
    if (supabase && accountId) {
      const { error: deactivateError } = await supabase.from("environments").update({ is_active: false }).eq("owner_id", accountId).eq("is_active", true);
      if (deactivateError) { setAccountNotice(deactivateError.message); const localFallback = next.map(item => item.id === environment.id ? { ...item, cloudOwnerId: undefined } : item); setEnvironments(localFallback); writeGuestEnvironments(localFallback.filter(item => !item.cloudOwnerId)); return; }
      const variables = Object.fromEntries(environment.variables.filter(item => item.enabled && item.key.trim()).map(item => [item.key.trim(), item.value]));
      const { error: saveError } = await supabase.from("environments").upsert({
        id: environment.id, owner_id: accountId, guest_id: environment.id,
        name: environment.name, variables, is_active: true
      }, { onConflict: "owner_id,guest_id" });
      if (saveError) { setAccountNotice(saveError.message); const localFallback = next.map(item => item.id === environment.id ? { ...item, cloudOwnerId: undefined } : item); setEnvironments(localFallback); writeGuestEnvironments(localFallback.filter(item => !item.cloudOwnerId)); return; }
      setEnvironments(next.map(item => item.id === environment.id ? { ...item, cloudOwnerId: accountId } : item));
      const guestBackup = readGuestEnvironments();
      if (guestBackup.some(item => item.id === environment.id)) writeGuestEnvironments(guestBackup.map(item => item.id === environment.id ? environment : item));
    } else {
      writeGuestEnvironments(next.filter(item => !item.cloudOwnerId));
    }
  }

  async function deleteEnvironment(id: string) {
    const next = environments.filter(environment => environment.id !== id);
    const target = environments.find(environment => environment.id === id);
    setEnvironments(next);
    writeGuestEnvironments(readGuestEnvironments().filter(environment => environment.id !== id));
    if (activeEnvironmentId === id) {
      const nextId = next[0]?.id ?? null;
      setActiveEnvironmentId(nextId);
      writeActiveEnvironmentId(nextId);
    }
    setShowEnvironmentModal(false);
    setEditingEnvironment(null);
    if (supabase && accountId && target?.cloudOwnerId === accountId) {
      const { error: deleteError } = await supabase.from("environments").delete().eq("owner_id", accountId).eq("guest_id", id);
      if (deleteError) setAccountNotice(deleteError.message);
    }
  }

  async function activateEnvironment(id: string) {
    setActiveEnvironmentId(id);
    writeActiveEnvironmentId(id);
    const environment = environments.find(item => item.id === id);
    if (!supabase || !accountId || !environment) return;
    const { error: deactivateError } = await supabase.from("environments").update({ is_active: false }).eq("owner_id", accountId).eq("is_active", true);
    if (deactivateError) { setAccountNotice(deactivateError.message); return; }
    const variables = Object.fromEntries(environment.variables.filter(item => item.enabled && item.key.trim()).map(item => [item.key.trim(), item.value]));
    const { error: activateError } = await supabase.from("environments").upsert({
      id: environment.id, owner_id: accountId, guest_id: environment.id,
      name: environment.name, variables, is_active: true
    }, { onConflict: "owner_id,guest_id" });
    if (activateError) setAccountNotice(activateError.message);
    else setEnvironments(items => items.map(item => item.id === id ? { ...item, cloudOwnerId: accountId } : item));
  }

  const prettyBody = useMemo(() => {
    if (!response?.body) return "";
    const contentType = Object.entries(response.headers).find(([key]) => key.toLowerCase() === "content-type")?.[1]?.toLowerCase() ?? "";
    const looksLikeXml = contentType.includes("xml") || /^\\s*<\\?xml|^\\s*<[a-z][\\w:.-]*(?:\\s|>)/i.test(response.body);
    if (looksLikeXml) {
      try { return prettyXml(response.body); } catch { return response.body; }
    }
    try { return JSON.stringify(JSON.parse(response.body), null, 2); } catch { return response.body; }
  }, [response]);

  function downloadResponse() {
    if (!response) return;
    const contentType = Object.entries(response.headers).find(([key]) => key.toLowerCase() === "content-type")?.[1] ?? "text/plain";
    const extension = /json/i.test(contentType) ? "json" : /xml/i.test(contentType) || /<\\?xml/i.test(response.body) ? "xml" : "txt";
    const blob = new Blob([response.body], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "devlens-response." + extension;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const updateRequest = (patch: Partial<ApiRequest>) => setRequest(current => ({ ...current, ...patch }));
  const formDataRows = useMemo(() => {
    if (request.bodyType !== "formdata" || !request.body.trim()) return [] as Array<{ key: string; value: string }>;
    try {
      const parsed: unknown = JSON.parse(request.body);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(row => row && typeof row === "object").map(row => ({
        key: typeof row.key === "string" ? row.key : "",
        value: typeof row.value === "string" ? row.value : ""
      }));
    } catch { return []; }
  }, [request.body, request.bodyType]);
  const saveFormDataRows = (rows: Array<{ key: string; value: string }>) => updateRequest({ body: JSON.stringify(rows, null, 2) });
  const updateFormDataRow = (index: number, patch: Partial<{ key: string; value: string }>) => {
    saveFormDataRows(formDataRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };
  async function createCollection() {
    const name = collectionName.trim();
    if (!name) return;
    const collection: LocalCollection = { id: uid(), name, requests: [], updatedAt: new Date().toISOString() };
    const next = [collection, ...collections];
    setCollections(next);
    setActiveCollectionId(collection.id);
    setShowNew(false);
    if (supabase && accountId) {
      const { error: cloudError } = await supabase.from("collections").insert({ id: collection.id, owner_id: accountId, guest_id: collection.id, name, content: { requests: [] } });
      if (cloudError) { setAccountNotice(cloudError.message); writeGuestCollections(next.filter(item => !item.cloudOwnerId)); }
      else setCollections(next.map(item => item.id === collection.id ? { ...item, cloudOwnerId: accountId } : item));
    } else {
      writeGuestCollections(next.filter(item => !item.cloudOwnerId));
    }
  }

  async function invokePublishAction(collectionId: string, action: "status" | "publish" | "unpublish") {
    const body = { collectionId, action };
    const first = await supabase!.functions.invoke("publish-collection", { body });
    const status = (first.error as unknown as { context?: Response } | null)?.context?.status;
    if (!first.error || (status !== undefined && status !== 401)) return first;
    const { data: refreshed, error: refreshError } = await supabase!.auth.refreshSession();
    if (refreshError || !refreshed.session) return first;
    return supabase!.functions.invoke("publish-collection", {
      body,
      headers: { Authorization: `Bearer ${refreshed.session.access_token}` }
    });
  }

  async function publishCollection(id: string) {
    if (!supabase || !accountId) { setShowAuth(true); return; }
    setAccountNotice("Preparing public collection link…");
    const status = await invokePublishAction(id, "status");
    if (status.error) { setAccountNotice(status.error.message); return; }
    let slug = status.data?.slug as string | undefined;
    if (!status.data?.published || !slug) {
      const { data, error: publishError } = await invokePublishAction(id, "publish");
      if (publishError || !data?.slug) {
        setAccountNotice(publishError?.message || data?.error || "Unable to publish this collection.");
        return;
      }
      slug = data.slug;
      setAccountNotice("Collection published.");
    }
    setPublishedSlugs(current => ({ ...current, [id]: slug! }));
    const shareUrl = window.location.origin + "/share/" + slug;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setAccountNotice("Public link copied: " + shareUrl);
    } catch {
      setAccountNotice("Copy your public collection link: " + shareUrl);
    }
  }

  async function unpublishCollection(id: string) {
    if (!supabase || !accountId || !(await askConfirm("Stop sharing this collection? Its public link will stop working.", "Unpublish collection"))) return;
    const { data, error: unpublishError } = await invokePublishAction(id, "unpublish");
    if (unpublishError || data?.error) { setAccountNotice(unpublishError?.message || data.error); return; }
    setPublishedSlugs(current => { const next = { ...current }; delete next[id]; return next; });
    setAccountNotice("Collection is no longer public. Its old link is disabled.");
  }

  async function importSharedCollection(name: string, rows: Array<Record<string, unknown>>) {
    const importedRequests: SavedRequest[] = rows.slice(0, 500).flatMap((row, index) => {
      const method = String(row.method || "GET").toUpperCase();
      if (!methods.includes(method as HttpMethod) || typeof row.url !== "string") return [];
      let url: URL;
      try { url = new URL(row.url); } catch { return []; }
      if (!["http:", "https:"].includes(url.protocol)) return [];
      const rawHeaders = Array.isArray(row.headers) ? row.headers : [];
      const headers = rawHeaders.filter(item => item && typeof item === "object").map(item => {
        const header = item as Record<string, unknown>;
        return { key: String(header.key || "").slice(0,128), value: String(header.value || "").slice(0,8192), enabled: header.enabled !== false };
      });
      return [{
        id: uid(), name: typeof row.name === "string" ? row.name.slice(0,120) : "Imported request " + (index + 1),
        method: method as HttpMethod, url: redactUrl(url.toString()), headers: safeSavedHeaders(headers),
        body: typeof row.body === "string" ? row.body.slice(0, 100_000) : "",
        bodyType: (row.bodyType === "text" || row.bodyType === "urlencoded" || row.bodyType === "formdata" ? row.bodyType : "json") as SavedRequest["bodyType"],
        createdAt: new Date().toISOString()
      }];
    });
    const collection: LocalCollection = { id: uid(), name: (name + " (imported)").slice(0,120), requests: importedRequests, updatedAt: new Date().toISOString() };
    if (supabase && accountId) {
      const { error: insertError } = await supabase.from("collections").insert({
        id: collection.id, owner_id: accountId, guest_id: collection.id, name: collection.name,
        content: { requests: collection.requests }
      });
      if (insertError) { setAccountNotice("Import failed: " + insertError.message); return; }
    } else {
      writeGuestCollections([collection, ...readGuestCollections()]);
    }
    window.location.assign("/");
  }

  async function renameCollection(id: string) {
    const current = collections.find(item => item.id === id);
    if (!current) return;
    const nextName = (await askPrompt("Enter a new name for this collection.", current.name))?.trim();
    if (!nextName || nextName === current.name) return;
    if (nextName.length > 120) { setAccountNotice("Collection names must be 120 characters or fewer."); return; }
    const next = collections.map(item => item.id === id ? { ...item, name: nextName, updatedAt: new Date().toISOString() } : item);
    setCollections(next);
    if (activeCollectionId === id) setCollectionName(nextName);
    if (supabase && accountId && current.cloudOwnerId === accountId) {
      const { error: updateError } = await supabase.from("collections").update({ name: nextName, updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", accountId);
      if (updateError) setAccountNotice("Collection renamed locally, but cloud sync failed: " + updateError.message);
    } else writeGuestCollections(next.filter(item => !item.cloudOwnerId));
  }

  async function duplicateCollection(id: string) {
    const current = collections.find(item => item.id === id);
    if (!current) return;
    const copy: LocalCollection = { ...current, id: uid(), name: current.name + " copy", requests: current.requests.map(item => ({ ...item, id: uid() })), updatedAt: new Date().toISOString(), cloudOwnerId: undefined };
    const next = [copy, ...collections];
    if (supabase && accountId) {
      const { error: insertError } = await supabase.from("collections").insert({
        id: copy.id, owner_id: accountId, guest_id: copy.id, name: copy.name,
        content: { requests: copy.requests }
      });
      if (insertError) { setAccountNotice("Unable to duplicate collection: " + insertError.message); return; }
      copy.cloudOwnerId = accountId;
    } else writeGuestCollections(next);
    setCollections(next);
    setActiveCollectionId(copy.id);
    setCollectionName(copy.name);
    setAccountNotice("Collection duplicated.");
  }

  async function deleteCollection(id: string) {
    const current = collections.find(item => item.id === id);
    if (!current || !(await askConfirm(`Delete "${current.name}" and its saved requests? This cannot be undone.`, "Delete collection"))) return;
    if (supabase && accountId && current.cloudOwnerId === accountId) {
      const { error: deleteError } = await supabase.from("collections").delete().eq("id", id).eq("owner_id", accountId);
      if (deleteError) { setAccountNotice("Unable to delete collection: " + deleteError.message); return; }
    }
    const next = collections.filter(item => item.id !== id);
    setCollections(next);
    writeGuestCollections(next.filter(item => !item.cloudOwnerId));
    if (activeCollectionId === id) {
      const replacement = next[0];
      setActiveCollectionId(replacement?.id ?? null);
      setCollectionName(replacement?.name ?? "My workspace");
    }
    setAccountNotice("Collection deleted.");
  }

  function exportCollectionById(id: string) {
    const collection = collections.find(item => item.id === id);
    if (!collection) return;
    const blob = new Blob([JSON.stringify({ format: "devlens-collection", version: 1, name: collection.name, requests: collection.requests }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".devlens.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportActiveCollection() {
    const collection = collections.find(item => item.id === activeCollectionId);
    if (!collection) { setAccountNotice("Select a collection before exporting."); return; }
    const blob = new Blob([JSON.stringify({ format: "devlens-collection", version: 1, name: collection.name, requests: collection.requests }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = collection.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".devlens.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importCollectionFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Collection files must be smaller than 2 MB.");
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
      const rows = Array.isArray(parsed.requests) ? parsed.requests : [];
      if (!name || name.length > 120 || rows.length > 500) throw new Error("This is not a valid DevLens collection export.");
      const importedRequests: SavedRequest[] = rows.map((item, index) => {
        if (!item || typeof item !== "object") throw new Error("A request entry is invalid.");
        const row = item as Record<string, unknown>;
        const method = String(row.method || "GET").toUpperCase();
        if (!methods.includes(method as HttpMethod)) throw new Error("A request uses an unsupported HTTP method.");
        if (typeof row.url !== "string" || !row.url.trim() || row.url.length > 4096) throw new Error("A request URL is missing or too long.");
        const rawHeaders = Array.isArray(row.headers) ? row.headers : [];
        const headers = rawHeaders.filter(header => header && typeof header === "object").map(header => {
          const h = header as Record<string, unknown>;
          return { key: String(h.key || "").slice(0,128), value: String(h.value || "").slice(0,8192), enabled: h.enabled !== false };
        });
        return {
          id: uid(), name: typeof row.name === "string" ? row.name.slice(0,120) : `Imported request ${index + 1}`,
          method: method as HttpMethod, url: redactUrl(row.url), headers: safeSavedHeaders(headers), body: typeof row.body === "string" ? row.body.slice(0, 1024 * 1024) : "", bodyType: (row.bodyType === "text" || row.bodyType === "urlencoded" || row.bodyType === "formdata" ? row.bodyType : "json") as SavedRequest["bodyType"],
          createdAt: new Date().toISOString()
        };
      });
      const collection: LocalCollection = { id: uid(), name, requests: importedRequests, updatedAt: new Date().toISOString() };
      const next = [collection, ...collections];
      if (supabase && accountId) {
        const { error: cloudError } = await supabase.from("collections").insert({
          id: collection.id, owner_id: accountId, guest_id: collection.id, name,
          content: { requests: importedRequests }
        });
        if (cloudError) throw cloudError;
        collection.cloudOwnerId = accountId;
      } else {
        writeGuestCollections(next);
      }
      setCollections(next);
      setActiveCollectionId(collection.id);
      setCollectionName(collection.name);
      setAccountNotice(`Imported "${collection.name}" with ${importedRequests.length} request(s).`);
    } catch (error) {
      setAccountNotice(error instanceof Error ? error.message : "Unable to import this collection.");
    }
  }

  async function saveRequest() {
    const current = collections.find(item => item.id === activeCollectionId);
    const target = current ?? { id: uid(), name: "My requests", requests: [], updatedAt: new Date().toISOString() };
    const saved = { id: uid(), name: "Untitled request", method: request.method, url: redactUrl(request.url), headers: safeSavedHeaders(request.headers), body: request.body, bodyType: request.bodyType ?? "json", createdAt: new Date().toISOString() };
    const next = current
      ? collections.map(item => item.id === current.id ? { ...item, requests: [saved, ...item.requests], updatedAt: new Date().toISOString() } : item)
      : [{ ...target, requests: [saved] }, ...collections];
    setCollections(next);
    setActiveCollectionId(target.id);
    if (supabase && accountId) {
      const cloudCollection = next.find(item => item.id === target.id);
      if (cloudCollection) {
        const { error: cloudError } = await supabase.from("collections").upsert({
          id: cloudCollection.id, owner_id: accountId, guest_id: cloudCollection.id,
          name: cloudCollection.name, content: { requests: cloudCollection.requests }
        });
        if (cloudError) {
          setAccountNotice(cloudError.message);
          const localFallback = next.map(item => item.id === target.id ? { ...item, cloudOwnerId: undefined } : item);
          setCollections(localFallback);
          writeGuestCollections(localFallback.filter(item => !item.cloudOwnerId));
        } else {
          setCollections(next.map(item => item.id === target.id ? { ...item, cloudOwnerId: accountId } : item));
          const guestBackup = readGuestCollections();
          if (guestBackup.some(item => item.id === target.id)) writeGuestCollections(guestBackup.map(item => item.id === target.id ? cloudCollection : item));
        }
      }
    } else {
      writeGuestCollections(next.filter(item => !item.cloudOwnerId));
    }
  }

  const updateHeader = (id: string, patch: Partial<HeaderPair>) => updateRequest({ headers: request.headers.map(h => h.id === id ? { ...h, ...patch } : h) });
  async function importGuestData() {
    const guestCollections = collections.filter(item => !item.cloudOwnerId);
    const guestEnvironments = environments.filter(item => !item.cloudOwnerId);
    if (!supabase || !accountId || (!guestCollections.length && !guestEnvironments.length)) return;
    setAccountNotice("");
    if (guestCollections.length) {
      const rows = guestCollections.map(({ id, name, requests }) => ({ id, owner_id: accountId, guest_id: id, name, content: { requests } }));
      const { error: importError } = await supabase.from("collections").upsert(rows, { onConflict: "owner_id,guest_id", ignoreDuplicates: true });
      if (importError) { setAccountNotice(importError.message); return; }
    }
    if (guestEnvironments.length) {
      const rows = guestEnvironments.map(environment => ({
        id: environment.id,
        owner_id: accountId,
        guest_id: environment.id,
        name: environment.name,
        variables: Object.fromEntries(environment.variables.filter(item => item.enabled && item.key.trim()).map(item => [item.key.trim(), item.value])),
        is_active: false
      }));
      const { error: importError } = await supabase.from("environments").upsert(rows, { onConflict: "owner_id,guest_id", ignoreDuplicates: true });
      if (importError) { setAccountNotice(importError.message); return; }
    }
    setCollections(items => items.map(item => guestCollections.some(guest => guest.id === item.id) ? { ...item, cloudOwnerId: accountId } : item));
    setEnvironments(items => items.map(item => guestEnvironments.some(guest => guest.id === item.id) ? { ...item, cloudOwnerId: accountId } : item));
    try {
      const imported = importedGuestIds(accountId);
      guestCollections.forEach(item => imported.add(item.id));
      guestEnvironments.forEach(item => imported.add(item.id));
      localStorage.setItem(guestImportKey(accountId), JSON.stringify([...imported]));
    } catch { /* Local copies remain safe if storage is unavailable. */ }
    setShowImportPrompt(false);
    setAccountNotice("Guest collections and environments imported. Your local copies remain on this device.");
  }
  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAccountNotice("");
  }

  function loadImportedCurl(imported: { method: string; url: string; headers: Record<string, string>; body: string }) {
    const headers = Object.entries(imported.headers).map(([key, value]) => ({ id: uid(), key, value, enabled: true }));
    const contentType = imported.headers["content-type"] || imported.headers["Content-Type"] || "";
    const bodyType: ApiRequest["bodyType"] = contentType.includes("x-www-form-urlencoded") ? "urlencoded" : contentType.includes("text/") ? "text" : "json";
    setRequest({ method: imported.method as HttpMethod, url: imported.url, headers, body: imported.body, bodyType });
    setParams([{ id: uid(), key: "", value: "", enabled: true }]);
    setAuthType("No authentication"); setAuthToken(""); setBasicUsername(""); setBasicPassword(""); setApiKeyValue("");
    setResponse(null); setError("");
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    setCurrentPage("workspace");
    setActiveNav("Collections");
    setMobilePanel(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelRequest() {
    abortController?.abort();
  }

  async function run() {
    const controller = new AbortController();
    setAbortController(controller);
    setBusy(true); setError(""); setResponse(null);
    try {
      const resolve = (value: string) => resolveEnvironmentVariables(value, activeEnvironment);
      const finalUrl = new URL(resolve(request.url));
      params.filter(p => p.enabled && p.key.trim()).forEach(p => finalUrl.searchParams.set(resolve(p.key), resolve(p.value)));
      const outgoingHeaders = request.headers.map(header => ({ ...header, key: resolve(header.key), value: resolve(header.value) }));
      const bodyContentType = request.bodyType === "text" ? "text/plain; charset=utf-8" : request.bodyType === "urlencoded" ? "application/x-www-form-urlencoded" : "application/json";
      if (request.bodyType === "formdata") outgoingHeaders.splice(0, outgoingHeaders.length, ...outgoingHeaders.filter(header => header.key.toLowerCase() !== "content-type"));
      if (request.body.trim() && request.bodyType !== "formdata" && !outgoingHeaders.some(header => header.enabled && header.key.toLowerCase() === "content-type")) {
        outgoingHeaders.push({ id: uid(), key: "Content-Type", value: bodyContentType, enabled: true });
      }
      if (authType === "Bearer token" && authToken) outgoingHeaders.push({ id: uid(), key: "Authorization", value: "Bearer " + resolve(authToken), enabled: true });
      if (authType === "Basic auth" && basicUsername) outgoingHeaders.push({ id: uid(), key: "Authorization", value: "Basic " + btoa(resolve(basicUsername) + ":" + resolve(basicPassword)), enabled: true });
      if (authType === "API key" && apiKeyName && apiKeyValue) {
        if (apiKeyLocation === "Header") outgoingHeaders.push({ id: uid(), key: resolve(apiKeyName), value: resolve(apiKeyValue), enabled: true });
        else finalUrl.searchParams.set(resolve(apiKeyName), resolve(apiKeyValue));
      }
      const { data: sessionData, error: sessionError } = supabase ? await supabase.auth.getSession() : { data: { session: null }, error: null };
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error("Your session has expired. Sign in again to send this request.");
      const result = await sendRequest({ ...request, headers: outgoingHeaders, url: finalUrl.toString(), body: resolve(request.body), bodyType: request.bodyType }, controller.signal, formFiles.map(({key,file})=>({key,file})), sessionData.session.access_token);
      setResponse(result);
      const historyItem: RequestHistoryItem = {
        id: uid(), method: request.method, url: redactUrl(finalUrl.toString()),
        status: result.status, duration: result.duration, createdAt: new Date().toISOString()
      };
      setHistory(items => {
        const next = [historyItem, ...items.filter(item => item.url !== historyItem.url || item.method !== historyItem.method)].slice(0, 100);
        writeRequestHistory(next);
        return next;
      });
      if (supabase && accountId) {
        const { error: historyError } = await supabase.from("request_history").insert({
          id: historyItem.id, owner_id: accountId, method: historyItem.method,
          url: historyItem.url, status_code: historyItem.status, duration_ms: historyItem.duration
        });
        if (historyError) setAccountNotice("Request completed, but history sync failed: " + historyError.message);
        else setHistory(items => items.map(item => item.id === historyItem.id ? { ...item, cloudOwnerId: accountId } : item));
      }
    } catch (e) { setError(e instanceof DOMException && e.name === "AbortError" ? "Request cancelled." : e instanceof Error ? e.message : "Request failed."); }
    finally { setBusy(false); setAbortController(null); }
  }

  const shareSlug = window.location.pathname.match(/^\/share\/([a-zA-Z0-9_-]{8,80})$/)?.[1] ?? null;
  if (shareSlug && !authReady) return <div className="auth-loading" role="status">Preparing your shared collection...</div>;
  if (shareSlug) return <><SharedCollectionPage slug={shareSlug} onImport={(name, rows) => { if (!accountId) { setAuthMode("signin"); setShowAuth(true); return; } void importSharedCollection(name, rows as unknown as Array<Record<string, unknown>>); }} />{showAuth && <AuthModal initialMode="signin" onClose={() => setShowAuth(false)} onAuthenticated={user => { setAccountEmail(user.email ?? null); setAccountId(user.id); }} />}</>;
  if (!authReady) return <div className="auth-loading" role="status">Preparing your workspace...</div>;
  if (!accountId) return <><LandingPage onGetStarted={() => { setAuthMode("signup"); setShowAuth(true); }} onSignIn={() => { setAuthMode("signin"); setShowAuth(true); }}/>{showAuth && <AuthModal initialMode={window.location.search.includes("password-reset=1") ? "update" : authMode} onClose={() => { setShowAuth(false); if (window.location.search.includes("password-reset=1")) window.history.replaceState({}, "", window.location.pathname); }} onAuthenticated={user => { setAccountEmail(user.email ?? null); setAccountId(user.id); void syncCloudCollections(user.id); void syncCloudEnvironments(user.id); void syncCloudHistory(user.id); }} />}</>;

  return <div className={dark ? "app dark app-enter" : "app light app-enter"}>
    <a className="skip-link" href="#request-workspace">Skip to workspace</a>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={18} strokeWidth={2.4}/></div><span>dev<span className="brand-accent">lens</span></span><span className="beta">BETA</span></div>
      <div className="workspace-switch"><div className="workspace-avatar">{collectionName.slice(0,1).toUpperCase() || "D"}</div><span><b>{collectionName}</b><small>{"Synced account workspace"}</small></span></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Primary workspace navigation">
        {workspaceNav.map(({name, icon: Icon}) => <button key={name as string} className={currentPage===name.toLowerCase() ? "active" : ""} onClick={() => navigateTo(name.toLowerCase() as AppPage)}><Icon size={17}/>{name as string}{name==="Collections" && <span className="nav-count">{collections.length}</span>}</button>)}
      </nav>
      {activeNav === "Collections" && <div className="collection-list">{collections.length ? collections.map(collection=><div className="collection-group" key={collection.id}><div className="collection-row"><button className={activeCollectionId===collection.id?"collection-choice active":"collection-choice"} onClick={()=>{setActiveCollectionId(collection.id);setCollectionName(collection.name);}}><Folder size={13}/><span>{collection.name}</span><small>{collection.requests.length}</small></button><div className="collection-row-actions"><button title={`Rename ${collection.name}`} aria-label={`Rename ${collection.name}`} onClick={()=>void renameCollection(collection.id)}>Rename</button><button title={`Duplicate ${collection.name}`} aria-label={`Duplicate ${collection.name}`} onClick={()=>void duplicateCollection(collection.id)}>Copy</button><button title={`Delete ${collection.name}`} aria-label={`Delete ${collection.name}`} onClick={()=>void deleteCollection(collection.id)}>Delete</button><button title={`Publish ${collection.name}`} aria-label={`Publish ${collection.name}`} onClick={()=>void publishCollection(collection.id)}>Share</button>{publishedSlugs[collection.id] && <button title={`Unpublish ${collection.name}`} aria-label={`Unpublish ${collection.name}`} onClick={()=>void unpublishCollection(collection.id)}>Unpublish</button>}</div></div>{collection.requests.map(saved=><button className="saved-request-choice" key={saved.id} onClick={()=>{setRequest({method:saved.method as HttpMethod,url:saved.url,body:saved.body,bodyType:saved.bodyType ?? "json",headers:saved.headers.map(header=>({...header,id:uid()}))});setFormFiles([]);setResponse(null);}}><span className="saved-method">{saved.method}</span><span>{saved.name}</span></button>)}</div>) : <div className="collection-empty">No collections yet. Create one to save requests.</div>}</div>}
      {activeNav === "Collections" && <div className="collection-actions"><button onClick={exportActiveCollection} disabled={!activeCollectionId}>Export selected</button><label>Import JSON<input type="file" accept=".json,application/json" onChange={event => { void importCollectionFile(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label></div>}
      {activeNav === "Environments" && <div className="collection-list"><button className="environment-new" onClick={()=>{setEditingEnvironment(null);setShowEnvironmentModal(true);}}><Plus size={13}/> New environment</button>{environments.length ? environments.map(environment=><div className="collection-group" key={environment.id}><button className={activeEnvironmentId===environment.id?"collection-choice active":"collection-choice"} onClick={()=>activateEnvironment(environment.id)}><Globe2 size={13}/><span>{environment.name}</span>{activeEnvironmentId===environment.id && <small>ACTIVE</small>}</button><button className="saved-request-choice" onClick={()=>{setEditingEnvironment(environment);setShowEnvironmentModal(true);}}>Edit variables</button></div>) : <div className="collection-empty">No environments yet. Add one to use variables.</div>}</div>}
      {activeNav === "History" && <div className="history-panel"><div className="history-tools"><input aria-label="Search request history" placeholder="Search method or URL" value={historyFilter} onChange={event=>setHistoryFilter(event.target.value)}/><button onClick={()=>void clearRequestHistory()} disabled={!history.length}>Clear</button></div><div className="tool-subnav">{history.filter(item=>(item.method+" "+item.url+" "+(item.status ?? "")).toLowerCase().includes(historyFilter.toLowerCase())).length ? history.filter(item=>(item.method+" "+item.url+" "+(item.status ?? "")).toLowerCase().includes(historyFilter.toLowerCase())).map(item=><button key={item.id} onClick={()=>updateRequest({method:item.method,url:item.url})}><span className="saved-method">{item.method}</span>{item.status ?? "—"} · {item.url}</button>) : <button disabled>{history.length ? "No matching requests" : "No requests yet"}</button>}</div></div>}
      <div className="side-divider"/>
      <div className="side-label">DEVELOPER TOOLS</div>
      <nav className="side-nav">
        <button className={currentPage === "tools" ? "active" : ""} onClick={() => navigateTo("tools")}><Braces size={17}/>Developer tools<ChevronRight size={14} className="nav-chevron"/></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="secure-note"><ShieldCheck size={16}/><span><b>Private by design</b><small>Secrets stay in your workspace.</small></span></div>
        <button className="profile-row" onClick={() => accountId ? signOut() : setShowAuth(true)}><div className="profile-avatar">{accountEmail ? accountEmail.slice(0,1).toUpperCase() : "A"}</div><span><b>{accountEmail ?? "Your account"}</b><small>{"Click to sign out"}</small></span><MoreHorizontal size={17}/></button>
      </div>
    </aside>

    <main className="main" id="request-workspace" tabIndex={-1}>
      <header className="topbar">
        <button className="top-brand" onClick={()=>navigateTo("workspace")} aria-label="DevLens home"><span className="top-brand-mark"><Activity size={17}/></span><span>dev<span>lens</span></span></button>
        <div className="breadcrumbs"><ChevronRight size={13}/><b>{pageTitles[currentPage]}</b></div>
        <div className="top-actions"><span className="connection"><i/> Workspace ready</span>
          <button className="icon-button" title="Toggle theme" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button>
          <div className="menu-anchor"><button className={menuOpen?"menu-trigger open":"menu-trigger"} aria-label="Open main menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><Menu size={19}/></button>
          {menuOpen && <><button className="menu-scrim" aria-label="Close menu" onClick={()=>setMenuOpen(false)}></button><div className="account-menu">
            <div className="menu-account"><span className="menu-avatar">{accountEmail?accountEmail.slice(0,1).toUpperCase():"A"}</span><span><b>{accountEmail??"Your account"}</b><small>{"Signed in"}</small></span></div>
            <button onClick={()=>{setMenuOpen(false);accountId?signOut():setShowAuth(true);}}><UserRound size={16}/>{accountId?"Sign out":"Sign in / Create account"}<ChevronRight size={14}/></button>
            <button onClick={()=>{setMenuOpen(false);setShowNew(true);}}><Plus size={16}/>New collection<ChevronRight size={14}/></button>
            <div className="menu-divider"/>
            {(["workspace","collections","environments","history","tools"] as AppPage[]).map(page=><button key={page} onClick={()=>navigateTo(page)}>{page==="workspace"?<Activity size={16}/>:page==="collections"?<Folder size={16}/>:page==="environments"?<Globe2 size={16}/>:page==="history"?<History size={16}/>:<Braces size={16}/>}<span>{pageTitles[page]}</span><ChevronRight size={14}/></button>)}
            <div className="menu-divider"/><button onClick={()=>{setMenuOpen(false);setDark(v=>!v);}}>{dark?<Sun size={16}/>:<Moon size={16}/>}<span>Switch to {dark?"light":"dark"} theme</span><ChevronRight size={14}/></button>
            <a href="https://github.com/theemeraldesign/devlens" target="_blank" rel="noreferrer"><Code2 size={16}/>GitHub repository<ExternalLink size={13}/></a>
          </div></>}
          </div>
        </div>
      </header>

      <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/>{currentPage==="workspace"?"API WORKSPACE":"DEVLENS WORKSPACE"}<span className="eyebrow-line"/></div><h1>{pageTitles[currentPage]}<span>.</span></h1><p>{currentPage==="workspace"?"Build, send and inspect HTTP requests with clarity.":currentPage==="collections"?"Organise reusable requests into focused API workspaces.":currentPage==="environments"?"Manage base URLs, tokens and variables across your requests.":currentPage==="history"?"Review, search and replay your recent API activity.":"A focused toolkit for everyday API development."}</p></div><div className="heading-meta"><span className="live-dot"/> {"Account"} <span className="meta-divider"/> {activeEnvironment?.name ?? "No environment"}</div></section>
      {showImportPrompt && <div className="import-banner"><div><b>Local workspace data found</b><span>Import {collections.filter(item => !item.cloudOwnerId).length} collection(s) and {environments.filter(item => !item.cloudOwnerId).length} environment(s) into your account. Local copies will stay on this device.</span></div><button onClick={importGuestData}>Import local data</button><button className="dismiss-import" onClick={() => setShowImportPrompt(false)} aria-label="Dismiss"><X size={14}/></button></div>}
      {accountNotice && <div className="import-banner"><span>{accountNotice}</span><button className="dismiss-import" onClick={() => setAccountNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}

      {currentPage === "workspace" && <>      <div className="workspace-grid">
      <section className="request-card">
        <div className="request-card-top"><div className="request-title"><div className="request-icon"><Code2 size={17}/></div><div><b>Untitled request</b><small>REST API · HTTP</small></div><span className="unsaved">UNSAVED</span></div><div className="request-actions"><button className="icon-button" title="Save request to this device" onClick={saveRequest}><Bookmark size={16}/></button><button className="icon-button" title="Resend request" onClick={run}><Send size={15}/></button></div></div>
        <div className="url-row"><label className="sr-only" htmlFor="request-method">HTTP method</label><SelectMenu id="request-method" value={request.method} options={methods} onChange={value=>updateRequest({method:value as HttpMethod})} className="method-select" ariaLabel="HTTP method"/><label className="sr-only" htmlFor="request-url">Request URL</label><input id="request-url" className="url-input" value={request.url} onChange={e=>updateRequest({url:e.target.value})} onKeyDown={e=>e.key==="Enter"&&run()} aria-label="Request URL" placeholder="Enter request URL"/><button className="send-button" onClick={busy?cancelRequest:run}><Send size={15}/>{busy?"Cancel":"Send"}<span>↵</span></button></div>
        <div className="editor-tabs">{(["params","headers","body","auth"] as const).map(t=><button key={t} className={tab===t?"selected":""} onClick={()=>setTab(t)}>{t==="params"?"Params":t==="headers"?"Headers":t==="body"?"Body":"Auth"}{t==="headers"&&<span className="tab-count">{request.headers.length}</span>}</button>)}</div>
        <div className="editor-panel">
          {tab==="headers" && <><div className="panel-caption"><span>HEADER</span><span>VALUE</span><span> </span></div>{request.headers.map(h=><div className="key-value-row" key={h.id}><label className="sr-only" htmlFor={`header-enabled-${h.id}`}>Enable header</label><input id={`header-enabled-${h.id}`} type="checkbox" checked={h.enabled} onChange={e=>updateHeader(h.id,{enabled:e.target.checked})}/><label className="sr-only" htmlFor={`header-key-${h.id}`}>Header name</label><input id={`header-key-${h.id}`} value={h.key} placeholder="Header name" onChange={e=>updateHeader(h.id,{key:e.target.value})}/><label className="sr-only" htmlFor={`header-value-${h.id}`}>Header value</label><input id={`header-value-${h.id}`} value={h.value} placeholder="Value" onChange={e=>updateHeader(h.id,{value:e.target.value})}/><button className="row-icon" aria-label={`Remove header ${h.key || "row"}`} onClick={()=>updateRequest({headers:request.headers.filter(x=>x.id!==h.id)})}><X size={14}/></button></div>)}<button className="add-row" onClick={()=>updateRequest({headers:[...request.headers,{id:uid(),key:"",value:"",enabled:true}]})}><Plus size={14}/> Add header</button></>}
          {tab==="params" && <><div className="panel-caption"><span>PARAMETER</span><span>VALUE</span><span> </span></div>{params.map(p=><div className="key-value-row" key={p.id}><label className="sr-only" htmlFor={`param-enabled-${p.id}`}>Enable parameter</label><input id={`param-enabled-${p.id}`} type="checkbox" checked={p.enabled} onChange={e=>setParams(items=>items.map(x=>x.id===p.id?{...x,enabled:e.target.checked}:x))}/><label className="sr-only" htmlFor={`param-key-${p.id}`}>Parameter name</label><input id={`param-key-${p.id}`} value={p.key} placeholder="Parameter" onChange={e=>setParams(items=>items.map(x=>x.id===p.id?{...x,key:e.target.value}:x))}/><label className="sr-only" htmlFor={`param-value-${p.id}`}>Parameter value</label><input id={`param-value-${p.id}`} value={p.value} placeholder="Value" onChange={e=>setParams(items=>items.map(x=>x.id===p.id?{...x,value:e.target.value}:x))}/><button className="row-icon" aria-label={`Remove parameter ${p.key || "row"}`} onClick={()=>setParams(items=>items.filter(x=>x.id!==p.id))}><X size={14}/></button></div>)}<button className="add-row" onClick={()=>setParams(items=>[...items,{id:uid(),key:"",value:"",enabled:true}])}><Plus size={14}/> Add parameter</button></>}
          {tab==="body" && <div className="body-editor"><div className="body-toolbar"><label htmlFor="body-type">BODY TYPE</label><SelectMenu id="body-type" value={request.bodyType ?? "json"} options={[{value:"json",label:"JSON"},{value:"text",label:"Text"},{value:"urlencoded",label:"URL encoded"},{value:"formdata",label:"Form data"}]} onChange={value=>{const bodyType=value as "json"|"text"|"urlencoded"|"formdata";updateRequest({bodyType,...(bodyType==="formdata"?{body:"[]"}:{})});if(bodyType!=="formdata")setFormFiles([]);}} className="body-type-select" ariaLabel="Body type"/><span>{request.bodyType === "formdata" ? "multipart/form-data · boundary generated automatically" : request.bodyType === "text" ? "text/plain" : request.bodyType === "urlencoded" ? "application/x-www-form-urlencoded" : "application/json"}</span></div>{request.bodyType === "formdata" ? <div className="formdata-editor"><div className="formdata-head"><span>KEY</span><span>VALUE</span><span></span></div>{formDataRows.map((row,index)=><div className="formdata-row" key={index}><input aria-label={"Form data key " + (index+1)} value={row.key} onChange={event=>updateFormDataRow(index,{key:event.target.value})} placeholder="Field name"/><input aria-label={"Form data value " + (index+1)} value={row.value} onChange={event=>updateFormDataRow(index,{value:event.target.value})} placeholder="Field value"/><button type="button" aria-label={"Remove form data field " + (index+1)} onClick={()=>saveFormDataRows(formDataRows.filter((_,rowIndex)=>rowIndex!==index))}><X size={13}/></button></div>)}<button type="button" className="formdata-add" onClick={()=>saveFormDataRows([...formDataRows,{key:"",value:""}])}><Plus size={12}/> Add field</button>{formDataRows.length===0&&<p className="formdata-empty">Add text fields to build your multipart request.</p>}<div className="formdata-upload"><div className="formdata-upload-fields"><label htmlFor="form-file-key">FILE FIELD NAME</label><input id="form-file-key" value={formFileKey} onChange={event=>setFormFileKey(event.target.value)} placeholder="file"/><label htmlFor="form-files">ATTACH FILES</label><input id="form-files" aria-label="Upload files" type="file" multiple onChange={event=>{const selected=Array.from(event.currentTarget.files??[]);setFormFiles(items=>[...items,...selected.map(file=>({id:uid(),key:formFileKey.trim()||"file",file}))]);event.currentTarget.value="";}}/></div>{formFiles.map(item=><div className="formdata-file" key={item.id}><span>{item.file.name}<small>{(item.file.size/1024).toFixed(1)} KB · {item.key}</small></span><button type="button" aria-label={"Remove file "+item.file.name} onClick={()=>setFormFiles(items=>items.filter(file=>file.id!==item.id))}><X size={13}/></button></div>)}<p>10 MB total browser upload limit. Files are sent with this request and are not saved in collections.</p></div></div> : <><label className="sr-only" htmlFor="request-body">Request body</label><textarea id="request-body" value={request.body} onChange={e=>updateRequest({body:e.target.value})} placeholder={request.bodyType === "urlencoded" ? "name=DevLens&status=building" : request.bodyType === "text" ? "Enter plain text..." : '{\n  "name": "DevLens",\n  "status": "building"\n}'} spellCheck={false}/></>}</div>}
          {tab==="auth" && <div className="auth-panel"><label htmlFor="auth-type">AUTHENTICATION TYPE</label><SelectMenu id="auth-type" value={authType} options={["No authentication","Bearer token","Basic auth","API key"]} onChange={setAuthType} className="auth-type-select" ariaLabel="Authentication type"/>{authType==="Bearer token" && <><label className="sr-only" htmlFor="auth-bearer-token">Bearer token</label><input id="auth-bearer-token" className="auth-value" type="password" value={authToken} onChange={e=>setAuthToken(e.target.value)} placeholder="Bearer token"/></>}{authType==="Basic auth" && <><label className="sr-only" htmlFor="auth-basic-username">Basic auth username</label><input id="auth-basic-username" className="auth-value" value={basicUsername} onChange={e=>setBasicUsername(e.target.value)} placeholder="Username"/><label className="sr-only" htmlFor="auth-basic-password">Basic auth password</label><input id="auth-basic-password" className="auth-value" type="password" value={basicPassword} onChange={e=>setBasicPassword(e.target.value)} placeholder="Password"/></>}{authType==="API key" && <><label className="sr-only" htmlFor="auth-api-key-name">API key name</label><input id="auth-api-key-name" className="auth-value" value={apiKeyName} onChange={e=>setApiKeyName(e.target.value)} placeholder="Key name"/><label className="sr-only" htmlFor="auth-api-key-value">API key value</label><input id="auth-api-key-value" className="auth-value" type="password" value={apiKeyValue} onChange={e=>setApiKeyValue(e.target.value)} placeholder="API key value"/><label className="sr-only" htmlFor="auth-api-key-location">API key location</label><SelectMenu id="auth-api-key-location" value={apiKeyLocation} options={["Header","Query"]} onChange={value=>setApiKeyLocation(value as "Header" | "Query")} className="auth-location" ariaLabel="API key location"/></>}<p>Credentials are sent with this request only. They are not saved with your account collections or included in public collection exports.</p></div>}
        </div>
      </section>

      <section className="response-card">
        <div className="response-head"><div className="response-title"><div className="response-icon"><ArrowDown size={16}/></div><div><b>Response</b><small>{response?"Latest request result":"Your response will appear here"}</small></div></div>{response && <div className="response-stats"><span className={response.status<400?"status-good":"status-bad"}><i/>{response.status} {response.statusText}</span><span><Clock3 size={13}/>{response.duration} ms</span><span><Layers3 size={13}/>{(response.size/1024).toFixed(2)} KB</span></div>}</div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {response ? <><div className="response-tabs">{(["pretty","raw","headers"] as const).map(t=><button className={responseTab===t?"selected":""} onClick={()=>setResponseTab(t)} key={t}>{t==="pretty"?"Pretty":t==="raw"?"Raw":"Headers"}</button>)}<button className="copy-response" onClick={()=>navigator.clipboard.writeText(responseTab==="headers"?JSON.stringify(response.headers,null,2):responseTab==="raw"?response.body:prettyBody)}><Copy size={13}/> Copy</button><button className="download-response" onClick={downloadResponse} title="Download response"><Download size={13}/> Save</button></div><pre className="response-code">{responseTab==="headers"?JSON.stringify(response.headers,null,2):responseTab==="raw"?response.body:prettyBody}</pre></> : <div className="response-empty"><div className="empty-art"><div className="empty-ring ring-one"/><div className="empty-ring ring-two"/><div className="empty-center"><FileJson size={23}/></div><span className="float-dot dot-a"/><span className="float-dot dot-b"/></div><b>Waiting for a response</b><p>Send a request to see status, headers and response data.</p><span className="empty-hint"><Command size={12}/> Press Enter in the URL field to send</span></div>}
      </section>
      </div></>}
      {currentPage === "collections" && <section className="screen-page">
        <div className="screen-toolbar"><div><span className="screen-kicker">YOUR LIBRARY</span><h2>Request collections</h2><p>{collections.length} collection{collections.length===1?"":"s"} · {collections.reduce((n,item)=>n+item.requests.length,0)} saved requests</p></div><button className="screen-primary" onClick={()=>setShowNew(true)}><Plus size={16}/> New collection</button></div>
        {collections.length===0?<div className="screen-empty"><Folder size={28}/><b>Your collection space is empty</b><p>Create a collection to organise and reuse API requests.</p><button className="screen-primary" onClick={()=>setShowNew(true)}><Plus size={15}/> Create first collection</button></div>:<div className="screen-card-grid">{collections.map(collection=><article className="screen-card" key={collection.id}><div className="screen-card-icon"><Folder size={19}/></div><div className="screen-card-content"><h3>{collection.name}</h3><p>{collection.requests.length} saved request{collection.requests.length===1?"":"s"} · Updated {new Date(collection.updatedAt).toLocaleDateString()}</p><div className="screen-card-actions"><button onClick={()=>{setActiveCollectionId(collection.id);setCollectionName(collection.name);navigateTo("workspace");}}>Open workspace</button><button onClick={()=>void exportCollectionById(collection.id)}>Export</button><button onClick={()=>void renameCollection(collection.id)}>Rename</button><button onClick={()=>void duplicateCollection(collection.id)}>Duplicate</button><button onClick={()=>void publishCollection(collection.id)}>Share</button><button className="danger" onClick={()=>void deleteCollection(collection.id)}>Delete</button></div></div></article>)}</div>}
        <div className="screen-bottom-note">Private by default. Public sharing is opt-in and sanitises sensitive values.</div>
      </section>}
      {currentPage === "environments" && <section className="screen-page">
        <div className="screen-toolbar"><div><span className="screen-kicker">VARIABLE MANAGER</span><h2>Environments</h2><p>Switch between development, staging and production settings.</p></div><button className="screen-primary" onClick={()=>{setEditingEnvironment(null);setShowEnvironmentModal(true);}}><Plus size={16}/> New environment</button></div>
        {environments.length===0?<div className="screen-empty"><Globe2 size={28}/><b>No environments configured</b><p>Add variables such as API_BASE_URL or API_TOKEN. Secret values stay masked in the editor.</p><button className="screen-primary" onClick={()=>{setEditingEnvironment(null);setShowEnvironmentModal(true);}}><Plus size={15}/> Create environment</button></div>:<div className="screen-card-grid">{environments.map(environment=><article className={activeEnvironmentId===environment.id?"screen-card active":"screen-card"} key={environment.id}><div className="screen-card-icon"><Globe2 size={19}/></div><div className="screen-card-content"><div className="screen-card-title"><h3>{environment.name}</h3>{activeEnvironmentId===environment.id&&<span className="active-pill">ACTIVE</span>}</div><p>{environment.variables.length} variable{environment.variables.length===1?"":"s"} · {environment.variables.filter(v=>v.enabled).length} enabled</p><div className="screen-card-actions"><button onClick={()=>void activateEnvironment(environment.id)}>Use environment</button><button onClick={()=>{setEditingEnvironment(environment);setShowEnvironmentModal(true);}}>Edit variables</button><button className="danger" onClick={()=>void deleteEnvironment(environment.id)}>Delete</button></div></div></article>)}</div>}
      </section>}
      {currentPage === "history" && <section className="screen-page">
        <div className="screen-toolbar"><div><span className="screen-kicker">ACTIVITY LOG</span><h2>Request history</h2><p>Recent requests are stored without request or response bodies.</p></div><button className="screen-secondary" onClick={()=>void clearRequestHistory()} disabled={!history.length}>Clear history</button></div>
        <div className="history-search"><input value={historyFilter} onChange={event=>setHistoryFilter(event.target.value)} placeholder="Search method, URL or status…" aria-label="Search request history"/><span>{history.filter(item=>(item.method+" "+item.url+" "+(item.status??"")).toLowerCase().includes(historyFilter.toLowerCase())).length} results</span></div>
        {history.filter(item=>(item.method+" "+item.url+" "+(item.status??"")).toLowerCase().includes(historyFilter.toLowerCase())).length===0?<div className="screen-empty"><History size={28}/><b>No matching requests</b><p>Send an API request and it will appear here.</p></div>:<div className="history-table">{history.filter(item=>(item.method+" "+item.url+" "+(item.status??"")).toLowerCase().includes(historyFilter.toLowerCase())).map(item=><button className="history-row" key={item.id} onClick={()=>{updateRequest({method:item.method,url:item.url});navigateTo("workspace");}}><span className="history-method">{item.method}</span><span className="history-url">{item.url}</span><span className="history-status">{item.status??"—"}</span><span className="history-time">{new Date(item.createdAt).toLocaleString()}</span><ChevronRight size={15}/></button>)}</div>}
      </section>}
      {currentPage === "tools" && <section className="screen-page">
        <div className="screen-toolbar"><div><span className="screen-kicker">DEVELOPER TOOLKIT</span><h2>Utilities</h2><p>Small, fast tools for inspecting and transforming API data.</p></div></div>
        <div className="tool-card-grid">{[["JSON formatter","Format and validate JSON","{}"],["JSON diff","Compare two JSON documents","⇄"],["XML formatter","Indent and inspect XML","</>"],["JWT inspector","Decode JWT header and payload","JWT"],["Base64 encode","Encode text to Base64","64"],["Base64 decode","Decode Base64 text","↙"],["URL encode","Encode URL components","%"],["URL decode","Decode URL components","↗"],["UUID generator","Generate random UUIDs","ID"],["cURL importer","Import a cURL command","$"],["cURL exporter","Export a request as cURL","⌘"]].map(([name,desc,mark])=><button className="tool-card" key={name} onClick={()=>setActiveUtility(name)}><span>{mark}</span><b>{name}</b><small>{desc}</small><ChevronRight size={15}/></button>)}</div>
      </section>}

      <footer className="footer"><span>DEVLENS <span>·</span> SEE YOUR APIS CLEARLY</span><span>Built for developers. Open source and privacy-first.</span><a href="https://github.com/theemeraldesign/devlens" target="_blank" rel="noreferrer">GitHub <ExternalLink size={12}/></a></footer>
    </main>

    {mobilePanel && <div className="mobile-panel" role="region" aria-label="Mobile workspace menu">
      <div className="mobile-panel-head"><b>{mobilePanel==="collections"?"Collections":mobilePanel==="environments"?"Environments":mobilePanel==="history"?"Request history":"Developer utilities"}</b><button onClick={()=>setMobilePanel(null)} aria-label="Close panel"><X size={16}/></button></div>
      {mobilePanel==="collections" && <><button className="mobile-panel-action" onClick={()=>{setShowNew(true);setMobilePanel(null);}}><Plus size={14}/> New collection</button>{collections.length ? collections.map(collection=><div className="mobile-panel-group" key={collection.id}><button className={activeCollectionId===collection.id?"mobile-panel-item active":"mobile-panel-item"} onClick={()=>{setActiveCollectionId(collection.id);setCollectionName(collection.name);}}><Folder size={14}/><span>{collection.name}</span><small>{collection.requests.length}</small></button>{collection.requests.map(saved=><button className="mobile-saved-request" key={saved.id} onClick={()=>{setRequest({method:saved.method as HttpMethod,url:saved.url,body:saved.body,bodyType:saved.bodyType ?? "json",headers:saved.headers.map(header=>({...header,id:uid()}))});setFormFiles([]);setResponse(null);setMobilePanel(null);}}><span>{saved.method}</span>{saved.name}</button>)}</div>) : <p className="mobile-panel-empty">No collections yet. Create one to save requests.</p>}</>}
      {mobilePanel==="environments" && <><button className="mobile-panel-action" onClick={()=>{setEditingEnvironment(null);setShowEnvironmentModal(true);setMobilePanel(null);}}><Plus size={14}/> New environment</button>{environments.length ? environments.map(environment=><div className="mobile-panel-group" key={environment.id}><button className={activeEnvironmentId===environment.id?"mobile-panel-item active":"mobile-panel-item"} onClick={()=>activateEnvironment(environment.id)}><Globe2 size={14}/><span>{environment.name}</span>{activeEnvironmentId===environment.id && <small>ACTIVE</small>}</button><button className="mobile-saved-request" onClick={()=>{setEditingEnvironment(environment);setShowEnvironmentModal(true);setMobilePanel(null);}}>Edit variables</button></div>) : <p className="mobile-panel-empty">No environments yet. Add one to use variables.</p>}</>}
      {mobilePanel==="history" && <>{history.length ? history.map(item=><button className="mobile-panel-item" key={item.id} onClick={()=>{updateRequest({method:item.method,url:item.url});setMobilePanel(null);}}><Clock3 size={14}/><span>{item.method} · {item.status ?? "—"} · {item.url}</span></button>) : <p className="mobile-panel-empty">Your recent requests will appear here.</p>}</>}
      {mobilePanel==="utilities" && <div className="mobile-utility-grid">{["JSON formatter","JSON diff","XML formatter","JWT inspector","Base64 encode","Base64 decode","URL encode","URL decode","UUID generator","cURL exporter"].map(tool=><button key={tool} onClick={()=>{setActiveUtility(tool);setMobilePanel(null);}}>{tool}</button>)}</div>}
    </div>}
    <nav className="mobile-nav" aria-label="Primary navigation">{(["workspace","collections","environments","history","tools"] as AppPage[]).map(page=><button key={page} className={currentPage===page?"active":""} onClick={()=>navigateTo(page)}>{page==="workspace"?<Activity size={18}/>:page==="collections"?<Folder size={18}/>:page==="environments"?<Globe2 size={18}/>:page==="history"?<History size={18}/>:<Braces size={18}/>}<span>{page==="workspace"?"Workspace":page==="tools"?"Tools":page==="history"?"History":page==="collections"?"Collections":"Environments"}</span></button>)}</nav>
    {showEnvironmentModal && <EnvironmentModal initial={editingEnvironment} onClose={() => setShowEnvironmentModal(false)} onSave={saveEnvironment} onDelete={deleteEnvironment} />}
    {activeUtility && <UtilityModal tool={activeUtility} onClose={() => setActiveUtility(null)} onImportRequest={loadImportedCurl} />}
    {showAuth && <AuthModal initialMode={window.location.search.includes("password-reset=1") ? "update" : "signin"} onClose={() => { setShowAuth(false); if (window.location.search.includes("password-reset=1")) window.history.replaceState({}, "", window.location.pathname); }} onAuthenticated={user => { setAccountEmail(user.email ?? null); setAccountId(user.id); if ((collections.some(item => !item.cloudOwnerId) || environments.some(item => !item.cloudOwnerId)) && hasUnimportedGuestData(user.id, collections, environments)) setShowImportPrompt(true); }} />}
    {showNew && <CollectionModal value={collectionName} onChange={setCollectionName} onClose={()=>setShowNew(false)} onCreate={createCollection} />}
    {dialogState && <div className="dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)resolveDialog(dialogState.kind==="confirm"?false:null);}}>
      <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
        <span className="dialog-mark">{dialogState.kind==="confirm"?"!":"✎"}</span>
        <h2 id="feedback-dialog-title">{dialogState.title}</h2><p>{dialogState.message}</p>
        {dialogState.kind==="prompt" && <input autoFocus value={dialogState.value} maxLength={120} onChange={event=>setDialogState(current=>current?{...current,value:event.target.value}:current)} onKeyDown={event=>{if(event.key==="Enter")resolveDialog(dialogState.value);if(event.key==="Escape")resolveDialog(null);}}/>}
        <div className="feedback-actions"><button className="dialog-cancel" onClick={()=>resolveDialog(dialogState.kind==="confirm"?false:null)}>Cancel</button><button className={dialogState.title==="Delete collection"?"dialog-danger":"dialog-primary"} onClick={()=>resolveDialog(dialogState.kind==="confirm"?true:dialogState.value)}>{dialogState.kind==="confirm"?(dialogState.title==="Delete collection"?"Delete":"Confirm"):"Save name"}</button></div>
      </section>
    </div>}
  </div>;
}
