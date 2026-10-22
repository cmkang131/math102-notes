/* v6-extra-a — MATH102 course widgets (Ch.1 series/sequences review, Ch.3 Newton / fixed points).
   Requires assets/v6.js (window.V6) loaded first.
     series-converge  일반항 a_n 과 부분합 S_n (두 패널), 프리셋별 판정 문구
     newton1d         1변수 뉴턴법: 접선 → x축 교점 → 다음 반복, 오차표
     newton2d         2변수 뉴턴법: 두 식의 선형화(직선 2개)의 교점 = 다음 반복 (J·Δ = −F)
     cobweb           고정점 반복 x_{n+1} = g(x_n) 의 거미줄 그림, |g'(x*)| 판정
   Pure math lives in `calc` (no DOM) so verify/a-numeric.mjs can load this file in a vm
   with a fake V6 that provides __testHook. The real V6 has no __testHook, so nothing leaks. */
(function(){
"use strict";
var V6=(typeof window!=="undefined")?window.V6:null;
if(!V6||typeof V6.register!=="function")return;
var INK=V6.INK||"#1a1a1a", RED=V6.RED||"#9e2b25", GRID=V6.GRID||"#e8e6e0";
var FAINT="rgba(26,26,26,0.38)";
var FONT="'Noto Sans KR','Apple SD Gothic Neo',sans-serif";
var MINUS="−";

/* ================= formatting ================= */
var SUP={"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","-":"⁻","+":""};
var SUB={"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉"};
function mapChars(s,t){return String(s).split("").map(function(ch){return t[ch]!==undefined?t[ch]:ch;}).join("");}
function sub(n){return mapChars(n,SUB);}
function neg(s){return s.charAt(0)==="-"?MINUS+s.slice(1):s;}
function trimZeros(s){return s.indexOf(".")<0?s:s.replace(/0+$/,"").replace(/\.$/,"");}
/* general display: NaN → 정의 안 됨, ±∞ → 발산, large/small → a×10ⁿ */
function fmt(v,sig){
  sig=sig||6;
  if(typeof v!=="number"||isNaN(v))return "정의 안 됨";
  if(!isFinite(v))return v>0?"+∞ (발산)":MINUS+"∞ (발산)";
  if(v===0)return "0";
  var a=Math.abs(v);
  if(a>=1e6||a<1e-4){
    var s=v.toExponential(Math.max(0,sig-3)), k=s.indexOf("e");
    return neg(trimZeros(s.slice(0,k)))+"×10"+mapChars(String(parseInt(s.slice(k+1),10)),SUP);
  }
  if(a>=Math.pow(10,sig))return neg(String(Math.round(v)));
  return neg(trimZeros(v.toPrecision(sig)));
}
/* table: many digits so the doubling of correct digits is visible */
function fmtLong(v){
  if(typeof v!=="number"||isNaN(v))return "정의 안 됨";
  if(!isFinite(v))return "발산";
  if(v===0)return "0";
  var a=Math.abs(v);
  if(a>=1e7||a<1e-5){var s=v.toExponential(10),k=s.indexOf("e");
    return neg(s.slice(0,k))+"×10"+mapChars(String(parseInt(s.slice(k+1),10)),SUP);}
  return neg(v.toPrecision(16));
}
function fmtErr(v){
  if(typeof v!=="number"||isNaN(v))return "—";
  if(v===0)return "0 (기계정밀도)";
  return fmt(v,3);
}
function fmtTick(v,step){
  if(Math.abs(v)<step*1e-6)return "0";
  if(Math.abs(v)>=1e5||step<1e-4)return fmt(v,6);
  var d=0;while(d<6&&Math.abs(Math.round(step*Math.pow(10,d))-step*Math.pow(10,d))>1e-6)d++;
  return neg(v.toFixed(d));
}
function num(v,def){var x=(typeof v==="string"&&v.trim()!=="")?Number(v):v;return (typeof x==="number"&&isFinite(x))?x:def;}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}

/* ================= safe expressions (wraps V6.makeFn) ================= */
/* V6.makeFn whitelists abs sqrt pow exp log sin cos tan pi e min max. We add a few more by passing
   them as extra parameters (atan, asin, acos, sinh, cosh, tanh). '^' is XOR in JS → rejected. */
var BASE=["abs","sqrt","pow","exp","log","sin","cos","tan","pi","e","min","max"];
var EXTRA=["atan","asin","acos","sinh","cosh","tanh"];
var EXTRA_VALS=[Math.atan,Math.asin,Math.acos,Math.sinh,Math.cosh,Math.tanh];
function compile(src,vars){
  if(typeof src!=="string"||!src.trim())return {err:"식이 비어 있습니다."};
  if(src.length>200)return {err:"식이 너무 깁니다 (200자 이하)."};
  if(src.indexOf("^")>=0){
    var v0=vars[0]||"x";
    return {err:"‘^’는 지원하지 않습니다 (JS에서 ^는 거듭제곱이 아님). pow("+v0+",2)처럼 쓰세요. 예: 1/pow("+v0+",2)"};
  }
  var bad=src.match(/[^0-9A-Za-z_+\-*\/().,\s]/);
  if(bad)return {err:"허용되지 않는 문자 ‘"+bad[0]+"’가 있습니다. 사칙연산, 괄호, 함수 이름만 쓸 수 있습니다."};
  // implicit multiplication (2n, 2(n+1), (n+1)(n+2)) is not JS: 2n is a BigInt literal, 2(…) a call
  if(/\d(?![eE][+\-]?\d)[A-Za-z_(]/.test(src)||/\)\s*[(A-Za-z0-9_.]/.test(src))
    return {err:"곱셈 기호 *를 생략할 수 없습니다 (예: 2n → 2*n, (n+1)(n+2) → (n+1)*(n+2))."};
  var noNum=src.replace(/(^|[^A-Za-z0-9_.])(\d+\.?\d*|\.\d+)([eE][+\-]?\d+)?/g,"$1 0 ");
  var toks=noNum.match(/[A-Za-z_][A-Za-z0-9_]*/g)||[], allowed=vars.concat(BASE,EXTRA);
  for(var i=0;i<toks.length;i++){
    if(allowed.indexOf(toks[i])<0)
      return {err:"알 수 없는 이름 ‘"+toks[i]+"’. 변수는 "+vars.join(", ")+", 함수는 "+BASE.concat(EXTRA).join(" ")+" 만 됩니다."};
  }
  var f;
  try{f=V6.makeFn(src,vars.concat(EXTRA));}catch(e){return {err:"식을 해석할 수 없습니다 (괄호·곱셈 기호 * 확인): "+src};}
  return {fn:function(){var a=Array.prototype.slice.call(arguments);return f(a.concat(EXTRA_VALS));}};
}

/* ================= pure math (tested by verify/a-numeric.mjs) ================= */
var calc={};
calc.EULER_GAMMA=0.5772156649015329;
/* ζ(p), p>1, by Euler–Maclaurin with M=40 (error far below display precision) */
calc.zeta=function(p){
  if(!(p>1))return Infinity;
  var M=40,s=0;for(var n=1;n<M;n++)s+=Math.pow(n,-p);
  return s+Math.pow(M,1-p)/(p-1)+Math.pow(M,-p)/2+p*Math.pow(M,-p-1)/12
         -p*(p+1)*(p+2)*Math.pow(M,-p-3)/720+p*(p+1)*(p+2)*(p+3)*(p+4)*Math.pow(M,-p-5)/30240;
};
/* terms a_1..a_N and partial sums; an undefined term makes all later S_n undefined */
calc.seriesData=function(term,N){
  var a=[],S=[],s=0,bad=[];
  for(var n=1;n<=N;n++){
    var v=term(n);
    if(typeof v!=="number"||!isFinite(v)){bad.push(n);v=NaN;}
    a.push(v);s=s+v;S.push(s);
  }
  return {a:a,S:S,bad:bad};
};
calc.newton1d=function(f,df,x0,maxIt){
  var FLAT=1e-12,BIG=1e8,it=[{x:x0,fx:f(x0)}],status="max";
  for(var k=0;k<maxIt;k++){
    var cur=it[it.length-1],x=cur.x,fx=cur.fx,d=df(x);
    cur.dfx=d;
    if(!isFinite(x)||!isFinite(fx)){status="nan";break;}
    if(fx===0){status="root";break;}
    if(!isFinite(d)){status="nan";break;}
    if(Math.abs(d)<FLAT){status=Math.abs(x)>1e6?"diverge":"flat";break;} // tiny slope far out = runaway, not a stall
    var xn=x-fx/d;
    cur.next=xn;
    if(!isFinite(xn)||Math.abs(xn)>BIG){status="diverge";break;}
    it.push({x:xn,fx:f(xn)});
    if(Math.abs(xn-x)<=2e-16*Math.max(1,Math.abs(x))){status="conv";break;}
  }
  var last=it[it.length-1];if(last.dfx===undefined)last.dfx=df(last.x);
  return {it:it,status:status};
};
/* 2x2 Newton step: solve J·Δ = −F by Cramer */
calc.newton2dStep=function(F,J,x,y){
  var f=F(x,y),j=J(x,y),det=j[0]*j[3]-j[1]*j[2];
  var r={F:f,J:j,det:det,normF:Math.sqrt(f[0]*f[0]+f[1]*f[1])};
  if(![f[0],f[1],j[0],j[1],j[2],j[3]].every(isFinite)){r.status="nan";return r;}
  var sc=Math.max(1,j[0]*j[0]+j[1]*j[1]+j[2]*j[2]+j[3]*j[3]);
  if(Math.abs(det)<1e-12*sc){r.status="singular";return r;}
  r.dx=(-f[0]*j[3]+j[1]*f[1])/det;r.dy=(-j[0]*f[1]+j[2]*f[0])/det;
  r.nx=x+r.dx;r.ny=y+r.dy;r.status="ok";
  r.cond=Math.abs(det)/sc; // small ⇒ the two lines are nearly parallel
  return r;
};
calc.newton2d=function(F,J,x0,y0,maxIt){
  var it=[],x=x0,y=y0,status="max";
  for(var k=0;k<=maxIt;k++){
    var s=calc.newton2dStep(F,J,x,y);s.x=x;s.y=y;it.push(s);
    if(s.status!=="ok"){status=s.status;break;}
    if(s.normF===0){status="root";break;}
    if(k===maxIt)break;
    if(Math.abs(s.nx)>1e8||Math.abs(s.ny)>1e8){status="diverge";break;}
    if(Math.abs(s.dx)+Math.abs(s.dy)<=2e-16*Math.max(1,Math.abs(x)+Math.abs(y))){x=s.nx;y=s.ny;status="conv";
      var t=calc.newton2dStep(F,J,x,y);t.x=x;t.y=y;it.push(t);break;}
    x=s.nx;y=s.ny;
  }
  return {it:it,status:status};
};
calc.dnum=function(g,x){var h=1e-5*Math.max(1,Math.abs(x));return (g(x+h)-g(x-h))/(2*h);};
calc.orbit=function(g,x0,n){
  var xs=[x0],x=x0;
  for(var i=0;i<n;i++){x=g(x);if(typeof x!=="number"||!isFinite(x)||Math.abs(x)>1e6){xs.push(NaN);break;}xs.push(x);}
  return xs;
};
/* fixed points of g on [lo,hi]: sign changes of g(x)−x refined by bisection, plus touching zeros */
calc.fixedPoints=function(g,lo,hi){
  var M=4000,h=function(x){return g(x)-x;},out=[],prev=null,px=lo;
  var vals=[];for(var i=0;i<=M;i++){var x=lo+(hi-lo)*i/M;vals.push([x,h(x)]);}
  for(i=0;i<=M;i++){
    var xv=vals[i][0],hv=vals[i][1];
    if(!isFinite(hv)){prev=null;continue;}
    if(hv===0)out.push(xv);
    else if(prev!==null&&prev*hv<0){
      var a=px,b=xv,ha=prev;
      for(var k=0;k<80;k++){var m=(a+b)/2,hm=h(m);if(!isFinite(hm))break;if(hm===0){a=b=m;break;}if(ha*hm<0)b=m;else{a=m;ha=hm;}}
      var r=(a+b)/2;if(Math.abs(h(r))<1e-7)out.push(r);
    }else if(i>0&&i<M&&isFinite(vals[i-1][1])&&isFinite(vals[i+1][1])&&prev*hv>0&&hv*vals[i+1][1]>0&&
             Math.abs(hv)<=Math.abs(vals[i-1][1])&&Math.abs(hv)<=Math.abs(vals[i+1][1])&&Math.abs(hv)<1e-3){
      /* g(x) − x touches 0 without changing sign (e.g. r = 1 logistic): minimise |h| by ternary search */
      var L=vals[i-1][0],R=vals[i+1][0];
      for(k=0;k<200;k++){var m1=L+(R-L)/3,m2=R-(R-L)/3;if(Math.abs(h(m1))<Math.abs(h(m2)))R=m2;else L=m1;}
      var t=(L+R)/2;if(Math.abs(t)<1e-12)t=0;if(Math.abs(h(t))<1e-12)out.push(t);
    }
    prev=hv;px=xv;
  }
  out.sort(function(a,b){return a-b;});
  return out.filter(function(v,i){return i===0||Math.abs(v-out[i-1])>1e-6*Math.max(1,Math.abs(v));});
};
calc.classifyFixed=function(d,tol){
  var a=Math.abs(d);tol=tol||1e-9;
  if(!isFinite(a))return "unknown";
  if(Math.abs(a-1)<=tol)return "neutral";
  return a<1?"attract":"repel";
};
/* long-run behaviour after a transient: converge / period p / no short period / diverge */
calc.longRun=function(g,x0){
  var T=20000,x=x0,i,spreadA=0,spreadB=0,w=[];
  for(i=0;i<T;i++){
    x=g(x);if(typeof x!=="number"||!isFinite(x)||Math.abs(x)>1e6)return {kind:"diverge",at:i+1};
    if(i>=T/2&&i<T/2+64){w.push(x);}
  }
  for(i=1;i<w.length;i++)spreadA=Math.max(spreadA,Math.abs(w[i]-w[i-1]));
  var c=[x];for(i=0;i<128;i++){x=g(x);if(!isFinite(x))return {kind:"diverge",at:T+i};c.push(x);}
  for(i=1;i<65;i++)spreadB=Math.max(spreadB,Math.abs(c[i]-c[i-1]));
  var tol=1e-7*Math.max(1,Math.abs(c[0]));
  for(var p=1;p<=64;p++){
    var ok=true;for(i=0;i+p<c.length;i++)if(Math.abs(c[i+p]-c[i])>tol){ok=false;break;}
    if(ok){
      var slow=(spreadB<0.9*spreadA)&&spreadB>tol; // still shrinking after 10⁴ steps
      return {kind:p===1?"fixed":"cycle",p:p,pts:c.slice(0,p),slow:slow||(p===1&&spreadA>1e-9)};
    }
  }
  return {kind:"none",sample:c[0]};
};
calc.logistic={
  r2cycle:1+Math.sqrt(6), r4cycle:3.5440903595519, rInf:3.5699456718709, r3window:1+Math.sqrt(8)
};

/* ================= DOM / canvas helpers ================= */
function mk(tag,cls,text){var d=document.createElement(tag);if(cls)d.className=cls;if(text!==undefined)d.textContent=text;return d;}
function errBox(el){var d=mk("div","v6-state");d.style.color=RED;d.style.display="none";d.style.marginTop="6px";el.appendChild(d);
  return {set:function(m){d.textContent=m?"⚠ "+m:"";d.style.display=m?"block":"none";}};}
function fatal(el,m){var d=mk("div","v6-state","⚠ "+m);d.style.color=RED;el.appendChild(d);}
function guard(el,name,fn){
  try{fn();}catch(e){fatal(el,"‘"+name+"’ 위젯을 그리지 못했습니다. data-config 를 확인하세요. ("+((e&&e.message)||e)+")");}
}
function addSelect(parent,label,opts,val,on){
  var lab=mk("label",null,label+" "),s=mk("select");
  s.style.cssText="font:inherit;font-size:12.5px;border:1.2px solid #1a1a1a;border-radius:3px;background:#fff;padding:1px 4px";
  opts.forEach(function(o){var op=mk("option",null,o[1]);op.value=o[0];s.appendChild(op);});
  s.value=val;s.onchange=function(){on(s.value);};lab.appendChild(s);parent.appendChild(lab);
  return {el:s,lab:lab};
}
function addSlider(parent,label,min,max,step,val,show,on){
  var lab=mk("label",null,label+" "),r=mk("input"),v=mk("span","v6-val");
  r.type="range";r.min=min;r.max=max;r.step=step;r.value=val;v.textContent=show(val);
  r.oninput=function(){var x=parseFloat(r.value);v.textContent=show(x);on(x);};
  lab.appendChild(r);lab.appendChild(v);parent.appendChild(lab);
  return {lab:lab,set:function(x){r.value=x;v.textContent=show(x);}};
}
function addBtn(parent,text,on){var b=mk("button","v6-btn",text);b.type="button";b.onclick=on;parent.appendChild(b);return b;}
function niceStep(span,n){
  var raw=span/Math.max(1,n),p=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10)),m=raw/p;
  return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p;
}
function ticks(lo,hi,n,intOnly){
  if(!(hi>lo))return {list:[],step:1};
  var st=niceStep(hi-lo,n);if(intOnly)st=Math.max(1,Math.round(st));
  var out=[];for(var v=Math.ceil(lo/st-1e-9)*st;v<=hi+st*1e-9&&out.length<60;v+=st)out.push(Math.abs(v)<st*1e-9?0:v);
  return {list:out,step:st};
}
/* plot frame with margins: grid, zero axes, border, numeric tick labels, axis names */
function frame(ctx,b,xr,yr,o){
  o=o||{};
  var sx=b.w/(xr[1]-xr[0]),sy=b.h/(yr[1]-yr[0]);
  var X=function(x){return b.x+(x-xr[0])*sx;},Y=function(y){return b.y+b.h-(y-yr[0])*sy;};
  var xt=ticks(xr[0],xr[1],Math.max(2,Math.floor(b.w/62)),o.intX),yt=ticks(yr[0],yr[1],Math.max(2,Math.floor(b.h/30)));
  ctx.save();ctx.lineWidth=1;ctx.strokeStyle=GRID;ctx.setLineDash([]);
  xt.list.forEach(function(t){var p=Math.round(X(t))+0.5;ctx.beginPath();ctx.moveTo(p,b.y);ctx.lineTo(p,b.y+b.h);ctx.stroke();});
  yt.list.forEach(function(t){var p=Math.round(Y(t))+0.5;ctx.beginPath();ctx.moveTo(b.x,p);ctx.lineTo(b.x+b.w,p);ctx.stroke();});
  ctx.strokeStyle=INK;ctx.lineWidth=1.2;
  if(xr[0]<0&&xr[1]>0&&!o.noYaxis){ctx.beginPath();ctx.moveTo(X(0),b.y);ctx.lineTo(X(0),b.y+b.h);ctx.stroke();}
  if(yr[0]<0&&yr[1]>0){ctx.beginPath();ctx.moveTo(b.x,Y(0));ctx.lineTo(b.x+b.w,Y(0));ctx.stroke();}
  ctx.lineWidth=1;ctx.strokeRect(b.x+0.5,b.y+0.5,b.w,b.h);
  ctx.fillStyle=INK;ctx.font="11px "+FONT;ctx.textAlign="center";ctx.textBaseline="top";
  var lastR=-1e9;
  xt.list.forEach(function(t){var s=fmtTick(t,xt.step),w=ctx.measureText(s).width,x=X(t);
    if(x-w/2<lastR+6)return;ctx.fillText(s,x,b.y+b.h+4);lastR=x+w/2;});
  ctx.textAlign="right";ctx.textBaseline="middle";
  yt.list.forEach(function(t){ctx.fillText(fmtTick(t,yt.step),b.x-5,Y(t));});
  if(o.xname){ctx.textAlign="right";ctx.textBaseline="top";ctx.fillText(o.xname,b.x+b.w,b.y+b.h+18);}
  if(o.yname){ctx.textAlign="left";ctx.textBaseline="bottom";ctx.font="bold 11.5px "+FONT;ctx.fillText(o.yname,b.x,b.y-3);}
  ctx.restore();
  return {X:X,Y:Y,b:b,xr:xr,yr:yr,
    inX:function(x){return x>=xr[0]&&x<=xr[1];},inY:function(y){return y>=yr[0]&&y<=yr[1];},
    clip:function(){ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();},
    unclip:function(){ctx.restore();},
    toData:function(px,py){return [xr[0]+(px-b.x)/sx,yr[0]+(b.y+b.h-py)/sy];}};
}
function plotFn(ctx,F,fn,color,width,dash){
  var b=F.b,span=F.yr[1]-F.yr[0],started=false;
  F.clip();ctx.strokeStyle=color;ctx.lineWidth=width||2;ctx.setLineDash(dash||[]);ctx.beginPath();
  var prevY=null;
  for(var px=b.x;px<=b.x+b.w;px+=1){
    var x=F.xr[0]+(px-b.x)/b.w*(F.xr[1]-F.xr[0]),y=fn(x);
    if(typeof y!=="number"||!isFinite(y)||y<F.yr[0]-10*span||y>F.yr[1]+10*span){started=false;prevY=null;continue;}
    if(prevY!==null&&Math.abs(y-prevY)>3*span)started=false; // break at poles
    if(!started){ctx.moveTo(px,F.Y(y));started=true;}else ctx.lineTo(px,F.Y(y));
    prevY=y;
  }
  ctx.stroke();ctx.setLineDash([]);F.unclip();
}
/* text with white backing, kept inside the canvas */
function tag(ctx,text,x,y,o){
  o=o||{};ctx.save();ctx.font=(o.bold?"bold ":"")+(o.size||11.5)+"px "+FONT;
  var w=ctx.measureText(text).width,h=(o.size||11.5)+4,al=o.align||"left";
  var x0=al==="left"?x:al==="right"?x-w:x-w/2;
  var W=ctx.canvas.width,H=ctx.canvas.height;
  x0=clamp(x0,2,W-w-2);var y0=clamp(y-h/2,1,H-h-1);
  if(o.bg!==false){ctx.fillStyle="rgba(255,255,255,0.9)";ctx.fillRect(x0-2,y0,w+4,h);}
  ctx.fillStyle=o.color||INK;ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillText(text,x0,y0+h/2);
  ctx.restore();return {x:x0,y:y0,w:w,h:h};
}
function dot(ctx,x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.4;ctx.stroke();}}
function seg(ctx,x1,y1,x2,y2,color,width,dash){ctx.strokeStyle=color;ctx.lineWidth=width||1;ctx.setLineDash(dash||[]);
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);}
/* small arrow at the box edge for a value that lies outside the plotted x range */
function edgeArrow(ctx,F,x,yPix,text){
  var b=F.b,right=x>F.xr[1],px=right?b.x+b.w-2:b.x+2,dir=right?1:-1;
  ctx.fillStyle=RED;ctx.beginPath();ctx.moveTo(px,yPix);ctx.lineTo(px-dir*9,yPix-5);ctx.lineTo(px-dir*9,yPix+5);ctx.closePath();ctx.fill();
  tag(ctx,text,right?px-12:px+12,yPix-12,{align:right?"right":"left",color:RED,size:11});
}
function afterFonts(fn){try{if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){fn();});}catch(e){}}
function autoRange(vals,includeZero){
  var lo=Infinity,hi=-Infinity;
  vals.forEach(function(v){if(typeof v==="number"&&isFinite(v)){if(v<lo)lo=v;if(v>hi)hi=v;}});
  if(includeZero){lo=Math.min(lo,0);hi=Math.max(hi,0);}
  if(!isFinite(lo)||!isFinite(hi))return [-1,1];
  if(hi-lo<1e-9*Math.max(1,Math.abs(hi))){lo-=0.5*Math.max(1e-6,Math.abs(lo)||1);hi+=0.5*Math.max(1e-6,Math.abs(hi)||1);}
  var pad=(hi-lo)*0.08;return [lo-pad,hi+pad];
}
function canvasPoint(c,ev){var r=c.getBoundingClientRect();return [(ev.clientX-r.left)*c.width/r.width,(ev.clientY-r.top)*c.height/r.height];}

