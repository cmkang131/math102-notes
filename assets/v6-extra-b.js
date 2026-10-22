/* v6-extra-b.js — MATH102 v6 course widgets (set B).
   Load after assets/v6.js:
     <script src="assets/v6.js"></script><script src="assets/v6-extra-b.js"></script>
   Widgets: gd-lr, directional-derivative, quadratic-form, linear-map, dot-product.
   Pure math lives in the CALC block below (no DOM); verify/b-numeric.mjs loads
   only that block through node:vm and checks it against an independent rewrite. */
(function(){
"use strict";
var V6=window.V6;
if(!V6||typeof V6.register!=="function"){
  if(window.console)console.error("v6-extra-b: assets/v6.js 를 먼저 로드해야 합니다.");return;}

/*CALC-BEGIN*/
var calc=(function(){
var SUP={"-":"⁻","0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹"};
function sup(n){return String(n).split("").map(function(ch){return SUP[ch]||ch;}).join("");}
function trimZ(s){return s.indexOf(".")<0?s:s.replace(/0+$/,"").replace(/\.$/,"");}
function minus(s){return s.charAt(0)==="-"?"−"+s.slice(1):s;}
/* number -> display string. d = max decimals. tiny/huge -> m×10ⁿ */
function fmt(x,d){
  if(typeof x!=="number"||x!==x)return "정의 안 됨";
  if(!isFinite(x))return x>0?"+∞":"−∞";
  if(d==null)d=3;
  if(x===0)return "0";
  var ax=Math.abs(x);
  if(ax>=1e5||ax<Math.pow(10,-d)){
    var ex=Math.floor(Math.log10(ax)),m=(x/Math.pow(10,ex)).toFixed(2);
    if(Math.abs(parseFloat(m))>=10){ex+=1;m=(x/Math.pow(10,ex)).toFixed(2);}
    m=trimZ(m);
    return minus(m==="1"?"":m==="-1"?"-":m+"×")+"10"+sup(ex);
  }
  var s=trimZ(x.toFixed(d));
  if(s==="-0")s="0";
  return minus(s);
}
/* snap |x| < tol*scale to exact 0 (roundoff noise) */
function snap(x,scale){return Math.abs(x)<=1e-12*Math.max(1,Math.abs(scale||0))?0:x;}
function niceStep(raw){
  if(!(raw>0)||!isFinite(raw))return 1;
  var p=Math.pow(10,Math.floor(Math.log10(raw))),m=raw/p;
  return (m<=1?1:m<=2?2:m<=5?5:10)*p;
}
function niceTicks(lo,hi,n){
  if(!(hi>lo))return [lo];
  var st=niceStep((hi-lo)/(n||5)),out=[];
  for(var t=Math.ceil(lo/st-1e-9)*st;t<=hi+st*1e-9;t+=st)out.push(parseFloat((Math.round(t/st)*st).toPrecision(12)));
  return out;
}
/* expression check for V6.makeFn: returns null if ok, else Korean message */
var FUNCS=["abs","sqrt","pow","exp","log","sin","cos","tan","pi","e","min","max"];
function checkExpr(src,vars){
  if(typeof src!=="string"||!src.trim())return "식이 비어 있습니다.";
  if(src.indexOf("^")>=0)return "‘^’는 쓸 수 없습니다. 거듭제곱은 pow(x,2) 또는 x*x 로 쓰세요.";
  var bad=src.match(/[^0-9A-Za-z_+\-*\/(). ,\t]/);
  if(bad)return "허용되지 않는 문자 ‘"+bad[0]+"’가 있습니다.";
  var ids=src.replace(/\b\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/g," ").match(/[A-Za-z_]\w*/g)||[];
  for(var i=0;i<ids.length;i++)
    if(vars.indexOf(ids[i])<0&&FUNCS.indexOf(ids[i])<0)
      return "알 수 없는 이름 ‘"+ids[i]+"’ (변수 "+vars.join(", ")+"와 "+FUNCS.join(" ")+"만 사용 가능)";
  return null;
}
/* ---- gradient descent ---- */
/* iterate x_{k+1} = x_k - eta*df(x_k); stop when |x|>cap (diverged) or value undefined */
function gd1(df,eta,x0,N,cap){
  var xs=[x0],status="ok",at=-1;
  for(var k=0;k<N;k++){
    var g=df(xs[k]),nx=xs[k]-eta*g;
    if(g!==g||nx!==nx){status="undef";at=k+1;break;}
    if(!isFinite(nx)||Math.abs(nx)>cap){xs.push(nx);status="div";at=k+1;break;}
    xs.push(nx);
  }
  return {xs:xs,status:status,at:at};
}
/* f = c x^2 / 2 with step eta: x_{k+1} = r x_k, r = 1 - eta c */
function classifyQuadLR(c,eta){
  var p=eta*c,r=1-p,tol=1e-9,kind;
  if(!(c>0))kind="badc";
  else if(!(eta>0))kind=eta===0?"zero":"neg";
  else if(Math.abs(p-1)<tol)kind="one";
  else if(Math.abs(p-2)<tol)kind="bounce";
  else if(p<1)kind="mono";
  else if(p<2)kind="osc";
  else kind="div";
  return {r:Math.abs(p-1)<tol?0:r,kind:kind,etaOne:1/c,etaMax:2/c};
}
/* f = (x^2 + kappa y^2)/2 */
function gd2(kappa,eta,x0,y0,N,cap){
  var P=[[x0,y0]],status="ok",at=-1;
  for(var k=0;k<N;k++){
    var x=P[k][0],y=P[k][1],nx=x-eta*x,ny=y-eta*kappa*y;
    P.push([nx,ny]);
    if(!isFinite(nx)||!isFinite(ny)||Math.abs(nx)>cap||Math.abs(ny)>cap){status="div";at=k+1;break;}
  }
  return {P:P,status:status,at:at};
}
function f2(kappa,x,y){return 0.5*(x*x+kappa*y*y);}
function rates2(kappa,eta){
  var rx=1-eta,ry=1-eta*kappa,lmin=Math.min(1,kappa),lmax=Math.max(1,kappa);
  return {rx:rx,ry:ry,rho:Math.max(Math.abs(rx),Math.abs(ry)),
    etaMax:2/lmax,etaStar:2/(lmin+lmax),rhoStar:(lmax-lmin)/(lmax+lmin)};
}
/* k with rho^(2k) <= tol (sufficient, from f_k <= rho^(2k) f_0) */
function itersFor(rho,tol){
  if(!(rho>=0))return NaN;
  if(rho===0)return 1;
  if(rho>=1)return Infinity;
  return Math.ceil(Math.log(tol)/(2*Math.log(rho))-1e-12);
}
/* ---- directional derivative ---- */
function grad(f,a,b){
  var hx=1e-5*Math.max(1,Math.abs(a)),hy=1e-5*Math.max(1,Math.abs(b));
  var fx=(f(a+hx,b)-f(a-hx,b))/(2*hx),fy=(f(a,b+hy)-f(a,b-hy))/(2*hy);
  /* one-sided check (kinks such as sqrt(x²+y²) at 0) */
  var h1=1e-6*Math.max(1,Math.abs(a)),h2=1e-6*Math.max(1,Math.abs(b)),f0=f(a,b);
  var xf=(f(a+h1,b)-f0)/h1,xb=(f0-f(a-h1,b))/h1,yf=(f(a,b+h2)-f0)/h2,yb=(f0-f(a,b-h2))/h2;
  var kink=Math.abs(xf-xb)>1e-2*(1+Math.abs(xf)+Math.abs(xb))||Math.abs(yf-yb)>1e-2*(1+Math.abs(yf)+Math.abs(yb));
  return {fx:fx,fy:fy,kink:kink};
}
function dirDeriv(fx,fy,th){return fx*Math.cos(th)+fy*Math.sin(th);}
/* one-sided difference quotient [f(P+hu) - f(P)]/h (the definition, h small) */
function oneSided(f,a,b,th,h){h=h||1e-6*Math.max(1,Math.abs(a),Math.abs(b));return (f(a+h*Math.cos(th),b+h*Math.sin(th))-f(a,b))/h;}
/* differentiability probe: does grad·u match the one-sided quotient in 16 directions? */
function diffCheck(f,a,b,fx,fy){
  var n=Math.hypot(fx,fy),worst=0;
  for(var i=0;i<16;i++){var t=i*Math.PI/8,q=oneSided(f,a,b,t);
    if(q!==q)return {ok:false,worst:NaN};
    worst=Math.max(worst,Math.abs(q-dirDeriv(fx,fy,t)));}
  return {ok:worst<=2e-3*(1+n),worst:worst};
}
/* ---- quadratic form Q = a x² + 2b xy + c y², matrix [[a,b],[b,c]] ---- */
function eig2(a,b,c){
  var m=(a+c)/2,R=Math.hypot(a-c,2*b)/2,det=a*c-b*b,l1,l2;
  if(m>=0){l2=m+R;l1=l2!==0?det/l2:0;}else{l1=m-R;l2=det/l1;}
  /* Q(cos t, sin t) = m + R cos(2t - phi): max at t2 = phi/2 */
  var t2=Math.atan2(2*b,a-c)/2;
  return {l1:l1,l2:l2,t2:t2,t1:t2+Math.PI/2,det:det,tr:a+c,R:R};
}
function Qval(a,b,c,x,y){return a*x*x+2*b*x*y+c*y*y;}
function classifyQ(l1,l2,scale){
  var tol=1e-9*Math.max(1,scale||0),z1=Math.abs(l1)<=tol,z2=Math.abs(l2)<=tol;
  if(z1&&z2)return "zero";
  if(z1)return l2>0?"psd":"nsd";
  if(z2)return l1<0?"nsd":"psd";
  if(l1>0)return "pd";
  if(l2<0)return "nd";
  return "indef";
}
/* ---- 2x2 linear map [[p,q],[r,s]] ---- */
function det2(p,q,r,s){return p*s-q*r;}
function apply2(p,q,r,s,x,y){return [p*x+q*y,r*x+s*y];}
/* ---- dot product ---- */
function dot(u,v){return u[0]*v[0]+u[1]*v[1];}
function proj(u,v){var uu=dot(u,u);if(!(uu>0))return null;var t=dot(u,v)/uu;return [t*u[0],t*u[1]];}
function angleBetween(u,v){
  var nu=Math.hypot(u[0],u[1]),nv=Math.hypot(v[0],v[1]);
  if(!(nu>0)||!(nv>0))return NaN;
  /* atan2 form is accurate near 0 and π */
  return Math.atan2(Math.abs(u[0]*v[1]-u[1]*v[0]),dot(u,v));
}
return {fmt:fmt,snap:snap,sup:sup,niceTicks:niceTicks,checkExpr:checkExpr,gd1:gd1,classifyQuadLR:classifyQuadLR,
  gd2:gd2,f2:f2,rates2:rates2,itersFor:itersFor,grad:grad,dirDeriv:dirDeriv,oneSided:oneSided,diffCheck:diffCheck,eig2:eig2,Qval:Qval,
  classifyQ:classifyQ,det2:det2,apply2:apply2,dot:dot,proj:proj,angleBetween:angleBetween};
})();
/*CALC-END*/

/* ================= drawing / UI helpers ================= */
var INK=V6.INK,RED=V6.RED,GRID=V6.GRID,GRAY="#8a8a8a",SOFT="#555",FONT="'Noto Sans KR',sans-serif";
var fmt=calc.fmt,DEG=Math.PI/180;
var MINE={},MOUNT={};
function num(v,def,lo,hi){var x=typeof v==="string"&&v.trim()===""?NaN:Number(v);
  if(v==null||typeof v==="boolean"||!isFinite(x))x=def;
  if(lo!=null&&x<lo)x=lo;if(hi!=null&&x>hi)x=hi;return x;}
function esc(s){return String(s).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch];});}
function fail(el,msg){var d=document.createElement("div");d.className="v6-state";d.style.color=RED;
  d.textContent="오류: "+msg;el.appendChild(d);}
