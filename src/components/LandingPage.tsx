import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, Braces, Check, Code2, Github, Globe2, Layers3, LockKeyhole, ShieldCheck, Terminal, Zap } from "lucide-react";

type Props = { onGetStarted: () => void; onSignIn: () => void };

function AsciiField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current, ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w=0,h=0,frame=0,visible=true;
    const chars=" .:-=+xX0S8#@";
    const resize=()=>{const d=Math.min(window.devicePixelRatio||1,2);w=el.clientWidth;h=el.clientHeight;el.width=w*d;el.height=h*d;ctx.setTransform(d,0,0,d,0,0);ctx.font="12px ui-monospace,monospace";ctx.textAlign="center";ctx.textBaseline="middle";};
    const draw=(time:number)=>{ctx.clearRect(0,0,w,h);const cols=Math.ceil(w/14),rows=Math.ceil(h/14);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const nx=x/Math.max(1,cols),ny=y/Math.max(1,rows),horizon=.78+Math.sin(nx*5+time*.00025)*.08,glow=Math.max(0,1-Math.abs(ny-horizon)*2.6),ripple=.5+.5*Math.sin(nx*12+ny*8-time*.0006),level=glow*ripple;if(level<.1)continue;ctx.fillStyle="rgba(230,164,103,"+(.18+level*.72)+")";ctx.fillText(chars[Math.min(chars.length-1,Math.floor(level*chars.length))],x*14+7,y*14+7);}};
    const tick=(time:number)=>{if(visible)draw(time);frame=requestAnimationFrame(tick);};
    resize();const ro=new ResizeObserver(resize);ro.observe(el);const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});io.observe(el);
    if(reduced)draw(0);else frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);ro.disconnect();io.disconnect();};
  },[]);
  return <canvas ref={canvas} className="landing-ascii" aria-hidden="true"/>;
}
function Brand(){return <a className="landing-brand" href="/" aria-label="DevLens home"><span><Activity size={20}/></span><b>dev<span>lens</span></b></a>;}