/* ======================================================================
   1. series-converge
   cfg: {title?, preset:"geometric"|"harmonic"|"p2"|"alt-harmonic"|"n-over-n1"|"pseries"|"custom",
         term?: "1/pow(n,2)" (식, 변수 n), kind?:"series"|"sequence", N?:30, Nmax?:200, r?:0.5, p?:1.5}
   ====================================================================== */
var SERIES={
  "geometric":{label:"기하 rⁿ⁻¹ (r 조절)",show:function(P){return "a_n = r^(n"+MINUS+"1),  r = "+fmt(P.r);},
    term:function(n,P){return Math.pow(P.r,n-1);},
    lim:function(P){var a=Math.abs(P.r);return a<1?{v:0,t:"0"}:(P.r===1?{v:1,t:"1"}:null);},
    sum:function(P){return Math.abs(P.r)<1?{v:1/(1-P.r),t:"1/(1"+MINUS+"r)"}:null;},
    series:function(P){var a=Math.abs(P.r);
      if(a<1)return "수렴. 기하급수에서 |r| = "+fmt(a)+" < 1 이면 합 = a/(1"+MINUS+"r) = 1/(1"+MINUS+(P.r<0?"("+fmt(P.r)+")":fmt(P.r))+") = "+fmt(1/(1-P.r))+"  (첫째항 a = 1).";
      return "발산. |r| ≥ 1 이면 일반항 r^(n"+MINUS+"1) 이 0으로 가지 않는다 (일반항 판정)"+
        (P.r===1?". S_n = n → ∞.":P.r===-1?". S_n 이 1, 0, 1, 0, … 을 오가며 극한이 없다.":".");},
    seq:function(P){var a=Math.abs(P.r);
      if(a<1)return "수열 rⁿ⁻¹ → 0 (|r| < 1). 급수 Σ rⁿ⁻¹ 도 수렴하지만(합 "+fmt(1/(1-P.r))+") 그 이유는 기하급수 공식이다 — a_n → 0 만으로 급수 수렴이 따라오지는 않는다(조화급수).";
      if(P.r===1)return "상수열 1 → 1. 급수로는 S_n = n → ∞ 발산.";
      if(P.r===-1)return "1, "+MINUS+"1, 1, … 진동 → 극한 없음 (발산).";
      return "|rⁿ⁻¹| → ∞ 이므로 수열이 발산한다.";}},
  "harmonic":{label:"조화급수 1/n",show:function(){return "a_n = 1/n";},
    term:function(n){return 1/n;},lim:function(){return {v:0,t:"0"};},sum:function(){return null;},
    ref:{f:function(n){return Math.log(n)+calc.EULER_GAMMA;},t:"ln n + γ"},
    series:function(){return "발산. 적분판정: ∫₁^∞ dx/x = ∞ (p급수 p = 1). 일반항 1/n → 0 이지만 발산한다: ‘a_n → 0’ 은 수렴의 필요조건일 뿐 충분조건이 아니다.";},
    seq:function(){return "수열 1/n → 0. 그러나 급수 Σ1/n 은 발산 (적분판정: ∫₁^∞ dx/x = ∞).";}},
  "p2":{label:"1/n² (p = 2)",show:function(){return "a_n = 1/n²";},
    term:function(n){return 1/(n*n);},lim:function(){return {v:0,t:"0"};},sum:function(){return {v:Math.PI*Math.PI/6,t:"π²/6"};},
    series:function(){return "수렴, 합 = π²/6 ≈ 1.644934. p급수 p = 2 > 1 (적분판정: ∫₁^∞ dx/x² = 1 < ∞).";},
    extra:function(P,N,S){var R=Math.PI*Math.PI/6-S;
      return "적분판정 꼬리 범위: 1/(N+1) < π²/6 "+MINUS+" S_N < 1/N  →  "+fmt(1/(N+1),4)+" < "+fmt(R,4)+" < "+fmt(1/N,4);},
    seq:function(){return "수열 1/n² → 0. 급수 Σ1/n² 도 수렴 (합 π²/6).";}},
  "alt-harmonic":{label:"교대 ("+MINUS+"1)ⁿ⁺¹/n",show:function(){return "a_n = ("+MINUS+"1)^(n+1)/n";},
    term:function(n){return (n%2===1?1:-1)/n;},lim:function(){return {v:0,t:"0"};},sum:function(){return {v:Math.LN2,t:"ln 2"};},
    series:function(){return "수렴, 합 = ln 2 ≈ 0.693147. 교대급수판정: 1/n 이 단조감소하며 0으로 간다. 하지만 Σ|a_n| = Σ1/n 은 발산하므로 절대수렴은 아니다 (조건수렴).";},
    extra:function(P,N,S){return "교대급수 오차 한계: |ln 2 "+MINUS+" S_N| = "+fmt(Math.abs(Math.LN2-S),4)+" ≤ 1/(N+1) = "+fmt(1/(N+1),4);},
    seq:function(){return "수열 ("+MINUS+"1)ⁿ⁺¹/n → 0. 급수는 조건수렴 (합 ln 2).";}},
  "n-over-n1":{label:"n/(n+1)",show:function(){return "a_n = n/(n+1)";},defKind:"sequence",
    term:function(n){return n/(n+1);},lim:function(){return {v:1,t:"1"};},sum:function(){return null;},
    series:function(){return "발산. 일반항 판정: a_n = n/(n+1) → 1 ≠ 0.";},
    seq:function(){return "수열 n/(n+1) → 1 (수렴). 그러나 급수 Σ n/(n+1) 은 일반항이 1로 가서 (0이 아님) 발산한다 — 아래 패널.";}},
  "pseries":{label:"p급수 1/nᵖ (p 조절)",show:function(P){return "a_n = 1/n^p,  p = "+fmt(P.p);},
    term:function(n,P){return Math.pow(n,-P.p);},lim:function(P){return P.p>0?{v:0,t:"0"}:null;},
    sum:function(P){return P.p>1?{v:calc.zeta(P.p),t:P.p===2?"π²/6":"ζ(p)"}:null;},
    series:function(P){
      if(P.p>1)return "수렴. p급수 p = "+fmt(P.p)+" > 1 (적분판정: ∫₁^∞ dx/x^p = 1/(p"+MINUS+"1) < ∞). 합 ζ("+fmt(P.p)+") ≈ "+fmt(calc.zeta(P.p))+(P.p===2?" (= π²/6)":" (수치 계산값)")+".";
      return "발산. p = "+fmt(P.p)+" ≤ 1 이면 적분판정 ∫₁^∞ dx/x^p = ∞.";},
    extra:function(P,N,S){if(!(P.p>1))return "";var q=P.p-1;
      return "적분판정 꼬리 범위: 1/((p"+MINUS+"1)(N+1)^(p"+MINUS+"1)) < 합 "+MINUS+" S_N < 1/((p"+MINUS+"1)N^(p"+MINUS+"1))  →  "+
        fmt(1/(q*Math.pow(N+1,q)),4)+" < "+fmt(calc.zeta(P.p)-S,4)+" < "+fmt(1/(q*Math.pow(N,q)),4);},
    seq:function(P){return "수열 1/n^p → 0 (p > 0). 급수는 p > 1 일 때만 수렴.";}},
  "custom":{label:"직접 입력",show:function(P){return "a_n = "+P.term;},term:null,
    lim:function(){return null;},sum:function(){return null;},
    series:function(){return "사용자 정의 식: 알려진 합이 없어 점선을 그리지 않는다. 아래 값은 n ≤ N 까지의 수치일 뿐, 수렴·발산의 증명이 아니다.";},
    seq:function(){return "사용자 정의 식: 알려진 극한이 없어 점선을 그리지 않는다. 그림은 n ≤ N 까지의 값일 뿐 극한을 보장하지 않는다.";}}
};
var CAP=1e9;
function seriesWidget(el,cfg){
  V6.title(el,cfg.title||"수열과 급수: 일반항 a_n 과 부분합 S_n");
  var msgs=[];
  var preset=cfg.preset;
  if(preset===undefined)preset=(typeof cfg.term==="string")?"custom":"geometric";
  if(!SERIES[preset]){msgs.push("알 수 없는 preset ‘"+preset+"’ → 기하급수로 표시합니다.");preset="geometric";}
  var NMAX=Math.round(clamp(num(cfg.Nmax,200),5,500));
  var st={preset:preset,N:Math.round(clamp(num(cfg.N,30),1,NMAX)),
    r:clamp(num(cfg.r,0.5),-1.5,1.5),p:clamp(num(cfg.p,1.5),0.5,3),
    term:typeof cfg.term==="string"?cfg.term:"1/pow(n,2)",kind:null,termFn:null};
  st.kind=cfg.kind==="sequence"||cfg.kind==="series"?cfg.kind:(SERIES[preset].defKind||"series");
  var c=V6.canvas(el,470),ctx=c.getContext("2d");
  var ctl=mk("div","v6-controls");el.appendChild(ctl);
  addSelect(ctl,"예시",Object.keys(SERIES).map(function(k){return [k,SERIES[k].label];}),st.preset,function(v){
    st.preset=v;st.kind=SERIES[v].defKind||"series";kindSel.el.value=st.kind;sync();draw();});
  var kindSel=addSelect(ctl,"보기",[["series","급수 Σa_n"],["sequence","수열 a_n"]],st.kind,function(v){st.kind=v;draw();});
  addSlider(ctl,"N",1,NMAX,1,st.N,function(v){return String(v);},function(v){st.N=v;draw();});
  var rS=addSlider(ctl,"r",-1.5,1.5,0.05,st.r,function(v){return fmt(v);},function(v){st.r=Math.round(v*100)/100;draw();});
  var pS=addSlider(ctl,"p",0.5,3,0.05,st.p,function(v){return fmt(v);},function(v){st.p=Math.round(v*100)/100;draw();});
  var cRow=mk("div","v6-controls");el.appendChild(cRow);
  var cLab=mk("label",null,"a_n = "),cIn=mk("input");cIn.type="text";cIn.value=st.term;cIn.size=28;
  cIn.style.cssText="font:inherit;font-size:12.5px;border:1.2px solid #1a1a1a;border-radius:3px;padding:1px 6px";
  cLab.appendChild(cIn);cRow.appendChild(cLab);
  addBtn(cRow,"적용",function(){st.term=cIn.value;compileTerm();draw();});
  cIn.onkeydown=function(e){if(e.key==="Enter"){st.term=cIn.value;compileTerm();draw();}};
  cRow.appendChild(mk("span",null,"변수 n, 거듭제곱은 pow(n,2), (−1)ⁿ 은 pow(-1,n)"));
  var err=errBox(el),state=mk("div","v6-state");el.appendChild(state);
  var termErr="";
  function compileTerm(){var r=compile(st.term,["n"]);termErr=r.err||"";st.termFn=r.fn||null;}
  function sync(){rS.lab.style.display=st.preset==="geometric"?"":"none";pS.lab.style.display=st.preset==="pseries"?"":"none";
    cRow.style.display=st.preset==="custom"?"":"none";if(st.preset==="custom")compileTerm();}
  function draw(){guard(el,"series-converge",drawInner);}
  function drawInner(){
    ctx.clearRect(0,0,c.width,c.height);
    var S=SERIES[st.preset],P={r:st.r,p:st.p,term:st.term},N=st.N,m=msgs.slice();
    var term=st.preset==="custom"?st.termFn:function(n){return S.term(n,P);};
    if(st.preset==="custom"&&!term){m.push(termErr||"식을 해석할 수 없습니다.");err.set(m.join(" "));
      state.innerHTML="";tag(ctx,"식을 고치면 그래프가 나타납니다.",360,200,{align:"center"});return;}
    var d=calc.seriesData(term,N);
    if(d.bad.length)m.push("a_n 이 정의되지 않는 n: "+d.bad.slice(0,6).join(", ")+(d.bad.length>6?" …":"")+" (그 뒤 부분합도 정의 안 됨)");
    err.set(m.join(" "));
    var lim=S.lim(P),sum=S.sum(P);
    var boxA={x:62,y:24,w:556,h:170},boxS={x:62,y:256,w:556,h:170},xr=[0.5,N+0.5];
    panel(boxA,d.a,lim,"a_n  (일반항)",st.kind==="sequence","lim a_n");
    panel(boxS,d.S,sum,"S_n = a₁ + … + a_n  (부분합)"+(st.kind==="sequence"?"  — 참고: 급수로 본다면":""),st.kind==="series","합",S.ref);
    function panel(b,vals,L,name,emph,lname,ref){
      var shown=vals.filter(function(v){return isFinite(v)&&Math.abs(v)<=CAP;});
      var yr=autoRange(shown.concat(L&&Math.abs(L.v)<=CAP?[L.v]:[]),true);
      var F=frame(ctx,b,xr,yr,{intX:true,xname:"n",yname:name});
      if(emph){ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.strokeRect(b.x+0.5,b.y+0.5,b.w,b.h);}
      if(ref){plotFn(ctx,F,function(x){return x>=1?ref.f(x):NaN;},FAINT,1.2,[2,3]);
        var ry=clamp(F.Y(ref.f(N)),b.y+8,b.y+b.h-8);tag(ctx,ref.t+" (비교)",b.x+b.w+6,ry+(L?14:0),{color:INK,size:11,bg:false});}
      if(L){var ly=F.Y(L.v);seg(ctx,b.x,ly,b.x+b.w,ly,RED,1.4,[6,4]);
        tag(ctx,lname+" = "+L.t,b.x+b.w+6,clamp(ly,b.y+8,b.y+b.h-8)-7,{color:RED,size:11,bg:false});
        if(L.t!==fmt(L.v,5))tag(ctx,"≈ "+fmt(L.v,5),b.x+b.w+6,clamp(ly,b.y+8,b.y+b.h-8)+7,{color:RED,size:11,bg:false});}
      var rad=N<=60?3:N<=120?2.2:1.7,off=0;
      for(var i=0;i<vals.length;i++){
        var v=vals[i],x=F.X(i+1);if(!isFinite(v))continue;
        var col=(i===vals.length-1)?RED:INK;
        if(Math.abs(v)>CAP){off++;var top=v>0;ctx.fillStyle=col;ctx.beginPath();
          var yy=top?b.y+2:b.y+b.h-2,dd=top?1:-1;ctx.moveTo(x,yy);ctx.lineTo(x-4,yy+dd*7);ctx.lineTo(x+4,yy+dd*7);ctx.closePath();ctx.fill();continue;}
        dot(ctx,x,F.Y(v),i===vals.length-1?rad+1:rad,col);
      }
      if(off)tag(ctx,"▲/▼ = |값| > 10⁹ 이라 축 밖 (발산)",b.x+8,b.y+13,{color:RED,size:11});
    }
    var aN=d.a[N-1],SN=d.S[N-1];
    var line1=st.kind==="series"?S.series(P):S.seq(P);
    var line2="N = "+N+":  a_N = "+fmt(aN)+",  S_N = "+(Math.abs(SN)>CAP&&isFinite(SN)?fmt(SN)+" (발산 중)":fmt(SN))+
      (sum&&isFinite(SN)?",  합 "+MINUS+" S_N = "+fmt(sum.v-SN,4):"")+(lim&&isFinite(aN)&&st.kind==="sequence"?",  |a_N "+MINUS+" 극한| = "+fmt(Math.abs(aN-lim.v),4):"");
    var line3=(S.extra&&isFinite(SN))?S.extra(P,N,SN):"";
    state.innerHTML="<b>"+esc(S.show(P))+"</b>\n<b>판정</b>  "+esc(line1)+"\n"+esc(line2)+(line3?"\n"+esc(line3):"");
  }
  sync();draw();afterFonts(draw);
}