function mount(name,fn){
  MINE[name]=1;
  V6.register(name,MOUNT[name]=function(el,cfg){
    el.setAttribute("data-v6b","1");
    if(!cfg||typeof cfg!=="object"||Array.isArray(cfg))cfg={};
    try{var redraw=fn(el,cfg);
      /* canvas text drawn before the web font loads would keep the fallback face: redraw once ready */
      if(typeof redraw==="function"&&document.fonts&&document.fonts.status!=="loaded")
        document.fonts.ready.then(function(){try{redraw();}catch(e){}});
    }catch(e){
      if(window.console)console.error("v6-extra-b "+name+":",e);
      fail(el,"위젯을 그리지 못했습니다 ("+(e&&e.message||e)+")");}
  });
}
function setFont(ctx,px,bold){ctx.font=(bold?"700 ":"")+px+"px "+FONT;}
function text(ctx,s,x,y,o){
  o=o||{};setFont(ctx,o.size||12,o.bold);ctx.textAlign=o.align||"left";ctx.textBaseline=o.base||"alphabetic";
  if(o.halo!==false){ctx.lineJoin="round";ctx.lineWidth=4;ctx.strokeStyle="#fff";ctx.strokeText(s,x,y);}
  ctx.fillStyle=o.color||INK;ctx.fillText(s,x,y);
}
function line(ctx,x1,y1,x2,y2,color,w,dash){
  ctx.save();ctx.strokeStyle=color||INK;ctx.lineWidth=w||1;ctx.setLineDash(dash||[]);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}
function arrow(ctx,x1,y1,x2,y2,color,w,dash){
  var dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy);if(L<1)return;
  var hd=Math.min(10,L*0.45),ux=dx/L,uy=dy/L,bx=x2-ux*hd,by=y2-uy*hd;
  line(ctx,x1,y1,bx+ux*1.5,by+uy*1.5,color,w||2,dash);
  ctx.save();ctx.fillStyle=color||INK;ctx.beginPath();ctx.moveTo(x2,y2);
  ctx.lineTo(bx-uy*hd*0.42,by+ux*hd*0.42);ctx.lineTo(bx+uy*hd*0.42,by-ux*hd*0.42);ctx.closePath();ctx.fill();ctx.restore();
}
function dotAt(ctx,x,y,r,color,hollow){
  ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);
  if(hollow){ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle=color||INK;ctx.lineWidth=1.5;ctx.stroke();}
  else{ctx.fillStyle=color||INK;ctx.fill();}ctx.restore();}
/* marker shapes for series 0,1,2 */
function marker(ctx,i,x,y,color,r){
  r=r||3.5;ctx.save();ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=1.4;ctx.beginPath();
  if(i===0){ctx.arc(x,y,r,0,2*Math.PI);ctx.fill();}
  else if(i===1){ctx.rect(x-r,y-r,2*r,2*r);ctx.fill();}
  else{ctx.moveTo(x,y-r*1.25);ctx.lineTo(x+r*1.15,y+r*0.85);ctx.lineTo(x-r*1.15,y+r*0.85);ctx.closePath();ctx.fillStyle="#fff";ctx.fill();ctx.stroke();}
  ctx.restore();}
/* framed plot area with nice ticks + numeric labels. R={x,y,w,h} in canvas px */
function panel(ctx,R,xr,yr,o){
  o=o||{};
  var sx=R.w/(xr[1]-xr[0]),sy=R.h/(yr[1]-yr[0]);
  function px(x){return R.x+(x-xr[0])*sx;}
  function py(y){return R.y+R.h-(y-yr[0])*sy;}
  var xt=o.xticks||calc.niceTicks(xr[0],xr[1],o.nx||6),yt=o.yticks||calc.niceTicks(yr[0],yr[1],o.ny||5);
  var xf=o.xfmt||function(t){return fmt(t,4);},yf=o.yfmt||function(t){return fmt(t,4);};
  ctx.save();ctx.strokeStyle=GRID;ctx.lineWidth=1;
  xt.forEach(function(t){var X=Math.round(px(t))+0.5;if(X<R.x||X>R.x+R.w)return;ctx.beginPath();ctx.moveTo(X,R.y);ctx.lineTo(X,R.y+R.h);ctx.stroke();});
  yt.forEach(function(t){var Y=Math.round(py(t))+0.5;if(Y<R.y||Y>R.y+R.h)return;ctx.beginPath();ctx.moveTo(R.x,Y);ctx.lineTo(R.x+R.w,Y);ctx.stroke();});
  ctx.restore();
  if(!o.noZero){
    if(0>xr[0]&&0<xr[1])line(ctx,px(0),R.y,px(0),R.y+R.h,INK,1);
    if(0>yr[0]&&0<yr[1])line(ctx,R.x,py(0),R.x+R.w,py(0),INK,1);
  }
  ctx.save();ctx.strokeStyle=INK;ctx.lineWidth=1.2;ctx.strokeRect(R.x+0.5,R.y+0.5,R.w-1,R.h-1);ctx.restore();
  var lastR=-1e9;
  xt.forEach(function(t){var X=px(t);if(X<R.x-1||X>R.x+R.w+1)return;var s=xf(t);
    setFont(ctx,11);var w=ctx.measureText(s).width;if(X-w/2<lastR+4)return;lastR=X+w/2;
    text(ctx,s,X,R.y+R.h+13,{size:11,align:"center",color:SOFT,halo:false});});
  var lastY=1e9;
  yt.slice().forEach(function(t){var Y=py(t);if(Y<R.y-1||Y>R.y+R.h+1)return;if(Math.abs(Y-lastY)<13)return;lastY=Y;
    text(ctx,yf(t),R.x-5,Y+4,{size:11,align:"right",color:SOFT,halo:false});});
  if(o.xlabel)text(ctx,o.xlabel,R.x+R.w+4,R.y+R.h-3,{size:12,color:INK,halo:false});
  if(o.ylabel)text(ctx,o.ylabel,R.x+2,R.y-6,{size:12,color:INK,halo:false});
  return {px:px,py:py,R:R,sx:sx,sy:sy,
    clip:function(){ctx.save();ctx.beginPath();ctx.rect(R.x+1,R.y+1,R.w-2,R.h-2);ctx.clip();},
    unclip:function(){ctx.restore();},
    inside:function(X,Y){return X>=R.x&&X<=R.x+R.w&&Y>=R.y&&Y<=R.y+R.h;}};
}
/* ranges with equal x/y scale that contain [x0,x1]×[y0,y1] */
function fitEqual(R,x0,x1,y0,y1){
  var cx=(x0+x1)/2,cy=(y0+y1)/2,s=Math.min(R.w/Math.max(x1-x0,1e-9),R.h/Math.max(y1-y0,1e-9));
  return {xr:[cx-R.w/(2*s),cx+R.w/(2*s)],yr:[cy-R.h/(2*s),cy+R.h/(2*s)]};
}
/* integer exponents for a log10 axis, step 1,2,3,5,10,20 */
function logTicks(L0,L1){var st=[1,2,3,5,10,20].filter(function(x){return (L1-L0)/x<=6;})[0]||20,out=[];
  for(var t=Math.floor(L1/st)*st;t>=L0;t-=st)out.push(t);return out;}
function intTicks(N){return calc.niceTicks(0,N,Math.min(N,8)).filter(function(t){return t===Math.round(t);});}
function clampPx(v){return Math.max(-1e5,Math.min(1e5,v));}
function controls(el){var d=document.createElement("div");d.className="v6-controls";el.appendChild(d);return d;}
function slider(parent,lab,min,max,step,val,show,onch){
  var L=document.createElement("label");L.appendChild(document.createTextNode(lab));
  var r=document.createElement("input");r.type="range";r.min=min;r.max=max;r.step=step;r.value=val;
  r.setAttribute("aria-label",lab);
  var v=document.createElement("span");v.className="v6-val";var cur=val;
  function upd(){v.textContent=show(cur);}
  r.addEventListener("input",function(){cur=parseFloat(r.value);upd();onch(cur);});
  L.appendChild(r);L.appendChild(v);parent.appendChild(L);upd();
  return {get:function(){return cur;},set:function(x){cur=x;r.value=x;upd();},input:r,label:L,
    range:function(a,b){r.min=a;r.max=b;r.value=cur;}};
}
function button(parent,label,fn){var b=document.createElement("button");b.type="button";b.className="v6-btn";
  b.textContent=label;b.addEventListener("click",fn);parent.appendChild(b);return b;}
function stateBox(el){var d=document.createElement("div");d.className="v6-state";el.appendChild(d);return d;}
function red(s){return "<span style='color:"+RED+"'>"+s+"</span>";}
function b(s){return "<b>"+s+"</b>";}
function sub(n){return String(n).replace(/[0-9]/g,function(d){return "₀₁₂₃₄₅₆₇₈₉"[+d];});}
function sectionHead(el,t){var d=document.createElement("div");d.style.cssText="font-weight:700;font-size:12.5px;margin:12px 0 4px";d.textContent=t;el.appendChild(d);return d;}
function compileXY(src,vars){
  var m=calc.checkExpr(src,vars);if(m)return {err:m};
  try{var F=V6.makeFn(src,vars);}catch(e){return {err:"식 문법 오류: ‘"+String(src)+"’ — 괄호 짝, 연산자(곱셈은 *), 쉼표를 확인하세요."};}
  return {fn:F};
}

/* =========================================================================
   1. gd-lr — gradient descent learning-rate comparison
   cfg: {title, mode:"both"|"1d"|"2d",
         fn:"quad"|"quartic"|"custom", c, x0, etas:[3], N, step, logy, etaMax, f, df, xr,
         kappa, start2d:[x0,y0], eta2d (absolute; omit -> η*), N2, step2d}
   ========================================================================= */
mount("gd-lr",function(el,cfg){
  V6.title(el,cfg.title||"경사하강법 — 학습률 η 비교");
  var mode=cfg.mode==="1d"||cfg.mode==="2d"?cfg.mode:"both",rd=[];
  if(mode!=="2d"){var d1=document.createElement("div");el.appendChild(d1);
    try{rd.push(gd1d(d1,cfg));}catch(e){if(window.console)console.error(e);fail(d1,"1차원 부분 오류 ("+(e&&e.message||e)+")");}}
  if(mode!=="1d"){var d2=document.createElement("div");el.appendChild(d2);
    try{rd.push(gd2d(d2,cfg,mode==="both"));}catch(e){if(window.console)console.error(e);fail(d2,"2차원 부분 오류 ("+(e&&e.message||e)+")");}}
  return function(){rd.forEach(function(f){if(typeof f==="function")f();});};
});
var VERDICT={mono:"단조 수렴",one:"한 번에 도달",osc:"진동하며 수렴",bounce:"±x₀ 왕복 (수렴 안 함)",div:"진동하며 발산",zero:"η = 0: 움직이지 않음",neg:"η < 0: 오르막으로 이동",badc:"c > 0 이어야 함"};
var LONG={
  mono:"0 < η < 1/c → 0 < r < 1: 같은 쪽에서 단조 수렴",
  one:"η = 1/c → r = 0: 한 걸음에 최솟점 x = 0 도달",
  osc:"1/c < η < 2/c → −1 < r < 0: 부호가 바뀌며(좌우로 튀며) 수렴",
  bounce:"η = 2/c → r = −1: x₀ 와 −x₀ 사이를 왕복, 수렴하지 않음",
  div:"η > 2/c → r < −1: |xₖ| = |r|ᵏ|x₀| 로 진동하며 발산",
  zero:"η = 0: xₖ = x₀ 그대로",neg:"η < 0: 기울기 방향(오르막)으로 이동해 발산",badc:"c ≤ 0 이면 최솟값이 없음"};
