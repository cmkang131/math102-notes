// verify/a-numeric.mjs — independent numeric checks for assets/v6-extra-a.js
// 1) Recompute every key number with code written separately here (no shared code with the widget).
// 2) Load the real assets/v6.js + assets/v6-extra-a.js in a node vm (stub document, no jsdom),
//    grab the widget's internal `calc` through a __testHook that only this fake V6 has,
//    and compare widget values with the independent values.
// usage: node verify/a-numeric.mjs  (writes verify/a-numeric.log)
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const src = (p) => readFileSync(new URL(p, root), "utf8");
const doc = { readyState: "complete", querySelectorAll: () => [], addEventListener() {} };
const ctx = { document: doc, Math, console, setTimeout: () => 0 };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(src("assets/v6.js"), ctx, { filename: "v6.js" });
let W = null;
ctx.V6.__testHook = (x) => { W = x; };
vm.runInContext(src("assets/v6-extra-a.js"), ctx, { filename: "v6-extra-a.js" });
if (!W) throw new Error("test hook not called");
const C = W.calc;

const rows = [];
const close = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function check(group, name, widget, indep, ok, note = "") {
  rows.push({ group, name, widget: String(widget), indep: String(indep), ok: !!ok, note });
}
const num = (v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toPrecision(15)) : String(v));

/* ---------------- independent implementations ---------------- */
function partial(term, N) { let s = 0; for (let n = 1; n <= N; n++) s += term(n); return s; }
// Kahan-summed high precision partial sum for reference
function kahan(term, N) { let s = 0, c = 0; for (let n = 1; n <= N; n++) { const y = term(n) - c, t = s + y; c = (t - s) - y; s = t; } return s; }
// ζ(p) by a different method: direct sum to 1e6 + integral tail midpoint correction
function zetaRef(p) { const M = 200000; let s = kahan((n) => Math.pow(n, -p), M); return s + Math.pow(M + 0.5, 1 - p) / (p - 1); }
function newtonRef(f, df, x0, n) { const xs = [x0]; let x = x0; for (let i = 0; i < n; i++) { const d = df(x); if (d === 0) break; x = x - f(x) / d; xs.push(x); if (!isFinite(x) || Math.abs(x) > 1e8) break; } return xs; }
function solve2(a, b, c, d, r1, r2) { // Gaussian elimination with partial pivoting
  if (Math.abs(c) > Math.abs(a)) { [a, b, r1, c, d, r2] = [c, d, r2, a, b, r1]; }
  const m = c / a; const d2 = d - m * b, r2b = r2 - m * r1; const y = r2b / d2; const x = (r1 - b * y) / a; return [x, y];
}
function bisect(h, a, b) { let fa = h(a); for (let i = 0; i < 200; i++) { const m = (a + b) / 2, fm = h(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } } return (a + b) / 2; }
function period(g, x0, T = 50000) { let x = x0; for (let i = 0; i < T; i++) x = g(x); const s = [x]; for (let i = 0; i < 200; i++) { x = g(x); s.push(x); }
  for (let p = 1; p <= 100; p++) { let ok = true; for (let i = 0; i + p < s.length; i++) if (Math.abs(s[i + p] - s[i]) > 1e-8) { ok = false; break; } if (ok) return p; } return 0; }

