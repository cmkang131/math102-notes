// Screenshot every demo section of demo-a.html via headless Chromium + raw CDP (no puppeteer).
// usage: node verify/a-shoot.mjs [baseURL] [ids...]   → verify/shots/<id>.png, console errors to stdout
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const base = process.argv[2] || "http://127.0.0.1:8765/demo-a.html";
const only = process.argv.slice(3);
const port = 9333 + Math.floor(Math.random() * 500);
const prof = mkdtempSync(join(tmpdir(), "chr-"));
const chrome = spawn("/usr/bin/chromium-browser", ["--headless=new", "--no-sandbox", "--disable-gpu",
  `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "--window-size=800,1000", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver; for (let i = 0; i < 50; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (ver.length) break; } catch {} await sleep(200); }
const page = ver.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map(); const logs = [];
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) logs.push("CONSOLE." + m.params.type + " " + m.params.args.map((a) => a.value ?? a.description).join(" "));
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") logs.push("LOG " + m.params.entry.text + " " + (m.params.entry.url || ""));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 1000, deviceScaleFactor: 1, mobile: false });
async function load(url) { await send("Page.navigate", { url }); for (let i = 0; i < 50; i++) { await sleep(150);
  const r = await send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true }); if (r.result?.result?.value === "complete") break; }
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(()=>1)", awaitPromise: true }); await sleep(250); }
await load(base);
const ids = only.length ? only : (await send("Runtime.evaluate", { expression: "[...document.querySelectorAll('section.demo')].map(s=>s.id)", returnByValue: true })).result.result.value;
const firstLogs = logs.splice(0);
const report = [];
for (const sid of ids) {
  await load(`${base}?only=${sid}`);
  const r = await send("Runtime.evaluate", { returnByValue: true, expression:
    `(()=>{const s=document.getElementById(${JSON.stringify(sid)});const b=s.getBoundingClientRect();
      return {x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height,text:s.innerText.slice(0,4000),
        canvases:[...s.querySelectorAll('canvas')].map(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>0&&d[i]<200)n++;return n;})}})()` });
  const v = r.result.result.value;
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: v.x, y: v.y, width: v.w, height: v.h, scale: 1 } });
  writeFileSync(new URL(`./shots/${sid}.png`, import.meta.url), Buffer.from(shot.result.data, "base64"));
  const errs = logs.splice(0);
  report.push({ id: sid, inkPixels: v.canvases, errors: errs, text: v.text });
}
console.log(JSON.stringify({ initialLoadErrors: firstLogs, report }, null, 1));
ws.close(); chrome.kill();