function gd1d(el,cfg){
  var kind=cfg.fn==="quartic"?"quartic":(cfg.fn==="custom"||(cfg.fn==null&&typeof cfg.f==="string"))?"custom":"quad";
  var c=num(cfg.c,2,0.1,50);
  var x0=num(cfg.x0,2,-1e3,1e3);
  var N=Math.round(num(cfg.N,kind==="quartic"?30:15,1,300));
  var CAP=1e6;
  var defE=kind==="quad"?[0.2/c,0.9/c,2.1/c]:kind==="quartic"?[0.05,0.3,0.6]:[0.05,0.2,0.5];
  var etas=[0,1,2].map(function(i){return num(Array.isArray(cfg.etas)?cfg.etas[i]:undefined,defE[i],-10,1e3);});
  var f,df,fLabel,dfLabel,customF=null,customD=null;
  if(kind==="custom"){
    var cf=compileXY(cfg.f,["x"]);if(cf.err){fail(el,"f(x): "+cf.err);return;}
    customF=cf.fn;
    if(cfg.df!=null){var cd=compileXY(cfg.df,["x"]);if(cd.err){fail(el,"f'(x): "+cd.err);return;}customD=cd.fn;}
    if(isNaN(customF([x0]))){fail(el,"x₀ = "+fmt(x0)+" 에서 f 값을 계산할 수 없습니다.");return;}
  }
  function setFns(){
    if(kind==="quad"){f=function(x){return 0.5*c*x*x;};df=function(x){return c*x;};
      fLabel="f(x) = ½·c·x²";dfLabel="f′(x) = c·x";}
    else if(kind==="quartic"){f=function(x){return x*x*x*x/4;};df=function(x){return x*x*x;};
      fLabel="f(x) = x⁴/4";dfLabel="f′(x) = x³";}
    else{f=function(x){return customF([x]);};
      df=customD?function(x){return customD([x]);}:function(x){var h=1e-5*Math.max(1,Math.abs(x));return (customF([x+h])-customF([x-h]))/(2*h);};
      fLabel="f(x) = "+cfg.f;dfLabel=customD?"f′(x) = "+cfg.df:"f′(x): 중심차분 수치미분";}
  }
  setFns();
  var etaTop=num(cfg.etaMax,kind==="quad"?2.6/c:kind==="quartic"?1:1.5*Math.max.apply(null,etas.map(Math.abs).concat([0.1])),0.01,1e3);
  etaTop=Math.max(etaTop,etas[0],etas[1],etas[2]);
  var k=Math.round(num(cfg.step,N,0,N));
  var logy=cfg.logy!==false;
  var cv=V6.canvas(el,430),ctx=cv.getContext("2d");
  var W=cv.width;
  var st=stateBox(el);
  var ctl=controls(el);
  var cS=null;
  if(kind==="quad")cS=slider(ctl,"c ",0.5,Math.max(4,c),0.1,c,function(v){return fmt(v,2);},function(v){c=v;setFns();draw();});
  var eS=etas.map(function(e,i){return slider(ctl,"η"+sub(i+1)+" ",0,parseFloat(etaTop.toPrecision(3)),0.005,e,function(v){return fmt(v,3);},function(v){etas[i]=v;draw();});});
  var lg=document.createElement("label");var cb=document.createElement("input");cb.type="checkbox";cb.checked=logy;
  lg.appendChild(cb);lg.appendChild(document.createTextNode(" 세로축 로그 눈금"));ctl.appendChild(lg);
  cb.addEventListener("change",function(){logy=cb.checked;draw();});
  var bar=document.createElement("div");bar.className="v6-stepbar";el.appendChild(bar);
  var pos=document.createElement("span");
  button(bar,"처음",function(){k=0;draw();});
  var bPrev=button(bar,"◀ 이전",function(){if(k>0){k--;draw();}});
  var bNext=button(bar,"다음 ▶",function(){if(k<N){k++;draw();}});
  button(bar,"끝",function(){k=N;draw();});
  bar.appendChild(pos);
  var SER=[GRAY,INK,INK];
  function draw(){
    ctx.clearRect(0,0,W,cv.height);
    pos.textContent="k = "+k+" / "+N;bPrev.disabled=k===0;bNext.disabled=k===N;
    var runs=etas.map(function(e){return calc.gd1(df,e,x0,N,CAP);});
    /* ---- top: three curve panels ---- */
    var Rx=Math.max(Math.abs(x0)*1.3,0.5);
    var xr=Array.isArray(cfg.xr)&&cfg.xr.length===2&&isFinite(cfg.xr[0])&&isFinite(cfg.xr[1])&&cfg.xr[1]>cfg.xr[0]?[+cfg.xr[0],+cfg.xr[1]]:[-Rx,Rx];
    var fmin=Infinity,fmax=-Infinity;
    for(var i=0;i<=200;i++){var fv=f(xr[0]+(xr[1]-xr[0])*i/200);if(isFinite(fv)){fmin=Math.min(fmin,fv);fmax=Math.max(fmax,fv);}}
    if(!isFinite(fmin)){fmin=0;fmax=1;}
    if(fmax-fmin<1e-12){fmax=fmin+1;}
    var sp=fmax-fmin,yr=[fmin-0.08*sp,fmax+0.1*sp];
    for(var j=0;j<3;j++){
      var R={x:40+j*233,y:44,w:192,h:150};
      var P=panel(ctx,R,xr,yr,{nx:4,ny:4});
      var cl=kind==="quad"?calc.classifyQuadLR(c,etas[j]):null;
      marker(ctx,j,R.x+5,16-4,SER[j],4);
      var h1="η"+sub(j+1)+" = "+fmt(etas[j],3)+(cl?"   r = 1−ηc = "+fmt(cl.r,3):"");
      text(ctx,h1,R.x+13,16,{size:12,bold:true,halo:false});
      var run=runs[j],v2;
      if(cl)v2=VERDICT[cl.kind];
      else if(run.status==="div")v2="발산 (k = "+run.at+"에서 |x| > 10⁶)";
      else if(run.status==="undef")v2="k = "+run.at+"에서 값 정의 안 됨";
      else v2=kind==="quartic"?"ηx₀² = "+fmt(etas[j]*x0*x0,3)+(etas[j]*x0*x0<2&&etas[j]>0?" < 2":" ≥ 2"):"x"+sub(N)+" = "+fmt(run.xs[run.xs.length-1],4);
      var bad=(cl&&(cl.kind==="div"||cl.kind==="bounce"||cl.kind==="neg"))||run.status!=="ok";
      text(ctx,v2,R.x,32,{size:12,color:bad?RED:INK,halo:false});
      P.clip();
      ctx.strokeStyle=INK;ctx.lineWidth=1.6;ctx.beginPath();var pen=false;
      for(var q=0;q<=240;q++){var xx=xr[0]+(xr[1]-xr[0])*q/240,yy=f(xx);
        if(!isFinite(yy)){pen=false;continue;}var Y=clampPx(P.py(yy));
        if(!pen){ctx.moveTo(P.px(xx),Y);pen=true;}else ctx.lineTo(P.px(xx),Y);}
      ctx.stroke();
      var last=Math.min(k,run.xs.length-1);
      ctx.strokeStyle=SER[j]===GRAY?GRAY:INK;ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();
      for(var s=0;s<=last;s++){var X=clampPx(P.px(run.xs[s])),Yv=clampPx(P.py(f(run.xs[s])));
        if(!isFinite(X)||!isFinite(Yv))break;if(s===0)ctx.moveTo(X,Yv);else ctx.lineTo(X,Yv);}
      ctx.stroke();ctx.setLineDash([]);
      for(s=0;s<=last;s++){var xs=run.xs[s],X2=P.px(xs),Y2=P.py(f(xs));
        if(isFinite(X2)&&isFinite(Y2)&&P.inside(X2,Y2))marker(ctx,j,X2,Y2,s===last?RED:SER[j],s===last?4.2:3);}
      P.unclip();
      var xl=run.xs[last],Xl=P.px(xl),Yl=P.py(f(xl));
      if(!(isFinite(Xl)&&isFinite(Yl)&&P.inside(Xl,Yl))){
        var side=!isFinite(Xl)?(xl>0?1:-1):Xl>R.x+R.w?1:Xl<R.x?-1:0;
        var msg=side>0?"x"+sub(last)+" → 오른쪽 밖":side<0?"← x"+sub(last)+" 밖":"x"+sub(last)+" 범위 밖";
        text(ctx,msg+" ("+fmt(xl,2)+")",side<0?R.x+4:R.x+R.w-4,R.y+R.h-8,{size:11,color:RED,align:side<0?"left":"right"});
      }
    }
    /* ---- bottom: f(x_k) vs k ---- */
    var RB={x:58,y:250,w:500,h:150};
    var vals=[],anyNonPos=false;
    runs.forEach(function(r){r.xs.forEach(function(x){var v=f(x);if(isFinite(v)&&Math.abs(x)<=CAP){vals.push(v);if(v<=0)anyNonPos=true;}});});
    var useLog=logy;
    var negF=vals.some(function(v){return v<0;});
    if(useLog&&negF)useLog=false;
    var f0=f(x0),yr2,yt,yfm;
    if(useLog){
      var pos_=vals.filter(function(v){return v>0;}),lo=Math.min.apply(null,pos_.concat([f0||1])),hi=Math.max.apply(null,pos_.concat([f0||1]));
      var L0=Math.max(-60,Math.floor(Math.log10(lo))),L1=Math.min(13,Math.ceil(Math.log10(hi)+0.3));
      if(L1-L0<2)L0=L1-2;
      yr2=[L0,L1];yt=logTicks(L0,L1);
      yfm=function(t){return "10"+calc.sup(t);};
    }else{
      var top=isFinite(f0)&&f0>0?f0*1.15:Math.max.apply(null,vals.concat([1]));
      var bot=Math.min(0,Math.min.apply(null,vals.concat([0])));
      if(top-bot<1e-12)top=bot+1;
      yr2=[bot-(top-bot)*0.04,top];yt=null;yfm=null;
    }
    var PB=panel(ctx,RB,[0,N],yr2,{noZero:useLog,nx:Math.min(N,10),yticks:yt,yfmt:yfm||undefined,xticks:intTicks(N),xfmt:function(t){return String(t);},xlabel:"k",ylabel:"f(xₖ)"+(useLog?"  (로그 눈금)":"  (선형 눈금)")});
    if(N<=0)return;
    PB.clip();
    var zeroNote=false,pinned=false;
    runs.forEach(function(r,j){
      var pts=[];
      for(var s=0;s<=Math.min(k,r.xs.length-1);s++){
        var v=f(r.xs[s]),X=PB.px(s),Y;
        if(useLog){if(v>0&&isFinite(v))Y=PB.py(Math.log10(v));else if(v===0){Y=RB.y+RB.h-4;zeroNote=true;}else Y=-1e4;}
        else Y=isFinite(v)?PB.py(v):-1e4;
        if(Y<RB.y+3)pinned=true;
        Y=Math.max(RB.y+3,Math.min(RB.y+RB.h-3,clampPx(Y)));pts.push([X,Y]);
      }
      ctx.strokeStyle=SER[j];ctx.lineWidth=1.3;ctx.setLineDash(j===2?[5,3]:[]);ctx.beginPath();
      pts.forEach(function(p,s){if(s===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);});ctx.stroke();ctx.setLineDash([]);
      pts.forEach(function(p){marker(ctx,j,p[0],p[1],SER[j],2.8);});
    });
    PB.unclip();
    /* legend */
    var lx=RB.x+RB.w+22,ly=RB.y+8;
    runs.forEach(function(r,j){
      line(ctx,lx,ly+j*36,lx+22,ly+j*36,SER[j],1.3,j===2?[5,3]:[]);marker(ctx,j,lx+11,ly+j*36,SER[j],3.2);
      text(ctx,"η"+sub(j+1)+" = "+fmt(etas[j],3),lx+28,ly+j*36+4,{size:12,halo:false});
      var tail=r.status==="div"?"k="+r.at+" 발산":r.status==="undef"?"정의 안 됨":"f(x"+sub(Math.min(k,r.xs.length-1))+") = "+fmt(f(r.xs[Math.min(k,r.xs.length-1)]),2);
      text(ctx,tail,lx+28,ly+j*36+19,{size:11,color:r.status==="ok"?SOFT:RED,halo:false});
    });
    var notes=[];
    if(pinned)notes.push("위 테두리에 붙은 점 = 범위 밖");
    if(zeroNote)notes.push("바닥 점 = f = 0 정확히 도달");
    if(logy&&!useLog)notes.push("f < 0 값이 있어 선형 눈금");
    notes.forEach(function(n,i){text(ctx,n,lx,RB.y+RB.h-14+i*14-((notes.length-1)*14),{size:10.5,color:SOFT,halo:false});});
    /* ---- explanation ---- */
    var L=[];
    if(kind==="quad"){
      L.push(b(fLabel+",  "+dfLabel+"  →  xₖ₊₁ = xₖ − η·c·xₖ = (1 − ηc)·xₖ = r·xₖ"));
      L.push("수렴 ⇔ |r| < 1 ⇔ 0 < η < 2/c = "+fmt(2/c,3)+"   (η = 1/c = "+fmt(1/c,3)+" 이면 한 걸음에 x = 0)");
      etas.forEach(function(e,j){var cl=calc.classifyQuadLR(c,e);var s="η"+sub(j+1)+" = "+fmt(e,3)+":  "+LONG[cl.kind];
        if(cl.kind==="mono"&&cl.r>=0.9)s+=" — 느림 (단계당 오차 ×"+fmt(cl.r,3)+")";
        L.push(cl.kind==="div"||cl.kind==="bounce"||cl.kind==="neg"?red(s):s);});
      L.push("f(xₖ) = r²ᵏ·f(x₀) → 로그 눈금에서 기울기 log₁₀(r²)인 직선 (|r| 작을수록 가파름)");
    }else if(kind==="quartic"){
      L.push(b(fLabel+",  "+dfLabel+"  →  xₖ₊₁ = xₖ(1 − η·xₖ²)"));
      L.push("|xₖ₊₁| < |xₖ| ⇔ 0 < η·xₖ² < 2.  기준이 xₖ에 따라 달라짐 — ‘η < 2/c’ 같은 고정 기준은 이차함수에서만 정확");
      L.push("최솟점에서 f″(0) = 0 이라 수렴해도 느림: 오차 ≈ 1/√(2ηk) (선형 수렴보다 느림)");
      etas.forEach(function(e,j){var r=runs[j],s="η"+sub(j+1)+" = "+fmt(e,3)+":  η·x₀² = "+fmt(e*x0*x0,3)+(r.status==="div"?" → 발산 (k = "+r.at+")":" → k = "+N+" 에서 |x| = "+fmt(Math.abs(r.xs[r.xs.length-1]),4));
        L.push(r.status==="div"?red(s):s);});
    }else{
      L.push(b(esc(fLabel)+",  "+esc(dfLabel)));
      L.push("사용자 정의 f: 해석적 판정 없음 — 아래는 N = "+N+" 단계의 수치 결과일 뿐입니다.");
      etas.forEach(function(e,j){var r=runs[j],s="η"+sub(j+1)+" = "+fmt(e,3)+":  "+(r.status==="div"?"|x| > 10⁶ (k = "+r.at+")":r.status==="undef"?"k = "+r.at+"에서 정의 안 됨":"x"+sub(N)+" = "+fmt(r.xs[r.xs.length-1],5)+",  f′(x"+sub(N)+") = "+fmt(calc.snap(df(r.xs[r.xs.length-1]),1),3));
        L.push(r.status==="ok"?s:red(s));});
    }
    st.innerHTML=L.join("\n");
  }
  draw();return draw;
}
function gd2d(el,cfg,withHead){
  if(withHead)sectionHead(el,"2차원: f(x, y) = ½(x² + κy²) — 조건수 κ가 크면 지그재그");
  var kappa=num(cfg.kappa,10,1,100);
  var st0=Array.isArray(cfg.start2d)?cfg.start2d:[];
  var X0=num(st0[0],4,-100,100),Y0=num(st0[1],1,-100,100);
  if(X0===0&&Y0===0){X0=4;Y0=1;}
  var N=Math.round(num(cfg.N2,40,1,400));
  var manual=cfg.eta2d!=null&&isFinite(Number(cfg.eta2d));
  var s=manual?num(cfg.eta2d,0.1,0,1e3)*kappa/2:0.9;
  var k=Math.round(num(cfg.step2d,N,0,N));
  var cv=V6.canvas(el,322),ctx=cv.getContext("2d"),W=cv.width;
  var st=stateBox(el);
  var ctl=controls(el);
  var kS=slider(ctl,"κ ",1,Math.max(50,Math.ceil(kappa)),1,kappa,function(v){return fmt(v,2);},function(v){kappa=v;draw();});
  var lab=document.createElement("label");var cb=document.createElement("input");cb.type="checkbox";cb.checked=!manual;
  lab.appendChild(cb);lab.appendChild(document.createTextNode(" η = η* = 2/(1+κ) 사용"));ctl.appendChild(lab);
  var sS=slider(ctl,"η = s·(2/κ), s ",0.02,1.2,0.01,Math.min(Math.max(s,0.02),1.2),function(v){return fmt(v,2);},function(v){s=v;draw();});
  if(manual)sS.set(s);
  cb.addEventListener("change",function(){manual=!cb.checked;if(manual){s=sS.get();}draw();});
  var bar=document.createElement("div");bar.className="v6-stepbar";el.appendChild(bar);
  var pos=document.createElement("span");
  button(bar,"처음",function(){k=0;draw();});
  var bPrev=button(bar,"◀ 이전",function(){if(k>0){k--;draw();}});
  var bNext=button(bar,"다음 ▶",function(){if(k<N){k++;draw();}});
  button(bar,"끝",function(){k=N;draw();});
  bar.appendChild(pos);
  function draw(){
    ctx.clearRect(0,0,W,cv.height);
    pos.textContent="k = "+k+" / "+N;bPrev.disabled=k===0;bNext.disabled=k===N;
    sS.input.disabled=!manual;sS.label.style.opacity=manual?1:0.45;
    var rt=calc.rates2(kappa,1);
    var eta=manual?s*2/kappa:rt.etaStar;
    if(!manual)sS.set(eta*kappa/2);
    rt=calc.rates2(kappa,eta);
    var M=Math.max(Math.abs(X0),Math.abs(Y0),1),CAP=1e6;
    var run=calc.gd2(kappa,eta,X0,Y0,N,CAP);
    var last=Math.min(k,run.P.length-1);
    /* plane panel (equal aspect) */
    var R={x:44,y:30,w:330,h:250};
    var bx0=Math.min(0,X0),bx1=Math.max(0,X0),by0=Math.min(0,Y0),by1=Math.max(0,Y0);
    run.P.forEach(function(p){if(Math.abs(p[0])<=4*M&&Math.abs(p[1])<=4*M){bx0=Math.min(bx0,p[0]);bx1=Math.max(bx1,p[0]);by0=Math.min(by0,p[1]);by1=Math.max(by1,p[1]);}});
    var px_=(bx1-bx0)*0.12+0.1*M,py_=(by1-by0)*0.15+0.1*M;
    var F=fitEqual(R,bx0-px_,bx1+px_,by0-py_,by1+py_);
    var P=panel(ctx,R,F.xr,F.yr,{nx:6,ny:5,xlabel:"x",ylabel:"y"});
    var f0=calc.f2(kappa,X0,Y0);
    P.clip();
    function ellipse(fv,color,dash,w){
      if(!(fv>0))return;var ax=Math.sqrt(2*fv),ay=Math.sqrt(2*fv/kappa);
      ctx.save();ctx.strokeStyle=color;ctx.lineWidth=w;ctx.setLineDash(dash);ctx.beginPath();
      for(var i=0;i<=180;i++){var t=2*Math.PI*i/180,X=clampPx(P.px(ax*Math.cos(t))),Y=clampPx(P.py(ay*Math.sin(t)));if(i===0)ctx.moveTo(X,Y);else ctx.lineTo(X,Y);}
      ctx.stroke();ctx.restore();}
    ellipse(f0,GRAY,[4,4],1);
    var pl=run.P[last],fl=calc.f2(kappa,pl[0],pl[1]);
    if(last>0&&isFinite(fl))ellipse(fl,GRAY,[],0.8);
    ctx.strokeStyle=INK;ctx.lineWidth=1.3;ctx.beginPath();
    for(var i=0;i<=last;i++){var X=clampPx(P.px(run.P[i][0])),Y=clampPx(P.py(run.P[i][1]));if(i===0)ctx.moveTo(X,Y);else ctx.lineTo(X,Y);}
    ctx.stroke();
    for(i=0;i<=last;i++){var Xi=P.px(run.P[i][0]),Yi=P.py(run.P[i][1]);if(P.inside(Xi,Yi))dotAt(ctx,Xi,Yi,i===last?4.2:2.6,i===last?RED:INK);}
    dotAt(ctx,P.px(0),P.py(0),3.2,INK,true);
    P.unclip();
    text(ctx,"점선: x² + κy² = 2f(x₀),  실선: 현재 f(xₖ) 높이의 타원",R.x,R.y+R.h+30,{size:11,color:SOFT,halo:false});
    var Xl=P.px(pl[0]),Yl=P.py(pl[1]);
    if(!(isFinite(Xl)&&isFinite(Yl)&&P.inside(Xl,Yl)))text(ctx,"현재 점이 화면 밖 (발산)",R.x+R.w-6,R.y+16,{size:11,color:RED,align:"right"});
    /* f_k vs k (log) */
    var RB={x:452,y:30,w:244,h:250};
    var vals=[];run.P.forEach(function(p){var v=calc.f2(kappa,p[0],p[1]);if(v>0&&isFinite(v))vals.push(v);});
    var lo=Math.min.apply(null,vals.concat([f0])),hi=Math.max.apply(null,vals.concat([f0]));
    var L0=Math.max(-60,Math.floor(Math.log10(lo))),L1=Math.min(13,Math.ceil(Math.log10(hi)+0.3));if(L1-L0<2)L0=L1-2;
    var yt=logTicks(L0,L1);
    var PB=panel(ctx,RB,[0,N],[L0,L1],{noZero:true,yticks:yt,yfmt:function(t){return "10"+calc.sup(t);},xticks:intTicks(N),xfmt:function(t){return String(t);},nx:5,xlabel:"k",ylabel:"f(xₖ)  (로그 눈금)"});
    PB.clip();
    if(rt.rho>0&&isFinite(rt.rho)){
      ctx.save();ctx.strokeStyle=GRAY;ctx.setLineDash([5,4]);ctx.lineWidth=1.2;ctx.beginPath();
      for(var q=0;q<=N;q++){var v=Math.log10(f0)+2*q*Math.log10(rt.rho),Y2=clampPx(PB.py(v));if(q===0)ctx.moveTo(PB.px(q),Y2);else ctx.lineTo(PB.px(q),Y2);}
      ctx.stroke();ctx.restore();}
    ctx.strokeStyle=INK;ctx.lineWidth=1.3;ctx.beginPath();
    var zero=false;
    for(i=0;i<=last;i++){var fv=calc.f2(kappa,run.P[i][0],run.P[i][1]),Y3=fv>0&&isFinite(fv)?PB.py(Math.log10(fv)):(fv===0?(zero=true,RB.y+RB.h-4):RB.y+3);
      Y3=Math.max(RB.y+3,Math.min(RB.y+RB.h-3,Y3));if(i===0)ctx.moveTo(PB.px(i),Y3);else ctx.lineTo(PB.px(i),Y3);}
    ctx.stroke();
    for(i=0;i<=last;i++){var fv2=calc.f2(kappa,run.P[i][0],run.P[i][1]),Y4=fv2>0&&isFinite(fv2)?PB.py(Math.log10(fv2)):(fv2===0?RB.y+RB.h-4:RB.y+3);
      Y4=Math.max(RB.y+3,Math.min(RB.y+RB.h-3,Y4));dotAt(ctx,PB.px(i),Y4,i===last?3.8:2.2,i===last?RED:INK);}
    PB.unclip();
    text(ctx,"점선: 상한 ρ²ᵏ·f(x₀)"+(zero?",  바닥 = 0 도달":""),RB.x,RB.y+RB.h+30,{size:11,color:SOFT,halo:false});
    /* explanation */
    var conv=rt.rho<1-1e-12,eq=Math.abs(rt.rho-1)<=1e-12;
    var kk=calc.itersFor(rt.rho,1e-6);
    var L=[];
    L.push(b("∇f = (x, κy),  헤세 행렬 고윳값 1, κ  →  조건수 κ = "+fmt(kappa,2)));
    L.push("xₖ₊₁ = (1 − η)xₖ,   yₖ₊₁ = (1 − ηκ)yₖ   (좌표마다 독립인 1차원 문제)");
    L.push("η = "+fmt(eta,4)+(manual?" (= "+fmt(s,2)+" × 2/κ)":" = η* = 2/(1+κ)")+";   수렴 ⇔ 0 < η < 2/κ = "+fmt(2/kappa,4));
    var ryTxt="r_y = 1 − ηκ = "+fmt(calc.snap(rt.ry,1),3);
    L.push("r_x = 1 − η = "+fmt(calc.snap(rt.rx,1),3)+",   "+ryTxt+(rt.ry<-1e-12?"  (음수 → y 부호가 매 단계 바뀜 = 지그재그)":""));
    var rl="ρ = max(|r_x|, |r_y|) = "+fmt(calc.snap(rt.rho,1),4)+"  →  f(xₖ) ≤ ρ²ᵏ·f(x₀)";
    L.push(conv?rl:red(rl+(eq?"  (ρ = 1: 수렴 안 함)":"  (ρ > 1: 발산)")));
    L.push("최적 고정 η* = 2/(1+κ) 에서 ρ* = (κ−1)/(κ+1) = "+fmt(rt.rhoStar,4)+"  — κ가 커지면 1에 가까워져 느려짐");
    if(conv)L.push("f를 10⁻⁶배 이하로 줄이는 데 충분한 k (상한 기준) = "+kk+(kk>N?"  (현재 N = "+N+" 보다 큼)":""));
    st.innerHTML=L.join("\n");
  }
  draw();return draw;
}