/* ---------------- 1. series ---------------- */
{
  const P = { r: 0.5, p: 1.5 };
  const S = W.SERIES;
  for (const N of [10, 30, 100, 200]) {
    const d = C.seriesData((n) => S["p2"].term(n, P), N), SN = d.S[N - 1];
    const ref = kahan((n) => 1 / (n * n), N), R = Math.PI ** 2 / 6 - ref;
    check("series", `Σ1/n² S_${N}`, num(SN), num(ref), close(SN, ref, 1e-13));
    check("series", `적분판정 꼬리 1/(N+1)<π²/6−S_N<1/N, N=${N}`, num(Math.PI ** 2 / 6 - SN), `(${num(1 / (N + 1))}, ${num(1 / N)})`, R > 1 / (N + 1) && R < 1 / N);
  }
  for (const N of [1, 2, 39, 40, 200]) {
    const SN = C.seriesData((n) => S["alt-harmonic"].term(n, P), N).S[N - 1];
    const ref = kahan((n) => (n % 2 ? 1 : -1) / n, N);
    check("series", `교대조화 S_${N}`, num(SN), num(ref), close(SN, ref, 1e-13));
    check("series", `교대 오차 |ln2−S_N| ≤ 1/(N+1), N=${N}`, num(Math.abs(Math.LN2 - SN)), num(1 / (N + 1)), Math.abs(Math.LN2 - ref) <= 1 / (N + 1));
  }
  // known: H_100 = 5.187377517639621
  { const SN = C.seriesData((n) => S["harmonic"].term(n, P), 100).S[99];
    check("series", "H_100", num(SN), "5.18737751763962", close(SN, 5.187377517639621, 1e-14));
    const g = SN - Math.log(100); check("series", "H_100 − ln 100 − γ ≈ 1/(2·100)", num(g - C.EULER_GAMMA), num(1 / 200), Math.abs(g - C.EULER_GAMMA - 1 / 200) < 1e-5); }
  for (const r of [0.5, -0.8, 0.95, 0, -1, 1, 1.5]) {
    const N = 40, SN = C.seriesData((n) => S["geometric"].term(n, { r }), N).S[N - 1];
    const ref = r === 1 ? N : (1 - Math.pow(r, N)) / (1 - r);
    check("series", `기하 r=${r} S_40 = (1−r^N)/(1−r)`, num(SN), num(ref), close(SN, ref, 1e-12));
    const sum = S["geometric"].sum({ r });
    const expect = Math.abs(r) < 1 ? 1 / (1 - r) : null;
    check("series", `기하 r=${r} 합 표시`, sum ? num(sum.v) : "없음(발산)", expect === null ? "없음(발산)" : num(expect), sum ? close(sum.v, expect, 1e-15) : expect === null);
  }
  { const N = 50, SN = C.seriesData((n) => S["n-over-n1"].term(n, P), N).S[N - 1];
    const ref = N + 1 - kahan((n) => 1 / n, N + 1); // Σ n/(n+1) = N − (H_{N+1} − 1)
    check("series", "Σ n/(n+1), N=50 = N+1−H_{N+1}", num(SN), num(ref), close(SN, ref, 1e-13)); }
  for (const p of [1.05, 1.5, 2, 3, 4]) {
    const z = C.zeta(p), zr = p === 2 ? Math.PI ** 2 / 6 : p === 4 ? Math.PI ** 4 / 90 : zetaRef(p);
    check("series", `ζ(${p})`, num(z), num(zr), close(z, zr, p === 1.05 ? 1e-6 : 1e-9), p === 2 || p === 4 ? "닫힌 형태" : "독립 합(2·10⁵항+꼬리)");
  }
  check("series", "ζ(1.5) 문헌값 2.612375348685488", num(C.zeta(1.5)), "2.61237534868549", close(C.zeta(1.5), 2.612375348685488, 1e-12));
  check("series", "ζ(3) 아페리 상수 1.2020569031595942", num(C.zeta(3)), "1.20205690315959", close(C.zeta(3), 1.2020569031595942, 1e-12));
  check("series", "p=1 (p급수) 합 없음", String(S.pseries.sum({ p: 1 })), "null", S.pseries.sum({ p: 1 }) === null);
  // p-series tail bound used in the text
  for (const p of [1.5, 2.5]) { const N = 20, SN = kahan((n) => n ** -p, N), q = p - 1, R = zetaRef(p) - SN;
    check("series", `p=${p} 꼬리 범위 N=20`, num(R), `(${num(1 / (q * (N + 1) ** q))}, ${num(1 / (q * N ** q))})`, R > 1 / (q * (N + 1) ** q) && R < 1 / (q * N ** q)); }
  // undefined term handling
  { const d = C.seriesData((n) => 1 / (n - 3), 6); check("series", "a_3 정의 안 됨 → bad=[3], S_3 이후 NaN", JSON.stringify(d.bad) + " " + d.S.map((v) => (isNaN(v) ? "NaN" : "ok")).join(","), "[3] ok,ok,NaN,NaN,NaN,NaN", JSON.stringify(d.bad) === "[3]" && isNaN(d.S[5]) && !isNaN(d.S[1])); }
}

