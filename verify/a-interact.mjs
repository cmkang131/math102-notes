// Fuzz the UI of every demo widget via CDP: every select option, slider min/mid/max, every button,
// bad expressions in text inputs. Reports exceptions and any widget showing the guard error text.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const base = process.argv[2]; const port = 9900 + Math.floor(Math.random() * 400);
const chrome = spawn("/usr/bin/chromium-browser", ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "chr-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 50; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (t.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map(); const errs = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable"); await send("Page.enable"); await send("Page.navigate", { url: base }); await sleep(2500);
const r = await send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const out=[]; let actions=0;
  const fire=(el,ev)=>el.dispatchEvent(new Event(ev,{bubbles:true}));
  for(const w of document.querySelectorAll('.v6-widget')){
    const sel=[...w.querySelectorAll('select')], rng=[...w.querySelectorAll('input[type=range]')], btn=()=>[...w.querySelectorAll('button')], txt=[...w.querySelectorAll('input[type=text]')];
    const hit=()=>{for(let k=0;k<6;k++)for(const b of btn())if(!b.disabled&&!/재생|끝까지/.test(b.textContent)){b.click();actions++;}};
    const opts=sel.length?[...sel[0].options].map(o=>o.value):[null];
    for(const o of opts){ if(o!==null){sel[0].value=o;fire(sel[0],'change');}
      for(const s of sel.slice(1))for(const o2 of [...s.options].map(x=>x.value)){s.value=o2;fire(s,'change');hit();}
      for(const R of rng){ if(R.closest('label').style.display==='none')continue;
        for(const v of [R.min,R.max,(+R.min+ +R.max)/2,0,1,-1]){R.value=v;fire(R,'input');hit();} }
      if(o==='custom'||(txt.length&&txt[0].offsetParent))for(const bad of ['1/x^2','2x','','sin(','x/0','1/(x-x)','pow(x,1000)','exp(exp(x))','log(x)','sqrt(-1)','tan(x)','1e308*x*x'])
        {for(const T of txt){T.value=bad.replace(/x/g, T.closest('label').textContent.startsWith('a_n')?'n':'x');}
         const ap=btn().find(b=>b.textContent==='적용'); if(ap){ap.click();hit();}}
      // canvas click for newton2d
      const c=w.querySelector('canvas'); if(w.dataset.widget==='newton2d'){for(const [fx,fy] of [[0.5,0.5],[0.62,0.43],[0.1,0.1],[0.53,0.43]]){const b=c.getBoundingClientRect();
        c.dispatchEvent(new MouseEvent('click',{clientX:b.left+fx*b.width,clientY:b.top+fy*b.height,bubbles:true}));hit();}}
    }
    const bad=w.innerText.includes('그리지 못했습니다'); out.push({w:w.dataset.widget,bad});
  }
  return {out,actions};})()` });
const v = r.result.result.value;
console.log("actions:", v.actions, " widgets:", v.out.length, " guard-errors:", v.out.filter((x) => x.bad).map((x) => x.w), " exceptions:", errs.length);
errs.slice(0, 10).forEach((e) => console.log("EXC", e));
ws.close(); chrome.kill(); process.exitCode = errs.length || v.out.some((x) => x.bad) ? 1 : 0;
