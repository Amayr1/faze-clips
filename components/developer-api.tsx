"use client";

import {useEffect, useState} from "react";
import {ArrowUpRight, Code2, Copy, KeyRound, Play, RefreshCw} from "lucide-react";
import "./developer-api.css";

const KEY_STORAGE = "faze-clips-mock-api-key";
const BASE_URL = "https://clips.example.com/api/v1";
const ENDPOINTS = [
  ["POST", "/clips", "Upload a clip", "clips:write"],
  ["GET", "/clips?sort=top", "List your clips", "clips:read"],
  ["GET", "/clips/{clipId}", "Clip and engagement", "clips:read"],
  ["DELETE", "/clips/{clipId}", "Delete your clip", "clips:write"],
];

export default function DeveloperApi() {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  useEffect(() => {
    try { const saved = sessionStorage.getItem(KEY_STORAGE); if (saved && /^faze_mock_[a-f0-9]{48}$/.test(saved)) setKey(saved); } catch {}
  }, []);
  function generate() {
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      const next = "faze_mock_" + Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
      setKey(next); setResponse("");
      try { sessionStorage.setItem(KEY_STORAGE, next); } catch {}
      setMessage("Demo key generated. It does not authenticate real uploads.");
    } catch { setMessage("Key generation is unavailable in this browser. Try the local HTTPS or localhost preview."); }
  }
  async function copy(value: string, name: string) {
    try { await navigator.clipboard.writeText(value); setMessage(name + " copied."); }
    catch { setMessage("Clipboard unavailable. Select and copy the text manually."); }
  }
  const header = "Authorization: Bearer " + (key || "<generate-a-demo-key>");
  const request = [
    'curl -X POST "' + BASE_URL + '/clips" \\',
    '  -H "' + header + '" \\',
    '  -H "Idempotency-Key: kickbot-demo-upload-001" \\',
    '  -F "video=@highlight.mp4;type=video/mp4" \\',
    '  -F "title=Run it back" \\',
    '  -F "game=Just Chatting"',
  ].join("\n");
  function preview() {
    setResponse(JSON.stringify({data:{id:"3e519168-5ee9-4cb4-b8c6-706b37cb79f6",canonicalClipId:"upload:3e519168-5ee9-4cb4-b8c6-706b37cb79f6",status:"published",title:"Run it back",description:"",game:"Just Chatting",creator:{displayName:"Demo Creator"},source:{platform:"original"},url:"https://clips.example.com/#clip=3e519168-5ee9-4cb4-b8c6-706b37cb79f6",createdAt:"2026-11-15T17:00:00Z",metrics:{fazeLikes:0,comments:0}},requestId:"req_mock_upload_001"}, null, 2));
    setMessage("Mock 201 response shown. No request was sent and no clip was uploaded.");
  }
  return <section className="developer-api page-width" id="developer-api" aria-labelledby="developer-api-title">
    <div className="section-heading"><div><span className="eyebrow"><Code2 size={14}/> BUILT FOR YOUR WORKFLOW</span><h2 id="developer-api-title">YOUR BOT. OUR FEED.</h2></div><span className="api-demo-badge">MOCK API / DEMO ONLY</span></div>
    <p className="api-intro">Design an upload action for Kickbot or another tool with custom HTTP support. Generate a fake key, copy the header, and explore the proposed clip API.</p>
    <div className="api-console-grid">
      <div className="api-key-panel"><span className="eyebrow">01 / YOUR DEMO KEY</span><h3>CONNECT THE MOMENT.</h3><p>This key is a sample for your integration setup. It stays in this browser tab’s session and grants no account access.</p>
        <label className="api-key-label" htmlFor="mock-api-key">Fake API key</label><div className="api-key-input"><input id="mock-api-key" value={key} placeholder="Generate your faze_mock_ key" readOnly spellCheck={false} autoComplete="off"/><button className="icon-button" disabled={!key} aria-label="Copy fake API key" onClick={()=>void copy(key,"Fake key")}><Copy size={17}/></button></div>
        <button className="button lime" onClick={generate}>{key?<RefreshCw size={16}/>:<KeyRound size={16}/>} {key?"Replace demo key":"Generate fake API key"}</button>
        <div className="api-header-label"><span>REQUEST HEADER</span><button className="text-button" disabled={!key} onClick={()=>void copy(header,"Authorization header")}><Copy size={13}/> Copy header</button></div><pre className="api-code" tabIndex={0} aria-label="Authorization header"><code>{header}</code></pre>
        <div className="api-scope-tags"><span>clips:read</span><span>clips:write</span><span>proposed scopes</span></div>
        <p className="api-boundary">Demo keys are not accepted by the current upload endpoint. Real Kickbot uploads require a live integration API and creator authorization.</p>
        <p className="api-status" role="status" aria-live="polite">{message}</p>
      </div>
      <div className="api-reference-panel"><span className="eyebrow">02 / THE UPLOAD CONTRACT</span><div className="api-base"><span>PLACEHOLDER BASE URL</span><code>{BASE_URL}</code></div>
        <div className="api-endpoints"><table><caption className="api-sr-only">Proposed creator-owned clip endpoints</caption><thead><tr><th>Method</th><th>Endpoint</th><th>Scope</th></tr></thead><tbody>{ENDPOINTS.map(([method,path,title,scope])=><tr key={method+path}><td><span className={"api-method "+method.toLowerCase()}>{method}</span></td><td><code>{path}</code><small>{title}</small></td><td>{scope}</td></tr>)}</tbody></table></div>
        <div className="api-header-label"><span>EXAMPLE UPLOAD · POSIX SHELL</span><button className="text-button" disabled={!key} onClick={()=>void copy(request,"Example request")}><Copy size={13}/> Copy request</button></div><pre className="api-code api-request" tabIndex={0} aria-label="Example upload request"><code>{request}</code></pre>
        <p className="api-limits">MP4 / WebM / MOV · 25 MiB max · title + game required. Upload bytes as multipart form data. The example.com address is a placeholder.</p>
        <button className="button outline" disabled={!key} onClick={preview}><Play size={15}/> Preview mock 201 response <ArrowUpRight size={15}/></button>
        {response&&<div className="api-response"><strong>201 CREATED · SIMULATED</strong><pre className="api-code" tabIndex={0} aria-label="Simulated upload response"><code>{response}</code></pre><small>Static example only. No file transfer, publication, or network request.</small></div>}
      </div>
    </div>
  </section>;
}