/* ======================================================================
   2. newton1d
   cfg: {title?, preset:"sqrt2"|"cos"|"cycle"|"atan"|"flat"|"double"|"custom",
         f?, df?, root?, x0?, x?:[a,b], y?:[c,d], maxIter?:8, step?: 처음 보일 단계 수 (반복당 3단계)}
   ====================================================================== */
var NEWTON={
  "sqrt2":{label:"x² − 2 (√2 구하기)",f:function(x){return x*x-2;},df:function(x){return 2*x;},d2:function(){return 2;},
    root:Math.SQRT2,rootT:"√2",x0:1,x:[-0.5,2.5],note:"단순근 √2: f'(√2) = 2√2 ≠ 0 이라 2차 수렴. C = |f''/(2f')| = 1/(2√2) ≈ 0.354."},
  "cos":{label:"cos x − x",f:function(x){return Math.cos(x)-x;},df:function(x){return -Math.sin(x)-1;},d2:function(x){return -Math.cos(x);},
    root:0.7390851332151607,rootT:"0.739085…",x0:0,x:[-0.5,1.5],note:"단순근 x* ≈ 0.739085 (cos x* = x*). f'(x*) = "+MINUS+"sin x* "+MINUS+" 1 ≠ 0 → 2차 수렴."},
  "cycle":{label:"x³ − 2x + 2, x₀ = 0 (2-주기)",f:function(x){return x*x*x-2*x+2;},df:function(x){return 3*x*x-2;},d2:function(x){return 6*x;},
    root:-1.7692923542386314,rootT:"−1.769292…",x0:0,x:[-2.5,2],note:"x₀ = 0 → x₁ = 1 → x₂ = 0 → … 영원히 0, 1 을 오간다. 실근 ≈ "+MINUS+"1.7693 으로 가지 않는다: 뉴턴법은 초기값이 근에 충분히 가까울 때만 수렴이 보장된다."},
  "atan":{label:"arctan x, x₀ = 1.5 (발산)",f:Math.atan,df:function(x){return 1/(1+x*x);},d2:function(x){return -2*x/Math.pow(1+x*x,2);},
    root:0,rootT:"0",x0:1.5,x:[-6,6],note:"근 0 은 단순근이지만 |x₀| > 1.3917 이면 접선이 너무 완만해 반복이 부호를 바꾸며 커진다 (발산). x₀ = 1 처럼 |x₀| < 1.3917 이면 수렴."},
  "flat":{label:"x² − 2, x₀ = 0.1 (f' ≈ 0)",f:function(x){return x*x-2;},df:function(x){return 2*x;},d2:function(){return 2;},
    root:Math.SQRT2,rootT:"√2",x0:0.1,x:[-1,11],note:"f'(0.1) = 0.2 로 작아 접선이 거의 수평 → x₁ ≈ 10.05 로 멀리 튄다. 그 뒤엔 오차가 대략 반씩 줄다가(1차처럼) 근 근처에서 2차 수렴. x₀ = 0 이면 f'(0) = 0 이라 한 걸음도 갈 수 없다."},
  "double":{label:"(x − 1)², 중근 (1차 수렴)",f:function(x){return (x-1)*(x-1);},df:function(x){return 2*(x-1);},d2:function(){return 2;},
    root:1,rootT:"1 (중근)",x0:2,x:[-0.5,2.5],multiple:true,note:"중근 x = 1 에서는 f'(1) = 0 이라 2차 수렴이 깨진다: x_{n+1} "+MINUS+" 1 = (x_n "+MINUS+" 1)/2 → 오차가 매번 절반(1차 수렴)."},
  "custom":{label:"직접 입력",x0:1,x:[-3,3]}
};
function newton1dWidget(el,cfg){
  V6.title(el,cfg.title||"뉴턴법 (1변수): x_{n+1} = x_n − f(x_n)/f'(x_n)");
  var msgs=[],preset=cfg.preset;
  if(preset===undefined)preset=(typeof cfg.f==="string")?"custom":"sqrt2";
  if(!NEWTON[preset]){msgs.push("알 수 없는 preset ‘"+preset+"’ → x² − 2 로 표시합니다.");preset="sqrt2";}
  var st={preset:preset,step:0,maxIt:Math.round(clamp(num(cfg.maxIter,8),1,30)),f:cfg.f||"x*x-2",df:cfg.df||"",cust:null,x0:null,x:null,y:null};
  function setPreset(p,first){
    st.preset=p;var P=NEWTON[p];
    var xr=(first&&Array.isArray(cfg.x)&&cfg.x.length===2)?[num(cfg.x[0],NaN),num(cfg.x[1],NaN)]:P.x.slice();
    if(!(xr[1]>xr[0])){msgs.push("x 범위가 잘못되어 기본값을 씁니다.");xr=P.x.slice();}
    st.x=xr;st.y=(first&&Array.isArray(cfg.y)&&cfg.y.length===2&&num(cfg.y[1],0)>num(cfg.y[0],0))?[num(cfg.y[0]),num(cfg.y[1])]:null;
    st.x0=first?clamp(num(cfg.x0,P.x0),xr[0],xr[1]):P.x0;
    st.step=first?Math.max(0,Math.round(num(cfg.step,0))):0;
  }
  setPreset(preset,true);
  var c=V6.canvas(el,360),ctx=c.getContext("2d");
  var ctl=mk("div","v6-controls");el.appendChild(ctl);
  addSelect(ctl,"예시",Object.keys(NEWTON).map(function(k){return [k,NEWTON[k].label];}),st.preset,function(v){
    setPreset(v,false);x0S.set(st.x0);x0Range();sync();recompute();draw();});
  var x0S=addSlider(ctl,"x₀",st.x[0],st.x[1],0.01,st.x0,function(v){return fmt(v,4);},function(v){st.x0=v;st.step=0;recompute();draw();});
  function x0Range(){var inp=x0S.lab.querySelector("input");inp.min=st.x[0];inp.max=st.x[1];inp.step=(st.x[1]-st.x[0])>8?0.05:0.01;x0S.set(st.x0);}
  var bar=mk("div","v6-stepbar");el.appendChild(bar);
  var bReset=addBtn(bar,"⟲ 처음",function(){stop();st.step=0;draw();});
  var bStep=addBtn(bar,"다음 단계 →",function(){stop();if(st.step<maxStep())st.step++;draw();});
  var bIt=addBtn(bar,"한 반복 ⇥",function(){stop();st.step=Math.min(maxStep(),(Math.floor(st.step/3)+1)*3);draw();});
  var bAll=addBtn(bar,"끝까지 ▶",function(){stop();timer=setInterval(function(){if(st.step>=maxStep()){stop();return;}st.step++;draw();},350);});
  var pos=mk("span");bar.appendChild(pos);
  var timer=null;function stop(){if(timer){clearInterval(timer);timer=null;}}
  var cRow=mk("div","v6-controls");el.appendChild(cRow);
  function inBox(lbl,val,size){var l=mk("label",null,lbl+" "),i=mk("input");i.type="text";i.value=val;i.size=size;
    i.style.cssText="font:inherit;font-size:12.5px;border:1.2px solid #1a1a1a;border-radius:3px;padding:1px 6px";l.appendChild(i);cRow.appendChild(l);return i;}
  var fIn=inBox("f(x) =",st.f,22),dIn=inBox("f'(x) =",st.df,18);dIn.placeholder="비우면 수치미분";
  addBtn(cRow,"적용",function(){st.f=fIn.value;st.df=dIn.value;st.step=0;recompute();draw();});
  var err=errBox(el),state=mk("div","v6-state");el.appendChild(state);
  var tbl=mk("div","v6-state");tbl.style.overflowX="auto";el.appendChild(tbl);
  var run=null,F=null,DF=null,root=null,rootNote="",custErr="";
  function sync(){cRow.style.display=st.preset==="custom"?"":"none";}
  function recompute(){
    custErr="";var P=NEWTON[st.preset];
    if(st.preset==="custom"){
      var cf=compile(st.f,["x"]);if(cf.err){custErr="f: "+cf.err;run=null;return;}
      F=cf.fn;
      if(st.df&&st.df.trim()){var cd=compile(st.df,["x"]);if(cd.err){custErr="f': "+cd.err;run=null;return;}DF=cd.fn;}
      else DF=function(x){return calc.dnum(F,x);};
      var ref=calc.newton1d(F,DF,st.x0,100);
      root=(ref.status==="conv"||ref.status==="root")?ref.it[ref.it.length-1].x:null;
      rootNote=root===null?"(수렴하지 않아 오차 계산 불가)":"(참값 대신 100회 반복 후 값으로 추정)";
    }else{F=P.f;DF=P.df;root=P.root;rootNote="";}
    run=calc.newton1d(F,DF,st.x0,st.maxIt);
  }
  function maxStep(){if(!run)return 0;var n=run.it.length-1;return n*3+(run.status==="flat"||run.status==="diverge"||run.status==="nan"?2:0);}
  function draw(){guard(el,"newton1d",drawInner);}
  function drawInner(){
    ctx.clearRect(0,0,c.width,c.height);
    var m=msgs.slice();if(custErr)m.push(custErr);err.set(m.join(" "));
    var b={x:58,y:22,w:640,h:300};
    if(!run){frame(ctx,b,st.x,[-1,1],{xname:"x"});tag(ctx,"식을 고치면 그래프가 나타납니다.",380,170,{align:"center"});state.textContent="";tbl.innerHTML="";pos.textContent="";return;}
    st.step=clamp(st.step,0,maxStep());
    var samples=[];for(var i=0;i<=200;i++)samples.push(F(st.x[0]+(st.x[1]-st.x[0])*i/200));
    var yr=st.y||autoRange(samples,true);
    var FR=frame(ctx,b,st.x,yr,{xname:"x",yname:"y = f(x)"});
    plotFn(ctx,FR,F,INK,2);
    var it=run.it,k=Math.floor(st.step/3),ph=st.step%3; // iteration k, phase ph (0: x_k shown, 1: point on curve, 2: tangent)
    FR.clip();
    for(var j=0;j<=k&&j<it.length;j++){
      var xj=it[j].x,cur=(j===k);
      if(!FR.inX(xj))continue;
      var px=FR.X(xj),py0=FR.Y(0);
      dot(ctx,px,py0,cur?4.5:3,cur?RED:FAINT);
      var showUp=!cur||ph>=1,showTan=!cur||ph>=2;
      if(showUp&&isFinite(it[j].fx)){var pyf=FR.Y(it[j].fx);seg(ctx,px,py0,px,pyf,cur?INK:FAINT,1,[3,3]);dot(ctx,px,pyf,cur?4:2.5,cur?INK:FAINT);}
      if(showTan&&isFinite(it[j].dfx)&&(cur||it[j].next!==undefined)){
        var a=it[j].x,fa=it[j].fx,s=it[j].dfx;
        seg(ctx,b.x,FR.Y(fa+s*(st.x[0]-a)),b.x+b.w,FR.Y(fa+s*(st.x[1]-a)),cur?RED:FAINT,cur?1.6:1);
      }
    }
    FR.unclip();
    /* labels for the current iterate + arrows for off-range ones */
    var curIt=it[Math.min(k,it.length-1)],xs=curIt.x;
    if(FR.inX(xs))tag(ctx,"x"+sub(k)+" = "+fmt(xs,6),FR.X(xs)+(FR.X(xs)>b.x+b.w-120?-6:6),FR.Y(0)+(yr[0]<0?14:-14),{color:RED,align:FR.X(xs)>b.x+b.w-120?"right":"left"});
    else edgeArrow(ctx,FR,xs,clamp(FR.Y(0),b.y+20,b.y+b.h-20),"x"+sub(k)+" = "+fmt(xs,4)+" (범위 밖)");
    if(ph===2&&curIt.next!==undefined&&isFinite(curIt.next)){
      var nx=curIt.next;
      if(FR.inX(nx)){var npx=FR.X(nx);ctx.strokeStyle=RED;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(npx,FR.Y(0),5.5,0,2*Math.PI);ctx.stroke();
        tag(ctx,"x"+sub(k+1)+" = "+fmt(nx,6),npx+(npx>b.x+b.w-120?-8:8),FR.Y(0)+(yr[0]<0?-14:14),{color:RED,align:npx>b.x+b.w-120?"right":"left"});}
      else edgeArrow(ctx,FR,nx,clamp(FR.Y(0)-18,b.y+20,b.y+b.h-20),"x"+sub(k+1)+" = "+fmt(nx,4)+" (범위 밖)");
    }
    pos.textContent="반복 "+k+" · 단계 "+st.step+" / "+maxStep();
    /* state text for the current phase */
    var s="";
    if(ph===0)s="x"+sub(k)+" = "+fmt(xs,10)+".  다음: 그래프 위의 점 (x"+sub(k)+", f(x"+sub(k)+")) 로 올라간다.";
    else if(ph===1)s="점 (x"+sub(k)+", f(x"+sub(k)+")) = ("+fmt(xs,6)+", "+fmt(curIt.fx,6)+").  다음: 이 점에서 접선을 긋는다.";
    else s="접선 y = f(x"+sub(k)+") + f'(x"+sub(k)+")(x "+MINUS+" x"+sub(k)+"),  f'(x"+sub(k)+") = "+fmt(curIt.dfx,6)+
      (curIt.next!==undefined?".  접선이 x축과 만나는 점: x"+sub(k+1)+" = x"+sub(k)+" "+MINUS+" f(x"+sub(k)+")/f'(x"+sub(k)+") = "+fmt(curIt.next,10):"");
    var end="";
    if(st.step>=maxStep()){
      var last=it[it.length-1];
      if(run.status==="flat")end=Math.abs(last.fx)<1e-12?"멈춤: f(x)와 f'(x)가 모두 ≈ 0 — 중근 근처에 도달 (더 나눌 수 없음).":
        "멈춤: f'(x"+sub(it.length-1)+") ≈ 0 → 접선이 수평이라 x축과 만나지 않는다 (x_{n+1} 정의 안 됨). 다른 x₀ 를 고르세요.";
      else if(run.status==="diverge")end=last.next!==undefined?"발산: |x| 가 10⁸ 을 넘어 중단 (x"+sub(it.length)+" = "+fmt(last.next,4)+").":
        "발산: x"+sub(it.length-1)+" = "+fmt(last.x,4)+" 까지 멀어져 f' 이 사실상 0 — 더 진행할 수 없다.";
      else if(run.status==="nan")end="중단: f 또는 f' 이 정의되지 않는 점에 도달.";
      else if(run.status==="root")end="f(x"+sub(it.length-1)+") = 0 정확히 — 근에 도달.";
      else if(run.status==="conv")end="수렴: 더 반복해도 x 가 기계정밀도 안에서 변하지 않는다.";
      else if(it.length>=3&&Math.abs(it[it.length-1].x-it[it.length-3].x)<1e-12&&Math.abs(it[it.length-1].x-it[it.length-2].x)>1e-6)
        end="2-주기 진동: x 가 "+fmt(it[it.length-2].x)+", "+fmt(it[it.length-1].x)+" 를 반복 — 근으로 가지 않는다.";
    }
    var P=NEWTON[st.preset];
    state.innerHTML=esc(s)+(end?"\n<b>"+esc(end)+"</b>":"")+(P.note?"\n"+esc(P.note):"")+
      "\n2차 수렴: 단순근 r (f(r) = 0, f'(r) ≠ 0) 근처에서 e_{n+1} ≈ C·e_n², C = |f''(r)/(2f'(r))| — 맞는 자릿수가 대략 두 배씩. 중근(f'(r) = 0)이면 1차 수렴으로 떨어진다.";
    /* table up to the iterate revealed so far */
    var rows=Math.min(k,it.length-1)+((ph===2&&curIt.next!==undefined&&k+1<it.length)?1:0);
    var C=(P.d2&&root!==null)?Math.abs(P.d2(root)/(2*P.df(root))):null;
    var h="<table><tr><th>n</th><th>x_n</th><th>f(x_n)</th><th>오차 e_n = |x_n − r|</th><th>e_n / e_{n−1}</th><th>e_n / e_{n−1}²</th></tr>";
    for(i=0;i<=rows;i++){
      var e=root===null?NaN:Math.abs(it[i].x-root),ep=i>0&&root!==null?Math.abs(it[i-1].x-root):NaN;
      var r1=(i>0&&ep>0&&e>0)?e/ep:NaN,r2=(i>0&&ep>0&&e>0&&ep<1)?e/(ep*ep):NaN;
      h+="<tr><td>"+i+"</td><td style='text-align:right'>"+esc(fmtLong(it[i].x))+"</td><td style='text-align:right'>"+esc(fmt(it[i].fx,4))+
        "</td><td style='text-align:right'>"+esc(fmtErr(e))+"</td><td style='text-align:right'>"+esc(isNaN(r1)?"—":fmt(r1,3))+
        "</td><td style='text-align:right'>"+esc(isNaN(r2)?"—":fmt(r2,3))+"</td></tr>";
    }
    h+="</table>"+(root!==null?"r = "+(P.rootT&&P.rootT!==fmtLong(root)?esc(P.rootT)+" = ":"")+esc(fmtLong(root))+" "+esc(rootNote):esc(rootNote))+
      (C!==null&&!P.multiple?"  ·  이 근에서 C = |f''(r)/(2f'(r))| ≈ "+esc(fmt(C,4))+(C<1e-12?" (f''(r) = 0 이라 수렴이 2차보다 빠르다: 이 경우 3차)":""):"")+
      (P.multiple?"  ·  e_n/e_{n−1} → 1/2 (1차 수렴)":"")+
      "\n(e_{n−1} ≥ 1 이면 e_n/e_{n−1}² 은 의미가 없어 ‘—’)";
    tbl.innerHTML=h;
    bStep.disabled=st.step>=maxStep();bIt.disabled=st.step>=maxStep();bAll.disabled=st.step>=maxStep();bReset.disabled=st.step===0;
  }
  sync();recompute();draw();afterFonts(draw);
}

