import { useState } from "react";
import { Activity, Braces, Check, ChevronRight, Copy, Globe2, LockKeyhole, Play, Sparkles } from "lucide-react";

const panels = {
  request: { label: "Request", method: "POST", path: "/v1/customers", status: "Ready to send", code: ['{','  "name": "Ada Lovelace",','  "email": "ada@example.dev",','  "plan": "pro"','}'] },
  response: { label: "Response", method: "201", path: "Created · 142 ms", status: "Request completed", code: ['{','  "id": "cus_8f2a91",','  "name": "Ada Lovelace",','  "created": true,','  "status": "active"','}'] },
  environment: { label: "Environment", method: "DEV", path: "api.dev.example.com", status: "3 variables loaded", code: ['API_BASE_URL  https://api.dev…','API_VERSION   v1','API_TOKEN     •••••••••••••••'] }
} as const;

export default function ShowcaseDeck() {
  const [active, setActive] = useState<keyof typeof panels>("request");
  const [sent, setSent] = useState(false);
  const panel = panels[active];
  return <section className="landing-showcase" aria-label="DevLens workspace preview">
    <div className="showcase-heading"><div><span className="landing-kicker"><Sparkles size={13}/> INSIDE THE WORKSPACE</span><h2>Every detail.<br/><em>In its right place.</em></h2></div><p>A focused surface for the full request cycle. Switch between the pieces and see how they fit together.</p></div>
    <div className="showcase-shell">
      <div className="showcase-top"><div className="showcase-brand"><span><Activity size={15}/></span>dev<span>lens</span></div><div className="showcase-breadcrumb">Workspace <ChevronRight size={12}/> Request studio</div><div className="showcase-live"><i/> LOCAL WORKSPACE</div></div>
      <div className="showcase-layout">
        <aside className="showcase-rail"><span className="rail-active"><Braces size={15}/></span><span><Globe2 size={15}/></span><span><LockKeyhole size={15}/></span></aside>
        <div className="showcase-main">
          <div className="showcase-tabs">{(Object.keys(panels) as Array<keyof typeof panels>).map(key=><button key={key} className={active===key?"active":""} onClick={()=>{setActive(key);setSent(false);}}>{panels[key].label}</button>)}</div>
          <div className="showcase-request-line"><b className={active==="response"?"method-created":active==="environment"?"method-env":""}>{panel.method}</b><span>{panel.path}</span>{active==="request"&&<button onClick={()=>setSent(true)}><Play size={12} fill="currentColor"/> Send request</button>}</div>
          <div className="showcase-code-head"><span>{active==="environment"?"ACTIVE VARIABLES":"BODY · APPLICATION/JSON"}</span><button aria-label="Copy example"><Copy size={12}/> Copy</button></div>
          <pre className="showcase-code">{panel.code.map((line,index)=><span key={index}><i>{String(index+1).padStart(2,"0")}</i>{line}</span>)}</pre>
          <div className="showcase-status"><span><Check size={13}/>{sent&&active==="request"?"201 Created · 142 ms":panel.status}</span><small>PREVIEW DATA</small></div>
        </div>
        <aside className="showcase-inspector"><span className="inspector-kicker">REQUEST CONTEXT</span><b>{active==="request"?"Create customer":active==="response"?"Response details":"Development"}</b><p>{active==="request"?"A structured request with clear method, endpoint and JSON body.":active==="response"?"Status, timing and payload stay together for quick inspection.":"Reusable values keep endpoints and credentials out of the request itself."}</p><div className="inspector-row"><span>Method</span><b>{active==="response"?"201":active==="environment"?"DEV":"POST"}</b></div><div className="inspector-row"><span>Content type</span><b>JSON</b></div><div className="inspector-row"><span>Privacy</span><b><LockKeyhole size={11}/> Private</b></div></aside>
      </div>
    </div>
  </section>;
}
