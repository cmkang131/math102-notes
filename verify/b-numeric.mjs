// Independent numeric verification for assets/v6-extra-b.js (set B).
// 1) loads only the /*CALC-BEGIN*/…/*CALC-END*/ block through node:vm (no DOM, nothing exposed on V6)
// 2) recomputes every quantity with formulas written separately here and compares
// 3) loads v6.js + v6-extra-b.js into a fake window to check registration / name collisions
// run: node verify/b-numeric.mjs > verify/b-numeric.log
import { readFileSync } from "node:fs";
import vm from "node:vm";
const root = new URL("../", import.meta.url);
const src = readFileSync(new URL("assets/v6-extra-b.js", root), "utf8");
const block = src.slice(src.indexOf("/*CALC-BEGIN*/"), src.indexOf("/*CALC-END*/"));
const ctx = vm.createContext({ Math, String, parseFloat, isFinite, Number });
vm.runInContext(block + "\nthis.calc=calc;", ctx);
const C = ctx.calc;
const rows = []; let fails = 0;
function check(group, name, widget, indep, tol = 1e-12) {
  let ok;
  if (typeof indep === "number" && typeof widget === "number") {
    ok = (widget === indep) || (Number.isNaN(widget) && Number.isNaN(indep)) ||
      Math.abs(widget - indep) <= tol * Math.max(1, Math.abs(indep));
  } else ok = JSON.stringify(widget) === JSON.stringify(indep);
  if (!ok) fails++;
  const f = (v) => typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toPrecision(10)) : JSON.stringify(v);
  rows.push(`| ${group} | ${name} | ${f(widget)} | ${f(indep)} | ${ok ? "PASS" : "**FAIL**"} |`);
}
/* ---------- 1. gradient descent ---------- */
for (const [c, eta] of [[2, 0.1], [2, 0.45], [2, 0.5], [2, 0.75], [2, 1], [2, 1.05], [0.5, 3.9], [4, 0.2]]) {
  const run = C.gd1((x) => c * x, eta, 2, 15, 1e6);
  const k = run.xs.length - 1, exact = 2 * Math.pow(1 - eta * c, k);
  check("gd 1D quad", `c=${c},η=${eta}: x_${k} vs (1−ηc)^k x0`, run.xs[k], exact, 1e-12);
  // independent classification by r = 1 − ηc
  const r = 1 - eta * c;
  const exp = Math.abs(r) < 1e-9 ? "one" : Math.abs(r + 1) < 1e-9 ? "bounce" : r > 0 && r < 1 ? "mono" : r < 0 && r > -1 ? "osc" : r < -1 ? "div" : "?";
  check("gd 1D quad", `c=${c},η=${eta}: 분류`, C.classifyQuadLR(c, eta).kind, exp);
}
check("gd 1D quad", "2/c 경계 (c=2)", C.classifyQuadLR(2, 1).etaMax, 1);
check("gd 1D quad", "η=0 → zero", C.classifyQuadLR(2, 0).kind, "zero");
{ // divergence detection: |r|=1.1, x0=2 → first k with 2·1.1^k > 1e6
  const run = C.gd1((x) => 2 * x, 1.05, 2, 400, 1e6);
  let k = 0; while (2 * Math.pow(1.1, k) <= 1e6) k++;
  check("gd 1D quad", "발산 감지 단계 (|x|>10⁶)", run.at, k);
}
{ // quartic x_{k+1} = x(1−ηx²)
  for (const eta of [0.05, 0.3, 0.6]) {
    let x = 2, ok = true, k = 0; const run = C.gd1((t) => t * t * t, eta, 2, 30, 1e6);
    for (k = 0; k < run.xs.length - 1; k++) x = x * (1 - eta * x * x);
    check("gd 1D quartic", `η=${eta}: 마지막 x`, run.xs[run.xs.length - 1], x, 1e-12);
  }
  const r = C.gd1((t) => t * t * t, 0.05, 2, 20000, 1e6);
  check("gd 1D quartic", "x_20000 ≈ 1/√(2ηk) (η=0.05, 상대오차<2%)", Math.abs(r.xs[20000] * Math.sqrt(2 * 0.05 * 20000) - 1) < 0.02, true);
}
/* 2D */
for (const [kap, eta] of [[10, 2 / 11], [40, 2 / 41], [10, 0.21], [1, 1], [25, 0.05]]) {
  const run = C.gd2(kap, eta, 4, 1, 30, 1e6);
  const k = run.P.length - 1;
  check("gd 2D", `κ=${kap},η=${eta.toFixed(4)}: x_k`, run.P[k][0], 4 * Math.pow(1 - eta, k), 1e-12);
  check("gd 2D", `κ=${kap},η=${eta.toFixed(4)}: y_k`, run.P[k][1], 1 * Math.pow(1 - eta * kap, k), 1e-12);
  const rt = C.rates2(kap, eta), rho = Math.max(Math.abs(1 - eta), Math.abs(1 - eta * kap));
  check("gd 2D", `κ=${kap}: ρ`, rt.rho, rho);
  check("gd 2D", `κ=${kap}: η* = 2/(1+κ)`, rt.etaStar, 2 / (1 + kap));
  check("gd 2D", `κ=${kap}: ρ* = (κ−1)/(κ+1)`, rt.rhoStar, (kap - 1) / (kap + 1));
  // bound f_k ≤ ρ^{2k} f0 for every k
  const f0 = 0.5 * (16 + kap); let bound = true;
  run.P.forEach((p, i) => { const fk = 0.5 * (p[0] ** 2 + kap * p[1] ** 2); if (fk > Math.pow(rho, 2 * i) * f0 * (1 + 1e-12) + 1e-300) bound = false; });
  check("gd 2D", `κ=${kap}: f_k ≤ ρ^{2k} f_0 (모든 k)`, bound, true);
}
{ // η* minimizes ρ over a fine η grid (κ = 10)
  let best = 1e9, bestEta = 0;
  for (let e = 1e-4; e < 0.2; e += 1e-5) { const r = Math.max(Math.abs(1 - e), Math.abs(1 - 10 * e)); if (r < best) { best = r; bestEta = e; } }
  check("gd 2D", "격자 탐색 argmin ρ(η), κ=10 (vs 2/11)", bestEta, 2 / 11, 1e-3);
  check("gd 2D", "수렴 경계 2/κ (κ=10): η=0.1999 수렴, 0.2001 발산", [C.rates2(10, 0.1999).rho < 1, C.rates2(10, 0.2001).rho > 1], [true, true]);
}
for (const rho of [0.8182, 0.9512, 0.5, 0, 1, 1.1]) {
  let k = 0; if (rho >= 1) k = Infinity; else if (rho === 0) k = 1; else while (Math.pow(rho, 2 * k) > 1e-6) k++;
  check("gd 2D", `10⁻⁶ 도달 k, ρ=${rho}`, C.itersFor(rho, 1e-6), k);
}
/* ---------- 2. directional derivative ---------- */
const fA = (x, y) => x * x + 3 * y * y, fB = (x, y) => Math.sin(x) * Math.cos(y), fC = (x, y) => 5 * x * y + y ** 3;
for (const [nm, f, gx, gy, a, b] of [["x²+3y²", fA, (x, y) => 2 * x, (x, y) => 6 * y, 1, 0.5], ["sin x cos y", fB, (x, y) => Math.cos(x) * Math.cos(y), (x, y) => -Math.sin(x) * Math.sin(y), 0.6, -0.8],
  ["5xy+y³", fC, (x, y) => 5 * y, (x, y) => 5 * x + 3 * y * y, 1, 1], ["exp(3x)·y", (x, y) => Math.exp(3 * x) * y, (x, y) => 3 * Math.exp(3 * x) * y, (x, y) => Math.exp(3 * x), 1.5, 0.7]]) {
  const g = C.grad(f, a, b);
  check("방향도함수", `${nm} @(${a},${b}) f_x`, g.fx, gx(a, b), 1e-7);
  check("방향도함수", `${nm} @(${a},${b}) f_y`, g.fy, gy(a, b), 1e-7);
  for (const th of [0, 0.7, 2.5, 4]) check("방향도함수", `${nm} D_u f, θ=${th}`, C.dirDeriv(g.fx, g.fy, th), gx(a, b) * Math.cos(th) + gy(a, b) * Math.sin(th), 1e-7);
  check("방향도함수", `${nm} 미분가능 판정 = 가능`, C.diffCheck(f, a, b, g.fx, g.fy).ok && !g.kink, true);
  // max of D_u f over θ grid equals |∇f|
  let mx = -1e9; for (let i = 0; i < 36000; i++) mx = Math.max(mx, C.dirDeriv(g.fx, g.fy, i * Math.PI / 18000));
  check("방향도함수", `${nm} max_θ D_u f = |∇f|`, mx, Math.hypot(gx(a, b), gy(a, b)), 1e-7);
}
{
  const f1 = (x, y) => Math.sqrt(x * x + y * y), g1 = C.grad(f1, 0, 0);
  check("방향도함수", "√(x²+y²) @0: 미분불가 감지", g1.kink || !C.diffCheck(f1, 0, 0, g1.fx, g1.fy).ok, true);
  check("방향도함수", "√(x²+y²) @0: 한쪽 방향미분 θ=1 → 1", C.oneSided(f1, 0, 0, 1), 1, 1e-9);
  const f2 = (x, y) => Math.sqrt(Math.abs(x * y)), g2 = C.grad(f2, 0, 0);
  check("방향도함수", "√|xy| @0: f_x=f_y=0 이지만 미분불가 감지", [g2.fx, g2.fy, !C.diffCheck(f2, 0, 0, g2.fx, g2.fy).ok], [0, 0, true]);
  check("방향도함수", "√|xy| @0: 45° 한쪽 미분 = 1/√2", C.oneSided(f2, 0, 0, Math.PI / 4), Math.SQRT1_2, 1e-9);
  const f3 = (x, y) => x * x + y * y, g3 = C.grad(f3, 0, 0);
  check("방향도함수", "x²+y² @0: ∇f=0, 미분가능", [g3.fx, g3.fy, C.diffCheck(f3, 0, 0, 0, 0).ok], [0, 0, true]);
}
/* ---------- 3. quadratic form ---------- */
function indepEig(a, b, c) { const t = a + c, d = Math.sqrt((a - c) ** 2 + 4 * b * b); return [(t - d) / 2, (t + d) / 2]; }
const QF = [[2, 0.6, 1, "pd"], [-2, 0.5, -1, "nd"], [1, 2, 1, "indef"], [1, 1, 1, "psd"], [-1, 1, -1, "nsd"], [2, 0, -1, "indef"], [1.5, 0, 1.5, "pd"], [0, 0, 0, "zero"], [0.3, 0.3, 0.3, "psd"], [0.2, 0.4, 0.8, "psd"], [0, 1, 0, "indef"], [1e-3, 0, 2, "pd"]];
for (const [a, b, c, kind] of QF) {
  const E = C.eig2(a, b, c), [l1, l2] = indepEig(a, b, c);
  check("이차형식", `[[${a},${b}],[${b},${c}]] λ₁`, E.l1, l1, 1e-12);
  check("이차형식", `[[${a},${b}],[${b},${c}]] λ₂`, E.l2, l2, 1e-12);
  let mn = 1e9, mx = -1e9; for (let i = 0; i < 200000; i++) { const t = i * Math.PI / 100000, q = a * Math.cos(t) ** 2 + 2 * b * Math.cos(t) * Math.sin(t) + c * Math.sin(t) ** 2; mn = Math.min(mn, q); mx = Math.max(mx, q); }
  check("이차형식", `  min_{|u|=1} Q = λ₁ (격자)`, E.l1, mn, 1e-8);
  check("이차형식", `  max_{|u|=1} Q = λ₂ (격자)`, E.l2, mx, 1e-8);
  for (const [t, l] of [[E.t1, E.l1], [E.t2, E.l2]]) { const v = [Math.cos(t), Math.sin(t)], r = Math.hypot(a * v[0] + b * v[1] - l * v[0], b * v[0] + c * v[1] - l * v[1]);
    check("이차형식", `  ‖Hv − λv‖ (λ=${l.toFixed(4)})`, r, 0, 1e-12); }
  const sc = Math.abs(a) + Math.abs(b) + Math.abs(c);
  check("이차형식", `  판정`, C.classifyQ(E.l1, E.l2, sc), kind);
  const D = a * c - b * b;  // second-derivative test consistency
  const test = Math.abs(D) < 1e-12 ? "inconclusive" : D < 0 ? "saddle" : a > 0 ? "min" : "max";
  const fromKind = { pd: "min", nd: "max", indef: "saddle", psd: "inconclusive", nsd: "inconclusive", zero: "inconclusive" }[kind];
  check("이차형식", `  D=ac−b²=${+D.toFixed(6)} 판정과 일치`, test, fromKind);
}
/* ---------- 4. linear map ---------- */
for (const [p, q, r, s] of [[1, 0.5, 0.3, 1], [Math.cos(0.5236), -Math.sin(0.5236), Math.sin(0.5236), Math.cos(0.5236)], [1, 1, 0, 1], [1, 0, 0, -1], [1, 2, 0.5, 1], [0.5, 1.5, 1.2, -0.4]]) {
  const e1 = C.apply2(p, q, r, s, 1, 0), e2 = C.apply2(p, q, r, s, 0, 1);
  // shoelace area of image of unit square (0, Ae1, Ae1+Ae2, Ae2)
  const P = [[0, 0], e1, [e1[0] + e2[0], e1[1] + e2[1]], e2]; let A = 0;
  for (let i = 0; i < 4; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4]; A += x1 * y2 - x2 * y1; }
  check("선형사상", `[[${+p.toFixed(3)},${+q.toFixed(3)}],[${+r.toFixed(3)},${+s.toFixed(3)}]] det = 부호있는 넓이(신발끈)`, C.det2(p, q, r, s), A / 2, 1e-12);
  check("선형사상", `  Ae₁ = 1열`, e1, [p, r]);
}
/* ---------- 5. dot product ---------- */
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 6 - 3;
let csOk = true, orthOk = true, angOk = true;
for (let i = 0; i < 20000; i++) {
  const u = [rnd(), rnd()], v = [rnd(), rnd()], d = u[0] * v[0] + u[1] * v[1], nu = Math.hypot(...u), nv = Math.hypot(...v);
  if (Math.abs(C.dot(u, v)) > nu * nv * (1 + 1e-12)) csOk = false;
  const pr = C.proj(u, v); if (Math.abs((v[0] - pr[0]) * u[0] + (v[1] - pr[1]) * u[1]) > 1e-9) orthOk = false;
  if (Math.abs(C.angleBetween(u, v) - Math.acos(Math.max(-1, Math.min(1, d / (nu * nv))))) > 1e-7) angOk = false;
}
check("내적", "코시–슈바르츠 |u·v| ≤ |u||v| (난수 20000쌍)", csOk, true);
check("내적", "(v − proj_u v) ⟂ u (난수 20000쌍)", orthOk, true);
check("내적", "angleBetween = arccos(u·v/|u||v|) (난수)", angOk, true);
check("내적", "u=(2,0.5), v=(−1.5,1.5): u·v", C.dot([2, 0.5], [-1.5, 1.5]), -2.25);
check("내적", "  proj_u v", C.proj([2, 0.5], [-1.5, 1.5]), [-2.25 / 4.25 * 2, -2.25 / 4.25 * 0.5]);
check("내적", "u=0 → proj 정의 안 됨(null)", C.proj([0, 0], [1, 1]), null);
check("내적", "u=0 → θ NaN", C.angleBetween([0, 0], [1, 1]), NaN);
check("내적", "평행 u=(1,2), v=(−2,−4): 등호 |u·v| = |u||v|", Math.abs(C.dot([1, 2], [-2, -4])), Math.hypot(1, 2) * Math.hypot(2, 4), 1e-14);
/* ---------- expression guard + formatting ---------- */
check("식 검사", "x^2 거부", C.checkExpr("x^2", ["x"]) !== null, true);
check("식 검사", "alert(1) 거부", C.checkExpr("alert(1)", ["x", "y"]) !== null, true);
check("식 검사", "x2 (미정의 이름) 거부", C.checkExpr("x2+1", ["x"]) !== null, true);
check("식 검사", "1.5e-3*x + sin(y) 허용", C.checkExpr("1.5e-3*x + sin(y)", ["x", "y"]), null);
check("식 검사", "pow(x,2)+e 허용", C.checkExpr("pow(x,2)+e", ["x"]), null);
check("식 검사", "빈 식 거부", C.checkExpr("  ", ["x"]) !== null, true);
check("포맷", "fmt(−2.25)", C.fmt(-2.25), "−2.25");
check("포맷", "fmt(4e-30)", C.fmt(4e-30), "4×10⁻³⁰");
check("포맷", "fmt(NaN)", C.fmt(NaN), "정의 안 됨");
check("포맷", "fmt(1e6)", C.fmt(1e6), "10⁶");
check("포맷", "fmt(-0.00001,3)", C.fmt(-0.00001, 3), "−10⁻⁵");
/* ---------- registration in a fake browser ---------- */
{
  const reg = []; const listeners = [];
  const fakeDoc = { readyState: "complete", querySelectorAll: () => [], addEventListener: (e, f) => listeners.push(f), fonts: null };
  const win = { console: { error() {} } };
  const g = vm.createContext({ window: win, document: fakeDoc, setTimeout: (f) => f(), console });
  win.document = fakeDoc; g.window = win;
  vm.runInContext(readFileSync(new URL("assets/v6.js", root), "utf8"), g);
  const base = Object.keys({}); const origReg = win.V6.register;
  win.V6.register = (n, f) => { reg.push(n); origReg(n, f); };
  vm.runInContext(readFileSync(new URL("assets/v6-extra-b.js", root), "utf8").replace(/\bV6\b(?=\.register|=window\.V6)/g, "V6"), Object.assign(g, { V6: win.V6 }));
  const v6names = [...readFileSync(new URL("assets/v6.js", root), "utf8").matchAll(/register\("([^"]+)"/g)].map((m) => m[1]);
  check("등록", "등록된 위젯 이름", reg, ["gd-lr", "directional-derivative", "quadratic-form", "linear-map", "dot-product"]);
  check("등록", `v6.js 이름(${v6names.join(",")})과 충돌 없음`, reg.filter((n) => v6names.includes(n)), []);
  check("등록", "V6 객체에 새 속성 노출 없음", Object.keys(win.V6).sort(), ["GRID", "INK", "RED", "axes", "canvas", "makeFn", "register", "title"]);
}
console.log(`# verify/b-numeric.mjs — ${new Date().toISOString()}`);
console.log(`node ${process.version}; 위젯 계산 = assets/v6-extra-b.js 의 CALC 블록(vm 로드), 독립 계산 = 이 파일의 별도 공식\n`);
console.log("| 그룹 | 항목 | 위젯 값 | 독립 계산 | 결과 |\n|---|---|---|---|---|");
rows.forEach((r) => console.log(r));
console.log(`\n합계: ${rows.length - fails}/${rows.length} PASS, ${fails} FAIL`);
process.exit(fails ? 1 : 0);