/* ======================================================================
   3. newton2d  — F(x,y) = (F1, F2) = 0, J·Δ = −F
   cfg: {title?, pair:"circle-xy"|"circle-hyp", x0?, y0?, maxIter?:8, step?: 처음 보일 단계 수 (반복당 3단계)}
   ====================================================================== */
var PAIRS={
  "circle-xy":{label:"원 x²+y²=4 & xy=1",
    F:function(x,y){return [x*x+y*y-4,x*y-1];},J:function(x,y){return [2*x,2*y,y,x];},
    t1:"F₁ = x² + y² − 4",t2:"F₂ = xy − 1",Jt:"J = [[2x, 2y], [y, x]],  det J = 2x² − 2y²",
    sols:(function(){var a=Math.sqrt(2+Math.sqrt(3)),b=Math.sqrt(2-Math.sqrt(3));return [[a,b],[b,a],[-a,-b],[-b,-a]];})(),
    curves:[{c:1,pts:function(t){return [2*Math.cos(t),2*Math.sin(t)];},t:[0,2*Math.PI]},
            {c:2,pts:function(t){return [Math.exp(t),Math.exp(-t)];},t:[-2.5,2.5]},
            {c:2,pts:function(t){return [-Math.exp(t),-Math.exp(-t)];},t:[-2.5,2.5]}],
    lab1:[-1.42,1.42],lab2:[2.9,0.345],singular:"det J = 0 ⇔ |x| = |y| (두 직선 y = ±x 위)",x0:2,y0:1},
  "circle-hyp":{label:"원 x²+y²=4 & x²−y²=1",
    F:function(x,y){return [x*x+y*y-4,x*x-y*y-1];},J:function(x,y){return [2*x,2*y,2*x,-2*y];},
    t1:"F₁ = x² + y² − 4",t2:"F₂ = x² − y² − 1",Jt:"J = [[2x, 2y], [2x, −2y]],  det J = −8xy",
    sols:(function(){var a=Math.sqrt(2.5),b=Math.sqrt(1.5);return [[a,b],[a,-b],[-a,b],[-a,-b]];})(),
    curves:[{c:1,pts:function(t){return [2*Math.cos(t),2*Math.sin(t)];},t:[0,2*Math.PI]},
            {c:2,pts:function(t){return [Math.cosh(t),Math.sinh(t)];},t:[-2,2]},
            {c:2,pts:function(t){return [-Math.cosh(t),Math.sinh(t)];},t:[-2,2]}],
    lab1:[-1.42,1.42],lab2:[3.0,2.75],singular:"det J = 0 ⇔ x = 0 또는 y = 0 (두 좌표축 위)",x0:1,y0:0.5}
};
function newton2dWidget(el,cfg){
  V6.title(el,cfg.title||"뉴턴법 (2변수): 두 식의 선형화(직선 2개)의 교점이 다음 점");
  var msgs=[],pair=cfg.pair||"circle-xy";
  if(!PAIRS[pair]){msgs.push("알 수 없는 pair ‘"+pair+"’ → 원과 xy=1 로 표시합니다.");pair="circle-xy";}
  var LIM=3.5;
  var st={pair:pair,x0:clamp(num(cfg.x0,PAIRS[pair].x0),-LIM,LIM),y0:clamp(num(cfg.y0,PAIRS[pair].y0),-LIM,LIM),
    step:Math.max(0,Math.round(num(cfg.step,0))),maxIt:Math.round(clamp(num(cfg.maxIter,8),1,25))};
  var c=V6.canvas(el,470),ctx=c.getContext("2d");c.style.cursor="crosshair";
  var ctl=mk("div","v6-controls");el.appendChild(ctl);
  addSelect(ctl,"곡선",Object.keys(PAIRS).map(function(k){return [k,PAIRS[k].label];}),st.pair,function(v){
    st.pair=v;st.x0=PAIRS[v].x0;st.y0=PAIRS[v].y0;xS.set(st.x0);yS.set(st.y0);st.step=0;recompute();draw();});
  var xS=addSlider(ctl,"x₀",-LIM,LIM,0.01,st.x0,function(v){return fmt(v,4);},function(v){st.x0=v;st.step=0;recompute();draw();});
  var yS=addSlider(ctl,"y₀",-LIM,LIM,0.01,st.y0,function(v){return fmt(v,4);},function(v){st.y0=v;st.step=0;recompute();draw();});
  ctl.appendChild(mk("span",null,"(그림을 클릭해도 시작점이 바뀝니다)"));
  var bar=mk("div","v6-stepbar");el.appendChild(bar);
  var bReset=addBtn(bar,"⟲ 처음",function(){stop();st.step=0;draw();});
  var bStep=addBtn(bar,"다음 단계 →",function(){stop();if(st.step<maxStep())st.step++;draw();});
  var bIt=addBtn(bar,"한 반복 ⇥",function(){stop();st.step=Math.min(maxStep(),(Math.floor(st.step/3)+1)*3);draw();});
  var bAll=addBtn(bar,"끝까지 ▶",function(){stop();timer=setInterval(function(){if(st.step>=maxStep()){stop();return;}st.step++;draw();},400);});
  var pos=mk("span");bar.appendChild(pos);
  var timer=null;function stop(){if(timer){clearInterval(timer);timer=null;}}
  var err=errBox(el),state=mk("div","v6-state");el.appendChild(state);
  var tbl=mk("div","v6-state");tbl.style.overflowX="auto";el.appendChild(tbl);
  var run=null,FR=null;
  var b={x:50,y:22,w:650,h:404};
  var xr=[-3.6,3.6],ys=(xr[1]-xr[0])*b.h/b.w/2,yr=[-ys,ys]; // equal scale so the circle is round
  c.addEventListener("click",function(ev){
    var p=canvasPoint(c,ev);if(p[0]<b.x||p[0]>b.x+b.w||p[1]<b.y||p[1]>b.y+b.h)return;
    var d=FR?FR.toData(p[0],p[1]):[0,0];stop();
    st.x0=Math.round(clamp(d[0],-LIM,LIM)*100)/100;st.y0=Math.round(clamp(d[1],-LIM,LIM)*100)/100;xS.set(st.x0);yS.set(st.y0);st.step=0;recompute();draw();});
  function recompute(){var P=PAIRS[st.pair];run=calc.newton2d(P.F,P.J,st.x0,st.y0,st.maxIt);}
  function maxStep(){var n=run.it.length-1;return n*3+(run.status==="max"||run.status==="diverge"||run.status==="singular"?2:0);}
  function lineIn(a,bb,cc){ // a x + b y = c, clipped to view (drawn with clip)
    var pts=[];
    if(Math.abs(bb)>1e-14){pts=[[xr[0],(cc-a*xr[0])/bb],[xr[1],(cc-a*xr[1])/bb]];}
    else if(Math.abs(a)>1e-14){pts=[[cc/a,yr[0]],[cc/a,yr[1]]];}
    return pts;
  }
  function clipSeg(p,q){ // Liang–Barsky for label placement
    var t0=0,t1=1,dx=q[0]-p[0],dy=q[1]-p[1],P=[-dx,dx,-dy,dy],Q=[p[0]-xr[0],xr[1]-p[0],p[1]-yr[0],yr[1]-p[1]];
    for(var i=0;i<4;i++){if(P[i]===0){if(Q[i]<0)return null;}else{var t=Q[i]/P[i];if(P[i]<0){if(t>t1)return null;if(t>t0)t0=t;}else{if(t<t0)return null;if(t<t1)t1=t;}}}
    return [[p[0]+t0*dx,p[1]+t0*dy],[p[0]+t1*dx,p[1]+t1*dy]];
  }
  function draw(){guard(el,"newton2d",drawInner);}
  function drawInner(){
    ctx.clearRect(0,0,c.width,c.height);err.set(msgs.join(" "));
    var P=PAIRS[st.pair];
    st.step=clamp(st.step,0,maxStep());
    FR=frame(ctx,b,xr,yr,{xname:"x",yname:"y"});
    FR.clip();
    P.curves.forEach(function(cv){
      ctx.strokeStyle=INK;ctx.lineWidth=cv.c===1?2:2;ctx.setLineDash(cv.c===1?[]:[9,4]);ctx.beginPath();
      for(var i=0;i<=400;i++){var t=cv.t[0]+(cv.t[1]-cv.t[0])*i/400,q=cv.pts(t);if(i===0)ctx.moveTo(FR.X(q[0]),FR.Y(q[1]));else ctx.lineTo(FR.X(q[0]),FR.Y(q[1]));}
      ctx.stroke();ctx.setLineDash([]);
    });
    P.sols.forEach(function(s){dot(ctx,FR.X(s[0]),FR.Y(s[1]),4,null,INK);});
    FR.unclip();
    /* legend in the top margin (keeps labels off the curves) */
    ctx.save();ctx.font="11.5px "+FONT;
    var l2=P.t2+" = 0",l1=P.t1+" = 0",w2=ctx.measureText(l2).width,w1=ctx.measureText(l1).width,lx2=b.x+b.w-w2,lx1=lx2-40-w1-28,ly=b.y-9;
    seg(ctx,lx1-30,ly,lx1-4,ly,INK,2);seg(ctx,lx2-30,ly,lx2-4,ly,INK,2,[9,4]);
    ctx.fillStyle=INK;ctx.textBaseline="middle";ctx.textAlign="left";ctx.fillText(l1,lx1,ly);ctx.fillText(l2,lx2,ly);ctx.restore();
    var outY=b.y+b.h-12;
    var it=run.it,k=Math.min(Math.floor(st.step/3),it.length-1),ph=st.step%3;
    /* path of earlier iterates */
    for(var j=0;j<=k;j++){
      var p=it[j],inside=FR.inX(p.x)&&FR.inY(p.y);
      if(j>0){var q=it[j-1];var cs=clipSeg([q.x,q.y],[p.x,p.y]);if(cs)seg(ctx,FR.X(cs[0][0]),FR.Y(cs[0][1]),FR.X(cs[1][0]),FR.Y(cs[1][1]),FAINT,1,[2,3]);}
      if(inside)dot(ctx,FR.X(p.x),FR.Y(p.y),j===k?4.5:3,j===k?RED:FAINT);
    }
    var cur=it[k];
    if(FR.inX(cur.x)&&FR.inY(cur.y))tag(ctx,"("+fmt(cur.x,4)+", "+fmt(cur.y,4)+")",FR.X(cur.x)+8,FR.Y(cur.y)+12,{color:RED,size:11});
    else{tag(ctx,"현재 점 ("+fmt(cur.x,4)+", "+fmt(cur.y,4)+") 은 그림 밖",b.x+6,outY,{color:RED,size:11});outY-=18;}
    /* linearizations: L_i : F_i(p) + ∇F_i(p)·(q − p) = 0  ⇔  ∇F_i·q = ∇F_i·p − F_i(p) */
    if(cur.status==="ok"||cur.status==="singular"){
      var L=[[cur.J[0],cur.J[1],cur.J[0]*cur.x+cur.J[1]*cur.y-cur.F[0]],[cur.J[2],cur.J[3],cur.J[2]*cur.x+cur.J[3]*cur.y-cur.F[1]]];
      var showL=[ph>=1,ph>=2];
      for(var li=0;li<2;li++){
        if(!showL[li])continue;
        var pts=lineIn(L[li][0],L[li][1],L[li][2]);
        if(!pts.length){tag(ctx,"L"+sub(li+1)+" 없음: ∇F"+sub(li+1)+" = 0",b.x+8,b.y+14+li*18,{color:RED,size:11});continue;}
        FR.clip();seg(ctx,FR.X(pts[0][0]),FR.Y(pts[0][1]),FR.X(pts[1][0]),FR.Y(pts[1][1]),RED,1.5,li===0?[]:[7,4]);FR.unclip();
        var cl=clipSeg(pts[0],pts[1]);
        if(cl){var fr=li===0?0.12:0.88,lx=cl[0][0]+(cl[1][0]-cl[0][0])*fr,ly=cl[0][1]+(cl[1][1]-cl[0][1])*fr;
          tag(ctx,"L"+sub(li+1)+(li===0?" (F₁ 선형화 = 0)":" (F₂ 선형화 = 0)"),FR.X(lx)+6,FR.Y(ly)-10,{color:RED,size:11,align:FR.X(lx)>b.x+b.w-150?"right":"left"});}
      }
      if(ph===2&&cur.status==="ok"){
        var nx=cur.nx,ny=cur.ny;
        if(FR.inX(nx)&&FR.inY(ny)){ctx.strokeStyle=RED;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(FR.X(nx),FR.Y(ny),6,0,2*Math.PI);ctx.stroke();
          tag(ctx,"교점 = 다음 점",FR.X(nx)+9,FR.Y(ny)-12,{color:RED,size:11});}
        else tag(ctx,"교점 = 다음 점 ("+fmt(nx,4)+", "+fmt(ny,4)+") 은 그림 밖",b.x+6,outY,{color:RED,size:11});
      }
    }
    pos.textContent="반복 "+k+" · 단계 "+st.step+" / "+maxStep();
    var nm="(x"+sub(k)+", y"+sub(k)+")",s;
    if(cur.status==="nan")s="중단: 값이 정의되지 않음.";
    else if(ph===0)s="현재 점 "+nm+" = ("+fmt(cur.x,8)+", "+fmt(cur.y,8)+"),  F = ("+fmt(cur.F[0],4)+", "+fmt(cur.F[1],4)+"),  |F| = "+fmt(cur.normF,4)+".";
    else if(ph===1)s="L₁: F₁"+nm+" + ∇F₁"+nm+"·(x "+MINUS+" x"+sub(k)+", y "+MINUS+" y"+sub(k)+") = 0,  ∇F₁ = ("+fmt(cur.J[0],4)+", "+fmt(cur.J[1],4)+").  곡선 F₁ = 0 의 접선이 아니라, F₁ 의 1차 근사가 0이 되는 직선이다 (점이 곡선 위에 있을 때만 접선과 같다).";
    else if(cur.status==="singular")s="L₂: ∇F₂ = ("+fmt(cur.J[2],4)+", "+fmt(cur.J[3],4)+").  det J = "+fmt(cur.det,3)+" 이라 L₁, L₂ 가 평행(또는 일치) — J·Δ = "+MINUS+"F 를 풀 수 없다.";
    else s="L₂: ∇F₂ = ("+fmt(cur.J[2],4)+", "+fmt(cur.J[3],4)+").  두 직선의 교점 = J·Δ = "+MINUS+"F 의 해:  Δ = ("+fmt(cur.dx,6)+", "+fmt(cur.dy,6)+"),  det J = "+fmt(cur.det,5)+".";
    var end="";
    if(cur.status==="singular")end="멈춤: det J = "+fmt(cur.det,3)+" ≈ 0 → 두 직선이 평행(또는 일치)해 교점이 없거나 하나로 정해지지 않는다. "+P.singular+". 시작점을 옮기세요.";
    else if(st.step>=maxStep()){
      if(run.status==="conv"||run.status==="root")end="수렴: 기계정밀도 안에서 더 움직이지 않는다.";
      else if(run.status==="diverge")end="발산: 다음 점의 좌표가 10⁸ 을 넘어 중단.";
      else end="최대 반복 수에 도달.";
    }
    if(cur.status==="ok"&&cur.cond<1e-3)end+=(end?" ":"")+"주의: det J 가 작아(두 직선이 거의 평행) 한 걸음 Δ 가 매우 크다.";
    state.innerHTML=esc(s)+(end?"\n<b>"+esc(end)+"</b>":"")+"\n"+esc(P.t1+",  "+P.t2+",  "+P.Jt)+".  ○ = 실제 해 4개.";
    var h="<table><tr><th>n</th><th>x_n</th><th>y_n</th><th>|F(x_n, y_n)|</th><th>det J</th><th>가장 가까운 해까지 거리</th></tr>";
    for(var i=0;i<=k;i++){var r=it[i],dist=Infinity;P.sols.forEach(function(sv){dist=Math.min(dist,Math.hypot(r.x-sv[0],r.y-sv[1]));});
      h+="<tr><td>"+i+"</td><td style='text-align:right'>"+esc(fmtLong(r.x))+"</td><td style='text-align:right'>"+esc(fmtLong(r.y))+"</td><td style='text-align:right'>"+
        esc(fmt(r.normF,3))+"</td><td style='text-align:right'>"+esc(fmt(r.det,5))+"</td><td style='text-align:right'>"+esc(fmtErr(dist))+"</td></tr>";}
    tbl.innerHTML=h+"</table>";
    bStep.disabled=st.step>=maxStep();bIt.disabled=st.step>=maxStep();bAll.disabled=st.step>=maxStep();bReset.disabled=st.step===0;
  }
  recompute();draw();afterFonts(draw);
}

