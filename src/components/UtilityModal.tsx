import { useState } from "react";
import { Copy, Play, X } from "lucide-react";
import { createUuid, decodeUrl, encodeUrl, exportCurl, fromBase64, inspectJwt, prettyJson, toBase64 } from "../lib/utilities";

type Props = { tool: string; onClose: () => void };

function jsonDiff(before: unknown, after: unknown, path = "$"): Array<{ path: string; before: unknown; after: unknown }> {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    const left = before as Record<string, unknown>;
    const right = after as Record<string, unknown>;
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(key => jsonDiff(left[key], right[key], path + "." + key));
  }
  return [{ path, before: before ?? null, after: after ?? null }];
}

export default function UtilityModal({ tool, onClose }: Props) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  function run() {
    setError("");
    try {
      let result = "";
      switch (tool) {
        case "JSON formatter":
          result = prettyJson(input);
          break;
        case "JSON diff": {
          const parts = input.split(/\n---\s*\n/);
          if (parts.length !== 2) throw new Error("Paste the first JSON document, then a line with ---, then the second document.");
          result = JSON.stringify(jsonDiff(JSON.parse(parts[0]), JSON.parse(parts[1])), null, 2);
          break;
        }
        case "JWT inspector":
          result = JSON.stringify({ ...inspectJwt(input), warning: "Decoded only. This does not verify the JWT signature." }, null, 2);
          break;
        case "Base64 encode":
          result = toBase64(input);
          break;
        case "Base64 decode":
          result = fromBase64(input);
          break;
        case "URL encode":
          result = encodeUrl(input);
          break;
        case "URL decode":
          result = decodeUrl(input);
          break;
        case "UUID generator":
          result = createUuid();
          break;
        case "cURL exporter": {
          const request = JSON.parse(input) as { method: string; url: string; headers?: Record<string, string>; body?: string };
          if (!request.method || !request.url) throw new Error("Provide JSON with method and url fields.");
          result = exportCurl({ method: request.method, url: request.url, headers: request.headers || {}, body: request.body });
          break;
        }
        default:
          throw new Error("This utility is not available yet.");
      }
      setOutput(result);
    } catch (reason) {
      setOutput("");
      setError(reason instanceof Error ? reason.message : "Unable to process this input.");
    }
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal utility-modal" role="dialog" aria-modal="true" aria-labelledby="utility-title" onClick={event => event.stopPropagation()}>
      <div className="modal-title"><div><span className="utility-kicker">DEVLENS UTILITIES</span><b id="utility-title">{tool}</b></div><button onClick={onClose} aria-label="Close utility"><X size={16}/></button></div>
      <p>{tool === "JSON diff" ? "Compare two JSON documents. Separate them with a line containing ---." : tool === "JWT inspector" ? "Inspect the header and payload. Signature verification is not performed." : tool === "cURL exporter" ? "Paste a request object as JSON to generate a cURL command." : "Process text locally in your browser. Input is not sent to the server."}</p>
      {tool !== "UUID generator" && <textarea className="utility-input" value={input} onChange={event => setInput(event.target.value)} spellCheck={false} placeholder={tool === "JSON diff" ? '{"name":"before"}\n---\n{"name":"after"}' : tool === "cURL exporter" ? '{"method":"POST","url":"https://api.example.com/items","headers":{"content-type":"application/json"},"body":"{}"}' : "Paste your input here..."}/>}
      {error && <div className="auth-message utility-error" role="alert">{error}</div>}
      <div className="utility-actions"><button className="send-button" onClick={run}><Play size={13}/> Run utility</button>{output && <button className="utility-copy" onClick={() => navigator.clipboard.writeText(output)}><Copy size={13}/> Copy output</button>}</div>
      {output && <pre className="utility-output">{output}</pre>}
    </section>
  </div>;
}