/* ---------------- 2. newton1d ---------------- */
{
  const NW = W.NEWTON;
  const indep = {
    sqrt2: [(x) => x * x - 2, (x) => 2 * x],
    cos: [(x) => Math.cos(x) - x, (x) => -Math.sin(x) - 1],
    cycle: [(x) => x ** 3 - 2 * x + 2, (x) => 3 * x * x - 2],
    atan: [(x) => Math.atan(x), (x) => 1 / (1 + x * x)],
    flat: [(x) => x * x - 2, (x) => 2 * x],
    double: [(x) => (x - 1) ** 2, (x) => 2 * (x - 1)],
  };
  for (const k of Object.keys(indep)) {
    const P = NW[k], run = C.newton1d(P.f, P.df, P.x0, 8), xs = run.it.map((t) => t.x);
    const ref = newtonRef(indep[k][0], indep[k][1], P.x0, xs.length - 1);
    const maxd = Math.max(...xs.map((x, i) => Math.abs(x - ref[i]) / Math.max(1, Math.abs(ref[i]))));
    check("newton1d", `${k}: 반복열 ${xs.length}개 일치`, xs.slice(0, 4).map(num).join(", "), ref.slice(0, 4).map(num).join(", "), maxd < 1e-13, `status=${run.status}`);
  }
  // roots of presets
  check("newton1d", "cos x = x 근 (이분법 독립)", num(NW.cos.root), num(bisect((x) => Math.cos(x) - x, 0, 1)), close(NW.cos.root, bisect((x) => Math.cos(x) - x, 0, 1), 1e-15));
  check("newton1d", "x³−2x+2 실근", num(NW.cycle.root), num(bisect((x) => x ** 3 - 2 * x + 2, -2, -1.5)), close(NW.cycle.root, bisect((x) => x ** 3 - 2 * x + 2, -2, -1.5), 1e-15));
  // 2-cycle exactly
  { const r = C.newton1d(NW.cycle.f, NW.cycle.df, 0, 8); check("newton1d", "x³−2x+2, x0=0 → 0,1,0,1,…", r.it.map((t) => t.x).join(","), "0,1,0,1,0,1,0,1,0", r.it.map((t) => t.x).join(",") === "0,1,0,1,0,1,0,1,0"); }
  // quadratic convergence constant for √2 : e_{n+1}/e_n² → 1/(2√2)
  { const xs = C.newton1d(NW.sqrt2.f, NW.sqrt2.df, 1, 8).it.map((t) => t.x), e = xs.map((x) => Math.abs(x - Math.SQRT2));
    const ratio = e[4] / (e[3] * e[3]); check("newton1d", "√2: e₄/e₃² → C = 1/(2√2)", num(ratio), num(1 / (2 * Math.SQRT2)), Math.abs(ratio - 1 / (2 * Math.SQRT2)) < 1e-3); }
  { const xs = C.newton1d(NW.cos.f, NW.cos.df, 0, 8).it.map((t) => t.x), r = NW.cos.root, e = xs.map((x) => Math.abs(x - r));
    const Cc = r / (2 * (1 + Math.sin(r))); // |f''/(2f')| = cos r / (2(1+sin r)), cos r = r
    const ratio = e[4] / (e[3] * e[3]); check("newton1d", "cos x−x: e₄/e₃² ≈ C = cos r/(2(1+sin r))", num(ratio), num(Cc), Math.abs(ratio - Cc) < 2e-3, "점근값이라 n이 커야 맞음"); }
  // double root: e_{n+1}/e_n = 1/2 exactly
  { const xs = C.newton1d(NW.double.f, NW.double.df, 2, 8).it.map((t) => t.x); const ok = xs.every((x, i) => i === 0 || Math.abs((x - 1) / (xs[i - 1] - 1) - 0.5) < 1e-12);
    check("newton1d", "중근 (x−1)²: e_{n+1}/e_n = 1/2", xs.slice(0, 4).map(num).join(", "), "2, 1.5, 1.25, 1.125", ok); }
  // atan threshold: 2x = (1+x²) atan x
  { const xc = bisect((x) => 2 * x - (1 + x * x) * Math.atan(x), 1, 2);
    check("newton1d", "arctan 임계 |x0| (문구 1.3917)", "1.3917", num(xc), Math.abs(xc - 1.3917) < 1e-4);
    const a = C.newton1d(Math.atan, (x) => 1 / (1 + x * x), 1.39, 40), b = C.newton1d(Math.atan, (x) => 1 / (1 + x * x), 1.40, 40);
    check("newton1d", "arctan x0=1.39 수렴, x0=1.40 발산", a.status + " / " + b.status, "conv|root / diverge", (a.status === "conv" || a.status === "root") && b.status === "diverge");
    const s = C.newton1d(NW.atan.f, NW.atan.df, 1.5, 8);
    check("newton1d", "arctan x0=1.5: |x_n| 증가·부호 교대", s.it.map((t) => t.x.toFixed(3)).join(", "), "1.5, -1.694, 2.321, -5.114, 32.296, …", s.status === "diverge" && Math.abs(s.it[1].x + 1.6940796) < 1e-6); }
  // flat: x0=0 stops immediately, x0=0.1 → 10.05
  { const r0 = C.newton1d(NW.sqrt2.f, NW.sqrt2.df, 0, 8); check("newton1d", "x²−2, x0=0 → f'=0 멈춤", r0.status, "flat", r0.status === "flat" && r0.it.length === 1);
    const r1 = C.newton1d(NW.flat.f, NW.flat.df, 0.1, 8); check("newton1d", "x²−2, x0=0.1 → x1 = 10.05", num(r1.it[1].x), num(0.1 - (0.01 - 2) / 0.2), close(r1.it[1].x, 10.05, 1e-14)); }
  // custom with numeric derivative converges to root of x³−x−1 (plastic number 1.324717957244746)
  { const f = W.compile("x*x*x-x-1", ["x"]).fn, run = C.newton1d(f, (x) => C.dnum(f, x), 1.5, 30), x = run.it[run.it.length - 1].x;
    check("newton1d", "직접입력 x³−x−1 (수치미분) → 1.324717957244746", num(x), "1.32471795724475", close(x, 1.324717957244746, 1e-14), run.status); }
}