/* ======================================================================
   4. cobweb — x_{n+1} = g(x_n)
   cfg: {title?, preset:"cos"|"logistic"|"half"|"square"|"custom", g?:"식(x)", r?:2.8, x0?, x?:[a,b], step?: 처음 보일 반복 수, maxSteps?:60}
   ====================================================================== */
var COB={
  "cos":{label:"g(x) = cos x",g:function(x){return Math.cos(x);},dg:function(x){return -Math.sin(x);},x:[-0.5,1.5],x0:1.4,
    fixed:function(){return [0.7390851332151607];},
    note:"cos 는 모든 x₀ 에서 수렴한다: 한 번 적용하면 [−1, 1] 안으로 들어가고, cos([−1,1]) ⊂ [−1,1] 이며 거기서 |g'(x)| = |sin x| ≤ sin 1 ≈ 0.841 < 1 (축소사상)."},
  "logistic":{label:"로지스틱 r·x(1 − x)",x:[0,1],x0:0.2,hasR:true,
    gR:function(r){return function(x){return r*x*(1-x);};},dgR:function(r){return function(x){return r*(1-2*x);};},
    fixedR:function(r){return r===0?[0]:(r===1?[0]:[0,1-1/r]);}},
  "half":{label:"g(x) = x/2 + 1",g:function(x){return x/2+1;},dg:function(){return 0.5;},x:[-0.5,4],x0:0,
    fixed:function(){return [2];},note:"g'(x) = 1/2 (모든 x): 전체에서 축소사상. 오차가 정확히 매번 절반: x_n "+MINUS+" 2 = (x₀ "+MINUS+" 2)/2ⁿ."},
  "square":{label:"g(x) = x² (반발 고정점)",g:function(x){return x*x;},dg:function(x){return 2*x;},x:[-0.2,1.6],x0:0.9,
    fixed:function(){return [0,1];},note:"x* = 0: g'(0) = 0 (아주 빠른 수렴). x* = 1: g'(1) = 2 > 1 반발 — |x₀| < 1 이면 0으로, |x₀| > 1 이면 ∞ 로 멀어진다."},
  "custom":{label:"직접 입력",x:[-2,2],x0:0.5}
};
function logisticText(r){
  var L=calc.logistic;
  if(r<1)return "0 ≤ r < 1: [0,1] 안의 고정점은 0 하나, g'(0) = r < 1 → 0 으로 수렴.";
  if(r===1)return "r = 1: x* = 0, g'(0) = 1 → 판정 불가 (실제로는 아주 느리게 0 으로).";
  if(r<3)return "1 < r < 3: x* = 1 "+MINUS+" 1/r, g'(x*) = 2 "+MINUS+" r, |2 "+MINUS+" r| < 1 → 안정"+(r<2?" (단조롭게 접근)":r===2?" (g'(x*) = 0: 매우 빠른 수렴)":" (진동하며 접근)")+".";
  if(r===3)return "r = 3: g'(x*) = "+MINUS+"1 → 판정 불가. 주기배가 분기점이며 수렴이 매우 느리다.";
  if(r<L.r2cycle)return "3 < r < 1+√6 ≈ 3.449: x* 는 반발 (|2 "+MINUS+" r| > 1), 대신 안정한 2-주기가 생긴다.";
  if(r<L.r4cycle)return "3.449 < r < 3.544: 안정한 4-주기 (주기배가).";
  if(r<L.rInf)return "3.544 < r < 3.5699: 8, 16, … 주기 (주기배가가 r ≈ 3.5699 에서 누적).";
  if(r<4)return "r > 3.5699: 혼돈 영역. 혼돈적인 r 이 많지만 안정 주기 궤도가 있는 ‘주기 창’이 촘촘히 끼어 있다 (예: r = 1+√8 ≈ 3.8284 에서 시작하는 3-주기 창).";
  if(r===4)return "r = 4: [0,1] 위에서 혼돈 (거의 모든 x₀ 에서 궤도가 주기적이지 않다).";
  return "r > 4: 궤도가 [0,1] 밖으로 나가 발산할 수 있다.";
}
function cobwebWidget(el,cfg){
  V6.title(el,cfg.title||"고정점 반복 x_{n+1} = g(x_n): 거미줄 그림");
  var msgs=[],preset=cfg.preset;
  if(preset===undefined)preset=(typeof cfg.g==="string")?"custom":"cos";
  if(!COB[preset]){msgs.push("알 수 없는 preset ‘"+preset+"’ → cos x 로 표시합니다.");preset="cos";}
  var st={preset:preset,r:clamp(num(cfg.r,2.8),0,4),g:typeof cfg.g==="string"?cfg.g:"cos(x)",x:null,x0:0,n:0,
    maxN:Math.round(clamp(num(cfg.maxSteps,60),5,300))};
  function setPreset(p,first){
    st.preset=p;var P=COB[p];
    var xr=(first&&Array.isArray(cfg.x)&&cfg.x.length===2)?[num(cfg.x[0],NaN),num(cfg.x[1],NaN)]:P.x.slice();
    if(!(xr[1]>xr[0])){msgs.push("x 범위가 잘못되어 기본값을 씁니다.");xr=P.x.slice();}
    st.x=xr;st.x0=first?clamp(num(cfg.x0,P.x0),xr[0],xr[1]):P.x0;st.n=first?Math.round(clamp(num(cfg.step,0),0,st.maxN)):0;
  }
  setPreset(preset,true);
  var c=V6.canvas(el,470),ctx=c.getContext("2d");
  var ctl=mk("div","v6-controls");el.appendChild(ctl);
  addSelect(ctl,"예시",Object.keys(COB).map(function(k){return [k,COB[k].label];}),st.preset,function(v){
    stop();setPreset(v,false);x0Range();sync();recompute();draw();});
  var rS=addSlider(ctl,"r",0,4,0.01,st.r,function(v){return fmt(v,4);},function(v){st.r=Math.round(v*100)/100;stop();recompute();draw();});
  var x0S=addSlider(ctl,"x₀",st.x[0],st.x[1],0.01,st.x0,function(v){return fmt(v,4);},function(v){st.x0=v;stop();recompute();draw();});
  function x0Range(){var inp=x0S.lab.querySelector("input");inp.min=st.x[0];inp.max=st.x[1];inp.step=(st.x[1]-st.x[0])/400;x0S.set(st.x0);}
  x0Range();
  var bar=mk("div","v6-stepbar");el.appendChild(bar);
  var bReset=addBtn(bar,"⟲ 처음",function(){stop();st.n=0;draw();});
  var bStep=addBtn(bar,"한 단계 →",function(){stop();if(st.n<st.maxN)st.n++;draw();});
  var bAll=addBtn(bar,"전체 재생 ▶",function(){stop();timer=setInterval(function(){if(st.n>=st.maxN||orbitEnded()){stop();return;}st.n++;draw();},180);});
  var pos=mk("span");bar.appendChild(pos);
  var timer=null;function stop(){if(timer){clearInterval(timer);timer=null;}}
  var cRow=mk("div","v6-controls");el.appendChild(cRow);
  var gLab=mk("label",null,"g(x) = "),gIn=mk("input");gIn.type="text";gIn.value=st.g;gIn.size=26;
  gIn.style.cssText="font:inherit;font-size:12.5px;border:1.2px solid #1a1a1a;border-radius:3px;padding:1px 6px";
  gLab.appendChild(gIn);cRow.appendChild(gLab);
  addBtn(cRow,"적용",function(){st.g=gIn.value;st.n=0;stop();recompute();draw();});
  var err=errBox(el),state=mk("div","v6-state");el.appendChild(state);
  var G=null,DG=null,orb=[],fps=[],lr=null,gErr="";
  function sync(){rS.lab.style.display=COB[st.preset].hasR?"":"none";cRow.style.display=st.preset==="custom"?"":"none";}
  function orbitEnded(){return orb.length&&isNaN(orb[orb.length-1])&&st.n>=orb.length-1;}
  function recompute(){
    gErr="";var P=COB[st.preset];
    if(st.preset==="custom"){var cg=compile(st.g,["x"]);if(cg.err){gErr=cg.err;G=null;return;}G=cg.fn;DG=function(x){return calc.dnum(G,x);};
      fps=calc.fixedPoints(G,st.x[0],st.x[1]);}
    else if(P.hasR){G=P.gR(st.r);DG=P.dgR(st.r);fps=P.fixedR(st.r).filter(function(v){return v>=st.x[0]&&v<=st.x[1];});}
    else{G=P.g;DG=P.dg;fps=P.fixed().filter(function(v){return v>=st.x[0]&&v<=st.x[1];});}
    orb=calc.orbit(G,st.x0,st.maxN);lr=calc.longRun(G,st.x0);
  }
  function draw(){guard(el,"cobweb",drawInner);}
  function drawInner(){
    ctx.clearRect(0,0,c.width,c.height);
    var m=msgs.slice();if(gErr)m.push(gErr);err.set(m.join(" "));
    var b={x:52,y:22,w:410,h:410},xr=st.x,yr=st.x;
    var FR=frame(ctx,b,xr,yr,{xname:"x",yname:"y"});
    if(!G){tag(ctx,"식을 고치면 그래프가 나타납니다.",b.x+b.w/2,b.y+b.h/2,{align:"center"});state.textContent="";pos.textContent="";return;}
    seg(ctx,FR.X(xr[0]),FR.Y(xr[0]),FR.X(xr[1]),FR.Y(xr[1]),INK,1,[4,4]);
    plotFn(ctx,FR,G,INK,2);
    tag(ctx,"y = x",FR.X(xr[1])-4,FR.Y(xr[1])+14,{align:"right",size:11});
    /* g label at the right end of the curve, or left if off-range */
    var gx=xr[0]+(xr[1]-xr[0])*0.97,gy=G(gx);
    tag(ctx,"y = g(x)",b.x+b.w-4,FR.inY(gy)?clamp(FR.Y(gy)+(gy>gx?-14:14),b.y+10,b.y+b.h-10):b.y+28,{align:"right",size:11,bold:true});
    st.n=clamp(st.n,0,st.maxN);
    var n=Math.min(st.n,orb.length-1);
    /* cobweb: start at (x0,0) ↑ to (x0,g(x0)) → (x1,x1) ↑ … */
    FR.clip();
    if(isFinite(orb[0]))seg(ctx,FR.X(orb[0]),FR.Y(Math.max(yr[0],Math.min(0,yr[1]))),FR.X(orb[0]),FR.Y(orb[0]),FAINT,1,[2,3]);
    for(var i=0;i<n;i++){
      var a=orb[i],bb=orb[i+1];if(!isFinite(a))break;
      var last=(i===n-1),col=last?RED:INK,w=last?1.8:1;
      var top=isFinite(bb)?bb:(G(a)>0?yr[1]+10:yr[0]-10);
      seg(ctx,FR.X(a),FR.Y(a),FR.X(a),FR.Y(top),col,w);
      if(isFinite(bb))seg(ctx,FR.X(a),FR.Y(bb),FR.X(bb),FR.Y(bb),col,w);
    }
    FR.unclip();
    fps.forEach(function(v){if(FR.inX(v)){dot(ctx,FR.X(v),FR.Y(v),5,"#fff",INK);}});
    if(isFinite(orb[0])&&FR.inX(orb[0])){dot(ctx,FR.X(orb[0]),FR.Y(Math.max(yr[0],Math.min(0,yr[1]))),3.5,RED);
      tag(ctx,"x₀",FR.X(orb[0]),FR.Y(Math.max(yr[0],Math.min(0,yr[1])))-11,{align:"center",color:RED,size:11});}
    var cur=orb[n];
    /* right panel: iterate list */
    var rx=b.x+b.w+34;ctx.fillStyle=INK;ctx.font="bold 11.5px "+FONT;ctx.textAlign="left";ctx.textBaseline="top";
    ctx.fillText("n      x_n",rx,b.y-14);ctx.font="11.5px "+FONT;
    var rowsMax=25,first=Math.max(0,n-rowsMax+1);
    for(i=first;i<=n;i++){ctx.fillStyle=i===n?RED:INK;var yy=b.y+4+(i-first)*16;
      ctx.fillText(String(i),rx,yy);ctx.fillText(isFinite(orb[i])?fmt(orb[i],10)+(FR.inX(orb[i])?"":"  (그림 밖)"):"발산",rx+40,yy);}
    if(first>0){ctx.fillStyle=FAINT;ctx.fillText("(앞 "+first+"개 생략)",rx,b.y+4+rowsMax*16);}
    pos.textContent="n = "+n+" / "+st.maxN;
    /* fixed point verdicts */
    var lines=[];
    if(!fps.length)lines.push("그림 범위 안에서 고정점(g(x) = x)을 찾지 못했다.");
    fps.slice(0,4).forEach(function(v){
      var d=DG(v),cls=calc.classifyFixed(d,st.preset==="custom"?1e-6:1e-12);
      var t="x* = "+fmt(v,7)+":  g'(x*) = "+fmt(d,5)+",  |g'(x*)| ";
      if(cls==="attract")t+="< 1 → 국소 수축: x* 근처에서 시작하면 수렴"+(Math.abs(d)<1e-9?" (g'(x*) = 0: 매우 빠름)":d<0?" (g' < 0: 진동하며 접근)":" (g' > 0: 한쪽에서 단조롭게 접근)")+".";
      else if(cls==="repel")t+="> 1 → 반발: x* 근처의 점이 멀어진다.";
      else if(cls==="neutral")t+="= 1 → 이 판정으로는 알 수 없다 (수렴할 수도, 안 할 수도).";
      else t+="을 계산할 수 없다.";
      lines.push(t);
    });
    if(fps.length>4)lines.push("… 고정점이 더 있다 ("+fps.length+"개).");
    var obs;
    if(lr.kind==="diverge")obs="발산: "+lr.at+"번째 반복 근처에서 |x_n| 이 10⁶ 을 넘거나 정의되지 않는다.";
    else if(lr.kind==="fixed")obs="고정점 "+fmt(lr.pts[0],7)+" 근처로 수렴"+(lr.slow?" — 단, 20000회 뒤에도 아직 조금씩 움직이는 매우 느린 수렴":"")+".";
    else if(lr.kind==="cycle")obs=(lr.slow?"아직 수렴 중(매우 느림) — 20000회 뒤의 모양은 주기 "+lr.p+" 처럼 보이지만 폭이 계속 줄고 있다: ":"주기 "+lr.p+" 궤도: ")+
      lr.pts.slice(0,8).map(function(v){return fmt(v,5);}).join(", ")+(lr.p>8?", …":"")+".";
    else obs="주기 64 이하의 주기가 보이지 않는다 — 혼돈적이거나 주기가 매우 길 수 있다 (수치 관찰일 뿐 증명은 아님).";
    var P=COB[st.preset];
    state.innerHTML=lines.map(esc).join("\n")+
      "\n<b>장기 거동 (수치 관찰, 20000회 반복 후)</b>  "+esc(obs)+
      (P.hasR?"\n<b>r = "+esc(fmt(st.r,4))+"</b>  "+esc(logisticText(st.r)):"")+(P.note?"\n"+esc(P.note):"")+
      "\n연결: 닫힌 구간 I 에서 g(I) ⊂ I 이고 |g'| ≤ k < 1 이면 평균값정리로 |g(x) "+MINUS+" g(y)| ≤ k|x "+MINUS+" y| — 축소사상이라 I 안의 고정점이 하나뿐이고 I 의 어느 x₀ 에서 시작해도 반복이 그것으로 수렴한다 (축소사상으로 음함수정리를 증명할 때와 같은 구조).";
    bStep.disabled=st.n>=st.maxN||orbitEnded();bAll.disabled=bStep.disabled;bReset.disabled=st.n===0;
  }
  sync();recompute();draw();afterFonts(draw);
}

