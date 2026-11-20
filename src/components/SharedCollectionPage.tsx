import { useEffect, useState } from "react";
import { HiOutlineArrowLeft as ArrowLeft, HiOutlineArrowDownTray as Download, HiOutlineGlobeAlt as Globe2, HiOutlineArrowPath as LoaderCircle } from "react-icons/hi2";
import { supabase } from "../lib/supabase";

type PublicRequest = {
  id?: string;
  name?: string;
  method?: string;
  url?: string;
  headers?: Array<{ key?: string; value?: string; enabled?: boolean }>;
  body?: string;
  bodyType?: string;
};

type Props = {
  slug: string;
  onImport: (title: string, requests: PublicRequest[]) => void;
};

export default function SharedCollectionPage({ slug, onImport }: Props) {
  const [title, setTitle] = useState("Shared collection");
  const [requests, setRequests] = useState<PublicRequest[]>([]);
  const [publishedAt, setPublishedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) { setError("The public collection service is unavailable."); setLoading(false); return; }
      const { data, error: queryError } = await supabase.from("public_collections")
        .select("slug,title,snapshot,published_at").eq("slug", slug).maybeSingle();
      if (!active) return;
      if (queryError || !data) {
        setError("This collection does not exist or is no longer public.");
        setLoading(false);
        return;
      }
      const snapshot = data.snapshot as { requests?: unknown[] } | null;
      const rows = Array.isArray(snapshot?.requests) ? snapshot.requests : [];
      setTitle(data.title);
      setRequests(rows.filter((item): item is PublicRequest => Boolean(item && typeof item === "object")));
      setPublishedAt(data.published_at);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [slug]);

  return <main className="shared-page">
    <header className="shared-topbar">
      <a href="/" className="shared-brand"><span className="shared-brand-mark"><Globe2 size={17}/></span>dev<span>lens</span></a>
      <a href="/" className="shared-back"><ArrowLeft size={14}/> Open DevLens</a>
    </header>
    <section className="shared-content">
      <div className="shared-eyebrow">PUBLIC COLLECTION <span>READ ONLY</span></div>
      {loading ? <div className="shared-state"><LoaderCircle className="shared-spinner" size={22}/> Loading collection…</div> : error ? <div className="shared-state shared-error">{error}</div> : <>
        <div className="shared-heading"><div><h1>{title}</h1><p>{requests.length} saved request{requests.length === 1 ? "" : "s"} · Published {new Date(publishedAt).toLocaleDateString()}</p></div><button className="shared-import" onClick={() => onImport(title, requests)}><Download size={15}/> Import to workspace</button></div>
        <div className="shared-request-list">{requests.length ? requests.map((request, index) => <article className="shared-request" key={request.id || index}>
          <div className="shared-request-heading"><span className="shared-method">{request.method || "GET"}</span><b>{request.name || "API request"}</b></div>
          <code className="shared-url">{request.url}</code>
          {request.headers?.filter(header => header.enabled !== false).length ? <div className="shared-headers">{request.headers.filter(header => header.enabled !== false).map((header, i) => <div key={i}><span>{header.key}</span><code>{header.value}</code></div>)}</div> : null}
          {request.body ? <pre className="shared-body">{request.body}</pre> : null}
        </article>) : <div className="shared-state">This collection has no requests yet.</div>}</div>
      </>}
    </section>
    <footer className="shared-footer">Shared with DevLens · API development studio</footer>
  </main>;
}
