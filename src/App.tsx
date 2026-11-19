import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, Bookmark, Braces, ChevronDown, Clock3, Code2, Command, Copy, ExternalLink, FileJson, Folder, Globe2, History, Layers3, Moon, MoreHorizontal, Plus, Send, ShieldCheck, Sun, X } from "lucide-react";
import { sendRequest, type ApiRequest, type ApiResponse, type HeaderPair, type HttpMethod } from "./lib/request";
import { readGuestCollections, writeGuestCollections, type LocalCollection } from "./lib/workspace";
import { readActiveEnvironmentId, readGuestEnvironments, resolveEnvironmentVariables, writeActiveEnvironmentId, writeGuestEnvironments, type LocalEnvironment } from "./lib/environments";
import { redactUrl, safeSavedHeaders } from "./lib/utilities";
import { readRequestHistory, writeRequestHistory, type RequestHistoryItem } from "./lib/history";
import { supabase } from "./lib/supabase";
import AuthModal from "./components/AuthModal";
import UtilityModal from "./components/UtilityModal";
import EnvironmentModal from "./components/EnvironmentModal";
import CollectionModal from "./components/CollectionModal";

const uid = () => crypto.randomUUID();
const starterHeaders: HeaderPair[] = [{ id: uid(), key: "Accept", value: "application/json", enabled: true }];
const initialRequest: ApiRequest = { method: "GET", url: "https://jsonplaceholder.typicode.com/posts/1", headers: starterHeaders, body: "" };
const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const workspaceNav = [{ name: "Collections", icon: Folder }, { name: "Environments", icon: Globe2 }, { name: "History", icon: History }] as const;
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

