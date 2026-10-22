// Headless Chromium via CDP (node 22 built-in WebSocket; no puppeteer).
// usage: node verify/b-shoot.mjs http://127.0.0.1:8765/demo-b.html id1 id2 ...
// Writes verify/shots/<id>.png and prints console errors / exceptions per page.
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [base, ...ids] = process.argv.slice(2);
const port = 9400 + Math.floor(Math.random() * 400);
const prof = mkdtempSync(join(tmpdir(), "b-chrome-"));
const chrome = spawn("/usr/bin/chromium-browser", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
  "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--window-size=800,1000", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.find(t => t.type === "page")) break; } catch {} await sleep(200); }
const page = tabs.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map(); const logs = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning"))
    logs.push(`console.${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description).join(" "));
  if (m.method === "Runtime.exceptionThrown") logs.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") logs.push("log.error: " + m.params.entry.text + " " + (m.params.entry.url || ""));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 1000, deviceScaleFactor: 1, mobile: false });
let fails = 0;
for (const pid of ids) {
  const [name, extra] = pid.split("@");   // id@js  -> run js after load (interaction state)
  logs.length = 0;
  await send("Page.navigate", { url: `${base}?only=${name}` });
  await sleep(900);
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(()=>1)", awaitPromise: true });
  if (extra) { await send("Runtime.evaluate", { expression: decodeURIComponent(extra) }); await sleep(200); }
  await sleep(250);
  const r = await send("Runtime.evaluate", { expression: "JSON.stringify((()=>{const d=[...document.querySelectorAll('.demo')].find(x=>x.style.display!=='none');const b=d.getBoundingClientRect();return {x:b.left-6,y:b.top+window.scrollY-6,w:b.width+12,h:b.height+12, err:[...d.querySelectorAll('.v6-state')].filter(s=>s.textContent.startsWith('오류')).map(s=>s.textContent)}})())", returnByValue: true });
  const box = JSON.parse(r.result.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 } });
  const fname = name + (extra ? "-" + (pid.split("#")[1] || "x") : "");
  writeFileSync(new URL(`./shots/${fname}.png`, import.meta.url), Buffer.from(shot.result.data, "base64"));
  const bad = logs.filter((l) => !/favicon/.test(l));
  console.log(`${fname}: ${bad.length ? "CONSOLE " + bad.join(" | ") : "console clean"}${box.err.length ? " | widget msgs: " + box.err.join(" / ") : ""}`);
  if (bad.length) fails++;
}
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