export default function LandingPage({onGetStarted,onSignIn}:Props){
 const [folderOpen,setFolderOpen]=useState(false);
 return <div className="landing-page">
  <a className="skip-link" href="#landing-main">Skip to content</a>
  <header className="landing-header"><Brand/><nav><a href="#features">Features</a><a href="#workflow">How it works</a><a href="#security">Security</a></nav><div><button className="landing-signin" onClick={onSignIn}>Sign in</button><button className="landing-header-cta" onClick={onGetStarted}>Create account <ArrowUpRight size={15}/></button></div></header>
  <main id="landing-main" tabIndex={-1}>
   <section className="landing-hero">
    <div className="landing-glow"/>
    <div className="landing-copy"><div className="landing-kicker"><i/> THE API WORKSPACE FOR BUILDERS</div><h1>Make every API<br/><em>make sense.</em></h1><p>Build requests, inspect responses, and organise your APIs in one focused workspace. Clear tools for the work behind great software.</p><div className="landing-actions"><button className="landing-primary" onClick={onGetStarted}>Start building <ArrowRight size={17}/></button><a href="https://github.com/theemeraldesign/devlens" target="_blank" rel="noreferrer"><Github size={17}/> View source</a></div><div className="landing-proof"><span><Check/> Private workspaces</span><span><Check/> Open source</span><span><Check/> Built for developers</span></div></div>
    <div className="landing-preview">
     <div className="landing-float float-ok"><i/> 200 OK <small>· 128 ms</small></div><div className="landing-float float-json"><Braces/> JSON response</div>
     <div className="preview-window"><div className="preview-bar"><span className="preview-dots"><i/><i/><i/></span><span>devlens / request-studio</span><b>● LIVE PREVIEW</b></div><div className="preview-body"><aside><strong><Activity/> devlens</strong><small>WORKSPACE</small><span className="selected"><Layers3/> Collections</span><span><Globe2/> Environments</span><span><Terminal/> History</span><small>TOOLS</small><span><Braces/> Utilities</span><label>● Your workspace</label></aside><div className="preview-editor"><small>REQUEST STUDIO</small><h3>Build and inspect.</h3><div className="preview-url"><b>GET</b><span>api.example.com/v1/users</span><button>Send</button></div><div className="preview-tabs"><span>Params</span><b>Headers</b><span>Body</span><span>Auth</span></div><div className="preview-fields"><div>● Accept <b>application/json</b></div><div>● Authorization <b>Bearer •••••••••</b></div><a>+ Add header</a></div><div className="preview-response"><b>Response</b><span>● 200 OK</span><small>128 ms</small></div><pre><i>{"{"}</i>{"\n"}  <em>"id"</em>: <b>1042</b>,{"\n"}  <em>"name"</em>: <b>"Ada Lovelace"</b>,{"\n"}  <em>"role"</em>: <b>"engineer"</b>,{"\n"}  <em>"active"</em>: <b>true</b>{"\n"}<i>{"}"}</i></pre></div></div></div>
     <div className="preview-stack"><span><Code2/> Request</span><span><Braces/> Response</span><span><ShieldCheck/> Private</span></div>
    </div><a className="landing-scroll" href="#features">SCROLL TO EXPLORE <i/></a>
   </section>
   <section className="landing-features" id="features"><div className="landing-kicker">ONE WORKSPACE. LESS FRICTION.</div><div className="landing-section-heading"><h2>Everything around<br/>the request, <em>in focus.</em></h2><p>Move from a raw endpoint to a repeatable workflow. Keep the details close, the interface quiet, and your work organised.</p></div>
    <div className="landing-grid">
     <article><div className="feature-art request-art"><b>POST</b><i/><i/><i/><span><Zap/> Send request</span></div><small>01 / REQUESTS</small><h3>Build with precision.</h3><p>Compose HTTP requests with headers, query parameters, authentication, and flexible request bodies.</p></article>
     <article><button type="button" className={folderOpen ? "feature-art folder-art open" : "feature-art folder-art"} aria-label="Toggle collection icon folder" aria-expanded={folderOpen} onClick={()=>setFolderOpen(value=>!value)}><div><Code2/><Braces/><Globe2/></div><i/></button><small>02 / COLLECTIONS</small><h3>Keep work organised.</h3><p>Save reusable requests in collections. Share clean, read-only snapshots when you choose.</p></article>
     <article><div className="feature-art env-art"><span>BASE_URL <b>https://api.dev</b></span><span>API_TOKEN <b>••••••••••</b></span><small>● DEVELOPMENT</small></div><small>03 / ENVIRONMENTS</small><h3>Switch context fast.</h3><p>Manage variables for development, staging, and production without rewriting requests.</p></article>
     <article><div className="feature-art response-art"><span>● RESPONSE.JSON <b>200</b></span><i/><i/><i/><i/></div><small>04 / INSPECTION</small><h3>Understand every result.</h3><p>Read status, timing, headers, and formatted JSON or XML. Download responses for later.</p></article>
     <article><div className="feature-art history-art"><span>● GET <b>/users</b> 200</span><span>● POST <b>/sessions</b> 201</span><span>● PATCH <b>/profile</b> 204</span></div><small>05 / HISTORY</small><h3>Pick up where you left off.</h3><p>Search recent activity and replay requests without losing your flow.</p></article>
     <article><div className="feature-art tools-art"><span>{"{ }"}</span><b>JWT</b><b>64</b><b>%</b></div><small>06 / UTILITIES</small><h3>Small tools. Right here.</h3><p>Format JSON, inspect JWTs, transform Base64 and URLs, and import or export cURL.</p></article>
    </div>
   </section>
   <section className="landing-workflow" id="workflow"><div><div className="landing-kicker">A CLEANER DEVELOPMENT LOOP</div><h2>From endpoint<br/>to <em>understanding.</em></h2><p>DevLens gives your API work a clear home. Compose, send, inspect, save, and share without jumping between disconnected tools.</p><button className="landing-primary" onClick={onGetStarted}>Create your workspace <ArrowRight/></button></div><div className="workflow-list">{[["01","Compose","Set your method, URL, headers, body, and auth.",Code2],["02","Send","Run the request and track status and duration.",Zap],["03","Inspect","Review the response body and headers.",Braces],["04","Organise","Save it to a collection and reuse it later.",Layers3]].map(([n,title,desc,Icon])=>{const I=Icon as typeof Code2;return <div key={n as string}><small>{n as string}</small><span><b>{title as string}</b><em>{desc as string}</em></span><I/></div>;})}</div></section>
   <section className="landing-security" id="security"><span><LockKeyhole/></span><div><div className="landing-kicker">PRIVATE BY DEFAULT</div><h2>Your workspace stays <em>yours.</em></h2><p>Collections and environments belong to your account. Public sharing is opt-in, and shared snapshots are sanitised before publication.</p></div><a href="https://github.com/theemeraldesign/devlens/blob/main/docs/SECURITY.md" target="_blank" rel="noreferrer">Read security notes <ArrowUpRight/></a></section>
  </main>
  <footer className="landing-footer"><div className="footer-dark"><AsciiField/><div className="footer-top"><Brand/><small>API DEVELOPMENT STUDIO</small></div><div className="footer-bottom"><p>See your APIs clearly.<br/>Build with confidence.</p><a href="https://github.com/theemeraldesign/devlens" target="_blank" rel="noreferrer" aria-label="GitHub"><Github/></a><b>devlens</b></div></div><div className="footer-light"><div><b>PRODUCT</b><a href="#features">Features</a><a href="#workflow">How it works</a><a href="#security">Security</a></div><div><b>RESOURCES</b><a href="https://github.com/theemeraldesign/devlens" target="_blank" rel="noreferrer">GitHub repository</a><a href="https://github.com/theemeraldesign/devlens/blob/main/README.md" target="_blank" rel="noreferrer">Documentation</a><a href="https://github.com/theemeraldesign/devlens/blob/main/docs/SECURITY.md" target="_blank" rel="noreferrer">Security notes</a></div><div><b>GET STARTED</b><button onClick={onGetStarted}>Create account <ArrowUpRight/></button><button onClick={onSignIn}>Sign in <ArrowUpRight/></button></div><small>© {new Date().getFullYear()} DevLens. Open source and built for developers.</small><strong>devlens</strong></div></footer>
 </div>;
}