/* ---------------- 3. newton2d ---------------- */
{
  const PR = W.PAIRS;
  const indepF = {
    "circle-xy": [(x, y) => [x * x + y * y - 4, x * y - 1], (x, y) => [[2 * x, 2 * y], [y, x]]],
    "circle-hyp": [(x, y) => [x * x + y * y - 4, x * x - y * y - 1], (x, y) => [[2 * x, 2 * y], [2 * x, -2 * y]]],
  };
  const starts = { "circle-xy": [[2, 1], [0.5, 1.5], [-1, 0.3], [1, 1.01]], "circle-hyp": [[1, 0.5], [0.2, 1], [2, 2]] };
  for (const k of Object.keys(indepF)) {
    const [F, J] = indepF[k];
    for (const s of PR[k].sols) { const f = F(s[0], s[1]); check("newton2d", `${k}: 해 (${s.map((v) => v.toFixed(6))}) 에서 |F|≈0`, num(Math.hypot(...f)), "0", Math.hypot(...f) < 1e-14); }
    for (const [x0, y0] of starts[k]) {
      const run = C.newton2d(PR[k].F, PR[k].J, x0, y0, 8);
      let x = x0, y = y0, maxd = 0;
      for (let i = 0; i < run.it.length; i++) {
        const t = run.it[i]; maxd = Math.max(maxd, Math.abs(t.x - x) / Math.max(1, Math.abs(x)), Math.abs(t.y - y) / Math.max(1, Math.abs(y)));
        const j = J(x, y), f = F(x, y), det = j[0][0] * j[1][1] - j[0][1] * j[1][0];
        if (Math.abs(t.det - det) > 1e-12 * Math.max(1, Math.abs(det))) maxd = 1;
        if (t.status !== "ok") break;
        const [dx, dy] = solve2(j[0][0], j[0][1], j[1][0], j[1][1], -f[0], -f[1]); x += dx; y += dy;
      }
      const last = run.it[run.it.length - 1];
      check("newton2d", `${k} 시작 (${x0}, ${y0}): 반복열·det 일치`, `(${last.x.toFixed(8)}, ${last.y.toFixed(8)})`, `(${x.toFixed(8)}, ${y.toFixed(8)})`, maxd < 1e-9, `status=${run.status}, 반복 ${run.it.length - 1}`);
    }
  }
  { const s = C.newton2dStep(PR["circle-xy"].F, PR["circle-xy"].J, 1, 1); check("newton2d", "(1,1): det J = 2−2 = 0 → singular", s.status + ", det=" + s.det, "singular, det=0", s.status === "singular" && s.det === 0); }
  { const s = C.newton2dStep(PR["circle-hyp"].F, PR["circle-hyp"].J, 0, 1); check("newton2d", "x²−y²=1 짝, (0,1): det = −8xy = 0 → singular", s.status, "singular", s.status === "singular"); }
  { const s = C.newton2dStep(PR["circle-xy"].F, PR["circle-xy"].J, 2, 1); check("newton2d", "(2,1) 첫 걸음 Δ = (0, −0.5)", `(${num(s.dx)}, ${num(s.dy)})`, "(0, -0.5)", Math.abs(s.dx) < 1e-15 && Math.abs(s.dy + 0.5) < 1e-15); }
  // quadratic convergence in 2D: |F| roughly squares
  { const run = C.newton2d(PR["circle-xy"].F, PR["circle-xy"].J, 2, 1, 8), n = run.it.map((t) => t.normF);
    check("newton2d", "(2,1): |F| 가 대략 제곱씩 감소 (|F₃| ≤ 10·|F₂|²)", n.slice(0, 5).map((v) => v.toExponential(2)).join(", "), "2차 수렴", n[3] <= 10 * n[2] * n[2]); }
  // analytic solutions
  check("newton2d", "x²=2+√3 해 √(2+√3) = 1.9318516525781366", num(PR["circle-xy"].sols[0][0]), "1.93185165257814", close(PR["circle-xy"].sols[0][0], 1.9318516525781366, 1e-15));
}