/* =========================================================================
   2. directional-derivative
   cfg: {title, f:"x*x+3*y*y", fx?, fy?, a, b, theta (deg), range:[lo,hi]}
   ========================================================================= */
mount("directional-derivative",function(el,cfg){
  V6.title(el,cfg.title||"방향도함수 D_u f = ∇f · u");
  var src=cfg.f==null?"x*x + 3*y*y":cfg.f;
  var cf=compileXY(src,["x","y"]);if(cf.err){fail(el,"f(x,y): "+cf.err);return;}
  var F=function(x,y){return cf.fn([x,y]);};
  var FX=null,FY=null;
  if(cfg.fx!=null||cfg.fy!=null){
    var cx=compileXY(cfg.fx,["x","y"]),cy=compileXY(cfg.fy,["x","y"]);
    if(cx.err){fail(el,"fx: "+cx.err);return;}if(cy.err){fail(el,"fy: "+cy.err);return;}
    FX=cx.fn;FY=cy.fn;
  }
  var rg=Array.isArray(cfg.range)&&cfg.range.length===2&&+cfg.range[1]>+cfg.range[0]?[num(cfg.range[0],-2),num(cfg.range[1],2)]:[-2,2];
  var a=num(cfg.a,1,rg[0],rg[1]),bb=num(cfg.b,0.5,rg[0],rg[1]);
  var th=num(cfg.theta,30,-1e4,1e4)*DEG;
  th=((th%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  var cv=V6.canvas(el,340),ctx=cv.getContext("2d"),W=cv.width;
  var st=stateBox(el),ctl=controls(el);
  var stepAB=parseFloat(((rg[1]-rg[0])/100).toPrecision(2));
  var tS=slider(ctl,"θ ",0,360,1,th/DEG,function(v){return fmt(v,1)+"°";},function(v){th=v*DEG;draw();});
  var aS=slider(ctl,"a ",rg[0],rg[1],stepAB,a,function(v){return fmt(v,3);},function(v){a=v;draw();});
  var bS=slider(ctl,"b ",rg[0],rg[1],stepAB,bb,function(v){return fmt(v,3);},function(v){bb=v;draw();});
  var g={};
  button(ctl,"u = ∇f 방향",function(){if(g.n>0){th=(Math.atan2(g.fy,g.fx)+2*Math.PI)%(2*Math.PI);tS.set(th/DEG);draw();}});
  button(ctl,"u = 접선 방향",function(){if(g.n>0){th=(Math.atan2(g.fy,g.fx)+Math.PI/2+2*Math.PI)%(2*Math.PI);tS.set(th/DEG);draw();}});
  function draw(){
    ctx.clearRect(0,0,W,cv.height);
    var f0=F(a,bb),fx,fy,kink=false,mismatch=null;
    if(FX){fx=FX([a,bb]);fy=FY([a,bb]);
      var gn=calc.grad(F,a,bb);kink=gn.kink;
      if(isFinite(gn.fx)&&isFinite(gn.fy)&&Math.hypot(gn.fx-fx,gn.fy-fy)>1e-4*(1+Math.hypot(fx,fy)))mismatch=gn;}
    else{var gr=calc.grad(F,a,bb);fx=gr.fx;fy=gr.fy;kink=gr.kink;}
    var sc=1+Math.abs(f0);
    fx=Math.abs(fx)<1e-7*sc?0:fx;fy=Math.abs(fy)<1e-7*sc?0:fy;
    var n=Math.hypot(fx,fy);g={fx:fx,fy:fy,n:n};
    var ok=isFinite(f0)&&isFinite(fx)&&isFinite(fy);
    var ux=Math.cos(th),uy=Math.sin(th);
    var nd=false;
    if(ok){var dc=calc.diffCheck(F,a,bb,fx,fy);nd=kink||!dc.ok;}
    var D=ok?calc.snap(calc.dirDeriv(fx,fy,th),n):NaN;
    var Dq=ok?calc.oneSided(F,a,bb,th):NaN;
    /* left: vectors at P */
    var R={x:46,y:28,w:290,h:280};
    var vmax=ok&&!nd?Math.min(Math.max(1,n),3):1,shrink=ok&&n>3?3/n:1;
    var Rv=1.22*vmax,F2=fitEqual(R,-Rv,Rv,-Rv,Rv);
    var P=panel(ctx,R,F2.xr,F2.yr,{nx:6,ny:6,xlabel:"",ylabel:"P에서 출발하는 벡터 (P를 원점으로)"});
    var O=[P.px(0),P.py(0)];
    ctx.save();ctx.strokeStyle=GRAY;ctx.setLineDash([3,4]);ctx.lineWidth=1;ctx.beginPath();
    ctx.arc(O[0],O[1],P.sx,0,2*Math.PI);ctx.stroke();ctx.restore();
    var busy=[th,th+Math.PI];if(ok&&!nd&&n>0){var tg0=Math.atan2(fy,fx);busy.push(tg0,tg0+Math.PI/2,tg0-Math.PI/2);}
    var best=0,bd=-1;for(var c8=0;c8<16;c8++){var ca=c8*Math.PI/8+Math.PI/16,md=7;
      busy.forEach(function(bq){var dd=Math.abs(Math.atan2(Math.sin(ca-bq),Math.cos(ca-bq)));md=Math.min(md,dd);});if(md>bd){bd=md;best=ca;}}
    text(ctx,"단위원",P.px(1.08*Math.cos(best)),P.py(1.08*Math.sin(best))+4,{size:11,color:GRAY,align:Math.cos(best)>=0?"left":"right"});
    if(ok&&nd)text(ctx,"미분 불가능 → ∇f 화살표 생략",R.x+6,R.y+16,{size:11.5,color:RED});
    if(ok&&!nd&&n>0){
      var tx=-fy/n,ty=fx/n,T=1.15*vmax;
      line(ctx,P.px(-T*tx),P.py(-T*ty),P.px(T*tx),P.py(T*ty),INK,1.2,[7,4]);
      text(ctx,"D_u f = 0 방향 (등위선 접선)",P.px(T*tx*0.92),P.py(T*ty*0.92)+(ty>0?-8:16),{size:11,align:tx>0?"right":"left",color:SOFT});
      var gx=fx*shrink,gy=fy*shrink;
      arrow(ctx,O[0],O[1],P.px(gx),P.py(gy),INK,2.4);
      text(ctx,"∇f"+(shrink<1?" (×"+fmt(shrink,2)+" 축소)":""),P.px(gx)+(gx>=0?6:-6),P.py(gy)+(gy>=0?-6:14),{size:12,bold:true,align:gx>=0?"left":"right"});
      /* projection of (scaled) grad on u */
      var pr=D*shrink;
      line(ctx,P.px(gx),P.py(gy),P.px(pr*ux),P.py(pr*uy),GRAY,1,[2,3]);
      line(ctx,O[0],O[1],P.px(pr*ux),P.py(pr*uy),"rgba(158,43,37,0.30)",8);
      dotAt(ctx,P.px(pr*ux),P.py(pr*uy),3,RED);
      var pl=pr*(1.04+0.06/Math.max(Math.abs(pr),0.2));
      text(ctx,"(∇f·u)u"+(shrink<1?" ×"+fmt(shrink,2):""),P.px(pl*ux)+(ux>=0?4:-4),P.py(pl*uy)+(uy>=0?-2:12),{size:11,color:RED,align:ux*pr>=0?"left":"right"});
    }
    arrow(ctx,O[0],O[1],P.px(ux),P.py(uy),RED,2);
    var nx=-uy,ny=ux;if(ok&&!nd&&nx*fx+ny*fy>0){nx=-nx;ny=-ny;}
    text(ctx,"u",P.px(ux*0.8)+15*nx,P.py(uy*0.8)-15*ny+5,{size:13,bold:true,color:RED,align:"center"});
    dotAt(ctx,O[0],O[1],3.5,INK);
    text(ctx,"P = ("+fmt(a,3)+", "+fmt(bb,3)+")",R.x+6,R.y+R.h-8,{size:11.5});
    /* right: D_u f(θ) */
    var RB={x:410,y:28,w:290,h:250};
    var A=ok&&n>0?n:1,qs=[];
    if(ok&&nd){A=0;for(var j=0;j<=360;j+=2){var qv=calc.oneSided(F,a,bb,j*DEG);qs.push(qv);if(isFinite(qv))A=Math.max(A,Math.abs(qv));}if(!(A>0))A=1;}
    var P2=panel(ctx,RB,[0,360],[-1.45*A,1.45*A],{xticks:[0,90,180,270,360],xfmt:function(t){return t+"°";},ny:5,xlabel:"θ",ylabel:nd?"[f(P+hu) − f(P)]/h  (h = 10⁻⁶)":"D_u f (θ)"});
    if(!ok){text(ctx,"이 점에서 f 또는 편도함수를 계산할 수 없습니다",RB.x+RB.w/2,RB.y+RB.h/2,{align:"center",color:RED});}
    else if(nd){
      P2.clip();ctx.strokeStyle=INK;ctx.lineWidth=1.8;ctx.beginPath();var pen=false;
      qs.forEach(function(qv,j){if(!isFinite(qv)){pen=false;return;}var X=P2.px(j*2),Y=P2.py(qv);if(!pen){ctx.moveTo(X,Y);pen=true;}else ctx.lineTo(X,Y);});
      ctx.stroke();P2.unclip();
      text(ctx,"∇f·u 사인곡선이 아님",RB.x+RB.w-6,RB.y+16,{size:11,align:"right",color:RED});
      var Xn=P2.px(th/DEG);line(ctx,Xn,RB.y,Xn,RB.y+RB.h,RED,1,[3,3]);if(isFinite(Dq))dotAt(ctx,Xn,P2.py(Dq),4.5,RED);
    }
    else{
      P2.clip();ctx.strokeStyle=INK;ctx.lineWidth=1.8;ctx.beginPath();
      for(var i=0;i<=360;i++){var Y=P2.py(calc.dirDeriv(fx,fy,i*DEG));if(i===0)ctx.moveTo(P2.px(i),Y);else ctx.lineTo(P2.px(i),Y);}
      ctx.stroke();P2.unclip();
      if(n>0){
        var tg=((Math.atan2(fy,fx)/DEG)+360)%360;
        [[tg,n,"최대 |∇f| (θ = ∇f 방향)"],[(tg+180)%360,-n,"최소 −|∇f|"]].forEach(function(m,j){
          var X=P2.px(m[0]),Y=P2.py(m[1]);dotAt(ctx,X,Y,3.5,INK,true);
          text(ctx,m[2],Math.min(Math.max(X,RB.x+70),RB.x+RB.w-70),Y+(j===0?-9:18),{size:11,align:"center"});});
        [(tg+90)%360,(tg+270)%360].forEach(function(z){var X=P2.px(z);line(ctx,X,P2.py(0)-5,X,P2.py(0)+5,INK,1.5);});
        text(ctx,"0 (접선 방향)",P2.px((tg+90)%360),P2.py(0)+17,{size:10.5,align:"center",color:SOFT});
      }
      var Xc=P2.px(th/DEG),Yc=P2.py(D);
      line(ctx,Xc,RB.y,Xc,RB.y+RB.h,RED,1,[3,3]);dotAt(ctx,Xc,Yc,4.5,RED);
    }
    /* state */
    var L=[];
    if(!ok){L.push(red("점 P에서 f(P) 또는 편도함수가 정의되지 않습니다 (정의역 밖?). a, b를 옮겨 보세요."));st.innerHTML=L.join("\n");return;}
    L.push(b("f(x, y) = "+esc(src))+",   P = ("+fmt(a,3)+", "+fmt(bb,3)+"),   f(P) = "+fmt(f0,4));
    if(nd){
      L.push(red("이 점에서 f는 미분가능하지 않습니다 (수치 판정: 한쪽 차분이 서로 다르거나, 어떤 방향에서 [f(P+hu) − f(P)]/h ≠ ∇f·u)."));
      L.push(red("따라서 D_u f = ∇f·u 공식을 쓸 수 없고 ∇f 그림은 생략합니다. 중심차분이 주는 값 ("+fmt(fx,4)+", "+fmt(fy,4)+")는 기울기가 아닙니다."));
      L.push("정의대로 계산한 한쪽 방향 미분: [f(P + hu) − f(P)] / h = "+fmt(calc.snap(Dq,1),4)+"   (θ = "+fmt(th/DEG,1)+"°, h = 10⁻⁶) — 오른쪽 그래프");
      st.innerHTML=L.join("\n");return;
    }
    L.push("∇f(P) = (f_x, f_y) = ("+fmt(fx,4)+", "+fmt(fy,4)+"),   |∇f| = "+fmt(n,4)+(FX?"   (config의 fx, fy 사용)":"   (중심차분 수치미분)"));
    L.push("u = (cos θ, sin θ) = ("+fmt(calc.snap(ux,1),4)+", "+fmt(calc.snap(uy,1),4)+")");
    L.push(b("D_u f = f_x cos θ + f_y sin θ = "+fmt(D,4))+(n>0?"  = |∇f| cos(θ − θ_∇),  θ_∇ = "+fmt(((Math.atan2(fy,fx)/DEG)+360)%360,2)+"°":""));
    L.push("검산 (정의): [f(P + hu) − f(P)] / h = "+fmt(Math.round(Dq*1e4)/1e4,4)+"   (h = 10⁻⁶, 오차 O(h))");
    if(n===0)L.push(red("∇f(P) = 0 (임계점): 모든 방향에서 D_u f = 0. ‘가장 가파른 방향’이 없습니다."));
    else L.push("최대 증가 방향 = ∇f 방향 (D_u f = |∇f|), 최대 감소 = −∇f 방향, ∇f ⟂ u 이면 D_u f = 0");
    if(mismatch)L.push(red("주의: config의 fx, fy가 수치미분 ("+fmt(mismatch.fx,4)+", "+fmt(mismatch.fy,4)+")과 다릅니다."));
    st.innerHTML=L.join("\n");
  }
  draw();return draw;
});

/* =========================================================================
   3. quadratic-form  Q = a x² + 2b xy + c y²
   cfg: {title, a, b, c, theta (deg), range:[lo,hi]}
   ========================================================================= */
var QNAME={pd:"양정부호 (positive definite)",nd:"음정부호 (negative definite)",indef:"부정부호 (indefinite)",
  psd:"양의 준정부호 (positive semidefinite, 정부호 아님)",nsd:"음의 준정부호 (negative semidefinite, 정부호 아님)",zero:"영 형식 (Q ≡ 0)"};
var QTEST={pd:"D > 0, a > 0 → 임계점은 극소",nd:"D > 0, a < 0 → 임계점은 극대",indef:"D < 0 → 임계점은 안장점",
  psd:"D = 0 → 2계 판정 불가 (고차항이 결정: x⁴+y² 는 극소, x³+y² 는 극값 아님)",
  nsd:"D = 0 → 2계 판정 불가 (고차항이 결정)",zero:"D = 0 → 2계 판정 불가"};
mount("quadratic-form",function(el,cfg){
  V6.title(el,cfg.title||"이차형식 Q(x, y) = a x² + 2b xy + c y² 와 고윳값");
  var rg=Array.isArray(cfg.range)&&cfg.range.length===2&&+cfg.range[1]>+cfg.range[0]?[num(cfg.range[0],-3),num(cfg.range[1],3)]:[-3,3];
  var A=num(cfg.a,2,rg[0],rg[1]),B=num(cfg.b,0.6,rg[0],rg[1]),C=num(cfg.c,1,rg[0],rg[1]);
  var th=num(cfg.theta,20,-1e4,1e4)*DEG;
  var cv=V6.canvas(el,340),ctx=cv.getContext("2d"),W=cv.width;
  var st=stateBox(el),ctl=controls(el);
  function sh(v){return fmt(v,2);}
  var aS=slider(ctl,"a ",rg[0],rg[1],0.1,A,sh,function(v){A=v;draw();});
  var bS=slider(ctl,"b ",rg[0],rg[1],0.1,B,sh,function(v){B=v;draw();});
  var cS=slider(ctl,"c ",rg[0],rg[1],0.1,C,sh,function(v){C=v;draw();});
  var tS=slider(ctl,"θ ",0,360,1,((th/DEG)%360+360)%360,function(v){return fmt(v,1)+"°";},function(v){th=v*DEG;draw();});
  var pre=controls(el);
  [["양정부호",2,0.6,1],["음정부호",-2,0.5,-1],["부정부호",1,2,1],["준정부호",1,1,1],["b = 0",2,0,-1],["중근 λ₁=λ₂",1.5,0,1.5]].forEach(function(p){
    button(pre,p[0],function(){A=p[1];B=p[2];C=p[3];aS.set(A);bS.set(B);cS.set(C);draw();});});
  function draw(){
    ctx.clearRect(0,0,W,cv.height);
    var E=calc.eig2(A,B,C),sc=Math.abs(A)+Math.abs(B)+Math.abs(C);
    var kind=calc.classifyQ(E.l1,E.l2,sc);
    var tol=1e-9*Math.max(1,sc),l1=calc.snap(E.l1,sc),l2=calc.snap(E.l2,sc),dbl=Math.abs(E.l2-E.l1)<=tol;
    var D=calc.snap(E.det,sc*sc);
    /* left: plane */
    var R={x:46,y:28,w:290,h:280},F2=fitEqual(R,-1.55,1.55,-1.55,1.55);
    var P=panel(ctx,R,F2.xr,F2.yr,{nx:6,ny:6,xlabel:"x",ylabel:"y"});
    /* unit circle coloured by sign of Q */
    var M=240;
    for(var i=0;i<M;i++){
      var t0=2*Math.PI*i/M,t1=2*Math.PI*(i+1)/M,tm=(t0+t1)/2,q=calc.Qval(A,B,C,Math.cos(tm),Math.sin(tm));
      var z=Math.abs(q)<=1e-9*Math.max(1,sc);
      ctx.save();ctx.strokeStyle=z?GRAY:q<0?RED:INK;ctx.lineWidth=z?1.2:3;
      ctx.beginPath();ctx.arc(P.px(0),P.py(0),P.sx,-t0,-t1,true);ctx.stroke();ctx.restore();
    }
    var v2=[Math.cos(E.t2),Math.sin(E.t2)],v1=[Math.cos(E.t1),Math.sin(E.t1)];
    [[v1,"v₁",l1],[v2,"v₂",l2]].forEach(function(e,j){
      line(ctx,P.px(-1.4*e[0][0]),P.py(-1.4*e[0][1]),P.px(1.4*e[0][0]),P.py(1.4*e[0][1]),GRAY,1,[2,4]);
      arrow(ctx,P.px(0),P.py(0),P.px(e[0][0]),P.py(e[0][1]),INK,2.2);
      var nx=-e[0][1],ny=e[0][0];if(ny<0||(ny===0&&nx<0)){nx=-nx;ny=-ny;}
      if(Math.abs(e[0][0])<0.3){nx=Math.abs(nx)<0.3?1:Math.abs(nx);ny=0;}
      var lx=P.px(1.16*e[0][0])+12*nx,ly=P.py(1.16*e[0][1])-12*ny;
      text(ctx,e[1]+(dbl?"":" (λ"+sub(j+1)+")"),lx,ly+4,{size:12,bold:true,align:Math.abs(e[0][0])<0.3?"left":"center"});
    });
    var u=[Math.cos(th),Math.sin(th)];
    line(ctx,P.px(0),P.py(0),P.px(u[0]),P.py(u[1]),RED,1,[3,3]);
    dotAt(ctx,P.px(u[0]),P.py(u[1]),4.5,RED);
    text(ctx,"원 위 굵은 선: Q > 0 검정, Q < 0 빨강, Q = 0 회색",R.x,R.y+R.h+30,{size:11,color:SOFT,halo:false});
    /* right: Q(cos θ, sin θ) */
    var RB={x:410,y:28,w:290,h:250};
    var lo=Math.min(l1,0),hi=Math.max(l2,0),pad=Math.max(0.25,(hi-lo)*0.18);
    var P2=panel(ctx,RB,[0,360],[lo-pad,hi+pad],{xticks:[0,90,180,270,360],xfmt:function(t){return t+"°";},ny:5,xlabel:"θ",ylabel:"Q(cos θ, sin θ)"});
    line(ctx,RB.x,P2.py(l1),RB.x+RB.w,P2.py(l1),GRAY,1,[5,4]);
    line(ctx,RB.x,P2.py(l2),RB.x+RB.w,P2.py(l2),GRAY,1,[5,4]);
    P2.clip();ctx.strokeStyle=INK;ctx.lineWidth=1.8;ctx.beginPath();
    for(i=0;i<=360;i++){var Y=P2.py(calc.Qval(A,B,C,Math.cos(i*DEG),Math.sin(i*DEG)));if(i===0)ctx.moveTo(P2.px(i),Y);else ctx.lineTo(P2.px(i),Y);}
    ctx.stroke();P2.unclip();
    if(dbl){text(ctx,"λ₁ = λ₂ = "+fmt(l1,3)+" : 상수",RB.x+RB.w-6,P2.py(l2)-7,{size:11.5,align:"right"});}
    else{
      text(ctx,"최댓값 λ₂ = "+fmt(l2,3),RB.x+RB.w-6,P2.py(l2)-7,{size:11.5,align:"right"});
      text(ctx,"최솟값 λ₁ = "+fmt(l1,3),RB.x+RB.w-6,P2.py(l1)+16,{size:11.5,align:"right"});
      var t2d=((E.t2/DEG)%180+180)%180,t1d=(t2d+90)%180;
      [t2d,t2d+180].forEach(function(x){dotAt(ctx,P2.px(x),P2.py(l2),3.5,INK,true);});
      [t1d,t1d+180].forEach(function(x){dotAt(ctx,P2.px(x),P2.py(l1),3.5,INK,true);});
    }
    var thd=((th/DEG)%360+360)%360,Qu=calc.Qval(A,B,C,u[0],u[1]);
    line(ctx,P2.px(thd),RB.y,P2.px(thd),RB.y+RB.h,RED,1,[3,3]);
    dotAt(ctx,P2.px(thd),P2.py(Qu),4.5,RED);
    /* state */
    var L=[];
    L.push(b("행렬 H = [[a, b], [b, c]] = [["+fmt(A,2)+", "+fmt(B,2)+"], ["+fmt(B,2)+", "+fmt(C,2)+"]]")+",   Q(x, y) = (x, y)·H·(x, y)ᵀ");
    L.push("λ = ((a+c) ∓ √((a−c)² + 4b²)) / 2  →  λ₁ = "+fmt(l1,4)+",  λ₂ = "+fmt(l2,4)+"   (λ₁λ₂ = det H = ac − b² = "+fmt(D,4)+")");
    L.push("판정: "+b(kind==="indef"||kind==="nd"?red(QNAME[kind]):QNAME[kind]));
    L.push("2계 도함수 판정 (임계점에서 a = f_xx, b = f_xy, c = f_yy, D = ac − b²): "+QTEST[kind]);
    L.push("단위원 위에서 min Q = λ₁, max Q = λ₂ (Rayleigh 몫), 각각 고유벡터 v₁, v₂ 방향에서 달성");
    L.push("현재 u = (cos θ, sin θ):  Q(u) = "+fmt(calc.snap(Qu,sc),4)+"   (λ₁ ≤ Q(u) ≤ λ₂)");
    if(dbl)L.push("λ₁ = λ₂ 이고 b = 0, a = c: H = λI 라 모든 방향이 고유벡터 (그림의 v₁, v₂는 한 예일 뿐)");
    else if(Math.abs(B)<=tol)L.push("b = 0: 행렬이 이미 대각 → 고유벡터는 좌표축 방향, 고윳값은 a, c");
    st.innerHTML=L.join("\n");
  }
  draw();return draw;
});

/* =========================================================================
   4. linear-map  A = [[p, q], [r, s]]
   cfg: {title, m:[[p,q],[r,s]], preset:"identity"|"rotation"|"shear"|"reflection"|"scale"|"singular", angle}
   ========================================================================= */
mount("linear-map",function(el,cfg){
  V6.title(el,cfg.title||"선형사상과 행렬식: det A = 부호 있는 넓이 배율");
  var ang=num(cfg.angle,30,-360,360);
  var PRE={identity:[1,0,0,1],rotation:null,shear:[1,1,0,1],reflection:[1,0,0,-1],scale:[2,0,0,0.5],singular:[1,2,0.5,1]};
  function rot(d){var t=d*DEG;return [calc.snap(Math.cos(t),1),calc.snap(-Math.sin(t),1),calc.snap(Math.sin(t),1),calc.snap(Math.cos(t),1)];}
  var m=[1,0.5,0.3,1];
  if(Array.isArray(cfg.m)&&cfg.m.length===2&&Array.isArray(cfg.m[0])&&Array.isArray(cfg.m[1]))
    m=[num(cfg.m[0][0],1,-3,3),num(cfg.m[0][1],0,-3,3),num(cfg.m[1][0],0,-3,3),num(cfg.m[1][1],1,-3,3)];
  else if(typeof cfg.preset==="string"&&cfg.preset in PRE)m=cfg.preset==="rotation"?rot(ang):PRE[cfg.preset].slice();
  var cv=V6.canvas(el,400),ctx=cv.getContext("2d"),W=cv.width;
  var st=stateBox(el),ctl=controls(el);
  var names=["p","q","r","s"],S=names.map(function(nm,i){return slider(ctl,nm+" ",-2,2,0.05,m[i],function(v){return fmt(v,3);},function(v){m[i]=v;draw();});});
  var pre=controls(el);
  function setM(v){m=v;S.forEach(function(s,i){s.set(m[i]);});draw();}
  button(pre,"항등",function(){setM([1,0,0,1]);});
  button(pre,"회전 "+fmt(ang,1)+"°",function(){setM(rot(ang));});
  button(pre,"전단",function(){setM([1,1,0,1]);});
  button(pre,"반사 (x축)",function(){setM([1,0,0,-1]);});
  button(pre,"늘이기",function(){setM([2,0,0,0.5]);});
  button(pre,"특이 (det = 0)",function(){setM([1,2,0.5,1]);});
  function draw(){
    ctx.clearRect(0,0,W,cv.height);
    var p=m[0],q=m[1],r=m[2],s=m[3],d=calc.snap(calc.det2(p,q,r,s),Math.abs(p*s)+Math.abs(q*r));
    var sc=Math.abs(p)+Math.abs(q)+Math.abs(r)+Math.abs(s);
    var flat=Math.abs(d)<=1e-9*Math.max(1,sc*sc),zero=sc===0;
    var R={x:46,y:22,w:350,h:350};
    var ext=1.6;[[1,0],[0,1],[1,1]].forEach(function(v){var w=calc.apply2(p,q,r,s,v[0],v[1]);ext=Math.max(ext,Math.abs(w[0])*1.18,Math.abs(w[1])*1.18);});
    var F2=fitEqual(R,-ext,ext,-ext,ext);
    var P=panel(ctx,R,F2.xr,F2.yr,{nx:6,ny:6,xlabel:"x",ylabel:"y",noZero:true});
    P.clip();
    /* original grid (light) */
    var G=Math.ceil(ext)+1;
    for(var i=-G;i<=G;i++){line(ctx,P.px(i),P.py(-G),P.px(i),P.py(G),"#d6d3cc",1);line(ctx,P.px(-G),P.py(i),P.px(G),P.py(i),"#d6d3cc",1);}
    line(ctx,P.px(-G),P.py(0),P.px(G),P.py(0),GRAY,1);line(ctx,P.px(0),P.py(-G),P.px(0),P.py(G),GRAY,1);
    /* transformed grid lines A(i,t), A(t,i) */
    var GG=G+2;
    for(i=-GG;i<=GG;i++){
      var a1=calc.apply2(p,q,r,s,i,-GG*3),a2=calc.apply2(p,q,r,s,i,GG*3),b1=calc.apply2(p,q,r,s,-GG*3,i),b2=calc.apply2(p,q,r,s,GG*3,i);
      line(ctx,clampPx(P.px(a1[0])),clampPx(P.py(a1[1])),clampPx(P.px(a2[0])),clampPx(P.py(a2[1])),"rgba(26,26,26,0.35)",1);
      line(ctx,clampPx(P.px(b1[0])),clampPx(P.py(b1[1])),clampPx(P.px(b2[0])),clampPx(P.py(b2[1])),"rgba(26,26,26,0.35)",1);
    }
    /* unit square and its image */
    ctx.save();ctx.strokeStyle=GRAY;ctx.setLineDash([4,3]);ctx.lineWidth=1.2;ctx.strokeRect(P.px(0),P.py(1),P.sx,P.sy);ctx.restore();
    var c0=[0,0],c1=calc.apply2(p,q,r,s,1,0),c2=calc.apply2(p,q,r,s,1,1),c3=calc.apply2(p,q,r,s,0,1);
    ctx.save();ctx.beginPath();[c0,c1,c2,c3].forEach(function(c,j){if(j===0)ctx.moveTo(P.px(c[0]),P.py(c[1]));else ctx.lineTo(P.px(c[0]),P.py(c[1]));});ctx.closePath();
    ctx.fillStyle=d<0?"rgba(158,43,37,0.16)":"rgba(26,26,26,0.10)";ctx.fill();ctx.strokeStyle=d<0?RED:INK;ctx.lineWidth=1.6;ctx.stroke();ctx.restore();
    /* orientation arc from A e1 toward A e2 */
    if(!flat){
      var a0=Math.atan2(c1[1],c1[0]),a3=Math.atan2(c3[1],c3[0]),dA=a3-a0;
      while(dA>Math.PI)dA-=2*Math.PI;while(dA<-Math.PI)dA+=2*Math.PI;
      var rr=0.32*Math.min(Math.hypot(c1[0],c1[1]),Math.hypot(c3[0],c3[1]),1)*P.sx,col=d<0?RED:INK;
      ctx.save();ctx.strokeStyle=col;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(P.px(0),P.py(0),rr,-a0,-(a0+dA*0.85),dA>0);ctx.stroke();
      var ae=a0+dA*0.85,hx=P.px(0)+rr*Math.cos(ae),hy=P.py(0)-rr*Math.sin(ae),sg=dA>0?1:-1,tx=-Math.sin(ae)*sg,ty=-Math.cos(ae)*sg;
      ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(hx+tx*7,hy+ty*7);ctx.lineTo(hx-ty*3.5,hy+tx*3.5);ctx.lineTo(hx+ty*3.5,hy-tx*3.5);ctx.closePath();ctx.fill();ctx.restore();
    }
    arrow(ctx,P.px(0),P.py(0),P.px(1),P.py(0),GRAY,1.4);arrow(ctx,P.px(0),P.py(0),P.px(0),P.py(1),GRAY,1.4);
    text(ctx,"e₁",P.px(1)+3,P.py(0)+14,{size:11,color:GRAY});text(ctx,"e₂",P.px(0)-16,P.py(1)+4,{size:11,color:GRAY});
    if(!zero){
      arrow(ctx,P.px(0),P.py(0),P.px(c1[0]),P.py(c1[1]),INK,2.4);
      arrow(ctx,P.px(0),P.py(0),P.px(c3[0]),P.py(c3[1]),INK,2.4);
      var same=Math.hypot(c1[0]-c3[0],c1[1]-c3[1])*P.sx<16;
      text(ctx,"Ae₁",P.px(c1[0])+(c1[0]>=0?6:-6),P.py(c1[1])+(c1[1]>=0?-6:14),{size:12,bold:true,align:c1[0]>=0?"left":"right"});
      text(ctx,"Ae₂",P.px(c3[0])+(c3[0]>=0?6:-6),P.py(c3[1])+(same?(c3[1]>=0?-20:28):(c3[1]>=0?-6:14)),{size:12,bold:true,align:c3[0]>=0?"left":"right"});
    }
    dotAt(ctx,P.px(0),P.py(0),3,INK);
    P.unclip();
    /* right: area bars */
    var bx=470,base=300,unit=Math.min(110,200/Math.max(1,Math.abs(d)));
    text(ctx,"넓이 비교",bx,40,{size:12.5,bold:true,halo:false});
    ctx.save();ctx.strokeStyle=INK;ctx.lineWidth=1.2;ctx.strokeRect(bx+8.5,base-unit+0.5,40,unit);ctx.restore();
    text(ctx,"단위정사각형",bx+28,base+16,{size:11,align:"center",halo:false});text(ctx,"1",bx+28,base-unit-6,{size:11.5,align:"center",halo:false});
    var hgt=Math.abs(d)*unit;
    ctx.save();ctx.fillStyle=d<0?"rgba(158,43,37,0.22)":"rgba(26,26,26,0.14)";ctx.strokeStyle=d<0?RED:INK;ctx.lineWidth=1.2;
    ctx.fillRect(bx+110,base-hgt,40,hgt);ctx.strokeRect(bx+110.5,base-hgt+0.5,40,Math.max(hgt,0.5));ctx.restore();
    line(ctx,bx,base+0.5,bx+190,base+0.5,INK,1.2);
    text(ctx,"변환된 넓이",bx+130,base+16,{size:11,align:"center",halo:false});
    text(ctx,"|det A| = "+fmt(Math.abs(d),3),bx+130,base-hgt-6,{size:11.5,align:"center",halo:false,color:d<0?RED:INK});
    text(ctx,"det A = "+fmt(d,4),bx,base+48,{size:15,bold:true,color:d<0?RED:INK,halo:false});
    text(ctx,flat?"넓이 0: 납작해짐":d<0?"방향 반전 (시계 방향)":"방향 유지 (반시계 방향)",bx,base+70,{size:12,color:d<0?RED:INK,halo:false});
    /* state */
    var L=[];
    L.push(b("A = [["+fmt(p,3)+", "+fmt(q,3)+"], ["+fmt(r,3)+", "+fmt(s,3)+"]]")+",   Ae₁ = ("+fmt(p,3)+", "+fmt(r,3)+") = 1열,   Ae₂ = ("+fmt(q,3)+", "+fmt(s,3)+") = 2열");
    function pf(x){var t=fmt(x,3);return x<0?"("+t+")":t;}
    L.push("det A = ps − qr = "+pf(p)+"·"+pf(s)+" − "+pf(q)+"·"+pf(r)+" = "+b(fmt(d,4))+"   = Ae₁, Ae₂가 만드는 평행사변형의 부호 있는 넓이");
    if(zero)L.push(red("A = 0: 평면 전체가 원점 한 점으로 — 넓이 0, 역행렬 없음"));
    else if(flat)L.push(red("det A = 0: 두 열이 평행(일차종속)이라 평면이 한 직선으로 납작해짐 — 넓이 0, 역행렬 없음, Ax = 0 에 0 아닌 해 존재"));
    else if(d<0)L.push(red("det A < 0: 방향이 뒤집힘 — e₁→e₂ 는 반시계지만 Ae₁→Ae₂ 는 시계 방향 (거울상). 넓이 배율은 |det A| = "+fmt(Math.abs(d),4)));
    else L.push("det A > 0: 방향 유지 — 모든 도형의 넓이가 det A = "+fmt(d,4)+" 배");
    st.innerHTML=L.join("\n");
  }
  draw();return draw;
});

/* =========================================================================
   5. dot-product
   cfg: {title, u:[x,y], v:[x,y]}  (or lenU, angU, lenV, angV in degrees)
   ========================================================================= */
mount("dot-product",function(el,cfg){
  V6.title(el,cfg.title||"내적 u·v = |u||v| cos θ, 정사영, 코시–슈바르츠 부등식");
  function polar(vec,len,ang,dl,da){
    if(Array.isArray(vec)&&vec.length===2){var x=num(vec[0],NaN),y=num(vec[1],NaN);
      if(isFinite(x)&&isFinite(y)){var L=Math.min(Math.hypot(x,y),3);return [L,L>0?Math.atan2(y,x)/DEG:da];}}
    return [num(len,dl,0,3),num(ang,da,-720,720)];
  }
  var U=polar(cfg.u,cfg.lenU,cfg.angU,2.5,15),V=polar(cfg.v,cfg.lenV,cfg.angV,2,65);
  U[1]=(U[1]%360+360)%360;V[1]=(V[1]%360+360)%360;
  var cv=V6.canvas(el,360),ctx=cv.getContext("2d"),W=cv.width;
  var st=stateBox(el),ctl=controls(el);
  var S=[slider(ctl,"|u| ",0,3,0.05,U[0],function(v){return fmt(v,2);},function(v){U[0]=v;draw();}),
         slider(ctl,"u 각도 ",0,360,1,U[1],function(v){return fmt(v,1)+"°";},function(v){U[1]=v;draw();}),
         slider(ctl,"|v| ",0,3,0.05,V[0],function(v){return fmt(v,2);},function(v){V[0]=v;draw();}),
         slider(ctl,"v 각도 ",0,360,1,V[1],function(v){return fmt(v,1)+"°";},function(v){V[1]=v;draw();})];
  var hint=document.createElement("span");hint.style.color="#555";hint.textContent="(화살표 끝을 끌어도 됩니다)";ctl.appendChild(hint);
  var R={x:46,y:22,w:390,h:310},F2=fitEqual(R,-3.3,3.3,-3.3,3.3),P=null;
  function vec(A){return [calc.snap(A[0]*Math.cos(A[1]*DEG),A[0]),calc.snap(A[0]*Math.sin(A[1]*DEG),A[0])];}
  function draw(){
    ctx.clearRect(0,0,W,cv.height);
    var u=vec(U),v=vec(V),nu=Math.hypot(u[0],u[1]),nv=Math.hypot(v[0],v[1]);
    var d=calc.snap(calc.dot(u,v),nu*nv),th=calc.angleBetween(u,v),pr=calc.proj(u,v);
    P=panel(ctx,R,F2.xr,F2.yr,{nx:7,ny:6,xlabel:"x",ylabel:"y"});
    P.clip();
    if(pr){
      line(ctx,P.px(-3.4*u[0]/nu),P.py(-3.4*u[1]/nu),P.px(3.4*u[0]/nu),P.py(3.4*u[1]/nu),GRAY,1,[2,4]);
      line(ctx,P.px(pr[0]),P.py(pr[1]),P.px(v[0]),P.py(v[1]),INK,1.2,[5,4]);
      var pn=Math.hypot(pr[0],pr[1]),wv=[v[0]-pr[0],v[1]-pr[1]],wn=Math.hypot(wv[0],wv[1]);
      if(pn>0.08&&wn>0.08){var e1=[u[0]/nu*0.16,u[1]/nu*0.16],e2=[wv[0]/wn*0.16,wv[1]/wn*0.16],s=pn>0.2?-1:1,sg=calc.dot(pr,u)>=0?1:-1;
        var a=[pr[0]-sg*e1[0],pr[1]-sg*e1[1]];
        ctx.save();ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(P.px(a[0]),P.py(a[1]));
        ctx.lineTo(P.px(a[0]+e2[0]),P.py(a[1]+e2[1]));ctx.lineTo(P.px(pr[0]+e2[0]),P.py(pr[1]+e2[1]));ctx.stroke();ctx.restore();}
      if(pn>1e-9)arrow(ctx,P.px(0),P.py(0),P.px(pr[0]),P.py(pr[1]),RED,4);
    }
    if(nu>0&&nv>0){
      var a0=U[1]*DEG,a1=V[1]*DEG,dA=a1-a0;while(dA>Math.PI)dA-=2*Math.PI;while(dA<-Math.PI)dA+=2*Math.PI;
      var rr=Math.min(0.45,nu*0.5,nv*0.5)*P.sx;
      ctx.save();ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.beginPath();ctx.arc(P.px(0),P.py(0),rr,-a0,-(a0+dA),dA>0);ctx.stroke();ctx.restore();
      var am=a0+dA/2;text(ctx,"θ",P.px(0)+(rr+9)*Math.cos(am),P.py(0)-(rr+9)*Math.sin(am)+4,{size:12,align:"center"});
    }
    if(nv>0){arrow(ctx,P.px(0),P.py(0),P.px(v[0]),P.py(v[1]),INK,2.2);text(ctx,"v",P.px(v[0]*1.08)+(v[0]>=0?4:-4),P.py(v[1]*1.08)+5,{size:14,bold:true,align:"center"});}
    if(nu>0){arrow(ctx,P.px(0),P.py(0),P.px(u[0]),P.py(u[1]),INK,2.8);text(ctx,"u",P.px(u[0]*1.08)+(u[0]>=0?4:-4),P.py(u[1]*1.08)+5,{size:14,bold:true,align:"center"});}
    dotAt(ctx,P.px(u[0]),P.py(u[1]),4,INK,true);dotAt(ctx,P.px(v[0]),P.py(v[1]),4,INK,true);
    if(pr&&Math.hypot(pr[0],pr[1])>0.3)text(ctx,"proj_u v",P.px(pr[0]/2),P.py(pr[1]/2)+(u[0]*u[1]>=0?16:-8),{size:11.5,color:RED,align:"center"});
    P.unclip();
    /* right: Cauchy–Schwarz bars */
    var bx=480,bw=200,top=60,mx=Math.max(nu*nv,1e-9),full=nu*nv;
    text(ctx,"코시–슈바르츠: |u·v| ≤ |u||v|",bx,top-22,{size:12.5,bold:true,halo:false});
    function hbar(y,val,lab,col,fill){
      ctx.save();ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.strokeRect(bx+0.5,y+0.5,bw,16);ctx.fillStyle=fill;ctx.fillRect(bx+1,y+1,full>0?bw*Math.min(val/mx,1)-1:0,15);ctx.restore();
      text(ctx,lab,bx,y-5,{size:11.5,color:col,halo:false});}
    hbar(top+14,full,"|u||v| = "+fmt(full,3),INK,"rgba(26,26,26,0.18)");
    hbar(top+62,Math.abs(d),"|u·v| = "+fmt(Math.abs(d),3),RED,"rgba(158,43,37,0.35)");
    var eqTxt=full===0?"u 또는 v = 0 → 0 ≤ 0, 등호":Math.abs(Math.abs(d)-full)<=1e-9*full?"등호 성립: u, v 평행 (θ = 0° 또는 180°)":"비율 |u·v| / (|u||v|) = |cos θ| = "+fmt(Math.abs(d)/full,3);
    text(ctx,eqTxt,bx,top+104,{size:11.5,halo:false});
    var sgn=!(nu>0&&nv>0)?"u·v = 0 (영벡터 포함)":d>0?"u·v > 0 → 예각 (θ < 90°)":d<0?"u·v < 0 → 둔각 (θ > 90°)":"u·v = 0 → 직교 (θ = 90°)";
    text(ctx,sgn,bx,top+136,{size:12,color:d<0?RED:INK,halo:false});
    text(ctx,"u·v = "+fmt(d,4),bx,top+170,{size:15,bold:true,halo:false});
    /* state */
    var L=[];
    L.push("u = ("+fmt(u[0],3)+", "+fmt(u[1],3)+"),  v = ("+fmt(v[0],3)+", "+fmt(v[1],3)+"),  |u| = "+fmt(nu,3)+",  |v| = "+fmt(nv,3));
    L.push(b("u·v = u₁v₁ + u₂v₂ = "+fmt(d,4))+(nu>0&&nv>0?"   = |u||v| cos θ = "+fmt(nu,3)+"·"+fmt(nv,3)+"·cos "+fmt(th/DEG,2)+"° = "+fmt(calc.snap(nu*nv*Math.cos(th),nu*nv),4):""));
    if(pr){var cmp=d/nu;
      L.push("proj_u v = (u·v / |u|²) u = ("+fmt(calc.snap(pr[0],1),3)+", "+fmt(calc.snap(pr[1],1),3)+"),   스칼라 성분 u·v/|u| = "+fmt(calc.snap(cmp,nv),4)+(cmp<0?" (음수: u 반대쪽)":""));
      L.push("직교 성분 v − proj_u v = ("+fmt(calc.snap(v[0]-pr[0],nv),3)+", "+fmt(calc.snap(v[1]-pr[1],nv),3)+"),  u와의 내적 = "+fmt(calc.snap(calc.dot(u,[v[0]-pr[0],v[1]-pr[1]]),nu*nv),3)+" (항상 0)");}
    else L.push(red("u = 0: proj_u v = (u·v/|u|²)u 는 |u|² = 0 으로 나누게 되어 정의되지 않습니다. θ도 정의되지 않음."));
    if(nu>0&&nv===0)L.push("v = 0: u·v = 0, proj_u v = 0, θ는 정의되지 않음");
    st.innerHTML=L.join("\n");
  }
  /* dragging the tips */
  var drag=-1;
  function toXY(e){var r=cv.getBoundingClientRect(),X=(e.clientX-r.left)*cv.width/r.width,Y=(e.clientY-r.top)*cv.height/r.height;
    return [F2.xr[0]+(X-R.x)/P.sx,F2.yr[0]+(R.y+R.h-Y)/P.sy,X,Y];}
  cv.addEventListener("pointerdown",function(e){if(!P)return;var q=toXY(e),best=-1,bd=16;
    [U,V].forEach(function(A,i){var w=vec(A),dd=Math.hypot(P.px(w[0])-q[2],P.py(w[1])-q[3]);if(dd<bd){bd=dd;best=i;}});
    if(best>=0){drag=best;cv.setPointerCapture(e.pointerId);e.preventDefault();}});
  cv.addEventListener("pointermove",function(e){if(drag<0)return;var q=toXY(e),A=drag===0?U:V;
    var L=Math.min(3,Math.hypot(q[0],q[1]));L=Math.round(L*20)/20;A[0]=L;if(L>0)A[1]=Math.round(((Math.atan2(q[1],q[0])/DEG)+360)%360);
    S[drag*2].set(A[0]);S[drag*2+1].set(A[1]);draw();});
  function end(){drag=-1;}
  cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);
  cv.style.touchAction="none";
  draw();return draw;
});

/* v6.js boot() silently skips configs whose JSON does not parse; show a message instead.
   Also mount our widgets ourselves if v6.js booted before this file was loaded. */
function lateMount(){
  var list=document.querySelectorAll(".v6-widget[data-widget]");
  for(var i=0;i<list.length;i++){
    var el=list[i],nm=el.getAttribute("data-widget");
    if(!MINE[nm]||el.getAttribute("data-v6b"))continue;
    var cfg=null;try{cfg=JSON.parse(el.getAttribute("data-config")||"{}");}catch(e){cfg=null;}
    if(cfg===null){el.setAttribute("data-v6b","1");fail(el,"data-config 의 JSON을 읽을 수 없습니다 (따옴표·쉼표 확인).");continue;}
    if(!el.childElementCount&&MOUNT[nm])MOUNT[nm](el,cfg);
  }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(lateMount,0);});
else setTimeout(lateMount,0);
})();