V6.register("series-converge",function(el,cfg){guard(el,"series-converge",function(){seriesWidget(el,cfg&&typeof cfg==="object"?cfg:{});});});
V6.register("newton1d",function(el,cfg){guard(el,"newton1d",function(){newton1dWidget(el,cfg&&typeof cfg==="object"?cfg:{});});});
V6.register("newton2d",function(el,cfg){guard(el,"newton2d",function(){newton2dWidget(el,cfg&&typeof cfg==="object"?cfg:{});});});
V6.register("cobweb",function(el,cfg){guard(el,"cobweb",function(){cobwebWidget(el,cfg&&typeof cfg==="object"?cfg:{});});});

/* v6.js boot silently skips a widget whose data-config is not valid JSON; show a Korean note instead */
var MINE=["series-converge","newton1d","newton2d","cobweb"];
function badJsonNote(){
  try{document.querySelectorAll(".v6-widget[data-widget]").forEach(function(w){
    if(MINE.indexOf(w.getAttribute("data-widget"))<0||w.childNodes.length)return;
    fatal(w,"data-config 가 올바른 JSON 이 아니라 위젯을 만들 수 없습니다 (작은따옴표 안에 큰따옴표 JSON).");});}catch(e){}
}
if(typeof document!=="undefined"){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(badJsonNote,0);});
  else setTimeout(badJsonNote,0);
}
if(typeof V6.__testHook==="function")V6.__testHook({calc:calc,compile:compile,fmt:fmt,SERIES:SERIES,NEWTON:NEWTON,PAIRS:PAIRS,COB:COB,logisticText:logisticText});
})();
