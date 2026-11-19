import { useMemo, useState } from "react";
import { Activity, ArrowDown, Bookmark, Braces, ChevronDown, Clock3, Code2, Command, Copy, ExternalLink, FileJson, Folder, Globe2, History, Layers3, Moon, MoreHorizontal, Plus, Send, Settings2, ShieldCheck, Sun, X } from "lucide-react";
import { sendRequest, type ApiRequest, type ApiResponse, type HeaderPair, type HttpMethod } from "./lib/request";
import { readGuestCollections, writeGuestCollections, type LocalCollection } from "./lib/workspace";

const uid = () => crypto.randomUUID();
const starterHeaders: HeaderPair[] = [{ id: uid(), key: "Accept", value: "application/json", enabled: true }];
const initialRequest: ApiRequest = { method: "GET", url: "https://jsonplaceholder.typicode.com/posts/1", headers: starterHeaders, body: "" };
const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export default function App() {
  const [dark, setDark] = useState(true);
  const [request, setRequest] = useState(initialRequest);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"body" | "headers" | "params" | "auth">("headers");
  const [responseTab, setResponseTab] = useState<"pretty" | "raw" | "headers">("pretty");
  const [activeNav, setActiveNav] = useState("Collections");
  const [collections, setCollections] = useState<LocalCollection[]>(() => readGuestCollections());
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(() => readGuestCollections()[0]?.id ?? null);
  const [collectionName, setCollectionName] = useState(() => readGuestCollections()[0]?.name ?? "My workspace");
  const [history, setHistory] = useState<string[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [params, setParams] = useState([{ id: uid(), key: "", value: "", enabled: true }]);
  const [authType, setAuthType] = useState("No authentication");

  const prettyBody = useMemo(() => {
    if (!response?.body) return "";
    try { return JSON.stringify(JSON.parse(response.body), null, 2); } catch { return response.body; }
  }, [response]);

  const updateRequest = (patch: Partial<ApiRequest>) => setRequest(current => ({ ...current, ...patch }));
  function createCollection() {
    const name = collectionName.trim();
    if (!name) return;
    const collection: LocalCollection = { id: uid(), name, requests: [], updatedAt: new Date().toISOString() };
    const next = [collection, ...collections];
    setCollections(next);
    writeGuestCollections(next);
    setActiveCollectionId(collection.id);
    setShowNew(false);
  }
  function saveRequest() {
    const current = collections.find(item => item.id === activeCollectionId);
    const target = current ?? { id: uid(), name: "My requests", requests: [], updatedAt: new Date().toISOString() };
    const saved = { id: uid(), name: "Untitled request", method: request.method, url: request.url, headers: request.headers.map(({key,value,enabled}) => ({key,value,enabled})), body: request.body, createdAt: new Date().toISOString() };
    const next = current
      ? collections.map(item => item.id === current.id ? { ...item, requests: [saved, ...item.requests], updatedAt: new Date().toISOString() } : item)
      : [ { ...target, requests: [saved] }, ...collections ];
    setCollections(next);
    writeGuestCollections(next);
    setActiveCollectionId(target.id);
  }
  const updateHeader = (id: string, patch: Partial<HeaderPair>) => updateRequest({ headers: request.headers.map(h => h.id === id ? { ...h, ...patch } : h) });

  async function run() {
    setBusy(true); setError(""); setResponse(null);
    try {
      const finalUrl = new URL(request.url);
      params.filter(p => p.enabled && p.key.trim()).forEach(p => finalUrl.searchParams.set(p.key, p.value));
      const result = await sendRequest({ ...request, url: finalUrl.toString() });
      setResponse(result);
      setHistory(items => [request.url, ...items.filter(x => x !== request.url)].slice(0, 12));
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed."); }
    finally { setBusy(false); }
  }

  return <div className={dark ? "app dark" : "app light"}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={18} strokeWidth={2.4}/></div><span>dev<span className="brand-accent">lens</span></span><span className="beta">BETA</span></div>
      <button className="workspace-switch"><div className="workspace-avatar">M</div><span><b>{collectionName}</b><small>Personal workspace</small></span><ChevronDown size={15}/></button>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav">
        {[["Collections",Folder],["Environments",Globe2],["History",History]].map(([name,Icon]) => <button key={name as string} className={activeNav===name ? "active" : ""} onClick={() => setActiveNav(name as string)}><Icon size={17}/>{name as string}{name==="Collections" && <span className="nav-count">{collections.length}</span>}</button>)}
      </nav>
      {activeNav === "History" && <div className="tool-subnav">{history.length ? history.map((url,index)=><button key={url+index} onClick={()=>updateRequest({url})}>{url}</button>) : <button disabled>No requests yet</button>}</div>}
      <div className="side-divider"/>
      <div className="side-label">DEVELOPER TOOLS</div>
      <nav className="side-nav">
        <button className={showTools ? "active" : ""} onClick={() => setShowTools(v=>!v)}><Braces size={17}/>Utilities<ChevronDown size={14} className="nav-chevron"/></button>
        {showTools && <div className="tool-subnav"><button>JSON formatter</button><button>JSON diff</button><button>JWT inspector</button><button>Base64 tools</button><button>cURL converter</button></div>}
      </nav>
      <div className="sidebar-bottom">
        <div className="secure-note"><ShieldCheck size={16}/><span><b>Private by design</b><small>Secrets stay in your workspace.</small></span></div>
        <button className="profile-row"><div className="profile-avatar">G</div><span><b>Guest workspace</b><small>Local session</small></span><MoreHorizontal size={17}/></button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{activeNav}</b></div><div className="top-actions"><span className="connection"><i/> All systems operational</span><button className="icon-button" title="Settings"><Settings2 size={17}/></button><button className="icon-button" title="Toggle theme" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button className="upgrade-button" onClick={()=>setShowNew(true)}><Plus size={15}/> New collection</button></div></header>

      <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> API WORKSPACE <span className="eyebrow-line"/></div><h1>Request studio<span>.</span></h1><p>Build, send and inspect HTTP requests with clarity.</p></div><div className="heading-meta"><span className="live-dot"/> Guest mode <span className="meta-divider"/> <kbd>⌘</kbd><kbd>K</kbd></div></section>

      <section className="request-card">
        <div className="request-card-top"><div className="request-title"><div className="request-icon"><Code2 size={17}/></div><div><b>Untitled request</b><small>REST API · HTTP</small></div><span className="unsaved">UNSAVED</span></div><div className="request-actions"><button className="icon-button" title="Save request to this device" onClick={saveRequest}><Bookmark size={16}/></button><button className="icon-button" title="More"><MoreHorizontal size={17}/></button></div></div>
        <div className="url-row"><select value={request.method} onChange={e=>updateRequest({method:e.target.value as HttpMethod})}>{methods.map(m=><option key={m}>{m}</option>)}</select><input className="url-input" value={request.url} onChange={e=>updateRequest({url:e.target.value})} onKeyDown={e=>e.key==="Enter"&&run()} aria-label="Request URL" placeholder="Enter request URL"/><button className="send-button" onClick={run} disabled={busy}><Send size={15}/>{busy?"Sending":"Send"}<span>↵</span></button></div>
        <div className="editor-tabs">{(["params","headers","body","auth"] as const).map(t=><button key={t} className={tab===t?"selected":""} onClick={()=>setTab(t)}>{t==="params"?"Params":t==="headers"?"Headers":t==="body"?"Body":"Auth"}{t==="headers"&&<span className="tab-count">{request.headers.length}</span>}</button>)}</div>
        <div className="editor-panel">
          {tab==="headers" && <><div className="panel-caption"><span>HEADER</span><span>VALUE</span><span> </span></div>{request.headers.map(h=><div className="key-value-row" key={h.id}><input type="checkbox" checked={h.enabled} onChange={e=>updateHeader(h.id,{enabled:e.target.checked})}/><input value={h.key} placeholder="Header name" onChange={e=>updateHeader(h.id,{key:e.target.value})}/><input value={h.value} placeholder="Value" onChange={e=>updateHeader(h.id,{value:e.target.value})}/><button className="row-icon" onClick={()=>updateRequest({headers:request.headers.filter(x=>x.id!==h.id)})}><X size={14}/></button></div>)}<button className="add-row" onClick={()=>updateRequest({headers:[...request.headers,{id:uid(),key:"",value:"",enabled:true}]})}><Plus size={14}/> Add header</button></>}
          {tab==="params" && <><div className="panel-caption"><span>PARAMETER</span><span>VALUE</span><span> </span></div>{params.map(p=><div className="key-value-row" key={p.id}><input type="checkbox" checked={p.enabled} onChange={e=>setParams(items=>items.map(x=>x.id===p.id?{...x,enabled:e.target.checked}:x))}/><input value={p.key} placeholder="Parameter" onChange={e=>setParams(items=>items.map(x=>x.id===p.id?{...x,key:e.target.value}:x))}/><input value={p.value} placeholder="Value" onChange={e=>setParams(items=>items.map(x=>x.id===p.id?{...x,value:e.target.value}:x))}/><button className="row-icon" onClick={()=>setParams(items=>items.filter(x=>x.id!==p.id))}><X size={14}/></button></div>)}<button className="add-row" onClick={()=>setParams(items=>[...items,{id:uid(),key:"",value:"",enabled:true}])}><Plus size={14}/> Add parameter</button></>}
          {tab==="body" && <div className="body-editor"><div className="body-toolbar"><span>JSON</span><span>application/json <ChevronDown size={13}/></span></div><textarea value={request.body} onChange={e=>updateRequest({body:e.target.value})} placeholder={'{\n  "name": "DevLens",\n  "status": "building"\n}'} spellCheck={false}/></div>}
          {tab==="auth" && <div className="auth-panel"><label>AUTHENTICATION TYPE</label><select value={authType} onChange={e=>setAuthType(e.target.value)}><option>No authentication</option><option>Bearer token</option><option>Basic auth</option><option>API key</option></select><p>Credentials are sent only with this request. They are never included in public collection exports.</p></div>}
        </div>
      </section>

      <section className="response-card">
        <div className="response-head"><div className="response-title"><div className="response-icon"><ArrowDown size={16}/></div><div><b>Response</b><small>{response?"Latest request result":"Your response will appear here"}</small></div></div>{response && <div className="response-stats"><span className={response.status<400?"status-good":"status-bad"}><i/>{response.status} {response.statusText}</span><span><Clock3 size={13}/>{response.duration} ms</span><span><Layers3 size={13}/>{(response.size/1024).toFixed(2)} KB</span></div>}</div>
        {error && <div className="error-banner">{error}</div>}
        {response ? <><div className="response-tabs">{(["pretty","raw","headers"] as const).map(t=><button className={responseTab===t?"selected":""} onClick={()=>setResponseTab(t)} key={t}>{t==="pretty"?"Pretty":t==="raw"?"Raw":"Headers"}</button>)}<button className="copy-response" onClick={()=>navigator.clipboard.writeText(responseTab==="headers"?JSON.stringify(response.headers,null,2):responseTab==="raw"?response.body:prettyBody)}><Copy size={13}/> Copy</button></div><pre className="response-code">{responseTab==="headers"?JSON.stringify(response.headers,null,2):responseTab==="raw"?response.body:prettyBody}</pre></> : <div className="response-empty"><div className="empty-art"><div className="empty-ring ring-one"/><div className="empty-ring ring-two"/><div className="empty-center"><FileJson size={23}/></div><span className="float-dot dot-a"/><span className="float-dot dot-b"/></div><b>Waiting for a response</b><p>Send a request to see status, headers and response data.</p><span className="empty-hint"><Command size={12}/> Press Enter in the URL field to send</span></div>}
      </section>
      <footer className="footer"><span>DEVLENS <span>·</span> EARLY ACCESS</span><span>Made for developers who care about the details.</span><a href="https://github.com/theemeraldesign/devlens" target="_blank" rel="noreferrer">Open source <ExternalLink size={12}/></a></footer>
    </main>
    {showNew && <div className="modal-backdrop" onClick={()=>setShowNew(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-title"><b>Create a collection</b><button onClick={()=>setShowNew(false)}><X size={16}/></button></div><p>Give your requests a home.</p><input value={collectionName} onChange={e=>setCollectionName(e.target.value)} placeholder="Collection name"/><button className="send-button modal-submit" onClick={createCollection}>Create collection</button></div></div>}
  </div>;
}