/* ---------------- 4. cobweb ---------------- */
{
  const CB = W.COB, L = C.logistic;
  check("cobweb", "cos 고정점", num(CB.cos.fixed()[0]), num(bisect((x) => Math.cos(x) - x, 0, 1)), close(CB.cos.fixed()[0], bisect((x) => Math.cos(x) - x, 0, 1), 1e-15));
  check("cobweb", "cos: g'(x*) = −sin x* (문구 −0.6736)", num(CB.cos.dg(CB.cos.fixed()[0])), num(-Math.sin(0.7390851332151607)), Math.abs(CB.cos.dg(CB.cos.fixed()[0]) + 0.67361) < 1e-5);
  check("cobweb", "cos 문구: sin 1 ≈ 0.841", "0.841", num(Math.sin(1)), Math.abs(Math.sin(1) - 0.841) < 5e-4);
  for (const r of [0.5, 1, 2.8, 3, 3.2, 3.9]) {
    const fp = CB.logistic.fixedR(r), g = CB.logistic.gR(r), dg = CB.logistic.dgR(r);
    const ok = fp.every((x) => Math.abs(g(x) - x) < 1e-15);
    const ind = r === 1 ? [0] : [0, 1 - 1 / r];
    check("cobweb", `로지스틱 r=${r} 고정점`, fp.map(num).join(", "), ind.map(num).join(", "), ok && fp.length === ind.length);
    if (r > 1) check("cobweb", `로지스틱 r=${r} g'(x*) = 2 − r`, num(dg(1 - 1 / r)), num(2 - r), Math.abs(dg(1 - 1 / r) - (2 - r)) < 1e-12);
  }
  // numeric fixed-point finder (custom path) vs independent bisection
  { const f = W.compile("1+1/x", ["x"]).fn, fp = C.fixedPoints(f, 0.5, 2.5); check("cobweb", "직접입력 1+1/x 고정점 = 황금비", fp.map(num).join(", "), num((1 + Math.sqrt(5)) / 2), fp.length === 1 && Math.abs(fp[0] - (1 + Math.sqrt(5)) / 2) < 1e-9); }
  { const g = (x) => 3.2 * x * (1 - x), fp = C.fixedPoints(g, 0, 1); check("cobweb", "fixedPoints(3.2x(1−x), [0,1])", fp.map(num).join(", "), "0, 0.6875", fp.length === 2 && Math.abs(fp[0]) < 1e-9 && Math.abs(fp[1] - 0.6875) < 1e-9); }
  { const g = (x) => x * (1 - x), fp = C.fixedPoints(g, -0.5, 1); check("cobweb", "접하는 고정점 (r=1, x*=0, 부호변화 없음)", fp.map(num).join(", "), "0", fp.length === 1 && Math.abs(fp[0]) < 1e-6); }
  { const fp = C.fixedPoints((x) => Math.tan(x), 1, 2); check("cobweb", "tan x 극(π/2)을 가짜 고정점으로 잡지 않음", fp.map(num).join(", ") || "(없음)", "(없음)", fp.length === 0); }
  // long-run behaviour vs independent period detection
  const lrCases = [[2.8, 1], [3.2, 2], [3.5, 4], [3.55, 8], [3.835, 3], [3.9, 0]];
  for (const [r, p] of lrCases) {
    const lr = C.longRun((x) => r * x * (1 - x), 0.2), pw = lr.kind === "fixed" ? 1 : lr.kind === "cycle" ? lr.p : 0, pi = period((x) => r * x * (1 - x), 0.2);
    check("cobweb", `로지스틱 r=${r} 장기 주기`, lr.kind + (lr.p ? " p=" + lr.p : ""), `p=${pi} (기대 ${p || "주기 없음"})`, pw === pi && pi === p);
  }
  { const r = 3.2, a = ((r + 1) + Math.sqrt((r + 1) * (r - 3))) / (2 * r), b = ((r + 1) - Math.sqrt((r + 1) * (r - 3))) / (2 * r);
    const lr = C.longRun((x) => r * x * (1 - x), 0.2), pts = lr.pts.slice().sort();
    check("cobweb", "r=3.2 2-주기 점 = ((r+1) ± √((r+1)(r−3)))/(2r)", pts.map(num).join(", "), [b, a].map(num).join(", "), Math.abs(pts[0] - b) < 1e-9 && Math.abs(pts[1] - a) < 1e-9); }
  { const lr = C.longRun((x) => 3 * x * (1 - x), 0.2); check("cobweb", "r=3: ‘느린 수렴’으로 표시 (주기 2로 단정 안 함)", lr.kind + " slow=" + lr.slow, "slow=true", lr.slow === true); }
  { const lr = C.longRun((x) => x * (1 - x), 0.2); check("cobweb", "r=1: 0 으로 느린 수렴", lr.kind + " slow=" + lr.slow, "fixed, slow", lr.kind === "fixed" && lr.slow === true); }
  { const lr = C.longRun((x) => x * x, 1.05); check("cobweb", "x², x0=1.05 → 발산", lr.kind, "diverge", lr.kind === "diverge"); }
  // logistic thresholds
  { const r2 = bisect((r) => (-r * r + 2 * r + 4) + 1, 3, 4); // 2-cycle multiplier −r²+2r+4 = −1
    check("cobweb", "2-주기 불안정화 r = 1+√6 (승수 −r²+2r+4 = −1)", num(L.r2cycle), num(r2), close(L.r2cycle, r2, 1e-12)); }
  check("cobweb", "r=3.544 은 4-주기, 3.5442 는 8-주기 (경계 3.5441)", `${period((x) => 3.544 * x * (1 - x), 0.2, 400000)}, ${period((x) => 3.5442 * x * (1 - x), 0.2, 400000)}`, "4, 8",
    period((x) => 3.544 * x * (1 - x), 0.2, 400000) === 4 && period((x) => 3.5442 * x * (1 - x), 0.2, 400000) === 8);
  check("cobweb", "3-주기 창 시작 1+√8 = 3.828427", num(L.r3window), num(1 + Math.sqrt(8)), close(L.r3window, 3.8284271247461903, 1e-15));
  { const lt = W.logisticText; const t = [lt(0.5), lt(1), lt(2.8), lt(3), lt(3.2), lt(3.5), lt(3.56), lt(3.9), lt(4)];
    const ok = t[0].includes("0 으로 수렴") && t[1].includes("판정 불가") && t[2].includes("안정") && t[3].includes("판정 불가") && t[4].includes("2-주기") && t[5].includes("4-주기") && t[6].includes("8, 16") && t[7].includes("혼돈") && t[8].includes("혼돈");
    check("cobweb", "로지스틱 구간 문구 (0.5,1,2.8,3,3.2,3.5,3.56,3.9,4)", "문구 9개", "기대 키워드", ok); }
  check("cobweb", "classifyFixed: 0.5/1/1.0000001/2", ["attract", "neutral", "repel", "repel"].join(","), [0.5, 1, 1.0000001, -2].map((d) => C.classifyFixed(d, 1e-9)).join(","), [0.5, 1, 1.0000001, -2].map((d) => C.classifyFixed(d, 1e-9)).join(",") === "attract,neutral,repel,repel");
}