export default function App() {
  const [dark, setDark] = useState(true);
  const [request, setRequest] = useState(initialRequest);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"body" | "headers" | "params" | "auth">("headers");
  const [responseTab, setResponseTab] = useState<"pretty" | "raw" | "headers">("pretty");
  const [activeNav, setActiveNav] = useState("Collections");
  const [collections, setCollections] = useState<LocalCollection[]>(() => readGuestCollections());
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(() => readGuestCollections()[0]?.id ?? null);
  const [collectionName, setCollectionName] = useState(() => readGuestCollections()[0]?.name ?? "My workspace");
  const [environments, setEnvironments] = useState<LocalEnvironment[]>(() => readGuestEnvironments());
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(() => readActiveEnvironmentId(readGuestEnvironments()));
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [editingEnvironment, setEditingEnvironment] = useState<LocalEnvironment | null>(null);
  const [history, setHistory] = useState<RequestHistoryItem[]>(() => readRequestHistory());
  const [showTools, setShowTools] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"collections" | "environments" | "history" | "utilities" | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [activeUtility, setActiveUtility] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  const [params, setParams] = useState([{ id: uid(), key: "", value: "", enabled: true }]);
  const [authType, setAuthType] = useState("No authentication");
  const [authToken, setAuthToken] = useState("");
  const [basicUsername, setBasicUsername] = useState("");
  const [basicPassword, setBasicPassword] = useState("");
  const [apiKeyName, setApiKeyName] = useState("x-api-key");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyLocation, setApiKeyLocation] = useState<"Header" | "Query">("Header");

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
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setAccountEmail(user?.email ?? null);
      setAccountId(user?.id ?? null);
      if (user) { void syncCloudCollections(user.id); void syncCloudEnvironments(user.id); void syncCloudHistory(user.id); if ((collections.some(item => !item.cloudOwnerId) || environments.some(item => !item.cloudOwnerId)) && hasUnimportedGuestData(user.id, collections, environments)) setShowImportPrompt(true); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountEmail(session?.user.email ?? null);
      setAccountId(session?.user.id ?? null);
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
    return () => subscription.unsubscribe();
  }, []);

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
    try { return JSON.stringify(JSON.parse(response.body), null, 2); } catch { return response.body; }
  }, [response]);

  const updateRequest = (patch: Partial<ApiRequest>) => setRequest(current => ({ ...current, ...patch }));
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
      const importedRequests = rows.map((item, index) => {
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
          method, url: redactUrl(row.url), headers: safeSavedHeaders(headers), body: typeof row.body === "string" ? row.body.slice(0, 1024 * 1024) : "",
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
    const saved = { id: uid(), name: "Untitled request", method: request.method, url: redactUrl(request.url), headers: safeSavedHeaders(request.headers), body: request.body, createdAt: new Date().toISOString() };
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
      if (authType === "Bearer token" && authToken) outgoingHeaders.push({ id: uid(), key: "Authorization", value: "Bearer " + resolve(authToken), enabled: true });
      if (authType === "Basic auth" && basicUsername) outgoingHeaders.push({ id: uid(), key: "Authorization", value: "Basic " + btoa(resolve(basicUsername) + ":" + resolve(basicPassword)), enabled: true });
      if (authType === "API key" && apiKeyName && apiKeyValue) {
        if (apiKeyLocation === "Header") outgoingHeaders.push({ id: uid(), key: resolve(apiKeyName), value: resolve(apiKeyValue), enabled: true });
        else finalUrl.searchParams.set(resolve(apiKeyName), resolve(apiKeyValue));
      }
      const result = await sendRequest({ ...request, headers: outgoingHeaders, url: finalUrl.toString(), body: resolve(request.body) }, controller.signal);
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

  return <div className={dark ? "app dark" : "app light"}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={18} strokeWidth={2.4}/></div><span>dev<span className="brand-accent">lens</span></span><span className="beta">BETA</span></div>
      <div className="workspace-switch"><div className="workspace-avatar">{collectionName.slice(0,1).toUpperCase() || "D"}</div><span><b>{collectionName}</b><small>{accountEmail ? "Synced account workspace" : "Local guest workspace"}</small></span></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Primary workspace navigation">
        {workspaceNav.map(({name, icon: Icon}) => <button key={name as string} className={activeNav===name ? "active" : ""} onClick={() => setActiveNav(name as string)}><Icon size={17}/>{name as string}{name==="Collections" && <span className="nav-count">{collections.length}</span>}</button>)}
      </nav>
      {activeNav === "Collections" && <div className="collection-list">{collections.length ? collections.map(collection=><div className="collection-group" key={collection.id}><button className={activeCollectionId===collection.id?"collection-choice active":"collection-choice"} onClick={()=>{setActiveCollectionId(collection.id);setCollectionName(collection.name);}}><Folder size={13}/><span>{collection.name}</span><small>{collection.requests.length}</small></button>{collection.requests.map(saved=><button className="saved-request-choice" key={saved.id} onClick={()=>{setRequest({method:saved.method as HttpMethod,url:saved.url,body:saved.body,headers:saved.headers.map(header=>({...header,id:uid()}))});setResponse(null);}}><span className="saved-method">{saved.method}</span><span>{saved.name}</span></button>)}</div>) : <div className="collection-empty">No collections yet. Create one to save requests.</div>}</div>}
      {activeNav === "Collections" && <div className="collection-actions"><button onClick={exportActiveCollection} disabled={!activeCollectionId}>Export selected</button><label>Import JSON<input type="file" accept=".json,application/json" onChange={event => { void importCollectionFile(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label></div>}
      {activeNav === "Environments" && <div className="collection-list"><button className="environment-new" onClick={()=>{setEditingEnvironment(null);setShowEnvironmentModal(true);}}><Plus size={13}/> New environment</button>{environments.length ? environments.map(environment=><div className="collection-group" key={environment.id}><button className={activeEnvironmentId===environment.id?"collection-choice active":"collection-choice"} onClick={()=>activateEnvironment(environment.id)}><Globe2 size={13}/><span>{environment.name}</span>{activeEnvironmentId===environment.id && <small>ACTIVE</small>}</button><button className="saved-request-choice" onClick={()=>{setEditingEnvironment(environment);setShowEnvironmentModal(true);}}>Edit variables</button></div>) : <div className="collection-empty">No environments yet. Add one to use variables.</div>}</div>}
      {activeNav === "History" && <div className="tool-subnav">{history.length ? history.map(item=><button key={item.id} onClick={()=>updateRequest({method:item.method,url:item.url})}><span className="saved-method">{item.method}</span>{item.status ?? "—"} · {item.url}</button>) : <button disabled>No requests yet</button>}</div>}
      <div className="side-divider"/>
      <div className="side-label">DEVELOPER TOOLS</div>
      <nav className="side-nav">
        <button className={showTools ? "active" : ""} onClick={() => setShowTools(v=>!v)}><Braces size={17}/>Utilities<ChevronDown size={14} className="nav-chevron"/></button>
        {showTools && <div className="tool-subnav">{["JSON formatter","JSON diff","JWT inspector","Base64 encode","Base64 decode","URL encode","URL decode","UUID generator","cURL exporter"].map(tool=><button key={tool} onClick={()=>setActiveUtility(tool)}>{tool}</button>)}</div>}
      </nav>
      <div className="sidebar-bottom">
        <div className="secure-note"><ShieldCheck size={16}/><span><b>Private by design</b><small>Secrets stay in your workspace.</small></span></div>
        <button className="profile-row" onClick={() => accountId ? signOut() : setShowAuth(true)}><div className="profile-avatar">{accountEmail ? accountEmail.slice(0,1).toUpperCase() : "G"}</div><span><b>{accountEmail ?? "Guest workspace"}</b><small>{accountEmail ? "Click to sign out" : "Local session · Sign in"}</small></span><MoreHorizontal size={17}/></button>
      </div>
    </aside>

    <main className="main" id="request-workspace">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{activeNav}</b></div><div className="top-actions"><span className="connection"><i/> Workspace ready</span><button className="icon-button" title="Toggle theme" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button className="upgrade-button" onClick={()=>setShowNew(true)}><Plus size={15}/> New collection</button></div></header>

      <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> API WORKSPACE <span className="eyebrow-line"/></div><h1>Request studio<span>.</span></h1><p>Build, send and inspect HTTP requests with clarity.</p></div><div className="heading-meta"><span className="live-dot"/> {accountEmail ? "Account" : "Guest mode"} <span className="meta-divider"/> {activeEnvironment?.name ?? "No environment"}</div></section>
      {showImportPrompt && <div className="import-banner"><div><b>Guest workspace data found</b><span>Import {collections.filter(item => !item.cloudOwnerId).length} collection(s) and {environments.filter(item => !item.cloudOwnerId).length} environment(s) into your account. Local copies will stay on this device.</span></div><button onClick={importGuestData}>Import guest data</button><button className="dismiss-import" onClick={() => setShowImportPrompt(false)} aria-label="Dismiss"><X size={14}/></button></div>}
      {accountNotice && <div className="import-banner"><span>{accountNotice}</span><button className="dismiss-import" onClick={() => setAccountNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}

      <div className="workspace-grid">
      <section className="request-card">
        <div className="request-card-top"><div className="request-title"><div className="request-icon"><Code2 size={17}/></div><div><b>Untitled request</b><small>REST API · HTTP</small></div><span className="unsaved">UNSAVED</span></div><div className="request-actions"><button className="icon-button" title="Save request to this device" onClick={saveRequest}><Bookmark size={16}/></button><button className="icon-button" title="Resend request" onClick={run}><Send size={15}/></button></div></div>
        <div className="url-row"><label className="sr-only" htmlFor="request-method">HTTP method</label><select id="request-method" value={request.method} onChange={e=>updateRequest({method:e.target.value as HttpMethod})}>{methods.map(m=><option key={m}>{m}</option>)}</select><label className="sr-only" htmlFor="request-url">Request URL</label><input id="request-url" className="url-input" value={request.url} onChange={e=>updateRequest({url:e.target.value})} onKeyDown={e=>e.key==="Enter"&&run()} aria-label="Request URL" placeholder="Enter request URL"/><button className="send-button" onClick={busy?cancelRequest:run}><Send size={15}/>{busy?"Cancel":"Send"}<span>↵</span></button></div>
        <div className="editor-tabs">{(["params","headers","body","auth"] as const).map(t=><button key={t} className={tab===t?"selected":""} onClick={()=>setTab(t)}>{t==="params"?"Params":t==="headers"?"Headers":t==="body"?"Body":"Auth"}{t==="headers"&&<span className="tab-count">{request.headers.length}</span>}</button>)}</div>
        <div className="editor-panel">
          {tab==="headers" && <><div className="panel-caption"><span>HEADER</span><span>VALUE</span><span> </span></div>{request.headers.map(h=><div className="key-value-row" key={h.id}><label className="sr-only" htmlFor={`header-enabled-${h.id}`}>Enable header</label><input id={`header-enabled-${h.id}`} type="checkbox" checked={h.enabled} onChange={e=>updateHeader(h.id,{enabled:e.target.checked})}/><label className="sr-only" htmlFor={`header-key-${h.id}`}>Header name</label><input id={`header-key-${h.id}`} value={h.key} placeholder="Header name" onChange={e=>updateHeader(h.id,{key:e.target.value})}/><label className="sr-only" htmlFor={`header-value-${h.id}`}>Header value</label><input id={`header-value-${h.id}`} value={h.value} placeholder="Value" onChange={e=>updateHeader(h.id,{value:e.target.value})}/><button className="row-icon" aria-label={`Remove header ${h.key || "row"}`} onClick={()=>updateRequest({headers:request.headers.filter(x=>x.id!==h.id)})}><X size={14}/></button></div>)}<button className="add-row" onClick={()=>updateRequest({headers:[...request.headers,{id:uid(),key:"",value:"",enabled:true}]})}><Plus size={14}/> Add header</button></>}
          {tab==="params" && <><div className="panel-caption"><span>PARAMETER</span><span>VALUE</span><span> </span></div>{params.map(p=><div className="key-value-row" key={p.id}><label className="sr-only" htmlFor={`param-enabled-${p.id}`}>Enable parameter</label><input id={`param-enabled-${p.id}`} type="checkbox" checked={p.enabled} onChange={e=>setParams(items=>items.map(x=>x.id===p.id?{...x,enabled:e.target.checked}:x))}/><label className="sr-only" htmlFor={`param-key-${p.id}`}>Parameter name</label><input id={`param-key-${p.id}`} value={p.key} placeholder="Parameter" onChange={e=>setParams(items=>items.map(x=>x.id===p.id?{...x,key:e.target.value}:x))}/><label className="sr-only" htmlFor={`param-value-${p.id}`}>Parameter value</label><input id={`param-value-${p.id}`} value={p.value} placeholder="Value" onChange={e=>setParams(items=>items.map(x=>x.id===p.id?{...x,value:e.target.value}:x))}/><button className="row-icon" aria-label={`Remove parameter ${p.key || "row"}`} onClick={()=>setParams(items=>items.filter(x=>x.id!==p.id))}><X size={14}/></button></div>)}<button className="add-row" onClick={()=>setParams(items=>[...items,{id:uid(),key:"",value:"",enabled:true}])}><Plus size={14}/> Add parameter</button></>}
          {tab==="body" && <div className="body-editor"><label className="sr-only" htmlFor="request-body">Request body</label><div className="body-toolbar"><span>JSON</span><span>application/json <ChevronDown size={13}/></span></div><textarea id="request-body" value={request.body} onChange={e=>updateRequest({body:e.target.value})} placeholder={'{\n  "name": "DevLens",\n  "status": "building"\n}'} spellCheck={false}/></div>}
          {tab==="auth" && <div className="auth-panel"><label htmlFor="auth-type">AUTHENTICATION TYPE</label><select id="auth-type" value={authType} onChange={e=>setAuthType(e.target.value)}><option>No authentication</option><option>Bearer token</option><option>Basic auth</option><option>API key</option></select>{authType==="Bearer token" && <><label className="sr-only" htmlFor="auth-bearer-token">Bearer token</label><input id="auth-bearer-token" className="auth-value" type="password" value={authToken} onChange={e=>setAuthToken(e.target.value)} placeholder="Bearer token"/></>}{authType==="Basic auth" && <><label className="sr-only" htmlFor="auth-basic-username">Basic auth username</label><input id="auth-basic-username" className="auth-value" value={basicUsername} onChange={e=>setBasicUsername(e.target.value)} placeholder="Username"/><label className="sr-only" htmlFor="auth-basic-password">Basic auth password</label><input id="auth-basic-password" className="auth-value" type="password" value={basicPassword} onChange={e=>setBasicPassword(e.target.value)} placeholder="Password"/></>}{authType==="API key" && <><label className="sr-only" htmlFor="auth-api-key-name">API key name</label><input id="auth-api-key-name" className="auth-value" value={apiKeyName} onChange={e=>setApiKeyName(e.target.value)} placeholder="Key name"/><label className="sr-only" htmlFor="auth-api-key-value">API key value</label><input id="auth-api-key-value" className="auth-value" type="password" value={apiKeyValue} onChange={e=>setApiKeyValue(e.target.value)} placeholder="API key value"/><label className="sr-only" htmlFor="auth-api-key-location">API key location</label><select id="auth-api-key-location" className="auth-location" value={apiKeyLocation} onChange={e=>setApiKeyLocation(e.target.value as "Header" | "Query")}><option>Header</option><option>Query</option></select></>}<p>Credentials are sent with this request only. They are not saved with guest collections or included in public collection exports.</p></div>}
        </div>
      </section>

      <section className="response-card">
        <div className="response-head"><div className="response-title"><div className="response-icon"><ArrowDown size={16}/></div><div><b>Response</b><small>{response?"Latest request result":"Your response will appear here"}</small></div></div>{response && <div className="response-stats"><span className={response.status<400?"status-good":"status-bad"}><i/>{response.status} {response.statusText}</span><span><Clock3 size={13}/>{response.duration} ms</span><span><Layers3 size={13}/>{(response.size/1024).toFixed(2)} KB</span></div>}</div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {response ? <><div className="response-tabs">{(["pretty","raw","headers"] as const).map(t=><button className={responseTab===t?"selected":""} onClick={()=>setResponseTab(t)} key={t}>{t==="pretty"?"Pretty":t==="raw"?"Raw":"Headers"}</button>)}<button className="copy-response" onClick={()=>navigator.clipboard.writeText(responseTab==="headers"?JSON.stringify(response.headers,null,2):responseTab==="raw"?response.body:prettyBody)}><Copy size={13}/> Copy</button></div><pre className="response-code">{responseTab==="headers"?JSON.stringify(response.headers,null,2):responseTab==="raw"?response.body:prettyBody}</pre></> : <div className="response-empty"><div className="empty-art"><div className="empty-ring ring-one"/><div className="empty-ring ring-two"/><div className="empty-center"><FileJson size={23}/></div><span className="float-dot dot-a"/><span className="float-dot dot-b"/></div><b>Waiting for a response</b><p>Send a request to see status, headers and response data.</p><span className="empty-hint"><Command size={12}/> Press Enter in the URL field to send</span></div>}
      </section>
      </div>
      <footer className="footer"><span>DEVLENS <span>·</span> EARLY ACCESS</span><span>Made for developers who care about the details.</span><a href="https://github.com/theemeraldesign/devlens" target="_blank" rel="noreferrer">Open source <ExternalLink size={12}/></a></footer>
    </main>

    {mobilePanel && <div className="mobile-panel">
      <div className="mobile-panel-head"><b>{mobilePanel==="collections"?"Collections":mobilePanel==="environments"?"Environments":mobilePanel==="history"?"Request history":"Developer utilities"}</b><button onClick={()=>setMobilePanel(null)} aria-label="Close panel"><X size={16}/></button></div>
      {mobilePanel==="collections" && <><button className="mobile-panel-action" onClick={()=>{setShowNew(true);setMobilePanel(null);}}><Plus size={14}/> New collection</button>{collections.length ? collections.map(collection=><div className="mobile-panel-group" key={collection.id}><button className={activeCollectionId===collection.id?"mobile-panel-item active":"mobile-panel-item"} onClick={()=>{setActiveCollectionId(collection.id);setCollectionName(collection.name);}}><Folder size={14}/><span>{collection.name}</span><small>{collection.requests.length}</small></button>{collection.requests.map(saved=><button className="mobile-saved-request" key={saved.id} onClick={()=>{setRequest({method:saved.method as HttpMethod,url:saved.url,body:saved.body,headers:saved.headers.map(header=>({...header,id:uid()}))});setResponse(null);setMobilePanel(null);}}><span>{saved.method}</span>{saved.name}</button>)}</div>) : <p className="mobile-panel-empty">No collections yet. Create one to save requests.</p>}</>}
      {mobilePanel==="environments" && <><button className="mobile-panel-action" onClick={()=>{setEditingEnvironment(null);setShowEnvironmentModal(true);setMobilePanel(null);}}><Plus size={14}/> New environment</button>{environments.length ? environments.map(environment=><div className="mobile-panel-group" key={environment.id}><button className={activeEnvironmentId===environment.id?"mobile-panel-item active":"mobile-panel-item"} onClick={()=>activateEnvironment(environment.id)}><Globe2 size={14}/><span>{environment.name}</span>{activeEnvironmentId===environment.id && <small>ACTIVE</small>}</button><button className="mobile-saved-request" onClick={()=>{setEditingEnvironment(environment);setShowEnvironmentModal(true);setMobilePanel(null);}}>Edit variables</button></div>) : <p className="mobile-panel-empty">No environments yet. Add one to use variables.</p>}</>}
      {mobilePanel==="history" && <>{history.length ? history.map(item=><button className="mobile-panel-item" key={item.id} onClick={()=>{updateRequest({method:item.method,url:item.url});setMobilePanel(null);}}><Clock3 size={14}/><span>{item.method} · {item.status ?? "—"} · {item.url}</span></button>) : <p className="mobile-panel-empty">Your recent requests will appear here.</p>}</>}
      {mobilePanel==="utilities" && <div className="mobile-utility-grid">{["JSON formatter","JSON diff","JWT inspector","Base64 encode","Base64 decode","URL encode","URL decode","UUID generator","cURL exporter"].map(tool=><button key={tool} onClick={()=>{setActiveUtility(tool);setMobilePanel(null);}}>{tool}</button>)}</div>}
    </div>}
    <nav className="mobile-nav" aria-label="Workspace navigation">
      <button className={!mobilePanel?"active":""} onClick={()=>{setActiveNav("Collections");setMobilePanel(null);}}><Activity size={18}/><span>Workspace</span></button>
      <button className={mobilePanel==="collections"?"active":""} onClick={()=>{setActiveNav("Collections");setMobilePanel(mobilePanel==="collections"?null:"collections");}}><Folder size={18}/><span>Collections</span></button>
      <button className={mobilePanel==="environments"?"active":""} onClick={()=>{setActiveNav("Environments");setMobilePanel(mobilePanel==="environments"?null:"environments");}}><Globe2 size={18}/><span>Environments</span></button>
      <button className={mobilePanel==="history"?"active":""} onClick={()=>{setActiveNav("History");setMobilePanel(mobilePanel==="history"?null:"history");}}><History size={18}/><span>History</span></button>
      <button className={mobilePanel==="utilities"?"active":""} onClick={()=>{setActiveNav("Utilities");setMobilePanel(mobilePanel==="utilities"?null:"utilities");}}><Braces size={18}/><span>Tools</span></button>
    </nav>
    {showEnvironmentModal && <EnvironmentModal initial={editingEnvironment} onClose={() => setShowEnvironmentModal(false)} onSave={saveEnvironment} onDelete={deleteEnvironment} />}
    {activeUtility && <UtilityModal tool={activeUtility} onClose={() => setActiveUtility(null)} />}
    {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuthenticated={user => { setAccountEmail(user.email ?? null); setAccountId(user.id); if ((collections.some(item => !item.cloudOwnerId) || environments.some(item => !item.cloudOwnerId)) && !hasImportedGuestData(user.id)) setShowImportPrompt(true); }} />}
    {showNew && <CollectionModal value={collectionName} onChange={setCollectionName} onClose={()=>setShowNew(false)} onCreate={createCollection} />}
  </div>;
}