/* ---------------- 5. expression guard / formatting ---------------- */
{
  const cases = [["1/n^2", false], ["2n", false], ["(n+1)(n+2)", false], ["2(n+1)", false], ["N", false], ["alert(1)", false], ["sin(n", false], ["1/n**2", true],
    ["1e-3*n", true], ["pow(-1,n+1)/n", true], ["1/(n*(n+1))", true], ["atan(n)", true], ["x2", false], ["n;1", false], ["", false]];
  for (const [s, ok] of cases) { const r = W.compile(s, ["n"]); check("guard", `compile("${s}")`, r.err ? "오류: " + r.err.slice(0, 30) + "…" : "ok", ok ? "ok" : "오류", ok ? !!r.fn : !!r.err); }
  { const r = W.compile("1e-3*n", ["n"]); check("guard", "1e-3*n at n=2", num(r.fn(2)), "0.002", r.fn(2) === 0.002); }
  { const r = W.compile("pow(-1,n+1)/n", ["n"]); check("guard", "pow(-1,n+1)/n at n=2", num(r.fn(2)), "-0.5", r.fn(2) === -0.5); }
  { const r = W.compile("1/(n-1)", ["n"]); check("guard", "1/(n-1) at n=1 → NaN (발산 표시)", String(r.fn(1)), "NaN", Number.isNaN(r.fn(1))); }
  const F = W.fmt;
  check("fmt", "fmt(265742.22,4)", F(265742.22, 4), "265742", F(265742.22, 4) === "265742");
  check("fmt", "fmt(3.306e35)", F(3.306e35), "3.306×10³⁵", F(3.306e35) === "3.306×10³⁵");
  check("fmt", "fmt(NaN), fmt(Infinity)", F(NaN) + " / " + F(Infinity), "정의 안 됨 / +∞ (발산)", F(NaN) === "정의 안 됨" && F(Infinity) === "+∞ (발산)");
  check("fmt", "fmt(-0.5)", F(-0.5), "−0.5", F(-0.5) === "−0.5");
}

/* ---------------- output ---------------- */
const pass = rows.filter((r) => r.ok).length;
const pad = (s, n) => { s = String(s); return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); };
let out = `# verify/a-numeric.mjs  (${new Date().toISOString()})\n# widget = assets/v6-extra-a.js 의 calc (vm 로드), indep = 이 스크립트에서 따로 계산\n\n`;
out += `${pad("결과", 5)} | ${pad("그룹", 9)} | ${pad("항목", 52)} | ${pad("widget", 40)} | ${pad("indep", 40)} | 비고\n`;
out += "-".repeat(170) + "\n";
for (const r of rows) out += `${pad(r.ok ? "PASS" : "FAIL", 5)} | ${pad(r.group, 9)} | ${pad(r.name, 52)} | ${pad(r.widget, 40)} | ${pad(r.indep, 40)} | ${r.note}\n`;
out += `\n합계: ${pass} / ${rows.length} PASS${pass === rows.length ? "" : "  ← FAIL 있음"}\n`;
writeFileSync(new URL("./a-numeric.log", import.meta.url), out);
console.log(out);
process.exitCode = pass === rows.length ? 0 : 1;
