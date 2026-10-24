/* ===== v6-extra :: core (parser, frame, ui) + widgets: plot-fn, tangent-slider, riemann, taylor, epsilon-delta =====
   MATH102 (다변수 미적분, Lax & Terrell). Canvas only, ink #1a1a1a, accent #9e2b25. */
(function(){
"use strict";
if(!window.V6){return;}
var V6=window.V6, INK=V6.INK||"#1a1a1a", RED=V6.RED||"#9e2b25", GRID=V6.GRID||"#e8e6e0", GREY="#777";
var FONT="'Noto Sans KR',sans-serif";

/* ---- load-order fix: v6.js (defer) boots as soon as it runs, i.e. BEFORE this file registers.
   Wrap register so widgets registered later still mount (and never mount twice). ---- */
if(!V6.__x){
  V6.__x=1;
  var baseReg=V6.register;
  V6.register=function(name,fn){
    var safe=function(el,cfg){
      if(el.__v6m)return; el.__v6m=1;
      try{fn(el,cfg);}catch(err){
        el.innerHTML="";var d=document.createElement("div");d.style.cssText="color:"+RED+";font-size:12px";
        d.textContent="위젯 오류: "+(err&&err.message||err);el.appendChild(d);
      }
    };
    baseReg(name,safe);
    var list=document.querySelectorAll('.v6-widget[data-widget="'+name+'"]');
    for(var i=0;i<list.length;i++){
      var el=list[i]; if(el.__v6m)continue;
      var cfg; try{cfg=JSON.parse(el.getAttribute("data-config")||"{}");}catch(e){continue;}
      safe(el,cfg);
    }
  };
}
var reg=function(n,f){V6.register(n,f);};
/* a widget whose module is missing would show as an empty bordered box; hide those quietly */
setTimeout(function(){var l=document.querySelectorAll(".v6-widget[data-widget]");
  for(var i=0;i<l.length;i++){if(!l[i].firstChild&&!l[i].__v6m)l[i].style.display="none";}},2500);

/* ---- expression parser: + - * / ^ , implicit "2x", functions, constants. No eval. ---- */
var FN1={sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,
  sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,exp:Math.exp,log:Math.log,ln:Math.log,sqrt:Math.sqrt,
  abs:Math.abs,floor:Math.floor,ceil:Math.ceil,sign:Math.sign,cbrt:Math.cbrt,
  /* real cube root helper for x^(1/3) style curves: cbrt(x) */
  };
var FN2={pow:Math.pow,min:Math.min,max:Math.max,atan2:Math.atan2};
function parse(src,vars){
  src=String(src).replace(/²/g,"^2").replace(/³/g,"^3").replace(/π/g,"pi").replace(/\*\*/g,"^");
  var toks=[],i=0,m;
  while(i<src.length){
    var ch=src[i];
    if(/\s/.test(ch)){i++;continue;}
    if(/[0-9.]/.test(ch)){m=/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      /* an "e" that starts the constant e, e.g. 2e or 2exp(x): only take exponent if digits follow */
      if(!m)throw new Error("숫자 오류");toks.push({t:"n",v:parseFloat(m[0])});i+=m[0].length;}
    else if(/[a-zA-Z_]/.test(ch)){m=/^[a-zA-Z_][a-zA-Z_0-9]*/.exec(src.slice(i))[0];toks.push({t:"i",v:m});i+=m.length;}
    else if("+-*/^(),".indexOf(ch)>=0){toks.push({t:ch});i++;}
    else throw new Error("알 수 없는 문자: "+ch);
  }
  var p=0;
  function peek(){return toks[p];}
  function eat(t){var k=toks[p];if(!k||k.t!==t)throw new Error("괄호/문법 오류");p++;return k;}
  function expr(){var l=term();while(peek()&&(peek().t==="+"||peek().t==="-")){var op=toks[p++].t,r=term();l=bin(op,l,r);}return l;}
  function bin(op,a,b){
    if(op==="+")return function(v){return a(v)+b(v);};
    if(op==="-")return function(v){return a(v)-b(v);};
    if(op==="*")return function(v){return a(v)*b(v);};
    return function(v){return a(v)/b(v);};
  }
  function startsAtom(k){return k&&(k.t==="n"||k.t==="i"||k.t==="(");}
  function term(){
    var l=unary();
    for(;;){
      var k=peek();
      if(k&&(k.t==="*"||k.t==="/")){p++;l=bin(k.t,l,unary());}
      else if(startsAtom(k)){l=bin("*",l,unary());}   /* implicit multiplication: 2x, x sin(x), (x)(y) */
      else break;
    }
    return l;
  }
  function unary(){
    var k=peek();
    if(k&&k.t==="-"){p++;var u=unary();return function(v){return -u(v);};}
    if(k&&k.t==="+"){p++;return unary();}
    return power();
  }
  function power(){
    var b=atom();
    if(peek()&&peek().t==="^"){p++;var ex=unary();   /* right-assoc, allows 2^-x */
      return function(v){var x=b(v),y=ex(v);
        /* real odd roots: (-8)^(1/3) = -2 when exponent is p/q with q odd */
        if(x<0&&y!==Math.round(y)){for(var q=3;q<=15;q+=2){var pn=y*q;if(Math.abs(pn-Math.round(pn))<1e-9){return Math.pow(Math.abs(x),y)*((Math.round(pn)%2===0)?1:-1);}}return NaN;}
        return Math.pow(x,y);};}
    return b;
  }
  function atom(){
    var k=toks[p++];
    if(!k)throw new Error("식이 끝났어요");
    if(k.t==="n"){var c=k.v;return function(){return c;};}
    if(k.t==="("){var e=expr();eat(")");return e;}
    if(k.t==="i"){
      var nm=k.v;
      if(peek()&&peek().t==="("){
        p++;var args=[expr()];while(peek()&&peek().t===","){p++;args.push(expr());}eat(")");
        if(FN1[nm]){if(args.length!==1)throw new Error(nm+"는 인자 1개");var a=args[0],f=FN1[nm];return function(v){return f(a(v));};}
        if(FN2[nm]){if(args.length!==2)throw new Error(nm+"는 인자 2개");var a1=args[0],a2=args[1],g=FN2[nm];return function(v){return g(a1(v),a2(v));};}
        throw new Error("모르는 함수: "+nm);
      }
      if(nm==="pi"){return function(){return Math.PI;};}
      if(nm==="e"&&vars.indexOf("e")<0){return function(){return Math.E;};}
      var ix=vars.indexOf(nm);if(ix<0)throw new Error("모르는 변수: "+nm);
      return function(v){return v[ix];};
    }
    throw new Error("문법 오류");
  }
  var tree=expr();
  if(p<toks.length)throw new Error("문법 오류 (남은 입력)");
  return function(){var a=arguments,vs=new Array(a.length);for(var j=0;j<a.length;j++)vs[j]=a[j];
    var r=tree(vs);return (typeof r==="number"&&isFinite(r))?r:NaN;};
}
/* returns {fn,err} where fn(x) one variable */
function compile1(src,vars){
  try{return {fn:parse(src,vars||["x"]),err:null};}catch(e){return {fn:function(){return NaN;},err:e.message};}
}

/* ---- DOM helpers ---- */
function h(tag,cls,text){var d=document.createElement(tag);if(cls)d.className=cls;if(text!=null)d.textContent=text;return d;}
function fmt(x,d){
  if(x==null||!isFinite(x))return "—";
  if(d==null)d=4;var a=Math.abs(x);if(a<1e-12)return "0";
  if(a!==0&&(a>=1e6||a<1e-4))return x.toExponential(2).replace("e+","e").replace(/e-0?/,"e-");
  var s=x.toFixed(d);if(s.indexOf(".")>=0)s=s.replace(/0+$/,"").replace(/\.$/,"");
  return s==="-0"?"0":s;
}
function slider(parent,label,lo,hi,step,val,on,fmtv){
  var lab=h("label");lab.appendChild(document.createTextNode(label+" "));
  var r=document.createElement("input");r.type="range";r.min=lo;r.max=hi;r.step=step;r.value=val;
  var v=h("span","v6-val");
  function show(){v.textContent=fmtv?fmtv(parseFloat(r.value)):fmt(parseFloat(r.value),3);}
  r.addEventListener("input",function(){show();on(parseFloat(r.value));});
  show();lab.appendChild(r);lab.appendChild(v);parent.appendChild(lab);
  return {input:r,get:function(){return parseFloat(r.value);},set:function(x){r.value=x;show();},range:function(a,b,s){r.min=a;r.max=b;if(s)r.step=s;}};
}
function btn(parent,text,on){var b=h("button","v6-btn",text);b.type="button";b.addEventListener("click",on);parent.appendChild(b);return b;}
function select(parent,label,opts,val,on){
  var lab=h("label");if(label)lab.appendChild(document.createTextNode(label+" "));
  var s=document.createElement("select");s.style.cssText="font:inherit;font-size:12.5px;border:1.2px solid "+INK+";border-radius:3px;background:#fff;padding:1px 4px";
  opts.forEach(function(o,i){var op=document.createElement("option");op.value=i;op.textContent=o;s.appendChild(op);});
  s.value=val;s.addEventListener("change",function(){on(parseInt(s.value,10));});lab.appendChild(s);parent.appendChild(lab);return s;
}
function textInput(parent,label,val,w,on){
  var lab=h("label");lab.appendChild(document.createTextNode(label+" "));
  var t=document.createElement("input");t.type="text";t.value=val;t.spellcheck=false;
  t.style.cssText="font:inherit;font-size:13px;border:1.2px solid "+INK+";border-radius:3px;padding:2px 6px;width:"+(w||150)+"px;font-family:Consolas,monospace";
  t.addEventListener("input",function(){on(t.value);});lab.appendChild(t);parent.appendChild(lab);return t;
}
function mkCanvas(el,H){
  var W=720,S=2,c=document.createElement("canvas");c.width=W*S;c.height=H*S;c.style.width="100%";c.style.touchAction="none";
  c.style.aspectRatio=W+"/"+H;el.appendChild(c);
  var ctx=c.getContext("2d");ctx.setTransform(S,0,0,S,0,0);
  var o={c:c,ctx:ctx,W:W,H:H,clear:function(){ctx.setTransform(S,0,0,S,0,0);ctx.clearRect(0,0,W,H);},
    pos:function(ev){var r=c.getBoundingClientRect();return {x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};},
    setSize:function(nW,nH){W=o.W=Math.round(nW);H=o.H=Math.round(nH);c.width=W*S;c.height=H*S;c.style.aspectRatio=W+"/"+H;ctx.setTransform(S,0,0,S,0,0);}};
  return o;
}
function niceStep(range,target){
  var raw=range/(target||6),mag=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10)),n=raw/mag;
  return (n<1.5?1:n<3.5?2:n<7.5?5:10)*mag;
}
function tickLabel(v,step){
  var dec=Math.max(0,-Math.floor(Math.log(step)/Math.LN10+1e-9));
  var s=(Math.abs(v)<step*1e-6?0:v).toFixed(Math.min(dec,6));
  return s;
}
/* frame: draws grid, axes, tick labels. returns mapping. margins in logical px */
function frame(ctx,W,H,xr,yr,o){
  o=o||{};
  var L=o.L==null?44:o.L,T=o.T==null?10:o.T,R=W-(o.R==null?14:o.R),B=H-(o.B==null?26:o.B);
  var px=function(x){return L+(x-xr[0])/(xr[1]-xr[0])*(R-L);};
  var py=function(y){return B-(y-yr[0])/(yr[1]-yr[0])*(B-T);};
  var ix=function(p){return xr[0]+(p-L)/(R-L)*(xr[1]-xr[0]);};
  var iy=function(p){return yr[0]+(B-p)/(B-T)*(yr[1]-yr[0]);};
  var sx=niceStep(xr[1]-xr[0],o.nx||7),sy=niceStep(yr[1]-yr[0],o.ny||6);
  ctx.save();ctx.font="11px "+FONT;ctx.lineWidth=1;
  ctx.fillStyle="#fff";ctx.fillRect(L,T,R-L,B-T);
  var k0=Math.ceil(xr[0]/sx-1e-9),k,v;
  for(k=k0;k*sx<=xr[1]+1e-9;k++){v=k*sx;ctx.strokeStyle=GRID;ctx.beginPath();ctx.moveTo(px(v),T);ctx.lineTo(px(v),B);ctx.stroke();}
  k0=Math.ceil(yr[0]/sy-1e-9);
  for(k=k0;k*sy<=yr[1]+1e-9;k++){v=k*sy;ctx.strokeStyle=GRID;ctx.beginPath();ctx.moveTo(L,py(v));ctx.lineTo(R,py(v));ctx.stroke();}
  ctx.strokeStyle=INK;ctx.lineWidth=1.3;
  if(xr[0]<=0&&xr[1]>=0){ctx.beginPath();ctx.moveTo(px(0),T);ctx.lineTo(px(0),B);ctx.stroke();}
  if(yr[0]<=0&&yr[1]>=0){ctx.beginPath();ctx.moveTo(L,py(0));ctx.lineTo(R,py(0));ctx.stroke();}
  ctx.lineWidth=1.2;ctx.strokeRect(L,T,R-L,B-T);
  ctx.fillStyle=INK;ctx.textAlign="center";ctx.textBaseline="top";
  for(k=Math.ceil(xr[0]/sx-1e-9);k*sx<=xr[1]+1e-9;k++){v=k*sx;ctx.fillText(tickLabel(v,sx),px(v),B+5);}
  ctx.textAlign="right";ctx.textBaseline="middle";
  for(k=Math.ceil(yr[0]/sy-1e-9);k*sy<=yr[1]+1e-9;k++){v=k*sy;ctx.fillText(tickLabel(v,sy),L-5,py(v));}
  ctx.restore();
  return {px:px,py:py,ix:ix,iy:iy,L:L,T:T,R:R,B:B,
    clip:function(){ctx.save();ctx.beginPath();ctx.rect(L,T,R-L,B-T);ctx.clip();}};
}
/* draw a function curve with jump/NaN breaks */
function curve(ctx,fr,fn,xr,yr,color,lw,dash){
  fr.clip();ctx.strokeStyle=color;ctx.lineWidth=lw||2;ctx.setLineDash(dash||[]);ctx.lineJoin="round";
  var yspan=yr[1]-yr[0],prev=NaN,started=false,N=Math.max(2,Math.round(fr.R-fr.L)*1.5);
  ctx.beginPath();
  for(var i=0;i<=N;i++){
    var x=xr[0]+(xr[1]-xr[0])*i/N,y=fn(x);
    if(isNaN(y)){started=false;prev=NaN;continue;}
    if(started&&Math.abs(y-prev)>yspan*0.8){started=false;}
    var Y=fr.py(y);
    if(Y<fr.T-4000||Y>fr.B+4000){started=false;prev=y;continue;}
    if(!started){ctx.moveTo(fr.px(x),Y);started=true;}else ctx.lineTo(fr.px(x),Y);
    prev=y;
  }
  ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function dot(ctx,x,y,r,color,fill){
  ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);
  if(fill!==false){ctx.fillStyle=color||INK;ctx.fill();}else{ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle=color||INK;ctx.lineWidth=1.6;ctx.stroke();}
  ctx.restore();
}
function label(ctx,t,x,y,color,align,bold){
  ctx.save();ctx.font=(bold?"700 ":"")+"12px "+FONT;ctx.fillStyle=color||INK;ctx.textAlign=align||"left";ctx.textBaseline="middle";ctx.fillText(t,x,y);ctx.restore();
}
function stateBox(el){var s=h("div","v6-state");s.style.fontFamily=FONT;el.appendChild(s);return s;}
function setLines(box,lines){
  box.innerHTML="";
  lines.forEach(function(l){var d=h("div");if(typeof l==="string"){d.textContent=l;}else{
    d.textContent=l.t;if(l.red)d.style.color=RED;if(l.b)d.style.fontWeight="700";}box.appendChild(d);});
}
function num(x,dflt){return (typeof x==="number"&&isFinite(x))?x:dflt;}
function rangeOk(r,d){return (Array.isArray(r)&&r.length===2&&isFinite(r[0])&&isFinite(r[1])&&r[1]>r[0])?[r[0],r[1]]:d.slice();}
function numeric(fn,a){/* central difference with relative step */
  var s=1e-5*Math.max(1,Math.abs(a));return (fn(a+s)-fn(a-s))/(2*s);}
function simpson(fn,a,b,n){
  n=n||4000;if(n%2)n++;var hh=(b-a)/n,s=fn(a)+fn(b);
  for(var i=1;i<n;i++)s+=fn(a+i*hh)*(i%2?4:2);return s*hh/3;
}
var X={parse:parse,compile1:compile1,fmt:fmt,simpson:simpson,niceStep:niceStep,numeric:numeric,
  h:h,slider:slider,btn:btn,select:select,textInput:textInput,mkCanvas:mkCanvas,frame:frame,curve:curve,dot:dot,label:label,
  stateBox:stateBox,setLines:setLines,num:num,rangeOk:rangeOk,reg:reg,INK:INK,RED:RED,GRID:GRID,GREY:GREY,FONT:FONT};
window.V6X=X;

/* ===== plot-fn : 범용 함수 플로터 ===== 
   config: {title, fs:["sin(x)","x^2/4"], x:[-7,7], y:[-4,4], h:380}  (f:"..." also accepted) */
reg("plot-fn",function(el,cfg){
  V6.title(el,cfg.title||"함수 플로터");
  var fs=(cfg.fs||(cfg.f?[cfg.f]:["sin(x)"])).slice(0,3);
  while(fs.length<1)fs.push("sin(x)");
  var xr=rangeOk(cfg.x,[-7,7]),yr=rangeOk(cfg.y,[-4,4]),x0=xr.slice(),y0=yr.slice();
  var cv=mkCanvas(el,cfg.h||380),ctx=cv.ctx;
  var ctl=h("div","v6-controls");el.appendChild(ctl);
  var cols=[INK,RED,GREY],dashes=[[],[],[6,4]];
  var comp=[],inputs=[],errs=h("div");errs.style.cssText="color:"+RED+";font-size:12px;margin-top:4px";
  var box=stateBox(el),hover=null,fr=null;
  function recompile(i){comp[i]=compile1(fs[i],["x"]);}
  fs.forEach(function(s,i){recompile(i);
    var t=textInput(ctl,"y"+(fs.length>1?(i+1):"")+" =",s,170,function(v){fs[i]=v;recompile(i);draw();});
    t.style.borderColor=cols[i];inputs.push(t);});
  var rng=h("div","v6-controls");el.appendChild(rng);
  var nf=[];
  function numField(lbl,idx,arr){
    var lab=h("label");lab.appendChild(document.createTextNode(lbl+" "));
    var t=document.createElement("input");t.type="number";t.step="any";t.value=fmt(arr[idx],4);
    t.style.cssText="width:70px;font:inherit;font-size:12.5px;border:1.2px solid "+INK+";border-radius:3px;padding:1px 4px";
    t.addEventListener("change",function(){var v=parseFloat(t.value);if(isFinite(v)){arr[idx]=v;if(!(arr[1]>arr[0])){arr[idx]=idx?arr[0]+1:arr[1]-1;}syncFields();draw();}});
    lab.appendChild(t);rng.appendChild(lab);nf.push([t,arr,idx]);
  }
  numField("x min",0,xr);numField("x max",1,xr);numField("y min",0,yr);numField("y max",1,yr);
  function syncFields(){nf.forEach(function(q){q[0].value=fmt(q[1][q[2]],4);});}
  function zoom(k,cx,cy){
    var mx=cx==null?(xr[0]+xr[1])/2:cx,my=cy==null?(yr[0]+yr[1])/2:cy;
    xr[0]=mx+(xr[0]-mx)*k;xr[1]=mx+(xr[1]-mx)*k;yr[0]=my+(yr[0]-my)*k;yr[1]=my+(yr[1]-my)*k;syncFields();draw();}
  btn(rng,"확대",function(){zoom(0.7);});btn(rng,"축소",function(){zoom(1/0.7);});
  btn(rng,"y 자동",function(){
    var lo=Infinity,hi=-Infinity;
    comp.forEach(function(c){for(var i=0;i<=400;i++){var y=c.fn(xr[0]+(xr[1]-xr[0])*i/400);if(!isNaN(y)&&Math.abs(y)<1e6){if(y<lo)lo=y;if(y>hi)hi=y;}}});
    if(lo<hi){var pad=(hi-lo)*0.08;yr[0]=lo-pad;yr[1]=hi+pad;syncFields();draw();}});
  btn(rng,"처음으로",function(){xr[0]=x0[0];xr[1]=x0[1];yr[0]=y0[0];yr[1]=y0[1];syncFields();draw();});
  el.appendChild(errs);
  var note=h("div");note.style.cssText="font-size:12px;color:#555;margin-top:4px";
  note.textContent="사용 가능: + - * / ^ ( ), 2x 같은 곱, sin cos tan asin acos atan sinh cosh tanh exp ln log sqrt cbrt abs floor sign pow(a,b) min max, pi, e. 드래그로 이동, 그래프 위에 마우스를 올리면 해당 x와 함수값 표시.";
  el.appendChild(note);
  function draw(){
    cv.clear();fr=frame(ctx,cv.W,cv.H,xr,yr);
    var msgs=[];
    comp.forEach(function(c,i){if(c.err){msgs.push("y"+(i+1)+": "+c.err);return;}curve(ctx,fr,c.fn,xr,yr,cols[i],2.2,dashes[i]);});
    errs.textContent=msgs.join("  ");
    var lines=[];
    if(hover!==null){
      var x=hover;fr.clip();ctx.strokeStyle=GREY;ctx.setLineDash([3,3]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(fr.px(x),fr.T);ctx.lineTo(fr.px(x),fr.B);ctx.stroke();ctx.setLineDash([]);
      comp.forEach(function(c,i){if(c.err)return;var y=c.fn(x);if(!isNaN(y)&&y>=yr[0]&&y<=yr[1])dot(ctx,fr.px(x),fr.py(y),4,cols[i]);});
      ctx.restore();
      lines.push("x = "+fmt(x,4)+"   "+comp.map(function(c,i){return "f"+(fs.length>1?(i+1):"")+"(x) = "+(c.err?"—":fmt(c.fn(x),5));}).join("   "));
    }else lines.push("그래프 위에 마우스를 올려 보세요.");
    setLines(box,lines);
  }
  var drag=null;
  cv.c.addEventListener("pointerdown",function(ev){var p=cv.pos(ev);drag={x:p.x,y:p.y,xr:xr.slice(),yr:yr.slice(),moved:false};cv.c.setPointerCapture(ev.pointerId);});
  cv.c.addEventListener("pointermove",function(ev){
    var p=cv.pos(ev);
    if(drag){var dx=(p.x-drag.x)/(fr.R-fr.L)*(drag.xr[1]-drag.xr[0]),dy=(p.y-drag.y)/(fr.B-fr.T)*(drag.yr[1]-drag.yr[0]);
      if(Math.abs(p.x-drag.x)+Math.abs(p.y-drag.y)>3)drag.moved=true;
      xr[0]=drag.xr[0]-dx;xr[1]=drag.xr[1]-dx;yr[0]=drag.yr[0]+dy;yr[1]=drag.yr[1]+dy;syncFields();}
    hover=(p.x>=fr.L&&p.x<=fr.R)?fr.ix(p.x):null;draw();});
  cv.c.addEventListener("pointerup",function(){drag=null;});
  cv.c.addEventListener("pointerleave",function(){hover=null;if(!drag)draw();});
  draw();
});

/* ===== tangent-slider : 접선 = 할선의 극한 = 최선의 1차 근사 =====
   config: {title, f, x, y, a:[lo,hi,init,step], h0, presets:[{label,f,x,y,a}]} */
reg("tangent-slider",function(el,cfg){
  V6.title(el,cfg.title||"접선과 할선: 차분몫이 도함수로");
  var presets=cfg.presets||[
    {label:"x²",f:"x^2",x:[-1,4],y:[-1,10],a:1},
    {label:"sin x",f:"sin(x)",x:[-4,4],y:[-2,2],a:0.5},
    {label:"eˣ",f:"exp(x)",x:[-3,3],y:[-1,12],a:0.5},
    {label:"|x|  (a=0에서 미분 불가)",f:"abs(x)",x:[-2,2],y:[-0.5,2.5],a:0},
    {label:"x^(1/3)  (a=0에서 접선이 수직)",f:"cbrt(x)",x:[-2,2],y:[-2,2],a:0}];
  if(cfg.f&&!cfg.presets)presets.unshift({label:cfg.f,f:cfg.f,x:cfg.x,y:cfg.y,a:cfg.a});
  var cur=presets[0],xr,yr,f;
  var cv=mkCanvas(el,cfg.h||380),ctx=cv.ctx,ctl=h("div","v6-controls"),ctl2=h("div","v6-controls");
  el.appendChild(ctl);el.appendChild(ctl2);var box=stateBox(el);
  var aS,hS,anim=null;
  function load(i){
    cur=presets[i];xr=rangeOk(cur.x,[-4,4]);yr=rangeOk(cur.y,[-4,4]);
    var c=compile1(cur.f,["x"]);f=c.fn;
    var a0=Array.isArray(cur.a)?cur.a:[xr[0],xr[1],num(cur.a,(xr[0]+xr[1])/2),0.05];
    var lo=a0.length>2?a0[0]:xr[0],hi=a0.length>2?a0[1]:xr[1],ini=a0.length>2?a0[2]:a0[0];
    aS.range(lo,hi,(a0[3]||0.05));aS.set(ini);draw();
  }
  select(ctl,"함수",presets.map(function(p){return p.label;}),0,load);
  aS=slider(ctl,"a",-1,1,0.05,0,function(){draw();});
  hS=slider(ctl2,"h",-2,2,0.01,num(cfg.h0,1),function(){draw();});
  btn(ctl2,"h 절반으로",function(){var v=hS.get()/2;if(Math.abs(v)<1e-4)v=v<0?-1e-4:1e-4;hS.set(v);draw();});
  btn(ctl2,"h → 0 재생",function(){
    if(anim){clearInterval(anim);anim=null;return;}
    hS.set(hS.get()>=0?1.6:-1.6);draw();
    anim=setInterval(function(){var v=hS.get()/1.6;if(Math.abs(v)<0.002){clearInterval(anim);anim=null;}hS.set(v);draw();},450);});
  function draw(){
    cv.clear();var fr=frame(ctx,cv.W,cv.H,xr,yr);
    var a=aS.get(),hh=hS.get();if(Math.abs(hh)<1e-6)hh=hh<0?-1e-6:1e-6;
    curve(ctx,fr,f,xr,yr,INK,2.4);
    var fa=f(a),fb=f(a+hh);
    var sl=(fb-fa)/hh,s=1e-6*Math.max(1,Math.abs(a)),dR=(f(a+s)-fa)/s,dL=(fa-f(a-s))/s;
    var diff=isFinite(dR)&&isFinite(dL)&&Math.abs(dR-dL)<1e-3*(1+Math.abs(dR));
    var s2=s*1000,dR2=(f(a+s2)-fa)/s2,dL2=(fa-f(a-s2))/s2;
    function blow(p,q){return !isFinite(p)||(Math.abs(p)>50&&Math.abs(p)>3*Math.abs(q));}
    var steep=blow(dR,dR2)||blow(dL,dL2);
    var d=diff&&!steep?(dR+dL)/2:NaN;
    fr.clip();
    /* secant (red) over full width */
    if(isFinite(sl)){ctx.strokeStyle=RED;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(fr.px(xr[0]),fr.py(fa+sl*(xr[0]-a)));ctx.lineTo(fr.px(xr[1]),fr.py(fa+sl*(xr[1]-a)));ctx.stroke();}
    /* tangent (ink dashed) */
    if(isFinite(d)){ctx.strokeStyle=INK;ctx.lineWidth=1.4;ctx.setLineDash([7,5]);ctx.beginPath();
      ctx.moveTo(fr.px(xr[0]),fr.py(fa+d*(xr[0]-a)));ctx.lineTo(fr.px(xr[1]),fr.py(fa+d*(xr[1]-a)));ctx.stroke();ctx.setLineDash([]);
      /* linear-approximation error at a+h: vertical segment */
      var Lh=fa+d*hh;ctx.strokeStyle=RED;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(fr.px(a+hh),fr.py(fb));ctx.lineTo(fr.px(a+hh),fr.py(Lh));ctx.stroke();}
    else if(steep&&isFinite(fa)){ctx.strokeStyle=INK;ctx.lineWidth=1.4;ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(fr.px(a),fr.T);ctx.lineTo(fr.px(a),fr.B);ctx.stroke();ctx.setLineDash([]);}
    ctx.restore();
    if(isFinite(fa))dot(ctx,fr.px(a),fr.py(fa),5,INK);
    if(isFinite(fb))dot(ctx,fr.px(a+hh),fr.py(fb),5,RED);
    label(ctx,"(a, f(a))",fr.px(a)+8,fr.py(fa)+14,INK);
    var lines=[];
    lines.push("할선 기울기 [f(a+h) − f(a)] / h = "+fmt(sl,6));
    if(isFinite(d)){
      var E=fb-(fa+d*hh);
      lines.push({t:"접선 기울기 f′(a) = "+fmt(d,6)+"    차이 = "+fmt(sl-d,6),b:true});
      lines.push("1차 근사 오차 E(h) = f(a+h) − f(a) − f′(a)h = "+fmt(E,7)+"    E(h)/h = "+fmt(E/hh,7));
      lines.push("h → 0 일 때 E(h)/h → 0 이 바로 '미분가능'의 정의입니다 (Ch3의 differentiability; 다변수에서는 |E(h)|/‖h‖ → 0).");
    }else if(steep){lines.push({t:"접선이 수직입니다: 할선 기울기가 h→0 에서 발산, f′(a)가 존재하지 않습니다.",red:true});}
    else{lines.push({t:"미분 불가: 오른쪽 기울기 "+fmt(dR,4)+" ≠ 왼쪽 기울기 "+fmt(dL,4)+". h>0 와 h<0 의 할선 기울기가 서로 다른 값으로 갑니다.",red:true});}
    setLines(box,lines);
  }
  load(0);
});

/* ===== riemann : 리만합 =====
   config: {title, f, a, b, y, nmax, n, method:0..5, exact?} */
reg("riemann",function(el,cfg){
  V6.title(el,cfg.title||"리만합: 구간을 잘게 쪼개면 정적분");
  var presets=cfg.presets||[
    {label:"x² on [0,2]",f:"x^2",a:0,b:2,y:[-0.5,4.5]},
    {label:"sin x on [0,π]",f:"sin(x)",a:0,b:Math.PI,y:[-0.3,1.3]},
    {label:"sin x on [0,2π] (부호 있는 넓이)",f:"sin(x)",a:0,b:2*Math.PI,y:[-1.4,1.4]},
    {label:"eˣ on [0,1]",f:"exp(x)",a:0,b:1,y:[-0.3,3]},
    {label:"1/x on [1,4]",f:"1/x",a:1,b:4,y:[-0.2,1.3]}];
  if(cfg.f&&!cfg.presets)presets.unshift({label:cfg.f,f:cfg.f,a:num(cfg.a,0),b:num(cfg.b,1),y:cfg.y||[-1,2]});
  var methods=["좌합 (왼쪽 끝점)","우합 (오른쪽 끝점)","중점합","사다리꼴","상합 (구간별 최댓값)","하합 (구간별 최솟값)"];
  var P=presets[0],f,A,B,yr,exact=NaN,mi=num(cfg.method,0);
  var cv=mkCanvas(el,cfg.h||360),ctx=cv.ctx,ctl=h("div","v6-controls");el.appendChild(ctl);var box=stateBox(el);
  var nS;
  function load(i){P=presets[i];f=compile1(P.f,["x"]).fn;A=P.a;B=P.b;yr=rangeOk(P.y,[-1,2]);
    exact=simpson(f,A,B,4000);draw();}
  select(ctl,"함수",presets.map(function(p){return p.label;}),0,load);
  select(ctl,"방법",methods,mi,function(i){mi=i;draw();});
  nS=slider(ctl,"n",1,num(cfg.nmax,200),1,num(cfg.n,6),function(){draw();},function(v){return String(Math.round(v));});
  function draw(){
    cv.clear();var n=Math.round(nS.get());
    var pad=(B-A)*0.08,xr=[A-pad,B+pad],fr=frame(ctx,cv.W,cv.H,xr,yr);
    var dx=(B-A)/n,sum=0,i,k;
    fr.clip();
    function rect(x0,x1,top){
      var y0=fr.py(0),y1=fr.py(top);
      ctx.fillStyle=top>=0?"rgba(26,26,26,0.13)":"rgba(158,43,37,0.20)";
      ctx.fillRect(fr.px(x0),Math.min(y0,y1),fr.px(x1)-fr.px(x0),Math.abs(y1-y0));
      ctx.strokeStyle=INK;ctx.lineWidth=n>60?0.5:1;ctx.strokeRect(fr.px(x0),Math.min(y0,y1),fr.px(x1)-fr.px(x0),Math.abs(y1-y0));
    }
    for(i=0;i<n;i++){
      var x0=A+i*dx,x1=x0+dx,hgt;
      if(mi===0)hgt=f(x0);else if(mi===1)hgt=f(x1);else if(mi===2)hgt=f((x0+x1)/2);
      else if(mi===3){hgt=(f(x0)+f(x1))/2;
        /* trapezoid drawn as polygon */
        ctx.beginPath();ctx.moveTo(fr.px(x0),fr.py(0));ctx.lineTo(fr.px(x0),fr.py(f(x0)));ctx.lineTo(fr.px(x1),fr.py(f(x1)));ctx.lineTo(fr.px(x1),fr.py(0));ctx.closePath();
        ctx.fillStyle="rgba(26,26,26,0.13)";ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=n>60?0.5:1;ctx.stroke();sum+=hgt*dx;continue;}
      else{var mx=-Infinity,mn=Infinity,S=48;for(k=0;k<=S;k++){var v=f(x0+dx*k/S);if(v>mx)mx=v;if(v<mn)mn=v;}hgt=(mi===4)?mx:mn;}
      rect(x0,x1,hgt);sum+=hgt*dx;
    }
    ctx.restore();
    curve(ctx,fr,f,xr,yr,INK,2.4);
    var neg=false;for(k=0;k<=60;k++){if(f(A+(B-A)*k/60)<-1e-9)neg=true;}
    var err=sum-exact,ord=(mi===0||mi===1||mi===4||mi===5)?1:2;
    setLines(box,[
      {t:"n = "+n+",  Δx = "+fmt(dx,5)+",  "+methods[mi]+" = "+fmt(sum,7),b:true},
      "정적분(정밀 수치값) ≈ "+fmt(exact,7)+"    오차 = "+fmt(err,7),
      "오차 × n"+(ord===2?"²":"")+" = "+fmt(err*Math.pow(n,ord),5)+"   (n을 키워도 이 값이 거의 일정하면 오차가 1/n"+(ord===2?"²":"")+" 로 줄어든다는 뜻)",
      mi>=4?"상합과 하합 사이에 정적분이 끼어 있습니다. n이 커지면 둘의 차가 0으로 갑니다 (적분가능 ⇔ 상합 = 하합의 극한)."
           :(neg?"빨강 영역은 f<0 인 부분: 부호 있는 넓이로 정적분에서 빼집니다.":"f ≥ 0 이면 정적분은 곡선 아래 넓이입니다.")]);
  }
  load(0);
});

/* ===== taylor : 테일러 다항식 =====
   config: {title, preset:0..4} */
reg("taylor",function(el,cfg){
  V6.title(el,cfg.title||"테일러 다항식: 차수가 오르면 근사가 넓어진다");
  var fact=function(k){var r=1;for(var i=2;i<=k;i++)r*=i;return r;};
  var PR=[
    {label:"sin x",f:"sin(x)",d:function(k,a){return Math.sin(a+k*Math.PI/2);},x:[-9,9],y:[-3,3],ac:[-3,3,0,0.1],
      bound:function(n,a,x){return Math.pow(Math.abs(x-a),n+1)/fact(n+1);},bt:"M=1"},
    {label:"cos x",f:"cos(x)",d:function(k,a){return Math.cos(a+k*Math.PI/2);},x:[-9,9],y:[-3,3],ac:[-3,3,0,0.1],
      bound:function(n,a,x){return Math.pow(Math.abs(x-a),n+1)/fact(n+1);},bt:"M=1"},
    {label:"eˣ",f:"exp(x)",d:function(k,a){return Math.exp(a);},x:[-4,4],y:[-2,12],ac:[-2,2,0,0.1],
      bound:function(n,a,x){return Math.exp(Math.max(a,x))*Math.pow(Math.abs(x-a),n+1)/fact(n+1);},bt:"M=e^max(a,x)"},
    {label:"ln x",f:"ln(x)",d:function(k,a){return k===0?Math.log(a):((k%2===1?1:-1)*fact(k-1)/Math.pow(a,k));},x:[0.02,5],y:[-3,2.5],ac:[0.5,3,1,0.1],
      bound:function(n,a,x){return fact(n)/Math.pow(Math.min(a,x),n+1)*Math.pow(Math.abs(x-a),n+1)/fact(n+1);},bt:"M=n!/min(a,x)^(n+1)",
      rad:function(a){return a;}},
    {label:"1/(1−x)",f:"1/(1-x)",d:function(k,a){return fact(k)/Math.pow(1-a,k+1);},x:[-3,3],y:[-2,6],ac:[-1.5,0.9,0,0.05],
      rad:function(a){return Math.abs(1-a);}}];
  var pi=Math.min(PR.length-1,Math.max(0,num(cfg.preset,0))),P=PR[pi],f;
  var cv=mkCanvas(el,cfg.h||380),ctx=cv.ctx,ctl=h("div","v6-controls");el.appendChild(ctl);var box=stateBox(el);
  var aS,nS,xS;
  function reload(i){P=PR[i];f=compile1(P.f,["x"]).fn;aS.range(P.ac[0],P.ac[1],P.ac[3]);aS.set(P.ac[2]);xS.range(P.x[0]+0.02,P.x[1]-0.02,0.02);
    var xr0=P.label==="ln x"?1.8:1.5;xS.set(Math.min(P.x[1]-0.02,Math.max(P.x[0]+0.02,P.ac[2]+xr0)));draw();}
  select(ctl,"함수",PR.map(function(p){return p.label;}),pi,reload);
  aS=slider(ctl,"중심 a",-1,1,0.1,0,function(){draw();});
  nS=slider(ctl,"차수 n",0,12,1,num(cfg.n,3),function(){draw();},function(v){return String(Math.round(v));});
  xS=slider(ctl,"점검할 x",-1,1,0.02,0,function(){draw();});
  function T(n,a,x){var s=0;for(var k=0;k<=n;k++)s+=P.d(k,a)*Math.pow(x-a,k)/fact(k);return s;}
  function draw(){
    cv.clear();var xr=P.x,yr=P.y,fr=frame(ctx,cv.W,cv.H,xr,yr);
    var a=aS.get(),n=Math.round(nS.get()),x=xS.get();
    curve(ctx,fr,f,xr,yr,INK,2.6);
    curve(ctx,fr,function(t){return T(n,a,t);},xr,yr,RED,2.2);
    var fx=f(x),tx=T(n,a,x);
    fr.clip();ctx.strokeStyle=GREY;ctx.setLineDash([3,3]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(fr.px(x),fr.T);ctx.lineTo(fr.px(x),fr.B);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    dot(ctx,fr.px(a),fr.py(f(a)),4.5,INK);
    if(isFinite(fx))dot(ctx,fr.px(x),fr.py(fx),4,INK,false);
    if(isFinite(tx)&&tx>=yr[0]&&tx<=yr[1])dot(ctx,fr.px(x),fr.py(tx),4,RED);
    label(ctx,"f (검정)",fr.L+8,fr.T+12,INK);label(ctx,"T"+n+" (빨강)",fr.L+8,fr.T+28,RED);
    var err=Math.abs(fx-tx),L=[
      {t:"x = "+fmt(x,3)+":   f(x) = "+fmt(fx,7)+",   T"+n+"(x) = "+fmt(tx,7)+",   |오차| = "+(err<1e-12?"< 1e-12":fmt(err,7)),b:true}];
    if(P.bound)L.push("라그랑주 나머지 한계 "+fmt(P.bound(n,a,x),6)+"  ("+P.bt+", |R_n| ≤ M|x−a|^(n+1)/(n+1)!) — 실제 오차가 이 값 이하입니다.");
    if(P.rad){var r=P.rad(a);L.push("수렴반경 "+fmt(r,3)+": |x−a| < "+fmt(r,3)+" 안에서만 T_n → f ("+(P.label==="ln x"?"x=0에서 특이점":"x=1에서 특이점")+"). 반경 밖에서는 차수를 올려도 오차가 커집니다.");}
    else L.push("이 함수는 수렴반경이 ∞: 모든 x에서 n을 올리면 T_n → f.");
    L.push("Ch4 연결: 2변수 2차 Taylor는 f(a+h) ≈ f(a) + ∇f(a)·h + ½ hᵀH(a)h. 여기서 n=2는 그 1변수판이고, H의 부호가 극값 판정(second derivative test)을 정합니다.");
    setLines(box,L);
  }
  reload(pi);
});

/* ===== epsilon-delta : 극한의 ε-δ =====
   config: {title, preset} */
reg("epsilon-delta",function(el,cfg){
  V6.title(el,cfg.title||"극한의 ε–δ: 허용오차 ε에 맞는 δ 찾기");
  var PR=[
    {label:"x² → 4  (x→2)",f:"x^2",a:2,L:4,x:[0,4],y:[0,10]},
    {label:"sin x / x → 1  (x→0)",f:"sin(x)/x",a:0,L:1,x:[-6,6],y:[-0.4,1.4]},
    {label:"|x| → 0  (x→0)",f:"abs(x)",a:0,L:0,x:[-2,2],y:[-0.3,2.2]},
    {label:"sign x : 극한 없음 (L=0이라 가정)",f:"sign(x)",a:0,L:0,x:[-2,2],y:[-1.5,1.5]},
    {label:"x sin(1/x) → 0  (x→0)",f:"x*sin(1/x)",a:0,L:0,x:[-0.5,0.5],y:[-0.5,0.5]}];
  var P=PR[0],f;
  var cv=mkCanvas(el,cfg.h||360),ctx=cv.ctx,ctl=h("div","v6-controls");el.appendChild(ctl);var box=stateBox(el);
  var eS;
  function load(i){P=PR[i];f=compile1(P.f,["x"]).fn;eS.set(P.L===4?1:0.3);draw();}
  select(ctl,"함수",PR.map(function(p){return p.label;}),Math.min(PR.length-1,num(cfg.preset,0)),load);
  eS=slider(ctl,"ε",0.02,2,0.01,0.5,function(){draw();});
  function findDelta(eps){
    var xr=P.x,span=Math.max(P.a-xr[0],xr[1]-P.a),N=20000,st=span/N,best=Infinity;
    [-1,1].forEach(function(s){
      var lim=s<0?P.a-xr[0]:xr[1]-P.a,d=Infinity;
      for(var k=1;k*st<=lim+1e-12;k++){var v=f(P.a+s*k*st);
        if(isNaN(v)||Math.abs(v-P.L)>=eps){d=(k-1)*st;break;}}
      if(d<best)best=d;});
    return {d:best,st:st,edge:best===Infinity};
  }
  function draw(){
    cv.clear();var xr=P.x,yr=P.y,fr=frame(ctx,cv.W,cv.H,xr,yr);
    var eps=eS.get(),r=findDelta(eps);
    var lim=Math.min(r.d,Math.max(P.a-xr[0],xr[1]-P.a));
    fr.clip();
    ctx.fillStyle="rgba(158,43,37,0.12)";ctx.fillRect(fr.L,fr.py(P.L+eps),fr.R-fr.L,fr.py(P.L-eps)-fr.py(P.L+eps));
    if(r.d>=r.st){ctx.fillStyle="rgba(26,26,26,0.10)";ctx.fillRect(fr.px(P.a-lim),fr.T,fr.px(P.a+lim)-fr.px(P.a-lim),fr.B-fr.T);}
    ctx.strokeStyle=RED;ctx.lineWidth=1.3;[P.L+eps,P.L-eps].forEach(function(y){ctx.beginPath();ctx.moveTo(fr.L,fr.py(y));ctx.lineTo(fr.R,fr.py(y));ctx.stroke();});
    ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(fr.L,fr.py(P.L));ctx.lineTo(fr.R,fr.py(P.L));ctx.stroke();ctx.setLineDash([]);
    if(r.d>=r.st)[P.a-lim,P.a+lim].forEach(function(x){ctx.beginPath();ctx.moveTo(fr.px(x),fr.T);ctx.lineTo(fr.px(x),fr.B);ctx.stroke();});
    ctx.restore();
    curve(ctx,fr,f,xr,yr,INK,2.2);
    dot(ctx,fr.px(P.a),fr.py(P.L),4.5,INK,false);
    label(ctx,"L + ε",fr.R-6,fr.py(P.L+eps)-8,RED,"right");label(ctx,"L − ε",fr.R-6,fr.py(P.L-eps)+10,RED,"right");
    var L=[];
    if(r.d<r.st*1.5){L.push({t:"ε = "+fmt(eps,3)+" 에 맞는 δ를 찾지 못했습니다 (δ < "+fmt(r.st,4)+" 해상도). 이 ε 에서는 a 바로 옆에서도 |f(x) − L| < ε 가 깨집니다 → 극한이 L이 아닐 수 있다는 신호입니다.",red:true});}
    else{L.push({t:"ε = "+fmt(eps,3)+"  →  δ ≈ "+(r.edge?"≥ "+fmt(lim,4)+" (그림 범위 전체)":fmt(r.d,4)),b:true});
      L.push("0 < |x − a| < δ 이면 |f(x) − L| < ε. ε을 줄이면 δ도 따라 줄어듭니다(그래프가 가파를수록 δ가 더 작아야 함). 모든 ε에 대해 δ가 존재해야 극한입니다.");}
    L.push("Ch2 연결: 다변수 극한은 같은 정의에서 |x − a|를 벡터 노름 ‖x − a‖로 바꾼 것입니다. 여기서의 δ-구간이 R²에서는 a를 중심으로 한 원판이 됩니다.");
    setLines(box,L);
  }
  load(Math.min(PR.length-1,num(cfg.preset,0)));
});
})();
(function(){
"use strict";
var X=window.V6X;if(!X)return;
var V6=window.V6,INK=X.INK,RED=X.RED,GRID=X.GRID,GREY=X.GREY,h=X.h,fmt=X.fmt,num=X.num,reg=X.reg,frame=X.frame,mkCanvas=X.mkCanvas,
  slider=X.slider,btn=X.btn,select=X.select,stateBox=X.stateBox,setLines=X.setLines,label=X.label,dot=X.dot,curve=X.curve,compile1=X.compile1,parse=X.parse;
function compile2(src){try{return {fn:parse(src,["x","y"]),err:null};}catch(e){return {fn:function(){return NaN;},err:e.message};}}
function arrow(ctx,x0,y0,x1,y1,color,lw,head){
  var dx=x1-x0,dy=y1-y0,L=Math.sqrt(dx*dx+dy*dy);if(L<0.6){return;}
  var ux=dx/L,uy=dy/L,hl=Math.min(head||7,L*0.6);
  ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=lw||1.4;
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1-ux*hl*0.7,y1-uy*hl*0.7);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x1-ux*hl-uy*hl*0.45,y1-uy*hl+ux*hl*0.45);ctx.lineTo(x1-ux*hl+uy*hl*0.45,y1-uy*hl-ux*hl*0.45);ctx.closePath();ctx.fill();ctx.restore();
}
X.arrow=arrow;X.compile2=compile2;

/* ===== vector-field : 벡터장, 발산(div)과 회전(curl)의 정의를 극한으로 =====
   config: {title, preset:0..5, x:[-3,3]}  (Ch3 §3.5 divergence와 curl) */
reg("vector-field",function(el,cfg){
  V6.title(el,cfg.title||"벡터장의 발산과 회전: 작은 원 위에서 재 본다");
  var PR=[
    {label:"F = (x, y)  퍼져 나감",P:"x",Q:"y",div:"2",curl:"0"},
    {label:"F = (−y, x)  회전",P:"-y",Q:"x",div:"0",curl:"2"},
    {label:"F = (y, 0)  전단",P:"y",Q:"0",div:"0",curl:"−1"},
    {label:"F = (x, −y)  안장 흐름",P:"x",Q:"-y",div:"0",curl:"0"},
    {label:"F = (x², y²)",P:"x^2",Q:"y^2",div:"2x + 2y",curl:"0"},
    {label:"F = (−y, x)/(x²+y²)  소용돌이 (원점 제외)",P:"-y/(x^2+y^2)",Q:"x/(x^2+y^2)",div:"0",curl:"0 (원점 제외)"}];
  var xr=X.rangeOk(cfg.x,[-3,3]),yr=xr.slice(),pi=Math.min(PR.length-1,Math.max(0,num(cfg.preset,0))),P,Pf,Qf;
  var S=372,cv=mkCanvas(el,S+36),ctx=cv.ctx,ctl=h("div","v6-controls");el.appendChild(ctl);var box=stateBox(el);
  var pt={x:1,y:0.5},rS,fr;
  function load(i){P=PR[i];Pf=compile2(P.P).fn;Qf=compile2(P.Q).fn;draw();}
  select(ctl,"벡터장",PR.map(function(p){return p.label;}),pi,load);
  rS=slider(ctl,"반지름 r",0.05,1.5,0.05,0.6,function(){draw();});
  var hint=h("span");hint.style.cssText="font-size:12px;color:#555";hint.textContent="그림을 클릭/드래그해서 점 p를 옮기세요";ctl.appendChild(hint);
  function draw(){
    cv.clear();var m=(cv.W-S)/2;fr=frame(ctx,cv.W,cv.H,xr,yr,{L:m,R:m,T:10,B:26,nx:6,ny:6});
    var n=13,cx=(xr[1]-xr[0])/n,mx=0,i,j,gx,gy;
    for(i=0;i<n;i++)for(j=0;j<n;j++){gx=xr[0]+(i+0.5)*cx;gy=yr[0]+(j+0.5)*cx;var a=Pf(gx,gy),b=Qf(gx,gy);if(isFinite(a)&&isFinite(b))mx=Math.max(mx,Math.hypot(a,b));}
    var cell=(fr.R-fr.L)/n,sc=mx>0?cell*0.9/mx:1;
    fr.clip();
    for(i=0;i<n;i++)for(j=0;j<n;j++){gx=xr[0]+(i+0.5)*cx;gy=yr[0]+(j+0.5)*cx;var a2=Pf(gx,gy),b2=Qf(gx,gy);if(!isFinite(a2)||!isFinite(b2))continue;
      var x0=fr.px(gx),y0=fr.py(gy);arrow(ctx,x0,y0,x0+a2*sc,y0-b2*sc,GREY,1.2,6);}
    /* the small circle and its boundary samples */
    var r=rS.get(),N=48,flux=0,circ=0,k;
    var ds=2*Math.PI*r/N;
    ctx.strokeStyle=INK;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(fr.px(pt.x),fr.py(pt.y),r/(xr[1]-xr[0])*(fr.R-fr.L),0,2*Math.PI);ctx.stroke();
    for(k=0;k<N;k++){
      var th=2*Math.PI*(k+0.5)/N,nx=Math.cos(th),ny=Math.sin(th),qx=pt.x+r*nx,qy=pt.y+r*ny,u=Pf(qx,qy),v=Qf(qx,qy);
      if(!isFinite(u)||!isFinite(v))continue;
      var fn=u*nx+v*ny,ft=-u*ny+v*nx;flux+=fn*ds;circ+=ft*ds;
      var X0=fr.px(qx),Y0=fr.py(qy);
      arrow(ctx,X0,Y0,X0+nx*fn*sc*0.9,Y0-ny*fn*sc*0.9,RED,1.5,5);   /* normal component (flux) in red */
    }
    ctx.restore();
    dot(ctx,fr.px(pt.x),fr.py(pt.y),4,INK);label(ctx,"p",fr.px(pt.x)+7,fr.py(pt.y)-9,INK,"left",true);
    var area=Math.PI*r*r,eps=1e-4;var Z=function(v){return Math.abs(v)<1e-6?0:v;};
    var div=(Pf(pt.x+eps,pt.y)-Pf(pt.x-eps,pt.y))/(2*eps)+(Qf(pt.x,pt.y+eps)-Qf(pt.x,pt.y-eps))/(2*eps);
    var curl=(Qf(pt.x+eps,pt.y)-Qf(pt.x-eps,pt.y))/(2*eps)-(Pf(pt.x,pt.y+eps)-Pf(pt.x,pt.y-eps))/(2*eps);
    setLines(box,[
      {t:"p = ("+fmt(pt.x,2)+", "+fmt(pt.y,2)+"),  F(p) = ("+fmt(Pf(pt.x,pt.y),3)+", "+fmt(Qf(pt.x,pt.y),3)+")",b:true},
      "원 둘레의 알짜 유출 ∮F·n ds / 넓이 = "+fmt(Z(flux/area),4)+"      ∂P/∂x + ∂Q/∂y = div F(p) = "+fmt(Z(div),4),
      "원 둘레의 순환 ∮F·t ds / 넓이 = "+fmt(Z(circ/area),4)+"      ∂Q/∂x − ∂P/∂y = curl F(p) = "+fmt(Z(curl),4),
      "빨간 화살표 = 둘레에서 F의 바깥 방향 성분. r → 0 으로 줄이면 왼쪽 값이 오른쪽 값에 수렴합니다. 이것이 div, curl 의 기하학적 뜻입니다.",
      "이 벡터장의 공식: div F = "+P.div+",  curl F = "+P.curl]);
  }
  function setPt(ev){var p=cv.pos(ev);if(p.x<fr.L||p.x>fr.R||p.y<fr.T||p.y>fr.B)return;pt.x=Math.round(fr.ix(p.x)*20)/20;pt.y=Math.round(fr.iy(p.y)*20)/20;draw();}
  var dn=false;cv.c.addEventListener("pointerdown",function(ev){dn=true;cv.c.setPointerCapture(ev.pointerId);setPt(ev);});
  cv.c.addEventListener("pointermove",function(ev){if(dn)setPt(ev);});cv.c.addEventListener("pointerup",function(){dn=false;});
  load(pi);
});

/* ===== path-limit : 다변수 극한은 경로에 무관해야 한다 =====  (Ch2 극한과 continuity) */
reg("path-limit",function(el,cfg){
  V6.title(el,cfg.title||"다변수 극한: 어떤 경로로 (0,0)에 다가가도 같은 값인가?");
  var PR=[
    {label:"xy / (x²+y²)",f:"x*y/(x^2+y^2)",line:function(m){return m/(1+m*m);},par:function(k){return 0;},parT:"포물선 y=kx² 위에서는 → 0 (직선과 다른 경로도 모두 같지는 않음)",
      verdict:"직선 y=mx 마다 극한이 m/(1+m²) 로 다릅니다 → 극한이 존재하지 않습니다."},
    {label:"x²y / (x⁴ + y²)",f:"x^2*y/(x^4+y^2)",line:function(m){return 0;},par:function(k){return k/(1+k*k);},
      verdict:"모든 직선 위에서는 극한이 0 이지만, 포물선 y=kx² 위에서는 k/(1+k²) 라서 극한이 존재하지 않습니다. 직선만 다 확인해서는 부족합니다."},
    {label:"x²y / (x² + y²)",f:"x^2*y/(x^2+y^2)",line:function(m){return 0;},par:function(k){return 0;},
      verdict:"|x²y/(x²+y²)| ≤ |y| → 0 (squeeze). 어떤 경로로 가도 0 이고, 실제로 극한이 0 입니다. 경로 실험은 반증만 할 수 있고 증명은 부등식으로 해야 합니다."},
    {label:"(x² − y²) / (x² + y²)",f:"(x^2-y^2)/(x^2+y^2)",line:function(m){return (1-m*m)/(1+m*m);},par:function(k){return 1;},
      verdict:"직선 y=mx 마다 극한이 (1−m²)/(1+m²) 로 다릅니다 → 극한이 존재하지 않습니다."}];
  var pi=Math.min(PR.length-1,Math.max(0,num(cfg.preset,0))),P,f,kind=0;
  var cv=mkCanvas(el,cfg.h||300),ctx=cv.ctx,ctl=h("div","v6-controls");el.appendChild(ctl);var box=stateBox(el);
  var mS;
  function load(i){P=PR[i];f=compile2(P.f).fn;draw();}
  select(ctl,"함수",PR.map(function(p){return p.label;}),pi,load);
  select(ctl,"경로",["y = m x","y = k x²"],0,function(i){kind=i;draw();});
  mS=slider(ctl,"m 또는 k",-3,3,0.1,1,function(){draw();});
  function g(t,m){return f(t,kind===0?m*t:m*t*t);}
  function pathLimit(m){var a=g(1e-5,m),b=g(-1e-5,m);var R=function(v){return Math.round(v*1e4)/1e4+0;};return {a:R(a),b:R(b)};}
  function draw(){
    cv.clear();var m=mS.get(),T=38,B=26;
    var f1=frame(ctx,cv.W,cv.H,[-1,1],[-1,1],{L:36,R:cv.W-286,T:T,B:B,nx:4,ny:4});
    var f2=frame(ctx,cv.W,cv.H,[-1,1],[-1.2,1.2],{L:340,R:14,T:T,B:B,nx:5,ny:6});
    /* left: path in the plane */
    f1.clip();ctx.strokeStyle=RED;ctx.lineWidth=2;ctx.beginPath();
    for(var i=0;i<=200;i++){var t=-1+i/100,y=kind===0?m*t:m*t*t;if(Math.abs(y)>1.3){continue;}
      if(i===0||Math.abs((kind===0?m*(t-0.01):m*(t-0.01)*(t-0.01))-y)>2)ctx.moveTo(f1.px(t),f1.py(y));else ctx.lineTo(f1.px(t),f1.py(y));}
    ctx.stroke();ctx.restore();
    dot(ctx,f1.px(0),f1.py(0),4.5,INK,false);
    label(ctx,"(x, y) 평면",f1.L,f1.T-26,INK);label(ctx,kind===0?"y = "+fmt(m,2)+" x":"y = "+fmt(m,2)+" x²",f1.L,f1.T-11,RED);
    /* right: g(t) along the path */
    var lim=pathLimit(m),ok=isFinite(lim.a)&&isFinite(lim.b);
    curve(ctx,f2,function(t){return Math.abs(t)<1e-9?NaN:g(t,m);},[-1,1],[-1.2,1.2],RED,2.2);
    if(ok&&Math.abs(lim.a-lim.b)<1e-3){f2.clip();ctx.strokeStyle=INK;ctx.setLineDash([5,4]);ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(f2.L,f2.py(lim.a));ctx.lineTo(f2.R,f2.py(lim.a));ctx.stroke();ctx.setLineDash([]);ctx.restore();
      label(ctx,"극한 "+fmt(lim.a,3),f2.R-6,f2.py(lim.a)-9,INK,"right");}
    dot(ctx,f2.px(0),f2.py(lim.a),4.5,INK,false);
    label(ctx,"경로를 따라 본 f(t, y(t))",f2.L,f2.T-11,INK);label(ctx,"t",f2.R-6,f2.B-10,INK,"right");
    var exact=kind===0?P.line(m):P.par(m),mm=[-2,-1,0,1,2].map(function(v){return "m="+v+": "+fmt(P.line(v),3);}).join("  ·  ");
    var L=[{t:(kind===0?"직선 y = "+fmt(m,2)+"x":"포물선 y = "+fmt(m,2)+"x²")+" 를 따라 (0,0) 으로 갈 때 f → "+fmt(lim.a,5)+"  (t→0⁺),  "+fmt(lim.b,5)+"  (t→0⁻)",b:true},
      "공식으로 구한 이 경로의 극한: "+fmt(exact,5),
      "직선들의 극한  "+mm,
      {t:P.verdict,red:PR[pi].f!==P.f?false:false}];
    setLines(box,L);
  }
  load(pi);
});
})();
(function () {
  "use strict";
  var X = window.V6X;
  if (!X) return;

  var INK = X.INK || "#1a1a1a", RED = X.RED || "#9e2b25";
  var GREY = X.GREY || "#777", EPS = 1e-12;

  function finite(x) { return Number.isFinite(x); }
  function clamp(v, lo, hi, fallback) {
    v = Number(v);
    return finite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  }
  function integer(v, lo, hi, fallback) {
    return Math.round(clamp(v, lo, hi, fallback));
  }
  function show(v, d) {
    if (!finite(v)) return "정의되지 않음";
    if (v === 0) return "0";
    if (Math.abs(v) >= 1e7 || Math.abs(v) < 1e-5) {
      return v.toExponential(3);
    }
    return X.fmt(v, d === undefined ? 6 : d);
  }
  function point(ctx, fr, x, y, radius, color, filled) {
    if (finite(x) && finite(y)) {
      fr.clip();
      X.dot(ctx, fr.px(x), fr.py(y), radius, color, filled !== false);
      ctx.restore();
    }
  }
  function segment(ctx, fr, x1, y1, x2, y2, color, width, dash) {
    if (![x1, y1, x2, y2].every(finite)) return;
    fr.clip();
    ctx.beginPath();
    ctx.setLineDash(dash || []);
    ctx.moveTo(fr.px(x1), fr.py(y1));
    ctx.lineTo(fr.px(x2), fr.py(y2));
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1.4;
    ctx.stroke();
    ctx.restore();
  }
  function horizontal(ctx, fr, yr, y, color, dash) {
    if (finite(y)) {
      segment(ctx, fr, 0, y, fr.ix(720 - fr.R), y,
        color, 1.25, dash || [5, 4]);
    }
  }
  function bounds(values, minSpan) {
    var good = values.filter(finite);
    if (!good.length) return [-1, 1];
    var a = Math.min.apply(null, good);
    var b = Math.max.apply(null, good);
    var span = Math.max(b - a, minSpan || 0.5, 1e-8);
    var mid = a / 2 + b / 2;
    return [mid - span * 0.58, mid + span * 0.58];
  }
  function bisect(fn, a, b, count) {
    var fa = fn(a), fb = fn(b);
    if (!finite(fa) || !finite(fb) || fa * fb > 0) return NaN;
    if (fa === 0) return a;
    if (fb === 0) return b;
    for (var i = 0; i < (count || 80); i++) {
      var m = a + (b - a) / 2, fm = fn(m);
      if (!finite(fm) || m === a || m === b) break;
      if (fm === 0) return m;
      if ((fa < 0) === (fm < 0)) {
        a = m;
        fa = fm;
      } else {
        b = m;
        fb = fm;
      }
    }
    return a + (b - a) / 2;
  }
  function item(parent, tag, str) {
    var e = X.h(tag, "", str);
    parent.appendChild(e);
    return e;
  }

  // ============================================================
  // 1. Sequence and series convergence
  // ============================================================

  X.reg("series-converge", function (el, cfg) {
    cfg = cfg || {};
    window.V6.title(el, cfg.title || "수열과 급수의 수렴");

    var cv = X.mkCanvas(el, 420), ctx = cv.ctx;
    var controls = X.h("div", "v6-controls");
    el.appendChild(controls);
    var box = X.stateBox(el);

    var p = integer(cfg.preset, 0, 4, 0);
    var N = integer(cfg.N, 1, 60, 20);
    var r = clamp(cfg.r, -1.49, 1.49, 0.6);
    var eps = clamp(cfg.epsilon, 0.01, 0.5, 0.1);

    X.select(controls, "종류", [
      "등비급수",
      "조화급수",
      "p-급수 (p=2)",
      "교대조화급수",
      "수열 n/(n+1)"
    ], p, function (v) {
      p = integer(v, 0, 4, 0);
      sync();
      draw();
    });

    X.slider(controls, "N", 1, 60, 1, N, function (v) {
      N = integer(v, 1, 60, 20);
      draw();
    });

    var rs = X.slider(controls, "r", -1.49, 1.49, 0.01, r,
      function (v) {
        r = clamp(v, -1.49, 1.49, 0.6);
        draw();
      },
      function (v) { return show(Number(v), 2); }
    );

    var es = X.slider(controls, "ε", 0.01, 0.5, 0.01, eps,
      function (v) {
        eps = clamp(v, 0.01, 0.5, 0.1);
        draw();
      },
      function (v) { return show(Number(v), 2); }
    );

    function sync() {
      rs.input.disabled = p !== 0;
      es.input.disabled = p !== 4;
    }

    // Smallest n >= 1 satisfying 1/(n+1) < epsilon.
    // Equality must NOT count.
    function firstN(e) {
      var n = Math.max(1, Math.floor(1 / e) - 2);
      while (1 / (n + 1) >= e) n++;
      while (n > 1 && 1 / n < e) n--;
      return n;
    }

    function draw() {
      cv.clear();

      var terms = [], sums = [], s = 0;
      var sumLimit = NaN, termLimit = 0;

      for (var n = 1; n <= N; n++) {
        var a = p === 0 ? Math.pow(r, n - 1)
          : p === 1 ? 1 / n
          : p === 2 ? 1 / (n * n)
          : p === 3 ? (n % 2 ? 1 : -1) / n
          : n / (n + 1);

        terms.push(a);

        if (p !== 4) {
          s += a;
          sums.push(s);
        }
      }

      if (p === 0 && Math.abs(r) < 1) sumLimit = 1 / (1 - r);
      if (p === 2) sumLimit = Math.PI * Math.PI / 6;
      if (p === 3) sumLimit = Math.LN2;
      if (p === 4) termLimit = 1;

      var threshold = p === 4 ? firstN(eps) : -1;
      var yTerms = bounds(
        terms.concat([termLimit]).concat(
          p === 4 ? [1 - eps, 1 + eps] : []
        ), 0.4
      );

      // The sequence preset uses only one large panel.
      var h1 = p === 4 ? 391 : 199;
      var f1 = X.frame(
        ctx, cv.W, h1, [0, N + 1], yTerms,
        { L: 49, R: 15, T: 19, B: 27 }
      );

      if (p === 4) {
        f1.clip();
        ctx.fillStyle = "rgba(26,26,26,0.08)";
        ctx.fillRect(
          f1.L,
          f1.py(1 + eps),
          cv.W - f1.L - f1.R,
          f1.py(1 - eps) - f1.py(1 + eps)
        );
        ctx.restore();

        horizontal(ctx, f1, yTerms, 1 + eps, GREY, [3, 4]);
        horizontal(ctx, f1, yTerms, 1 - eps, GREY, [3, 4]);
      }

      // A divergent geometric sequence has no term-limit line.
      if (p !== 0 || Math.abs(r) < 1) {
        horizontal(ctx, f1, yTerms, termLimit, GREY, [5, 4]);
      }

      terms.forEach(function (a, i) {
        point(ctx, f1, i + 1, a, 3, RED);
      });

      X.label(ctx, "aₙ  (n=1,…,N)",
        f1.L + 9, f1.T + 14, INK, "left", true);

      if (p === 4 && threshold <= N) {
        segment(ctx, f1,
          threshold, yTerms[0],
          threshold, yTerms[1],
          GREY, 1, [3, 4]);
      }

      // Lower panel: partial sums.
      if (p !== 4) {
        ctx.save();
        ctx.translate(0, 213);

        var ySums = bounds(
          sums.concat(finite(sumLimit) ? [sumLimit] : []).concat([0]),
          0.5
        );

        var f2 = X.frame(
          ctx, cv.W, 199, [0, N + 1], ySums,
          { L: 49, R: 15, T: 19, B: 27 }
        );

        if (finite(sumLimit)) {
          horizontal(ctx, f2, ySums, sumLimit, GREY, [5, 4]);
        }

        if (p === 1) {
          X.curve(ctx, f2, function (x) {
            return x > 0
              ? Math.log(x) + 0.5772156649015329
              : NaN;
          }, [1, N], ySums, GREY, 1.3, [3, 4]);
        }

        sums.forEach(function (a, i) {
          point(ctx, f2, i + 1, a, 3, RED);
        });

        X.label(ctx, "Sₙ = Σₖ₌₁ⁿ aₖ",
          f2.L + 9, f2.T + 14, INK, "left", true);

        ctx.restore();
      }

      var lines;

      if (p === 0) {
        var ar = Math.abs(r);
        var test = ar < 1 ? "수렴" : "발산";

        lines = [
          "aₙ = rⁿ⁻¹,  Σₙ₌₁∞ aₙ = 1/(1−r) (|r|<1)",
          "N=" + N + ", S_N=" + show(s) +
            ", 합=" + (finite(sumLimit) ? show(sumLimit) : "없음"),
          "|S_N−S|=" + (
            finite(sumLimit)
              ? show(Math.abs(s - sumLimit))
              : "정의되지 않음"
          ),
          "공비 판정: |r|=" + show(ar, 2) + " → " + test + ".",
          ar === 1
            ? "비율판정 L=1은 결론 불가. 이 경우 aₙ이 0으로 가지 않으므로 발산합니다."
            : r === 0
              ? "r=0에서는 첫 항만 1입니다. 이후 모든 항은 0입니다."
              : "비율판정: lim|aₙ₊₁/aₙ|=|r|. L<1이면 절대수렴, L>1이면 발산합니다."
        ];

      } else if (p === 1) {
        lines = [
          "aₙ=1/n,  S_N=Σₙ₌₁ᴺ 1/n",
          "N=" + N + ", S_N=" + show(s) +
            ", 합=없음, 오차=정의되지 않음",
          "적분판정 / p-급수 판정: p=1 → 발산.",
          "아래 점선은 ln N + γ (γ≈0.577216)입니다. S_N−ln N→γ이지만 S_N은 무한히 증가합니다."
        ];

      } else if (p === 2) {
        lines = [
          "aₙ=1/n²,  Σₙ₌₁∞ 1/n²=π²/6",
          "N=" + N + ", S_N=" + show(s) +
            ", 정확한 합=" + show(sumLimit),
          "|S_N−π²/6|=" + show(Math.abs(sumLimit - s)),
          "p-급수 판정: p=2>1 → 수렴.",
          "항이 0으로 가는 것만으로는 급수의 수렴을 보장하지 않습니다. p=1과 비교해 보세요."
        ];

      } else if (p === 3) {
        var err = Math.abs(s - sumLimit);
        var bound = 1 / (N + 1);

        lines = [
          "aₙ=(−1)ⁿ⁺¹/n,  Σₙ₌₁∞ aₙ=ln 2",
          "N=" + N + ", S_N=" + show(s) +
            ", 정확한 합=" + show(sumLimit),
          "|S_N−ln 2|=" + show(err) +
            " ≤ 1/(N+1)=" + show(bound),
          "교대급수 판정: 1/n이 감소해 0으로 감 → 수렴(조건수렴).",
          "절댓값을 취한 급수 Σ1/n은 발산합니다. 다음 항의 크기가 오차의 상한입니다."
        ];

      } else {
        lines = [
          "aₙ=n/(n+1) → 1; 급수가 아니라 수열의 극한을 살펴봅니다.",
          "N=" + N + ", a_N=" + show(terms[N - 1]) +
            ", 극한=1, |a_N−1|=" + show(1 / (N + 1)),
          "S_N=해당 없음(수열); ε=" + show(eps, 2) +
            ", N(ε)=" + threshold,
          "모든 n≥" + threshold +
            "에서 |aₙ−1|=1/(n+1)<ε (엄격한 부등식).",
          "ε-정의: 임의의 ε>0에 대해 충분히 큰 n부터 모든 항이 ε-띠 안에 있습니다."
        ];
      }

      X.setLines(box, lines);
    }

    sync();
    draw();
  });

  // ============================================================
  // 2. Newton's method in one variable
  // ============================================================

  X.reg("newton1d", function (el, cfg) {
    cfg = cfg || {};
    window.V6.title(el, cfg.title || "Newton 방법: 접선과 수렴 속도");

    var cv = X.mkCanvas(el, 360), ctx = cv.ctx;
    var controls = X.h("div", "v6-controls");
    el.appendChild(controls);

    var box = X.stateBox(el);
    var p = integer(cfg.preset, 0, 3, 0);

    var defs = [
      {
        label: "x²−2",
        f: function (x) { return x * x - 2; },
        d: function (x) { return 2 * x; },
        start: 2,
        bracket: [0, 2],
        exact: "√2"
      },
      {
        label: "cos(x)−x",
        f: function (x) { return Math.cos(x) - x; },
        d: function (x) { return -Math.sin(x) - 1; },
        start: 1,
        bracket: [0, 1],
        exact: "cos α=α"
      },
      {
        label: "x³−2x+2",
        f: function (x) { return x * x * x - 2 * x + 2; },
        d: function (x) { return 3 * x * x - 2; },
        start: 0,
        bracket: [-3, -1],
        exact: "실근 α"
      },
      {
        label: "cbrt(x)",
        f: function (x) { return Math.cbrt(x); },
        d: function (x) {
          return x === 0
            ? NaN
            : 1 / (3 * Math.pow(Math.abs(x), 2 / 3));
        },
        start: 0.2,
        bracket: null,
        exact: "0"
      }
    ];

    var history = [], last = null, issue = "";
    var timer = null, root = NaN;

    X.select(controls, "함수",
      defs.map(function (d) { return d.label; }),
      p, function (v) {
        stop();
        p = integer(v, 0, 3, 0);
        reset(true);
      }
    );

    var xslider = X.slider(
      controls, "x₀", 0.2, 4, 0.05,
      clamp(cfg.x0, 0.2, 4, 2),
      function (v) {
        if (p === 0) {
          stop();
          history = [clamp(v, 0.2, 4, 2)];
          last = null;
          issue = "";
          draw();
        }
      }
    );

    X.btn(controls, "다음 단계", function () {
      stop();
      next();
    });

    X.btn(controls, "되돌리기", function () {
      stop();

      if (history.length > 1) history.pop();

      if (history.length > 1) {
        var x = history[history.length - 2], d = defs[p];
        last = {
          x: x,
          f: d.f(x),
          slope: d.d(x),
          next: history[history.length - 1]
        };
      } else {
        last = null;
      }

      issue = "";
      draw();
    });

    X.btn(controls, "처음으로", function () {
      stop();
      reset(false);
    });

    X.btn(controls, "10단계 자동재생", function () {
      stop();
      var count = 0;

      timer = window.setInterval(function () {
        if (!document.contains(el) || count++ >= 10 || !next()) {
          stop();
        }
      }, 200);
    });

    function stop() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function reset(changing) {
      var def = defs[p];

      root = def.bracket
        ? bisect(def.f, def.bracket[0], def.bracket[1], 80)
        : 0;

      xslider.input.disabled = p !== 0;

      history = [
        p === 0 ? clamp(xslider.get(), 0.2, 4, 2) : def.start
      ];

      last = null;
      issue = "";
      draw();
    }

    function next() {
      if (history.length >= 61) {
        issue = "표시는 최대 60단계까지 지원합니다.";
        draw();
        return false;
      }

      var d = defs[p];
      var x = history[history.length - 1];
      var f = d.f(x), slope = d.d(x);

      if (!finite(f) || !finite(slope) || Math.abs(slope) < 1e-14) {
        issue = "f 또는 f′가 정의되지 않거나 f′≈0이므로 Newton 단계를 계산할 수 없습니다.";
        draw();
        return false;
      }

      if (Math.abs(f) <= 1e-14) {
        issue = "현재 점이 수치 정밀도 내에서 근입니다.";
        draw();
        return false;
      }

      var xn = x - f / slope;

      if (!finite(xn) || Math.abs(xn) > 1e12) {
        issue = "다음 반복값의 크기가 너무 커서 계산을 중단했습니다.";
        draw();
        return false;
      }

      last = {
        x: x,
        f: f,
        slope: slope,
        next: xn
      };

      history.push(xn);
      issue = "";
      draw();
      return true;
    }

    function digits(err) {
      if (!finite(err)) return "—";
      return err <= 2e-15
        ? "≥14 (정밀도 한계)"
        : show(-Math.log10(err), 2);
    }

    function draw() {
      cv.clear();

      var d = defs[p];
      var xs = history.concat([root, 0]);
      var xr = bounds(xs, p === 3 ? 1.8 : 3.2);
      var ys = [0];

      for (var k = 0; k <= 160; k++) {
        var xx = xr[0] + (xr[1] - xr[0]) * k / 160;
        ys.push(d.f(xx));
      }

      if (last) ys.push(last.f, d.f(last.next));

      var yr = bounds(ys, 2);
      var fr = X.frame(ctx, cv.W, cv.H, xr, yr,
        { L: 49, R: 18, T: 21, B: 31 });

      X.curve(ctx, fr, d.f, xr, yr, INK, 2);

      if (last) {
        // Tangent at x_n.
        X.curve(ctx, fr, function (x) {
          return last.f + last.slope * (x - last.x);
        }, xr, yr, GREY, 1.3, [5, 4]);

        // Vertical connection from tangent intercept to f(x_{n+1}).
        segment(ctx, fr,
          last.next, 0,
          last.next, d.f(last.next),
          GREY, 1.4, [3, 3]);

        point(ctx, fr, last.next, 0, 4.2, GREY, false);
      }

      history.forEach(function (x, i) {
        point(ctx, fr, x, d.f(x),
          i === history.length - 1 ? 4.8 : 2.8, RED);
      });

      X.label(ctx, "f(x)=" + d.label,
        fr.L + 9, fr.T + 15, INK, "left", true);

      if (finite(root)) point(ctx, fr, root, 0, 4, INK, false);

      box.textContent = "";

      item(box, "div",
        "반복식: xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ); 기준 근 " +
        d.exact + " ≈ " + show(root, 10)
      );

      item(box, "div",
        "현재 n=" + (history.length - 1) +
        ", xₙ=" + show(history[history.length - 1], 9) +
        ", f(xₙ)=" + show(d.f(history[history.length - 1]), 8)
      );

      if (issue) item(box, "div", "계산 안내: " + issue);

      if (p === 2) {
        item(box, "div",
          "x₀=0이면 0→1→0의 2-주기에 빠집니다. 근이 존재해도 Newton 방법의 수렴은 보장되지 않습니다."
        );
      } else if (p === 3) {
        item(box, "div",
          "x≠0에서 Newton 식은 xₙ₊₁=−2xₙ입니다. 절댓값이 매번 2배로 커지고 f′(0)은 정의되지 않습니다."
        );
      } else {
        item(box, "div",
          "f가 근 α 부근에서 충분히 매끄럽고(예: f″이 α 부근에서 연속) f′(α)≠0이면, 초기값이 α에 충분히 가까운 경우 보통 이차수렴해 오차의 자릿수가 약 두 배로 늘어납니다."
        );
      }

      var caption = item(box, "div",
        "반복표 (오차=|xₙ−α|, 자릿수=−log₁₀ 오차; 수치 정밀도 제한)"
      );
      caption.style.marginTop = "7px";

      var table = X.h("table", "");
      var header = X.h("tr", "");

      ["n", "xₙ", "f(xₙ)", "|xₙ−α|", "−log₁₀ 오차"].forEach(
        function (s) { item(header, "th", s); }
      );
      table.appendChild(header);

      for (var i = Math.max(0, history.length - 16);
        i < history.length; i++) {

        var tr = X.h("tr", "");
        var v = history[i];
        var err = Math.abs(v - root);

        [
          String(i),
          show(v, 9),
          show(d.f(v), 8),
          show(err, 8),
          digits(err)
        ].forEach(function (s) {
          item(tr, "td", s);
        });

        table.appendChild(tr);
      }

      box.appendChild(table);
    }

    reset(true);
  });

  // ============================================================
  // 3. Newton's method for two nonlinear equations
  // ============================================================

  
  X.reg("newton2d", function (el, cfg) {
    cfg = cfg || {};
    window.V6.title(el, cfg.title || "2변수 Newton 방법과 도함수 행렬");
  
    var cv = X.mkCanvas(el, 380), ctx = cv.ctx;
    var controls = X.h("div", "v6-controls");
    var actions = X.h("div", "v6-controls");
    el.appendChild(controls);
    el.appendChild(actions);
    controls.style.display = "flex";
    controls.style.flexWrap = "wrap";
    controls.style.alignItems = "center";
    controls.style.gap = "8px";
    actions.style.display = "flex";
    actions.style.flexWrap = "nowrap";
    actions.style.alignItems = "center";
    actions.style.gap = "8px";
    actions.style.marginTop = "6px";
  
    var box = X.stateBox(el);
    var p = integer(cfg.preset, 0, 1, 0);
    var starts = [[1.5, 0.8], [1.5, 1.5]];
    var history = [], last = null, issue = "", solutions = [], view = null;
    var ROOT_TOL = 1e-9, DET_TOL = 1e-8, MAX_STEPS = 60;
    var INK = X.INK || "#1a1a1a", RED = X.RED || "#9e2b25";
  
    function sub(parent, text) {
      var s = document.createElement("sub");
      s.textContent = text;
      parent.appendChild(s);
      return s;
    }
    function mathLine(parent, before, subscript, after) {
      var d = X.h("div", "");
      d.style.margin = "4px 0";
      d.appendChild(document.createTextNode(before));
      sub(d, subscript);
      d.appendChild(document.createTextNode(after));
      parent.appendChild(d);
      return d;
    }
    function heading(parent, text) {
      var h = X.h("div", "");
      h.textContent = text;
      h.style.fontWeight = "600";
      h.style.marginTop = "10px";
      parent.appendChild(h);
    }
    function lineText(parent, text) {
      var d = X.h("div", "");
      d.textContent = text;
      d.style.margin = "3px 0";
      parent.appendChild(d);
    }
    function model(x, y) {
      return p === 0
        ? { f: [x*x+y*y-4, x*y-1], J: [[2*x,2*y],[y,x]] }
        : { f: [x*x-y-1, x+y*y-3], J: [[2*x,-1],[1,2*y]] };
    }
    function determinant(m) {
      return m.J[0][0]*m.J[1][1]-m.J[0][1]*m.J[1][0];
    }
    function residual(z) {
      var f = model(z[0],z[1]).f;
      return Math.hypot(f[0],f[1]);
    }
    function calculate(z) {
      var m=model(z[0],z[1]), D=determinant(m);
      if (!m.f.every(finite)||!finite(D)) return {ok:false,reason:"nonfinite"};
      if (Math.abs(D)<DET_TOL) return {ok:false,reason:"singular",det:D};
      var a=m.J[0][0],b=m.J[0][1],c=m.J[1][0],d=m.J[1][1];
      var out=[
        z[0]+(-m.f[0]*d+b*m.f[1])/D,
        z[1]+(-a*m.f[1]+m.f[0]*c)/D
      ];
      if (!out.every(finite)||Math.max(Math.abs(out[0]),Math.abs(out[1]))>=1e8)
        return {ok:false,reason:"unsafe"};
      return {ok:true,z:out};
    }
    function solve(initial) {
      var z=initial.slice();
      for (var i=0;i<80;i++) {
        var r=residual(z);
        if (!finite(r)) return null;
        if (r<ROOT_TOL) return z;
        var s=calculate(z);
        if (!s.ok) return null;
        z=s.z;
      }
      return residual(z)<ROOT_TOL?z:null;
    }
    function gridRoots() {
      var roots=[];
      for (var i=0;i<=20;i++) for (var j=0;j<=20;j++) {
        var z=solve([-5+i*0.5,-2.7+j*0.27]);
        if (!z||!z.every(finite)||residual(z)>=ROOT_TOL) continue;
        if (!roots.some(function(q){return Math.hypot(z[0]-q[0],z[1]-q[1])<1e-6;}))
          roots.push(z);
      }
      return roots.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
    }
    function updateRoots(){ solutions=gridRoots(); }
  
    X.select(controls,"연립방정식",["원 ∩ 쌍곡선","두 포물선"],p,function(v){
      p=integer(v,0,1,0);
      updateRoots();
      xs.set(starts[p][0]); ys.set(starts[p][1]); reset();
    });
    var xs=X.slider(controls,"x₀",-5,5,0.05,
      clamp(cfg.x0,-5,5,starts[p][0]),function(v){
        if(!ys)return;
        history=[[clamp(v,-5,5,starts[p][0]),clamp(ys.get(),-2.7,2.7,starts[p][1])]];
        last=null;issue="";draw();
      });
    var ys=X.slider(controls,"y₀",-2.7,2.7,0.05,
      clamp(cfg.y0,-2.7,2.7,starts[p][1]),function(v){
        history=[[clamp(xs.get(),-5,5,starts[p][0]),clamp(v,-2.7,2.7,starts[p][1])]];
        last=null;issue="";draw();
      });
  
    X.btn(actions,"다음 단계",function(){
      if(history.length>=MAX_STEPS+1){issue="최대 60회 반복까지 표시합니다.";draw();return;}
      var z=history[history.length-1],m=model(z[0],z[1]);
      if(Math.hypot(m.f[0],m.f[1])<ROOT_TOL){
        issue="현재 반복점의 잔차가 10⁻⁹ 미만입니다. 수치적 수렴 기준을 충족했습니다.";
        draw();return;
      }
      var s=calculate(z);
      if(!s.ok){
        issue=s.reason==="singular"
          ? "|det J|="+show(Math.abs(s.det))+"로, 수치적 중단 기준 10⁻⁸ 미만입니다."
          : s.reason==="unsafe"
            ? "다음 반복값이 유한하지 않거나 좌표 절댓값이 10⁸ 이상입니다."
            : "함수값 또는 행렬식을 유한한 수로 계산할 수 없습니다.";
        draw();return;
      }
      last={z:z.slice(),m:m,next:s.z.slice()};
      history.push(s.z);issue="";draw();
    });
    X.btn(actions,"되돌리기",function(){
      if(history.length>1)history.pop();
      last=null;
      if(history.length>1){
        var a=history[history.length-2],b=history[history.length-1];
        last={z:a.slice(),m:model(a[0],a[1]),next:b.slice()};
      }
      issue="";draw();
    });
    X.btn(actions,"처음으로",reset);
  
    function reset(){
      history=[[clamp(xs.get(),-5,5,starts[p][0]),clamp(ys.get(),-2.7,2.7,starts[p][1])]];
      last=null;issue="";draw();
    }
    function lineInBox(fr,m,z,k,xr,yr){
      var a=m.J[k][0],b=m.J[k][1],c=m.f[k]-a*z[0]-b*z[1],pts=[];
      if(Math.abs(b)>EPS)pts.push([xr[0],(-c-a*xr[0])/b],[xr[1],(-c-a*xr[1])/b]);
      if(Math.abs(a)>EPS)pts.push([(-c-b*yr[0])/a,yr[0]],[(-c-b*yr[1])/a,yr[1]]);
      pts=pts.filter(function(q){return q.every(finite)&&q[0]>=xr[0]-EPS&&q[0]<=xr[1]+EPS&&q[1]>=yr[0]-EPS&&q[1]<=yr[1]+EPS;});
      var best=null,dist=-1;
      for(var i=0;i<pts.length;i++)for(var j=i+1;j<pts.length;j++){
        var d=Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1]);
        if(d>dist){dist=d;best=[pts[i],pts[j]];}
      }
      if(best)segment(ctx,fr,best[0][0],best[0][1],best[1][0],best[1][1],INK,1.5,[5,4]);
    }
    function curve(fr,fn,a,b,n){
      ctx.save();fr.clip();ctx.beginPath();ctx.strokeStyle=INK;ctx.lineWidth=1.8;
      var active=false,prev=null;
      for(var i=0;i<=n;i++){
        var q=fn(a+(b-a)*i/n);
        if(!q||!q.every(finite)||Math.abs(q[0])>1e7||Math.abs(q[1])>1e7){active=false;prev=null;continue;}
        var px=fr.px(q[0]),py=fr.py(q[1]);
        if(active&&prev&&Math.hypot(px-prev[0],py-prev[1])<Math.max(cv.W,cv.H)*0.35)ctx.lineTo(px,py);
        else ctx.moveTo(px,py);
        active=true;prev=[px,py];
      }
      ctx.stroke();ctx.restore();
    }
    cv.c.addEventListener("click",function(ev){
      if(!view)return;
      var t=cv.pos(ev),fr=view.fr;
      if(t.x<fr.L||t.x>cv.W-fr.R||t.y<fr.T||t.y>cv.H-fr.B)return;
      var x=Math.round(clamp(fr.ix(t.x),-5,5,0)*20)/20;
      var y=Math.round(clamp(fr.iy(t.y),-2.7,2.7,0)*20)/20;
      xs.set(x);ys.set(y);history=[[x,y]];last=null;issue="";draw();
    });
    function draw(){
      cv.clear();
      var z=history[history.length-1],all=history.concat(solutions);
      if(last)all.push(last.next);
      var xlo=-2.7,xhi=2.7,ylo=-2.7,yhi=2.7;
      all.forEach(function(q){if(q.every(finite)){xlo=Math.min(xlo,q[0]-0.4);xhi=Math.max(xhi,q[0]+0.4);ylo=Math.min(ylo,q[1]-0.4);yhi=Math.max(yhi,q[1]+0.4);}});
      xlo=Math.max(-1e3,xlo);xhi=Math.min(1e3,xhi);ylo=Math.max(-1e3,ylo);yhi=Math.min(1e3,yhi);
      var L=49,R=17,T=23,B=28,scale=Math.min((cv.W-L-R)/(xhi-xlo),(cv.H-T-B)/(yhi-ylo),75);
      var cx=(xlo+xhi)/2,cy=(ylo+yhi)/2;
      var xr=[cx-(cv.W-L-R)/(2*scale),cx+(cv.W-L-R)/(2*scale)];
      var yr=[cy-(cv.H-T-B)/(2*scale),cy+(cv.H-T-B)/(2*scale)];
      var fr=X.frame(ctx,cv.W,cv.H,xr,yr,{L:L,R:R,T:T,B:B});view={fr:fr};
      if(p===0){
        curve(fr,function(t){return[2*Math.cos(t),2*Math.sin(t)];},0,2*Math.PI,260);
        curve(fr,function(x){return[x,1/x];},Math.max(0.18,xr[0]),xr[1],260);
        curve(fr,function(x){return[x,1/x];},xr[0],Math.min(-0.18,xr[1]),260);
      }else{
        curve(fr,function(x){return[x,x*x-1];},xr[0],xr[1],260);
        curve(fr,function(y){return[3-y*y,y];},yr[0],yr[1],260);
      }
      if(last)for(var k=0;k<2;k++)lineInBox(fr,last.m,last.z,k,xr,yr);
      solutions.forEach(function(q){point(ctx,fr,q[0],q[1],4,INK,false);});
      for(var j=1;j<history.length;j++)segment(ctx,fr,history[j-1][0],history[j-1][1],history[j][0],history[j][1],RED,2.1);
      history.forEach(function(q,i){point(ctx,fr,q[0],q[1],i===history.length-1?5:3,RED);});
      X.label(ctx,p===0?"F₁: x²+y²=4   F₂: xy=1":"F₁: y=x²−1   F₂: x=3−y²",fr.L+8,fr.T+15,INK,"left",true);
  
      box.textContent="";
      heading(box,"현재 반복");
      mathLine(box,"p","n"," = ("+show(z[0])+", "+show(z[1])+")");
      var m=model(z[0],z[1]),D=determinant(m),n=residual(z);
      lineText(box,"F = ("+show(m.f[0])+", "+show(m.f[1])+")");
      lineText(box,"잔차 ‖F‖₂ = "+show(n));
      heading(box,"Jacobian");
      lineText(box,"det J = "+show(D)+(Math.abs(D)<DET_TOL?" · |det J| < 10⁻⁸: 수치적 중단 기준":""));
      var table=X.h("table","");
      table.style.borderCollapse="collapse";
      table.style.margin="4px 0";
      table.style.fontFamily="serif";
      table.style.fontSize="16px";
      table.style.borderLeft="2px solid "+INK;
      table.style.borderRight="2px solid "+INK;
      m.J.forEach(function(row){
        var tr=X.h("tr","");
        row.forEach(function(v){var td=X.h("td","");td.textContent=show(v);td.style.padding="2px 12px";td.style.textAlign="center";tr.appendChild(td);});
        table.appendChild(tr);
      });
      box.appendChild(table);
      heading(box,"격자 탐색");
      var nearest=null,best=Infinity;
      solutions.forEach(function(q){var d=Math.hypot(z[0]-q[0],z[1]-q[1]);if(d<best){best=d;nearest=q;}});
      lineText(box,nearest?"가장 가까운 검출 근: ("+nearest.map(function(v){return show(v,8);}).join(", ")+"), 거리 "+show(best):"검출한 근이 없습니다. 근의 부재를 뜻하지는 않습니다.");
      lineText(box,"441개 초기점에서 서로 다른 근 "+solutions.length+"개를 검출했습니다. 모든 실근의 완전한 검출을 보장하지 않습니다.");
      heading(box,"별도 자동 진단");
      var predicted=solve(history[0]);
      lineText(box,predicted?"초기점에서 계산한 근: ("+predicted.map(function(v){return show(v,8);}).join(", ")+"), 잔차 "+show(residual(predicted)):"80회 안에 수렴하지 못했거나 수치적 중단 기준에 걸렸습니다.");
      lineText(box,"이 검사는 수동 반복 경로를 변경하지 않습니다.");
      if(issue)lineText(box,"계산 안내: "+issue);
    }
    updateRoots();
    reset();
  });
  

  // ============================================================
  // 4. Cobweb and fixed-point iteration
  // ============================================================

  
  X.reg("cobweb", function (el, cfg) {
    cfg=cfg||{};
    window.V6.title(el,cfg.title||"고정점 반복과 Cobweb 도표");
    var cv=X.mkCanvas(el,375),ctx=cv.ctx;
    var controls=X.h("div","v6-controls"),actions=X.h("div","v6-controls");
    el.appendChild(controls);el.appendChild(actions);
    [controls,actions].forEach(function(n){
      n.style.display="flex";n.style.flexWrap="wrap";n.style.alignItems="center";n.style.gap="8px";
    });
    actions.style.marginTop="6px";
    var box=X.stateBox(el),p=integer(cfg.preset,0,3,0);
    var r=clamp(cfg.r,0.5,4,3.2),hist=[],issue="";
    var ranges=[[0,1.5],[0,4],[-0.1,1.1],[-3,2]],starts=[1.2,0.4,0.2,1.1];
    var INK=X.INK||"#1a1a1a",RED=X.RED||"#9e2b25",GRID=X.GRID||"#e8e6e0";
    function heading(t){var n=X.h("div","");n.textContent=t;n.style.fontWeight="600";n.style.marginTop="9px";box.appendChild(n);}
    function lineText(t){var n=X.h("div","");n.textContent=t;n.style.margin="3px 0";box.appendChild(n);}
    function g(x){return p===0?Math.cos(x):p===1?x/2+1:p===2?r*x*(1-x):2.5-x*x;}
    function h(x){return g(x)-x;}
    function derivative(x){var e=1e-5*Math.max(1,Math.abs(x));return(g(x+e)-g(x-e))/(2*e);}
    function search(){
      var span=ranges[p],roots=[],N=1600,a=span[0],fa=h(a);
      function add(x){if(Number.isFinite(x)&&!roots.some(function(q){return Math.abs(q-x)<1e-6;}))roots.push(x);}
      if(Number.isFinite(fa)&&Math.abs(fa)<1e-10)add(a);
      for(var i=1;i<=N;i++){
        var b=span[0]+(span[1]-span[0])*i/N,fb=h(b);
        if(Number.isFinite(fb)&&Math.abs(fb)<1e-10)add(b);
        if(Number.isFinite(fa)&&Number.isFinite(fb)&&fa*fb<0){
          var lo=a,hi=b,flo=fa;
          for(var j=0;j<80;j++){
            var mid=(lo+hi)/2,fm=h(mid);
            if(!Number.isFinite(fm))break;
            if(Math.abs(fm)<1e-14||hi-lo<1e-13){lo=hi=mid;break;}
            if(flo*fm<=0)hi=mid;else{lo=mid;flo=fm;}
          }
          add((lo+hi)/2);
        }
        a=b;fa=fb;
      }
      return{roots:roots.sort(function(a,b){return a-b;}),span:span};
    }
    X.select(controls,"함수 g",["cos(x)","x/2+1","r·x(1−x)","2.5−x²"],p,function(v){
      p=integer(v,0,3,0);reset(true);
    });
    var xslider=X.slider(controls,"x₀",ranges[p][0],ranges[p][1],0.01,
      clamp(cfg.x0,ranges[p][0],ranges[p][1],starts[p]),function(v){
        hist=[v];issue="";draw();
      });
    var rslider=X.slider(controls,"r",0.5,4,0.05,r,function(v){
      r=clamp(v,0.5,4,3.2);hist=[xslider.get()];issue="";draw();
    });
    X.btn(actions,"다음 단계",function(){next(true);});
    X.btn(actions,"10단계",function(){for(var i=0;i<10;i++)if(!next(false))break;draw();});
    X.btn(actions,"처음으로",function(){reset(false);});
    function reset(changed){
      var rg=ranges[p];
      xslider.range(rg[0],rg[1],0.01);
      if(changed)xslider.set(starts[p]);
      rslider.input.disabled=p!==2;
      rslider.input.parentNode.style.display=p===2?"":"none";
      hist=[clamp(xslider.get(),rg[0],rg[1],starts[p])];
      issue="";draw();
    }
    function next(render){
      if(hist.length>=101){issue="수동 반복은 최대 100단계입니다.";if(render)draw();return false;}
      var y=g(hist[hist.length-1]);
      if(!Number.isFinite(y)||Math.abs(y)>1e9){issue="함숫값이 유효 범위를 벗어나 반복을 중단했습니다.";if(render)draw();return false;}
      hist.push(y);issue="";
      if(render)draw();
      return true;
    }
    function analyze(x0){
      var xs=[x0],x=x0,tol=1e-8;
      for(var i=0;i<500;i++){
        var y=g(x);
        if(!Number.isFinite(y)||Math.abs(y)>1e9)return{status:"발산 또는 수치 한계",detail:(i+1)+"회째에 유효한 값을 얻지 못했습니다."};
        xs.push(y);
        if(Math.abs(y-x)<tol*(1+Math.abs(y)))return{status:"고정점 근사 도달",detail:"자동 반복 "+(i+1)+"회, x≈"+show(y,9)};
        x=y;
        for(var q=2;q<=6&&q<xs.length-1;q++){
          var old=xs[xs.length-1-q],scale=1+Math.abs(y);
          if(Math.abs(y-old)<1e-7*scale){
            var ok=true;
            for(var z=1;z<=q;z++){
              var u=xs.length-1-z,v=u-q;
              if(v<0||Math.abs(xs[u]-xs[v])>1e-5*(1+Math.abs(xs[u]))){ok=false;break;}
            }
            if(ok)return{status:"주기 후보",detail:"근사 주기 "+q+"을 검출했습니다. 실제 주기의 증명은 아닙니다."};
          }
        }
      }
      return{status:"수렴 여부 미판정",detail:"500회 안에 판정 기준을 충족하지 못했습니다."};
    }
    function draw(){
      cv.clear();
      var rg=ranges[p],found=search(),roots=found.roots;
      var lo=rg[0],hi=rg[1];
      hist.concat(roots).forEach(function(x){
        if(Number.isFinite(x)){lo=Math.min(lo,x-0.1);hi=Math.max(hi,x+0.1);}
      });
      var fr=X.frame(ctx,cv.W,cv.H,[lo,hi],[lo,hi],{L:49,R:18,T:25,B:32});
      X.curve(ctx,fr,g,[lo,hi],[lo,hi],INK,2.1);
      X.curve(ctx,fr,function(x){return x;},[lo,hi],[lo,hi],INK,1.4,[5,4]);
      roots.forEach(function(x){point(ctx,fr,x,x,4.5,INK,false);});
      for(var i=0;i<hist.length-1;i++){
        var a=hist[i],b=hist[i+1];
        segment(ctx,fr,a,a,a,b,RED,1.8);
        segment(ctx,fr,a,b,b,b,RED,1.8);
      }
      var cur=hist[hist.length-1];
      if(cur>=lo&&cur<=hi)point(ctx,fr,cur,cur,4.5,RED);
      X.label(ctx,"y=g(x)",fr.L+8,fr.T+15,INK,"left",true);
      X.label(ctx,"y=x",fr.L+8,fr.T+33,INK,"left",true);
  
      box.textContent="";
      heading("수동 반복");
      lineText("단계: "+(hist.length-1));
      lineText("현재 x = "+show(cur,9));
      lineText("최근 값: "+hist.slice(-5).map(function(v){return show(v);}).join(" → "));
      if(cur<rg[0]||cur>rg[1])lineText("현재 값이 기준 구간 밖입니다. 반복값은 유지됩니다.");
      heading("고정점 탐색");
      lineText("탐색 구간: ["+show(rg[0])+", "+show(rg[1])+"] · 1600개 구간 표본");
      if(!roots.length)lineText("검출한 고정점이 없습니다. 근의 부재를 증명하는 것은 아닙니다.");
      else lineText("검출한 고정점: "+roots.map(function(x){return show(x,8);}).join(", ")+". 모든 근의 검출을 보장하지 않습니다.");
      heading("국소 안정성");
      roots.forEach(function(x){
        var slope=Math.abs(derivative(x));
        lineText("x*≈"+show(x,8)+", |g′(x*)|≈"+show(slope,6)+": "+
          (slope<1-1e-5?"국소적으로 끌림":slope>1+1e-5?"국소적으로 밀림":"경계 또는 수치상 불확실"));
      });
      lineText("|g′(x*)|<1은 미분 가능한 고정점 근방의 국소 수렴 조건이지, 모든 초기점의 수렴 보장은 아닙니다.");
      heading("별도 자동 진단");
      var auto=analyze(hist[0]);
      lineText(auto.status);
      lineText(auto.detail);
      lineText("자동 진단은 수동 반복 경로를 변경하지 않습니다.");
      if(p===0)lineText("cos(x)의 유일한 실수 고정점은 약 0.739085이며, 그 근방에서 수렴합니다.");
      if(p===1)lineText("x/2+1의 고정점은 x*=2입니다. 모든 실수 초기점에서 수렴합니다.");
      if(p===2)lineText("rx(1−x)의 고정점은 0과 1−1/r이며 도함수는 각각 r, 2−r입니다.");
      if(p===3)lineText("2.5−x²의 고정점은 (−1±√11)/2이며 두 점 모두 국소적으로 불안정합니다.");
      if(issue)lineText("계산 안내: "+issue);
    }
    reset(false);
  });
  
})();
(function(){
  "use strict";

  var X = window.V6X;
  if (!X || !window.V6) return;

  var INK = X.INK;
  var RED = X.RED;
  var GREY = X.GREY || "#777";
  var GRID = X.GRID;
  var TAU = 2 * Math.PI;
  var EPS = 1e-9;

  // ============================================================
  // Shared geometry, drawing and numeric helpers
  // ============================================================

  function finite(x, fallback) {
    return Number.isFinite(x) ? x : fallback;
  }

  function clamp(x, lo, hi, fallback) {
    return Math.max(lo, Math.min(hi, finite(Number(x), fallback)));
  }

  function fmt(x, n) {
    return Number.isFinite(x)
      ? X.fmt(x, n === undefined ? 4 : n)
      : "정의 안 됨";
  }

  function line(ctx, fr, x1, y1, x2, y2, color, width, dash) {
    ctx.save();
    ctx.strokeStyle = color || INK;
    ctx.lineWidth = width || 1.4;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    ctx.moveTo(fr.px(x1), fr.py(y1));
    ctx.lineTo(fr.px(x2), fr.py(y2));
    ctx.stroke();
    ctx.restore();
  }

  function poly(ctx, fr, points, color, width, dash, close, fill) {
    if (!points.length) return;

    ctx.save();
    ctx.strokeStyle = color || INK;
    ctx.lineWidth = width || 1.5;
    ctx.setLineDash(dash || []);
    ctx.beginPath();

    points.forEach(function(p, i) {
      if (i) ctx.lineTo(fr.px(p[0]), fr.py(p[1]));
      else ctx.moveTo(fr.px(p[0]), fr.py(p[1]));
    });

    if (close) ctx.closePath();

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    ctx.stroke();
    ctx.restore();
  }

  // 0: circle, 1: square, 2: triangle, 3: diamond.
  function marker(ctx, x, y, type, color, r) {
    r = r || 3.3;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    if (type === 0) {
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    } else if (type === 1) {
      ctx.rect(x - r, y - r, 2 * r, 2 * r);
      ctx.fill();
    } else if (type === 2) {
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.1, y + r);
      ctx.lineTo(x - r * 1.1, y + r);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(x, y - r * 1.3);
      ctx.lineTo(x + r * 1.3, y);
      ctx.lineTo(x, y + r * 1.3);
      ctx.lineTo(x - r * 1.3, y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  function tag(ctx, text, x, y, color, align) {
    X.label(ctx, text, x, y, color || INK, align || "left", false);
  }

  // Shortest signed angle from v1 to v2, using world coordinates.
  function arcArrow(ctx, fr, v1, v2, radius, color) {
    var n1 = Math.hypot(v1[0], v1[1]);
    var n2 = Math.hypot(v2[0], v2[1]);

    if (n1 < EPS || n2 < EPS) return;

    var start = Math.atan2(v1[1], v1[0]);
    var angle = Math.atan2(
      v1[0] * v2[1] - v1[1] * v2[0],
      v1[0] * v2[0] + v1[1] * v2[1]
    );

    if (Math.abs(angle) < 1e-6) return;

    var pts = [];

    for (var i = 0; i <= 24; i++) {
      var a = start + angle * i / 24;
      pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
    }

    poly(ctx, fr, pts, color, 1.2);

    var p = pts[pts.length - 2];
    var q = pts[pts.length - 1];

    X.arrow(
      ctx,
      fr.px(p[0]), fr.py(p[1]),
      fr.px(q[0]), fr.py(q[1]),
      color, 1.2, 5
    );
  }

  function txt2(v) {
    return "(" + fmt(v[0], 3) + ", " + fmt(v[1], 3) + ")";
  }

  function controlsFor(el) {
    var e = X.h("div", "v6-controls");
    el.appendChild(e);
    return e;
  }

  function squareFrame(ctx) {
    return X.frame(
      ctx, 360, 360, [-4, 4], [-4, 4],
      {L:33, R:27, T:30, B:30, nx:4, ny:4}
    );
  }

  // ============================================================
  // 1. Gradient descent and learning rate
  // ============================================================

  
  X.reg("gd-lr", function(el,cfg){
    cfg=cfg||{};
    window.V6.title(el,cfg.title||"경사하강법: 학습률과 조건수");
    var cv=X.mkCanvas(el,440),ctx=cv.ctx;
    var W=720;
    function layout(){
      var avail=el.clientWidth||720;
      var nW=Math.max(320,Math.min(720,Math.floor(avail)));
      var nH=(mode&&nW<620)?810:440;
      if(nW!==W||nH!==cv.H){W=nW;cv.setSize(W,nH);}
    }
    var rszT=null;window.addEventListener("resize",function(){if(rszT)clearTimeout(rszT);rszT=setTimeout(function(){layout();refresh();},150);});
    var controls=X.h("div","v6-controls"),actions=X.h("div","v6-controls");
    el.appendChild(controls);el.appendChild(actions);
    [controls,actions].forEach(function(n){
      n.style.display="flex";n.style.flexWrap="wrap";n.style.alignItems="center";n.style.gap="8px";
    });
    actions.style.marginTop="6px";
    var box=X.stateBox(el),mode=0,c=2,x0=3,kappa=10,custom=1.1,target=1e-6,MAX_STEPS=100000;
    function heading(t){var n=X.h("div","");n.textContent=t;n.style.fontWeight="600";n.style.marginTop="9px";box.appendChild(n);}
    function lineText(t){var n=X.h("div","");n.textContent=t;n.style.margin="3px 0";box.appendChild(n);}
    function sub(parent,t){var s=document.createElement("sub");s.textContent=t;parent.appendChild(s);}
    X.select(controls,"모드",["1변수: 학습률","2변수 (κ)"],0,function(v){mode=v;refresh();});
    var sc=X.slider(controls,"c",0.5,4,0.1,c,function(v){
      var product=custom*c;c=v;custom=product/c;
      sd.range(0,2.5/c,0.01/c);sd.set(custom);refresh();
    });
    var sx=X.slider(controls,"x₀",-4,4,0.1,x0,function(v){x0=v;refresh();});
    var sd=X.slider(controls,"α 직접",0,2.5/c,0.01/c,custom,function(v){custom=v;refresh();},
      function(v){return fmt(v,4)+" (2/c="+fmt(2/c,4)+")";});
    var sk=X.slider(controls,"κ",1,50,1,kappa,function(v){kappa=v;refresh();});
    function switchControls(){
      sc.input.parentNode.style.display=mode?"none":"";
      sx.input.parentNode.style.display=mode?"none":"";
      sd.input.parentNode.style.display=mode?"none":"";
      sk.input.parentNode.style.display=mode?"":"none";
    }
    function finiteN(x){return typeof x==="number"&&Number.isFinite(x);}
    function stepsText(n){return n===null?"10만 단계 내 미도달":n===Infinity?"유한 단계로 도달 불가":String(n);}
    function classify(alpha){
      var r=1-alpha*c,rho=Math.abs(r);
      if(alpha<0)return{r:r,rho:rho,kind:"invalid",label:"음의 학습률"};
      if(alpha===0)return{r:r,rho:rho,kind:"stationary",label:"정지"};
      if(alpha===1/c)return{r:0,rho:0,kind:"exact",label:"한 단계 정확 도달"};
      if(alpha>0&&alpha<2/c)return{r:r,rho:rho,kind:"converge",label:"수렴"};
      if(alpha===2/c)return{r:r,rho:rho,kind:"boundary",label:"경계: 진동"};
      return{r:r,rho:rho,kind:"diverge",label:"발산"};
    }
    function reachSim(f0,r){
      if(f0<target)return 0;
      if(r===0)return 1;
      if(!(Math.abs(r)<1))return Infinity;
      var f=f0,k=0;
      while(k<MAX_STEPS&&f>=target){f*=r*r;k++;if(!finiteN(f))return null;}
      return f<target?k:null;
    }
    function reachExact(f0,r){
      if(f0<target)return 0;
      if(r===0)return 1;
      var rho=Math.abs(r);
      if(!(rho<1))return Infinity;
      var lr=Math.log(rho),lf=Math.log(f0),lt=Math.log(target);
      var n=Math.max(0,Math.floor((lt-lf)/(2*lr))+1);
      function below(k){return lf+2*k*lr<lt;}
      while(!below(n)&&n<Number.MAX_SAFE_INTEGER)n++;
      while(n>0&&below(n-1))n--;
      return n;
    }
    function drawOneVariable(){
      var f0=c*x0*x0/2,alphas=[0.1/c,1/c,1.9/c,custom];
      var styles=[
        {color:INK,shape:0,label:"① 0.1/c"},
        {color:INK,shape:1,label:"② 1/c"},
        {color:INK,shape:2,label:"③ 1.9/c"},
        {color:RED,shape:3,label:"④ 직접"}
      ];
      var ymax=Math.max(1,9*c);
      var topT=W<560?58:34;
      var top=X.frame(ctx,W,225,[-4,4],[0,ymax],{L:48,R:20,T:topT,B:29,nx:8,ny:4});
      var narrow=W<560;
      ctx.save();ctx.font="12px 'Noto Sans KR',sans-serif";
      if(narrow){
        tag(ctx,"f(x)=½cx² · 반복 위치 xₖ",48,14);
        var w0=ctx.measureText(styles[0].label).width,w2=ctx.measureText(styles[2].label).width;
        var xc2=48+8+Math.max(w0,w2)+24;
        var lpos=[[48,29],[xc2,29],[48,43],[xc2,43]];
        styles.forEach(function(s,j){
          marker(ctx,lpos[j][0],lpos[j][1],j,s.color,3);tag(ctx,s.label,lpos[j][0]+8,lpos[j][1]+3,s.color);
        });
      }else{
        tag(ctx,"f(x)=½cx² · 반복 위치 xₖ",55,16);
        var lx=55+ctx.measureText("f(x)=½cx² · 반복 위치 xₖ").width+24;
        styles.forEach(function(s,j){
          marker(ctx,lx,16,j,s.color,3);tag(ctx,s.label,lx+8,19,s.color);
          lx+=8+ctx.measureText(s.label).width+18;
        });
      }
      ctx.restore();
      X.curve(ctx,top,function(x){return c*x*x/2;},[-4,4],[0,ymax],INK,1.6);
      var data=[],outside=false;
      alphas.forEach(function(alpha,j){
        var cl=classify(alpha),xs=[],logs=[];
        for(var k=0;k<=25;k++){
          var x=x0*Math.pow(cl.r,k);xs.push(x);
          var lf=f0===0||cl.r===0&&k>0?-Infinity:Math.log10(f0)+2*k*Math.log10(Math.abs(cl.r)||1);
          logs.push([k,lf]);
          if(Math.abs(x)>4)outside=true;
        }
        data.push({xs:xs,logs:logs,classification:cl});
        ctx.save();top.clip();var prev=null;
        for(var i=0;i<=12;i++){
          var xx=xs[i],yy=c*xx*xx/2;
          if(finiteN(yy)&&Math.abs(xx)<=4){
            if(prev)line(ctx,top,prev[0],prev[1],xx,yy,styles[j].color,0.9,j===3?[4,3]:[]);
            marker(ctx,top.px(xx),top.py(yy),styles[j].shape,styles[j].color,i===0?3.7:2.7);
            prev=[xx,yy];
          }else prev=null;
        }
        ctx.restore();
      });
      ctx.save();ctx.translate(0,235);
      var high=Math.max(2,f0>0?Math.log10(f0)+0.5:2);
      data.forEach(function(D){D.logs.forEach(function(q){if(finiteN(q[1]))high=Math.max(high,q[1]+0.5);});});
      high=Math.min(25,high);
      var bottom=X.frame(ctx,W,205,[0,25],[-13,high],{L:48,R:20,T:31,B:30,nx:5,ny:4});
      tag(ctx,"log₁₀ f(xₖ) · fₖ=0이면 로그 미정의",55,17);
      line(ctx,bottom,0,-6,25,-6,INK,1,[5,4]);ctx.save();bottom.clip();
      data.forEach(function(D,j){
        var prev=null;
        D.logs.forEach(function(q){
          if(finiteN(q[1])){
            if(prev)line(ctx,bottom,prev[0],prev[1],q[0],q[1],styles[j].color,j===3?1.7:1.2,j===3?[5,4]:[]);
            marker(ctx,bottom.px(q[0]),bottom.py(q[1]),styles[j].shape,styles[j].color,2.4);prev=q;
          }else prev=null;
        });
      });
      ctx.restore();ctx.restore();
  
      box.textContent="";
      heading("현재 상태");
      lineText("f₀ = "+fmt(f0,6)+", x₀ = "+fmt(x0,5)+", c = "+fmt(c,5));
      if(f0===0)lineText("초기점이 이미 최적점입니다. 모든 학습률에서 이 시작점은 0에 머뭅니다.");
      heading("수렴 조건");
      lineText("이 1변수 이차함수에서의 수렴 조건: 0 < α < 2/c = "+fmt(2/c,5));
      lineText("α=0: 정지 · α=1/c: 한 단계 정확 도달 · α=2/c: 비영 초기점에서 진동 · α>2/c: 최적점이 아닌 초기점에서 발산");
      heading("반복과 공식 비교");
      alphas.forEach(function(alpha,j){
        var cl=data[j].classification,sim=reachSim(f0,cl.r),exact=reachExact(f0,cl.r);
        var status=cl.label;
        if(f0===0)status+=" · 초기점에서 이미 목표 달성";
        else if(cl.kind==="boundary")status+=" · "+(f0<target?"이미 목표 달성":"함숫값 일정, 목표 미도달");
        else if(cl.kind==="stationary"&&f0>=target)status+=" · 초기값 유지";
        else if(cl.kind==="diverge"&&f0>=target)status+=" · 목표로 수렴하지 않음";
        lineText(styles[j].label+": α="+fmt(alpha,5)+", ρ="+fmt(cl.rho,5)+", "+status);
        lineText("단계(반복/공식) = "+stepsText(sim)+" / "+stepsText(exact)+
          (sim===exact?" · 일치":sim===null?" · 시뮬레이션 상한":" · 불일치: 반올림·언더플로·경계比較 가능"));
      });
      heading("그래프 안내");
      if(outside)lineText("일부 반복점이 x∈[−4,4] 밖으로 나갑니다. 위쪽 그래프에서 경로가 잘릴 수 있습니다.");
      lineText("목표는 fₖ<10⁻⁶입니다. 0<ρ<1이고 f₀≥10⁻⁶이면 최소 단계는 ⌊log(10⁻⁶/f₀)/(2logρ)⌋+1입니다.");
      lineText("공식은 로그를 이용한 이론 계산이고 반복은 부동소수점 계산이므로 경계 근처에서 차이가 날 수 있습니다.");
    }
    function drawTwoVariables(){
      var r=(kappa-1)/(kappa+1),alpha=2/(kappa+1),f0=(16+kappa)/2,pts=[];
      for(var j=0;j<=25;j++)pts.push([4*Math.pow(r,j),Math.pow(-r,j)]);
      var f1=(pts[1][0]*pts[1][0]+kappa*pts[1][1]*pts[1][1])/2;
      var wide=W>=620,fw=wide?W/2:W;
      ctx.save();ctx.translate(0,38);
      var left=X.frame(ctx,fw,360,[-9,9],[-9,9],{L:33,R:27,T:34,B:30,nx:4,ny:4});
      tag(ctx,"(x,y) 이론 경로",36,18);ctx.save();left.clip();
      [1,0.5,0.2,0.05].forEach(function(q){
        var f=f0*q,ax=Math.sqrt(2*f),by=Math.sqrt(2*f/kappa),ellipse=[];
        for(var z=0;z<=160;z++){var t=TAU*z/160;ellipse.push([ax*Math.cos(t),by*Math.sin(t)]);}
        poly(ctx,left,ellipse,GRID,1.2,[],true);
      });
      poly(ctx,left,pts,RED,1.8);
      pts.forEach(function(q,i){marker(ctx,left.px(q[0]),left.py(q[1]),0,i===0?INK:RED,i===0?4:2.5);});
      ctx.restore();ctx.restore();
      ctx.save();ctx.translate(wide?fw:0,wide?38:410);
      var log0=Math.log10(f0);
      var right=X.frame(ctx,fw,360,[0,25],[-13,Math.max(2,log0+0.5)],{L:47,R:14,T:34,B:30,nx:5,ny:4});
      tag(ctx,"log₁₀ f(xₖ,yₖ) · 이론값",50,18);
      line(ctx,right,0,-6,25,-6,INK,1,[4,4]);ctx.save();right.clip();
      var prev=null;
      for(var i=0;i<=25;i++){
        var lf=r===0&&i>0?-Infinity:log0+2*i*Math.log10(r||1);
        if(!finiteN(lf)){prev=null;continue;}
        if(prev)line(ctx,right,prev[0],prev[1],i,lf,RED,1.5);
        marker(ctx,right.px(i),right.py(lf),0,RED,2.5);prev=[i,lf];
      }
      ctx.restore();ctx.restore();
      box.textContent="";
      heading("현재 상태");
      lineText("f(x,y)=½(x²+κy²), 시작점 (4,1), κ="+fmt(kappa,0));
      lineText("최적 학습률 α*=2/(1+κ)="+fmt(alpha,6));
      heading("수렴 분석");
      lineText("좌표 배율: x는 "+fmt(r,6)+", y는 "+fmt(-r,6));
      lineText("실제 f₁/f₀="+fmt(f1/f0,7)+", 최악 방향 수축률 상한="+fmt(r*r,7));
      lineText(kappa===1?"κ=1이면 첫 단계에서 (0,0)에 도달합니다.":"κ>1이면 y 좌표의 부호가 번갈아 바뀌며 두 좌표 모두 수축합니다.");
      heading("그래프 안내");
      lineText("경로와 로그 그래프는 이론값입니다. f=0이면 로그를 그릴 수 없습니다.");
    }
    function refresh(){
      layout();switchControls();cv.clear();if(mode)drawTwoVariables();else drawOneVariable();
    }
    refresh();
  });
  

  // ============================================================
  // 2. Directional derivative
  // ============================================================

  X.reg("directional-derivative", function (el, cfg) {
  cfg = cfg || {};
  window.V6.title(el, cfg.title || "방향도함수와 기울기 벡터");

  var INK = "#1a1a1a";
  var RED = "#9e2b25";
  var WHITE = "#ffffff";
  var TAU = 2 * Math.PI;
  var EPS = 1e-10;

  var cv = X.mkCanvas(el, 375);
  var ctx = cv.ctx;
  var controls = controlsFor(el);
  var box = X.stateBox(el);

  if (cv.canvas && cv.canvas.style) {
    Object.assign(cv.canvas.style, {
      display: "block",
      width: "100%",
      maxWidth: "760px",
      height: "auto",
      margin: "0 auto",
      background: WHITE
    });
  }

  var sources = [
    "x^2+y^2",
    "x*y",
    "sin(x)+cos(y)",
    "x^2+x*y+2*y^2"
  ];

  var presetGradients = [
    function (x, y) { return [2*x, 2*y]; },
    function (x, y) { return [y, x]; },
    function (x, y) {
      return [Math.cos(x), -Math.sin(y)];
    },
    function (x, y) { return [2*x+y, x+4*y]; }
  ];

  var src = typeof cfg.f === "string" ? cfg.f : sources[3];
  var index = sources.indexOf(src);

  if (cfg.preset !== undefined &&
      Number.isFinite(Number(cfg.preset))) {
    index = Math.round(clamp(cfg.preset, 0, 3, 3));
    src = sources[index];
  }

  var options = sources.slice();

  if (index < 0) {
    options.push("사용자 지정: " + src.slice(0, 24));
    index = 4;
  }

  var a = clamp(cfg.a, -2, 2, 1);
  var b = clamp(cfg.b, -2, 2, 0.5);
  var deg = 45;

  X.select(controls, "함수 f", options, index, function (i) {
    index = i;
    refresh();
  });

  X.slider(controls, "점의 x좌표", -2, 2, 0.1, a, function (v) {
    a = v;
    refresh();
  });

  X.slider(controls, "점의 y좌표", -2, 2, 0.1, b, function (v) {
    b = v;
    refresh();
  });

  X.slider(controls, "방향 θ (°)", 0, 360, 1, deg, function (v) {
    deg = v;
    refresh();
  });

  function safeEval(f, x, y) {
    try {
      var v = f(x, y);
      return Number.isFinite(v)
        ? {ok: true, value: v}
        : {ok: false, error: "함수값이 유한하지 않습니다."};
    } catch (e) {
      return {
        ok: false,
        error: String(e && e.message || e)
      };
    }
  }

  function evaluateGradient(f, x, y, h) {
    var xp = safeEval(f, x+h, y);
    var xm = safeEval(f, x-h, y);
    var yp = safeEval(f, x, y+h);
    var ym = safeEval(f, x, y-h);

    if (!xp.ok || !xm.ok || !yp.ok || !ym.ok) {
      return {
        ok: false,
        error: "편도함수 계산 중 함수 평가에 실패했습니다. " +
          (!xp.ok ? "x+h: " + xp.error :
           !xm.ok ? "x−h: " + xm.error :
           !yp.ok ? "y+h: " + yp.error : "y−h: " + ym.error)
      };
    }

    var gx = (xp.value-xm.value)/(2*h);
    var gy = (yp.value-ym.value)/(2*h);

    if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
      return {
        ok: false,
        error: "중앙차분 결과가 유한하지 않습니다."
      };
    }

    return {ok: true, gradient: [gx, gy]};
  }

  function fmtVec(v, digits) {
    return "(" + fmt(v[0], digits) + ", " + fmt(v[1], digits) + ")";
  }

  function angleDeg(rad) {
    return ((rad*180/Math.PI)%360+360)%360;
  }

  function refresh() {
    cv.clear();

    ctx.save();
    ctx.fillStyle = WHITE;
    ctx.fillRect(
      0, 0,
      cv.canvas ? cv.canvas.width : 720,
      cv.canvas ? cv.canvas.height : 375
    );

    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    var expr = index < 4 ? sources[index] : src;
    var compiled;

    try {
      compiled = X.compile2(expr);
    } catch (e) {
      compiled = {err: String(e && e.message || e)};
    }

    if (!compiled || compiled.err ||
        typeof compiled.fn !== "function") {
      X.setLines(box, [
        "함수식을 해석할 수 없습니다: " +
          String(compiled && compiled.err || "입력 오류")
      ]);
      ctx.restore();
      return;
    }

    var f = compiled.fn;
    var f0r = safeEval(f, a, b);

    if (!f0r.ok) {
      X.setLines(box, [
        "기준점 p에서 함수를 평가할 수 없습니다.",
        "p = " + fmtVec([a, b], 2),
        f0r.error,
        "함수식과 기준점을 확인하세요."
      ]);
      ctx.restore();
      return;
    }

    var f0 = f0r.value;
    var h1 = 1e-4;
    var h2 = 5e-5;
    var g1 = evaluateGradient(f, a, b, h1);
    var g2 = evaluateGradient(f, a, b, h2);

    if (!g1.ok || !g2.ok) {
      X.setLines(box, [
        "수치미분을 계산할 수 없습니다.",
        !g1.ok ? g1.error : g2.error,
        "기준점 또는 함수의 정의역을 확인하세요."
      ]);
      ctx.restore();
      return;
    }

    var grad = g2.gradient;
    var errorX = Math.abs(g2.gradient[0]-g1.gradient[0]);
    var errorY = Math.abs(g2.gradient[1]-g1.gradient[1]);
    var errorEst = Math.hypot(errorX, errorY);
    var norm = Math.hypot(grad[0], grad[1]);
    var theta = deg*Math.PI/180;
    var u = [Math.cos(theta), Math.sin(theta)];
    var du = grad[0]*u[0]+grad[1]*u[1];
    var cosPhi = norm > EPS ? du/norm : null;

    if (cosPhi !== null) {
      cosPhi = Math.max(-1, Math.min(1, cosPhi));
    }

    var directionalStep = 1e-4;
    var fp = safeEval(
      f,
      a+directionalStep*u[0],
      b+directionalStep*u[1]
    );

    var differenceQuotient = null;
    var quotientError = null;

    if (fp.ok) {
      differenceQuotient = (fp.value-f0)/directionalStep;
      quotientError = Math.abs(differenceQuotient-du);

      if (!Number.isFinite(differenceQuotient)) {
        differenceQuotient = null;
        quotientError = null;
      }
    }

    var gradAngle = norm > EPS
      ? Math.atan2(grad[1], grad[0])
      : null;

    var maxDirection = gradAngle === null
      ? null
      : [Math.cos(gradAngle), Math.sin(gradAngle)];

    // 두 패널은 각각 한 번만 프레임을 생성한다.
    var panelW = 350;
    var panelH = 340;
    var top = 25;
    var leftX = 0;
    var rightX = 365;

    ctx.font = "12px sans-serif";
    ctx.fillStyle = INK;
    ctx.fillText("기울기와 방향", leftX+34, 16);
    ctx.fillText("방향도함수와 각도", rightX+35, 16);

    // 왼쪽 패널: translate 이후 X.frame을 정확히 한 번 호출.
    ctx.save();
    ctx.translate(leftX, top);

    var left = X.frame(
      ctx, panelW, panelH,
      [-3, 3], [-3, 3],
      {L: 38, R: 18, T: 25, B: 32, nx: 4, ny: 4}
    );

    left.clip();

    X.dot(ctx, left.px(a), left.py(b), 4, INK);

    // 빨강: 최대 증가 방향. 검정: 선택한 단위 방향.
    // 두 화살표는 비교를 위해 길이를 정규화한다.
    if (norm > EPS) {
      X.arrow(
        ctx,
        left.px(a), left.py(b),
        left.px(a+1.2*maxDirection[0]),
        left.py(b+1.2*maxDirection[1]),
        RED, 2.5, 8
      );

      X.arrow(
        ctx,
        left.px(a), left.py(b),
        left.px(a+1.2*u[0]),
        left.py(b+1.2*u[1]),
        INK, 2, 8
      );

      var tangent = [-maxDirection[1], maxDirection[0]];

      line(
        ctx, left,
        a-2.3*tangent[0], b-2.3*tangent[1],
        a+2.3*tangent[0], b+2.3*tangent[1],
        INK, 1, [4, 4]
      );
    } else {
      X.arrow(
        ctx,
        left.px(a), left.py(b),
        left.px(a+1.2*u[0]),
        left.py(b+1.2*u[1]),
        INK, 2, 8
      );
    }

    ctx.restore();

    // 오른쪽 패널: 기존 방향도함수 곡선.
    ctx.save();
    ctx.translate(rightX, top);

    var m = Math.max(1, norm*1.2);

    var right = X.frame(
      ctx, panelW, panelH,
      [0, TAU], [-m, m],
      {L: 43, R: 16, T: 25, B: 32, nx: 4, ny: 4}
    );

    right.clip();

    X.curve(
      ctx, right,
      function (q) {
        return grad[0]*Math.cos(q)+grad[1]*Math.sin(q);
      },
      [0, TAU], [-m, m],
      INK, 1.8
    );

    line(ctx, right, 0, 0, TAU, 0, INK, 1, [3, 4]);

    if (norm > EPS) {
      var maxAngle = (gradAngle+TAU)%TAU;
      var minAngle = (maxAngle+Math.PI)%TAU;

      line(
        ctx, right,
        maxAngle, 0, maxAngle, norm,
        RED, 1.3, [4, 3]
      );

      X.dot(ctx, right.px(maxAngle), right.py(norm), 4, RED);
      X.dot(ctx, right.px(minAngle), right.py(-norm), 4, RED);

      var perpendicular1 = (maxAngle+Math.PI/2)%TAU;
      var perpendicular2 = (maxAngle+3*Math.PI/2)%TAU;

      X.dot(
        ctx, right.px(perpendicular1), right.py(0), 3, INK
      );
      X.dot(
        ctx, right.px(perpendicular2), right.py(0), 3, INK
      );
    }

    X.dot(ctx, right.px(theta), right.py(du), 5, RED);

    ctx.restore();

    var analytic = index < 4 ? presetGradients[index](a, b) : null;
    var analyticError = analytic
      ? Math.hypot(analytic[0]-grad[0], analytic[1]-grad[1])
      : null;

    var lines = [
      "p = " + fmtVec([a, b], 3) + ", f(p) = " + fmt(f0, 6),
      "수치 기울기 ∇f ≈ " + fmtVec(grad, 7),
      "‖∇f‖ ≈ " + fmt(norm, 7) +
        " · 두 중앙차분 결과 차이 ≈ " + fmt(errorEst, 8),
      "u = (cos θ, sin θ) = " + fmtVec(u, 5) +
        " · θ = " + fmt(deg, 0) + "°",
      "Dᵤf = ∇f · u ≈ " + fmt(du, 7)
    ];

    if (analytic) {
      lines.push(
        "예제의 정확한 기울기 = " + fmtVec(analytic, 7) +
        " · 수치 오차 ≈ " + fmt(analyticError, 9)
      );
    }

    if (norm > EPS) {
      lines.push(
        "최대 증가 방향 uₘₐₓ = ∇f/‖∇f‖ ≈ " +
          fmtVec(maxDirection, 5)
      );
      lines.push(
        "Dᵤf = ‖∇f‖ cos φ, cos φ ≈ " + fmt(cosPhi, 6) +
          " · 최대값 = ‖∇f‖ ≈ " + fmt(norm, 7)
      );
      lines.push(
        "최소 방향은 −uₘₐₓ이며, 최소 방향도함수는 −‖∇f‖입니다."
      );
    } else {
      lines.push(
        "‖∇f‖ ≈ 0: 1차 근사에서는 모든 단위 방향의 " +
        "방향도함수가 약 0입니다."
      );
      lines.push(
        "이 경우 최대 증가 방향은 기울기로부터 유일하게 정할 수 없습니다."
      );
    }

    if (differenceQuotient !== null) {
      lines.push(
        "전진차분 검산: [f(p+tu)−f(p)]/t ≈ " +
          fmt(differenceQuotient, 7) +
          " · ∇f·u와의 차이 ≈ " + fmt(quotientError, 7)
      );
    } else {
      lines.push(
        "전진차분 검산은 p+tu에서 함수를 평가할 수 없어 생략했습니다."
      );
    }

    lines.push(
      "그림의 두 화살표는 방향 비교용으로 길이를 정규화했습니다. " +
      "빨강은 기울기 방향, 검정은 선택한 단위 방향입니다."
    );

    lines.push(
      "두 단계 중앙차분의 차이는 오차 추정 지표이며, " +
      "함수의 매끄러움이나 수치 상쇄에 따라 실제 오차와 다를 수 있습니다."
    );

    X.setLines(box, lines);
    ctx.restore();
  }

  refresh();
});

  // ============================================================
  // 3. Quadratic forms and eigenvalues
  // ============================================================

  X.reg("quadratic-form", function (el, cfg) {
  cfg = cfg || {};
  window.V6.title(el, cfg.title || "이차형식과 고유값");

  var INK = "#1a1a1a";
  var RED = "#9e2b25";
  var WHITE = "#ffffff";
  var TAU = 2*Math.PI;
  var EPS = 1e-9;

  var cv = X.mkCanvas(el, 375);
  var ctx = cv.ctx;
  var controls = controlsFor(el);
  var box = X.stateBox(el);

  if (cv.canvas && cv.canvas.style) {
    Object.assign(cv.canvas.style, {
      display: "block",
      width: "100%",
      maxWidth: "760px",
      height: "auto",
      margin: "0 auto",
      background: WHITE
    });
  }

  // Q(x,y) = ax² + 2bxy + cy²; A is symmetric.
  var presets = [
    [2, 0.5, 1],
    [-2, -0.5, -1],
    [1, 2, -1],
    [1, 0, 0],
    [0, 0, 0],
    [1.5, 1.2, 1.5]
  ];

  var a = clamp(cfg.a, -3, 3, 2);
  var b = clamp(cfg.b, -3, 3, 1);
  var c = clamp(cfg.c, -3, 3, 2);
  var locked = false;

  var presetSelect = X.select(
    controls,
    "예제",
    [
      "직접 조절",
      "양의 정부호",
      "음의 정부호",
      "부정부호",
      "준정부호",
      "영행렬",
      "회전된 주축"
    ],
    0,
    function (i) {
      if (i === 0) return;

      var p = presets[i-1];
      locked = true;
      a = p[0];
      b = p[1];
      c = p[2];

      sa.set(a);
      sb.set(b);
      sc.set(c);

      locked = false;
      refresh();
    }
  );

  var sa = X.slider(controls, "a", -3, 3, 0.1, a, function (v) {
    if (locked) return;
    a = v;
    refresh();
  });

  var sb = X.slider(controls, "b", -3, 3, 0.1, b, function (v) {
    if (locked) return;
    b = v;
    refresh();
  });

  var sc = X.slider(controls, "c", -3, 3, 0.1, c, function (v) {
    if (locked) return;
    c = v;
    refresh();
  });

  function fmtVec(v, digits) {
    return "(" + fmt(v[0], digits) + ", " + fmt(v[1], digits) + ")";
  }

  function eigenData(a, b, c) {
    var mid = (a+c)/2;
    var delta = Math.hypot((a-c)/2, b);
    var l1 = mid-delta;
    var l2 = mid+delta;

    var v2;

    if (delta <= 1e-14) {
      v2 = [1,0];
    } else {
      // Choose the numerically better of two equivalent eigenvector formulas.
      var cand1 = [b, l2-a];
      var cand2 = [l2-c, b];
      var n1 = Math.hypot(cand1[0], cand1[1]);
      var n2 = Math.hypot(cand2[0], cand2[1]);
      v2 = n1 >= n2 ? cand1 : cand2;

      var n = Math.hypot(v2[0], v2[1]);

      if (!(n > 1e-14) || !Number.isFinite(n)) {
        v2 = [1,0];
      } else {
        v2 = [v2[0]/n, v2[1]/n];
      }

      // Deterministic sign convention.
      if (Math.abs(v2[0]) >= Math.abs(v2[1]) ?
          v2[0] < 0 : v2[1] < 0) {
        v2 = [-v2[0], -v2[1]];
      }
    }

    var v1 = [-v2[1], v2[0]];

    return {
      l1:l1,
      l2:l2,
      v1:v1,
      v2:v2,
      delta:delta,
      trace:a+c,
      det:a*c-b*b
    };
  }

  function classify(l1, l2, tolerance) {
    var p = l1 > tolerance;
    var n = l2 < -tolerance;
    var zero1 = Math.abs(l1) <= tolerance;
    var zero2 = Math.abs(l2) <= tolerance;

    if (p && l2 > tolerance) {
      return {
        key:"positive-definite",
        text:"양의 정부호",
        detail:"모든 0이 아닌 z에서 Q(z) > 0입니다."
      };
    }

    if (l1 < -tolerance && n) {
      return {
        key:"negative-definite",
        text:"음의 정부호",
        detail:"모든 0이 아닌 z에서 Q(z) < 0입니다."
      };
    }

    if (l1 < -tolerance && l2 > tolerance) {
      return {
        key:"indefinite",
        text:"부정부호",
        detail:"Q(z)가 양수와 음수를 모두 취합니다."
      };
    }

    if (l1 >= -tolerance && l2 >= -tolerance) {
      if (zero1 && zero2) {
        return {
          key:"zero",
          text:"영행렬",
          detail:"모든 z에서 Q(z) = 0입니다."
        };
      }
      return {
        key:"positive-semidefinite",
        text:"양의 준정부호",
        detail:"모든 z에서 Q(z) ≥ 0이며, 영이 되는 비영 벡터가 존재합니다."
      };
    }

    if (l1 <= tolerance && l2 <= tolerance) {
      return {
        key:"negative-semidefinite",
        text:"음의 준정부호",
        detail:"모든 z에서 Q(z) ≤ 0이며, 영이 되는 비영 벡터가 존재합니다."
      };
    }

    return {
      key:"indefinite",
      text:"부정부호",
      detail:"Q(z)가 양수와 음수를 모두 취합니다."
    };
  }

  function refresh() {
    cv.clear();

    ctx.save();
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0,
      cv.canvas ? cv.canvas.width : 720,
      cv.canvas ? cv.canvas.height : 375);
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    var e = eigenData(a,b,c);
    var scale = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c),
      Math.abs(e.l1), Math.abs(e.l2));
    var tol = EPS*scale;
    var cl = classify(e.l1,e.l2,tol);

    function Q(x,y) {
      return a*x*x+2*b*x*y+c*y*y;
    }

    function Qtheta(t) {
      var x = Math.cos(t);
      var y = Math.sin(t);
      return Q(x,y);
    }

    // Two centered panels. Each panel uses its own local coordinate system.
    var panelW = 350;
    var panelH = 340;
    var top = 25;

    ctx.fillText("단위원과 고유벡터 주축", 34, 16);
    ctx.fillText("단위원 위의 Q(z)", 395, 16);

    ctx.save();
    ctx.translate(0,top);

    var left = X.frame(
      ctx, panelW, panelH,
      [-1.6,1.6], [-1.6,1.6],
      {L:37,R:18,T:25,B:32,nx:4,ny:4}
    );

    left.clip();

    var circle = [];
    for (var j=0; j<=240; j++) {
      var t = TAU*j/240;
      circle.push([Math.cos(t),Math.sin(t)]);
    }

    poly(ctx,left,circle,INK,1.2);

    // Each eigenvector is a principal axis, drawn as a full line.
    [
      {v:e.v1, lambda:e.l1, label:"v₁"},
      {v:e.v2, lambda:e.l2, label:"v₂"}
    ].forEach(function(item) {
      var dominant = Math.abs(item.lambda) > tol;
      var color = item.lambda < -tol ? RED : INK;
      var v = item.v;

      line(
        ctx,left,
        -1.42*v[0],-1.42*v[1],
         1.42*v[0], 1.42*v[1],
        color,1.4,[5,4]
      );

      X.arrow(
        ctx,left,
        left.px(0),left.py(0),
        left.px(v[0]),left.py(v[1]),
        color,2,8
      );

      X.dot(ctx,left.px(v[0]),left.py(v[1]),3,color);
      X.dot(ctx,left.px(-v[0]),left.py(-v[1]),3,color);
    });

    ctx.restore();

    ctx.save();
    ctx.translate(365,top);

    var pad = Math.max(0.35, (e.l2-e.l1)*0.16);
    var ymin = Math.min(e.l1,0)-pad;
    var ymax = Math.max(e.l2,0)+pad;

    if (ymax-ymin < 0.7) {
      ymin -= 0.35;
      ymax += 0.35;
    }

    var right = X.frame(
      ctx,panelW,panelH,
      [0,TAU],[ymin,ymax],
      {L:42,R:16,T:25,B:32,nx:4,ny:4}
    );

    right.clip();

    X.curve(
      ctx,right,Qtheta,
      [0,TAU],[ymin,ymax],
      INK,1.8
    );

    line(ctx,right,0,0,TAU,0,INK,1,[3,4]);
    line(ctx,right,0,e.l1,TAU,e.l1,RED,1,[5,4]);
    line(ctx,right,0,e.l2,TAU,e.l2,INK,1,[5,4]);

    var t1 = (Math.atan2(e.v1[1],e.v1[0])+TAU)%TAU;
    var t2 = (Math.atan2(e.v2[1],e.v2[0])+TAU)%TAU;

    [t1,(t1+Math.PI)%TAU].forEach(function(t) {
      X.dot(ctx,right.px(t),right.py(Qtheta(t)),4,RED);
    });

    [t2,(t2+Math.PI)%TAU].forEach(function(t) {
      X.dot(ctx,right.px(t),right.py(Qtheta(t)),4,INK);
    });

    ctx.restore();
    ctx.restore();

    // Dense sampling is a visual/numerical cross-check, not the proof
    // of the classification. Eigenvalues determine the exact classification.
    var sampleMin = Infinity;
    var sampleMax = -Infinity;
    var sampleOK = true;

    for (var k=0;k<4096;k++) {
      var value = Qtheta(TAU*k/4096);

      if (!Number.isFinite(value)) {
        sampleOK = false;
        break;
      }

      sampleMin = Math.min(sampleMin,value);
      sampleMax = Math.max(sampleMax,value);
    }

    var minError = sampleOK ? Math.abs(sampleMin-e.l1) : NaN;
    var maxError = sampleOK ? Math.abs(sampleMax-e.l2) : NaN;

    X.setLines(box, [
      "A = [[ " + fmt(a,3) + ", " + fmt(b,3) +
        " ], [ " + fmt(b,3) + ", " + fmt(c,3) +
        " ]] · Q(x,y) = ax² + 2bxy + cy²",
      "고유값: λ₁ = " + fmt(e.l1,8) +
        " ≤ λ₂ = " + fmt(e.l2,8),
      "단위 고유벡터: v₁ = " + fmtVec(e.v1,6) +
        ", v₂ = " + fmtVec(e.v2,6),
      "det(A) = " + fmt(e.det,8) +
        " · tr(A) = " + fmt(e.trace,8),
      "분류: " + cl.text,
      cl.detail,
      "고유벡터 축에서 Q(v₁) = λ₁ = " + fmt(e.l1,8) +
        ", Q(v₂) = λ₂ = " + fmt(e.l2,8),
      sampleOK
        ? "4096개 단위원 표본: min ≈ " + fmt(sampleMin,8) +
          ", max ≈ " + fmt(sampleMax,8)
        : "단위원 표본 계산에서 유한하지 않은 값이 발생했습니다.",
      sampleOK
        ? "표본과 고유값의 차이: " + fmt(minError,8) +
          " / " + fmt(maxError,8) +
          " · 표본은 검산용이며 분류의 근거는 고유값입니다."
        : "표본 검산을 완료하지 못했습니다.",
      "임계점의 Hessian이 H = 2A인 경우, 양의 정부호면 엄격한 국소 최소, " +
        "음의 정부호면 엄격한 국소 최대, 부정부호면 안장점입니다.",
      "준정부호 또는 영행렬이면 Hessian의 2차 판정만으로 " +
        "일반적인 극값 결론을 내릴 수 없습니다."
    ]);

    ctx.restore();
  }

  refresh();
});

  // ============================================================
  // 4. Linear map, determinant and signed area
  // ============================================================

  
  X.reg("linear-map",function(el,cfg){
    cfg=cfg||{};
    window.V6.title(el,cfg.title||"선형변환 M: 격자, 넓이, 행렬식");
    var cv=X.mkCanvas(el,375),ctx=cv.ctx;
    var controls=X.h("div","v6-controls"),actions=X.h("div","v6-controls");
    el.appendChild(controls);el.appendChild(actions);
    [controls,actions].forEach(function(n){
      n.style.display="flex";n.style.flexWrap="wrap";n.style.alignItems="center";n.style.gap="8px";
    });
    actions.style.marginTop="6px";
    var box=X.stateBox(el);
    var WHITE="#ffffff",INK="#1a1a1a",RED="#9e2b25",GRID="#e8e6e0";
    var a=1,b=0,c=0,d=1,locked=false,showGrid=true,DET_EPS=1e-9;
    var presets=[
      [1,0,0,1],
      [Math.sqrt(3)/2,-0.5,0.5,Math.sqrt(3)/2],
      [1,1,0,1],[-1,0,0,1],[1.5,0,0,0.5],[1,2,2,4]
    ];
    function heading(t){
      var n=X.h("div","");n.textContent=t;n.style.fontWeight="600";n.style.marginTop="9px";box.appendChild(n);
    }
    function lineText(t){
      var n=X.h("div","");n.textContent=t;n.style.margin="3px 0";box.appendChild(n);
    }
    function sci(x){
      if(x===0)return "0";
      return x.toExponential(1).replace("e-"," × 10⁻").replace("e+"," × 10⁺");
    }
    function transform(x,y){return[a*x+b*y,c*x+d*y];}
    function changed(which,v){
      if(locked)return;
      if(which===0)a=v;else if(which===1)b=v;else if(which===2)c=v;else d=v;
      refresh();
    }
    X.select(controls,"예제",[
      "직접 조절","항등변환","30° 회전","전단","반사","축방향 확대","특이행렬"
    ],1,function(i){
      if(!i)return;
      locked=true;
      var q=presets[i-1];a=q[0];b=q[1];c=q[2];d=q[3];
      [sa,sb,sc,sd].forEach(function(s){s.input.step=i===2?"any":"0.1";});
      sa.set(a);sb.set(b);sc.set(c);sd.set(d);
      locked=false;refresh();
    });
    var sa=X.slider(controls,"a",-4,4,0.1,a,function(v){changed(0,v);},function(v){return fmt(v,4);});
    var sb=X.slider(controls,"b",-4,4,0.1,b,function(v){changed(1,v);},function(v){return fmt(v,4);});
    var sc=X.slider(controls,"c",-4,4,0.1,c,function(v){changed(2,v);},function(v){return fmt(v,4);});
    var sd=X.slider(controls,"d",-4,4,0.1,d,function(v){changed(3,v);},function(v){return fmt(v,4);});
    X.btn(actions,"격자 숨기기",function(){showGrid=false;refresh();});
    X.btn(actions,"격자 보이기",function(){showGrid=true;refresh();});
  
    function drawPanel(offset,title,points,transformed){
      ctx.save();
      ctx.translate(offset,10);
  
      var maxAbs=2;
      points.forEach(function(q){
        maxAbs=Math.max(maxAbs,Math.abs(q[0]),Math.abs(q[1]));
      });
      var half=Math.min(1e6,Math.max(2,maxAbs*1.3));
      var fr=X.frame(ctx,360,360,[-half,half],[-half,half],{
        L:36,R:24,T:35,B:31,nx:4,ny:4
      });
      // Only erase the plotting rectangle. Labels and surrounding UI remain intact.
      if(!showGrid){
        ctx.save();
        ctx.beginPath();
        ctx.rect(fr.L,fr.T,360-fr.L-fr.R,360-fr.T-fr.B);
        ctx.clip();
        ctx.fillStyle="#ffffff";
        ctx.fillRect(fr.L,fr.T,360-fr.L-fr.R,360-fr.T-fr.B);
        ctx.strokeStyle=INK;ctx.lineWidth=1.1;ctx.beginPath();
        if(fr.px(0)>=fr.L&&fr.px(0)<=360-fr.R){
          ctx.moveTo(fr.px(0),fr.T);ctx.lineTo(fr.px(0),360-fr.B);
        }
        if(fr.py(0)>=fr.T&&fr.py(0)<=360-fr.B){
          ctx.moveTo(fr.L,fr.py(0));ctx.lineTo(360-fr.R,fr.py(0));
        }
        ctx.stroke();ctx.restore();
      }
      tag(ctx,title,38,19,INK);
  
      if(showGrid){
        ctx.save();fr.clip();
        if(transformed){
          for(var j=-4;j<=4;j++){
            var s=transform(j,-4),t=transform(j,4);
            line(ctx,fr,s[0],s[1],t[0],t[1],GRID,1.1);
            s=transform(-4,j);t=transform(4,j);
            line(ctx,fr,s[0],s[1],t[0],t[1],GRID,1.1);
          }
        }else{
          for(var k=-4;k<=4;k++){
            line(ctx,fr,k,-4,k,4,GRID,1.1);
            line(ctx,fr,-4,k,4,k,GRID,1.1);
          }
        }
        ctx.restore();
      }
  
      ctx.save();fr.clip();
      poly(ctx,fr,points,INK,1.7,[],true,WHITE);
      if(!transformed){
        X.arrow(ctx,fr.px(0),fr.py(0),fr.px(1),fr.py(0),INK,2.4,8);
        X.arrow(ctx,fr.px(0),fr.py(0),fr.px(0),fr.py(1),RED,2.4,8);
        tag(ctx,"e₁",fr.px(1)+5,fr.py(0)-8,INK);
        tag(ctx,"e₂",fr.px(0)+7,fr.py(1)-5,RED);
      }else{
        var e1=transform(1,0),e2=transform(0,1);
        X.arrow(ctx,fr.px(0),fr.py(0),fr.px(e1[0]),fr.py(e1[1]),INK,2.4,8);
        X.arrow(ctx,fr.px(0),fr.py(0),fr.px(e2[0]),fr.py(e2[1]),RED,2.4,8);
        tag(ctx,"Me₁",fr.px(e1[0])+5,fr.py(e1[1])-8,INK);
        tag(ctx,"Me₂",fr.px(e2[0])+5,fr.py(e2[1])-8,RED);
      }
      ctx.restore();ctx.restore();
    }
  
    function refresh(){
      cv.clear();
      var D=a*d-b*c;
      var singular=Math.abs(D)<DET_EPS;
      var E1=transform(1,0),E2=transform(0,1),E12=transform(1,1);
      var original=[[0,0],[1,0],[1,1],[0,1]];
      var image=[[0,0],E1,E12,E2];
  
      drawPanel(0,"원래 평면 · 단위 정사각형",original,false);
      drawPanel(360,"상: M(x,y)",image,true);
  
      var signedArea=0;
      for(var i=0;i<4;i++){
        var q=image[i],w=image[(i+1)%4];
        signedArea+=q[0]*w[1]-w[0]*q[1];
      }
      signedArea/=2;
      var area=Math.abs(signedArea);
      box.textContent="";
      heading("행렬과 기저벡터");
      lineText("M = [["+fmt(a,5)+", "+fmt(b,5)+"], ["+fmt(c,5)+", "+fmt(d,5)+"]]");
      lineText("Me₁ = "+txt2(E1));
      lineText("Me₂ = "+txt2(E2));
      heading("행렬식과 방향");
      lineText("det M = ad − bc = "+fmt(D,9));
      lineText("방향: "+(singular?"퇴화 (수치적으로 특이)":D>0?"방향 보존":"방향 반전"));
      lineText("판정 기준: |det M| < "+sci(DET_EPS));
      heading("넓이 검산");
      lineText("신발끈 부호 넓이 = "+fmt(signedArea,9));
      lineText("실제 넓이 = "+fmt(area,9)+", |det M| = "+fmt(Math.abs(D),9));
      lineText("부호 넓이와 det M의 차이 = "+fmt(Math.abs(signedArea-D),12));
      heading("역행렬");
      lineText(singular
        ?"역행렬 없음: |det M| < "+sci(DET_EPS)+"이므로 이 위젯에서 수치적으로 특이하다고 분류합니다."
        :"M⁻¹ = (1/det M) [["+fmt(d,5)+", "+fmt(-b,5)+"], ["+fmt(-c,5)+", "+fmt(a,5)+"]]");
      heading("표시 상태");
      lineText("격자: "+(showGrid?"표시":"숨김"));
      lineText("직접 조절을 선택하면 현재 행렬을 유지한 채 계수를 편집합니다.");
      lineText("좌표 범위는 원래 정사각형과 변환된 정사각형의 꼭짓점을 기준으로 조정합니다.");
    }
    refresh();
  });
  

  // ============================================================
  // 5. Dot product, projection and inequalities
  // ============================================================

  X.reg("dot-product", function(el, cfg) {
    cfg = cfg || {};

    window.V6.title(
      el,
      cfg.title || "내적·사영·코시–슈바르츠 부등식"
    );

    var cv = X.mkCanvas(el, 375);
    var ctx = cv.ctx;
    var controls = controlsFor(el);
    var box = X.stateBox(el);

    var lenU = 2.7;
    var angleU = 25;
    var lenV = 3.2;
    var angleV = 110;

    X.slider(
      controls, "‖u‖", 0.5, 4, 0.1, lenU,
      function(v) {
        lenU = v;
        refresh();
      }
    );

    X.slider(
      controls, "u 각도", 0, 360, 1, angleU,
      function(v) {
        angleU = v;
        refresh();
      }
    );

    X.slider(
      controls, "‖v‖", 0.5, 4, 0.1, lenV,
      function(v) {
        lenV = v;
        refresh();
      }
    );

    X.slider(
      controls, "v 각도", 0, 360, 1, angleV,
      function(v) {
        angleV = v;
        refresh();
      }
    );

    function refresh() {
      cv.clear();

      var ua = angleU * Math.PI / 180;
      var va = angleV * Math.PI / 180;

      var u = [
        lenU * Math.cos(ua),
        lenU * Math.sin(ua)
      ];

      var v = [
        lenV * Math.cos(va),
        lenV * Math.sin(va)
      ];

      var dot = u[0] * v[0] + u[1] * v[1];
      var cosTheta = dot / (lenU * lenV);

      var projectionCoefficient = dot / (lenU * lenU);

      var projection = [
        projectionCoefficient * u[0],
        projectionCoefficient * u[1]
      ];

      var perpendicular = [
        v[0] - projection[0],
        v[1] - projection[1]
      ];

      var perpendicularDot =
        u[0] * perpendicular[0] +
        u[1] * perpendicular[1];

      var dotTrig =
        lenU * lenV * Math.cos(va - ua);

      var theta = Math.acos(
        clamp(cosTheta, -1, 1, 0)
      ) * 180 / Math.PI;

      var absDot = Math.abs(dot);
      var csBound = lenU * lenV;

      var sumNorm = Math.hypot(
        u[0] + v[0],
        u[1] + v[1]
      );

      var triangleBound = lenU + lenV;

      ctx.save();
      ctx.translate(0, 10);

      var left = X.frame(
        ctx, 360, 360,
        [-4.5, 4.5], [-4.5, 4.5],
        {L:33, R:27, T:30, B:30, nx:3, ny:3}
      );

      tag(ctx, "u, v와 직교 사영", 36, 16);

      left.clip();

      // Projection is parallel to u.
      line(
        ctx, left,
        0, 0,
        projection[0], projection[1],
        GREY, 5
      );

      // The residual component is perpendicular to u.
      line(
        ctx, left,
        projection[0], projection[1],
        v[0], v[1],
        GREY, 1.3, [5, 4]
      );

      X.arrow(
        ctx,
        left.px(0), left.py(0),
        left.px(u[0]), left.py(u[1]),
        INK, 2.7, 9
      );

      X.arrow(
        ctx,
        left.px(0), left.py(0),
        left.px(v[0]), left.py(v[1]),
        RED, 2.7, 9
      );

      arcArrow(ctx, left, u, v, 0.65, GREY);

      X.dot(
        ctx,
        left.px(projection[0]),
        left.py(projection[1]),
        3.8, GREY
      );

      tag(
        ctx, "u",
        left.px(u[0]) + 6,
        left.py(u[1]) - 5,
        INK
      );

      tag(
        ctx, "v",
        left.px(v[0]) + 6,
        left.py(v[1]) - 5,
        RED
      );

      ctx.restore();
      ctx.translate(360, 0);

      // Right: two comparisons using common horizontal scale.
      var bound = Math.max(csBound, triangleBound);

      var right = X.frame(
        ctx, 360, 360,
        [0, bound * 1.14], [0, 4.2],
        {L:47, R:19, T:30, B:30, nx:4, ny:4}
      );

      tag(ctx, "부등식: 측정값 ≤ 한계값", 49, 16);

      function bar(y, value, color) {
        var x = right.px(0);
        var width = right.px(Math.max(0, value)) - x;

        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(
          x,
          right.py(y) - 7,
          Math.max(0, width),
          14
        );
        ctx.restore();
      }

      right.clip();

      // Clamp only the visual width against floating-point
      // overshoot. Displayed numbers remain unmodified.
      bar(3.4, csBound, "rgba(26,26,26,0.20)");
      bar(3.0, Math.min(absDot, csBound), RED);

      bar(1.65, triangleBound, "rgba(26,26,26,0.20)");
      bar(1.25, Math.min(sumNorm, triangleBound), INK);

      ctx.restore();

      tag(
        ctx, "|u·v|",
        53, right.py(3.0) - 11,
        RED
      );

      tag(
        ctx, "‖u‖‖v‖",
        53, right.py(3.4) - 11,
        GREY
      );

      tag(
        ctx, "‖u+v‖",
        53, right.py(1.25) - 11,
        INK
      );

      tag(
        ctx, "‖u‖+‖v‖",
        53, right.py(1.65) - 11,
        GREY
      );

      ctx.restore();

      X.setLines(box, [
        "u=" + txt2(u) +
          ", v=" + txt2(v) +
          ", 두 벡터 사이각 θ=" + fmt(theta, 3) + "°",

        "u·v (성분 합)=" + fmt(dot, 8) +
          ", ‖u‖‖v‖cosθ=" + fmt(dotTrig, 8) +
          ", 차이=" + fmt(Math.abs(dot - dotTrig), 10),

        "projᵤ v=" + txt2(projection) +
          ", 계수 (u·v)/‖u‖²=" +
          fmt(projectionCoefficient, 6),

        "v−projᵤ v=" + txt2(perpendicular) +
          ", u·(v−projᵤ v)=" +
          fmt(perpendicularDot, 10),

        "u ⟂ v? " +
          (absDot < 1e-9 ? "예" : "아니요") +
          ", 코시–슈바르츠 비율 |u·v|/(‖u‖‖v‖)=" +
          fmt(absDot / csBound, 8),

        "|u·v|=" + fmt(absDot, 6) +
          " ≤ ‖u‖‖v‖=" + fmt(csBound, 6) +
          ", ‖u+v‖=" + fmt(sumNorm, 6) +
          " ≤ ‖u‖+‖v‖=" + fmt(triangleBound, 6),

        "사영은 v를 u 방향 성분과 직교 성분으로 분해합니다. " +
          "코시–슈바르츠의 등호는 두 벡터가 평행할 때 성립합니다."
      ]);
    }

    refresh();
  });


/* ---- surface3d: 3D wireframe surface + contour panel (ChatGPT-authored engine) ---- */

X.reg("surface3d", function(el, cfg) {
  "use strict";

  cfg = cfg || {};

  var INK = V6.INK || "#1a1a1a";
  var RED = V6.RED || "#9e2b25";
  var GRID = V6.GRID || "#e8e6e0";
  var FONT = '"Noto Sans KR", sans-serif';
  var TAU = Math.PI * 2;
  var PI = Math.PI;

  function finite(v) {
    return typeof v === "number" && Number.isFinite(v);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function number(v, fallback) {
    var n = Number(v);
    return finite(n) ? n : fallback;
  }

  function fmt(v) {
    if (!finite(v)) return "정의되지 않음";
    if (Math.abs(v) < 5e-9) v = 0;
    if (v !== 0 && (Math.abs(v) >= 10000 || Math.abs(v) < 0.0001)) {
      return v.toExponential(2);
    }
    return String(Number(v.toFixed(4)));
  }

  function signed(v) {
    return v < -5e-9
      ? " − " + fmt(-v)
      : " + " + fmt(Math.abs(v));
  }

  function range(raw, fallback) {
    if (!Array.isArray(raw) || raw.length < 2) return fallback.slice();
    var a = Number(raw[0]);
    var b = Number(raw[1]);
    return finite(a) && finite(b) && a < b
      ? [a, b]
      : fallback.slice();
  }

  function rgba(hex, opacity) {
    var h = hex.replace("#", "");
    if (h.length === 3) {
      h = h.split("").map(function(c) { return c + c; }).join("");
    }
    var n = parseInt(h, 16);
    if (!finite(n)) return hex;
    return "rgba(" +
      ((n >> 16) & 255) + "," +
      ((n >> 8) & 255) + "," +
      (n & 255) + "," +
      clamp(opacity, 0, 1) + ")";
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // The previous instance is explicitly disposed before a remount.
  // This also handles runtimes that clear el.innerHTML themselves.
  if (typeof el.__surface3dCleanup === "function") {
    el.__surface3dCleanup();
  }

  var disposed = false;
  var cleanupFns = [];
  var instanceRoot = null;
  var resizeObserver = null;
  var mutationObserver = null;
  var rafId = 0;
  var renderPending = false;
  var dataPending = false;
  var dataRafId = 0;

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanupFns.push(function() {
      target.removeEventListener(type, handler, options);
    });
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;

    if (rafId) cancelAnimationFrame(rafId);
    if (dataRafId) cancelAnimationFrame(dataRafId);

    if (resizeObserver) resizeObserver.disconnect();
    if (mutationObserver) mutationObserver.disconnect();

    cleanupFns.forEach(function(fn) {
      try { fn(); } catch (err) {}
    });
    cleanupFns.length = 0;

    if (el.__surface3dCleanup === cleanup) {
      delete el.__surface3dCleanup;
    }
  }

  el.__surface3dCleanup = cleanup;

  // ------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------

  var xr = range(cfg.x, [-2, 2]);
  var yr = range(cfg.y, [-2, 2]);
  var zr = range(cfg.z, [-4, 4]);

  var xmin = xr[0], xmax = xr[1];
  var ymin = yr[0], ymax = yr[1];
  var zmin = zr[0], zmax = zr[1];

  var dx = xmax - xmin;
  var dy = ymax - ymin;
  var dz = zmax - zmin;

  var xmid = (xmin + xmax) / 2;
  var ymid = (ymin + ymax) / 2;
  var zmid = (zmin + zmax) / 2;

  var mesh = clamp(Math.round(number(cfg.mesh, 12)), 4, 48);
  var mode = cfg.mode === "surface" ? "surface" : "both";
  var showContours = mode === "both";

  var initialAzim = number(cfg.view && cfg.view.azim, 0.8);
  var initialElev = clamp(
    number(cfg.view && cfg.view.elev, 0.55),
    -1.35, 1.35
  );

  var azim = initialAzim;
  var elev = initialElev;

  var params = Object.create(null);
  var paramDefs = Object.create(null);
  var paramNames = [];

  if (cfg.params && typeof cfg.params === "object") {
    Object.keys(cfg.params).forEach(function(name) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return;
      if (name === "x" || name === "y") return;

      var s = cfg.params[name];
      if (!Array.isArray(s) || s.length < 4) return;

      var lo = Number(s[0]);
      var hi = Number(s[1]);
      var initial = Number(s[2]);
      var step = Number(s[3]);

      if (
        !finite(lo) || !finite(hi) ||
        !finite(initial) || !finite(step) ||
        lo >= hi || step <= 0
      ) return;

      paramNames.push(name);
      paramDefs[name] = {
        min: lo,
        max: hi,
        step: step
      };
      params[name] = clamp(initial, lo, hi);
    });
  }

  var variableNames = ["x", "y"].concat(paramNames);
  var rawF = V6.makeFn(String(cfg.f || "0"), variableNames);

  var rawG = cfg.lagrange && typeof cfg.lagrange.g === "string"
    ? V6.makeFn(cfg.lagrange.g, variableNames)
    : null;

  var constraintLevel = cfg.lagrange
    ? number(cfg.lagrange.level, NaN)
    : NaN;

  var hasConstraint = !!rawG && finite(constraintLevel);

  function args(x, y) {
    var values = [x, y];
    for (var i = 0; i < paramNames.length; i++) {
      values.push(params[paramNames[i]]);
    }
    return values;
  }

  function evaluate(fn, x, y) {
    if (!fn || !finite(x) || !finite(y)) return NaN;
    try {
      var result = fn(args(x, y));
      return finite(result) ? result : NaN;
    } catch (err) {
      return NaN;
    }
  }

  function f(x, y) {
    return evaluate(rawF, x, y);
  }

  function g(x, y) {
    return evaluate(rawG, x, y);
  }

  function clippedZ(z) {
    return finite(z) ? clamp(z, zmin, zmax) : NaN;
  }

  function outsideZ(z) {
    return finite(z) && (z < zmin || z > zmax);
  }

  function partial(fn, x, y, axis) {
    var span = axis === 0 ? dx : dy;
    var h = Math.max(span * 1e-4, 1e-7);

    var xp = axis === 0 ? x + h : x;
    var yp = axis === 1 ? y + h : y;
    var xm = axis === 0 ? x - h : x;
    var ym = axis === 1 ? y - h : y;

    var fp = evaluate(fn, xp, yp);
    var fm = evaluate(fn, xm, ym);
    var f0 = evaluate(fn, x, y);

    if (finite(fp) && finite(fm)) {
      return (fp - fm) / (2 * h);
    }
    if (finite(fp) && finite(f0)) {
      return (fp - f0) / h;
    }
    if (finite(fm) && finite(f0)) {
      return (f0 - fm) / h;
    }
    return NaN;
  }

  // ------------------------------------------------------------
  // DOM
  // ------------------------------------------------------------

  V6.title(el, cfg.title || "3D 곡면");

  var root = document.createElement("div");
  instanceRoot = root;

  root.style.cssText =
    "font-family:" + FONT + ";" +
    "color:" + INK + ";" +
    "width:100%;" +
    "box-sizing:border-box;";

  el.appendChild(root);

  var toolbar = document.createElement("div");
  toolbar.style.cssText =
    "display:flex;" +
    "align-items:center;" +
    "justify-content:space-between;" +
    "flex-wrap:wrap;" +
    "gap:10px 16px;" +
    "margin:8px 0 12px;";

  root.appendChild(toolbar);

  var angleLabel = document.createElement("span");
  angleLabel.style.cssText =
    "font-size:13px;" +
    "line-height:1.6;" +
    "color:" + rgba(INK, 0.76) + ";" +
    "font-variant-numeric:tabular-nums;";

  toolbar.appendChild(angleLabel);

  var resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "시점 초기화";
  resetButton.style.cssText =
    "min-height:44px;" +
    "min-width:104px;" +
    "padding:10px 16px;" +
    "border:1px solid " + INK + ";" +
    "border-radius:2px;" +
    "background:white;" +
    "color:" + INK + ";" +
    "font:500 13px " + FONT + ";" +
    "cursor:pointer;";

  toolbar.appendChild(resetButton);

  var controlRow = document.createElement("div");
  controlRow.style.cssText =
    "display:flex;" +
    "flex-wrap:wrap;" +
    "gap:14px 24px;" +
    "margin-bottom:12px;";

  root.appendChild(controlRow);

  paramNames.forEach(function(name) {
    var spec = paramDefs[name];
    var holder = document.createElement("label");

    holder.style.cssText =
      "display:flex;" +
      "flex-direction:column;" +
      "gap:4px;" +
      "flex:1 1 250px;" +
      "max-width:440px;" +
      "font-size:13px;";

    var header = document.createElement("div");
    header.style.cssText =
      "display:flex;" +
      "align-items:center;" +
      "justify-content:space-between;";

    var nameText = document.createElement("span");
    nameText.textContent = name;

    var valueText = document.createElement("output");
    valueText.textContent = fmt(params[name]);
    valueText.style.cssText =
      "color:" + RED + ";" +
      "font-weight:600;" +
      "font-variant-numeric:tabular-nums;";

    header.appendChild(nameText);
    header.appendChild(valueText);

    var slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(spec.min);
    slider.max = String(spec.max);
    slider.step = String(spec.step);
    slider.value = String(params[name]);

    slider.style.cssText =
      "display:block;" +
      "width:100%;" +
      "height:44px;" +
      "margin:0;" +
      "accent-color:" + RED + ";" +
      "cursor:pointer;" +
      "touch-action:pan-y;";

    slider.setAttribute("aria-label", name + " 매개변수");

    listen(slider, "input", function() {
      params[name] = Number(slider.value);
      valueText.textContent = fmt(params[name]);
      scheduleDataUpdate();
    });

    holder.appendChild(header);
    holder.appendChild(slider);
    controlRow.appendChild(holder);
  });

  var canvasHolder = document.createElement("div");
  canvasHolder.style.cssText =
    "width:100%;" +
    "box-sizing:border-box;" +
    "overflow:hidden;" +
    "border:1px solid " + GRID + ";" +
    "border-radius:2px;" +
    "background:white;";

  root.appendChild(canvasHolder);

  var canvas = V6.canvas(canvasHolder, 400);
  var ctx = canvas.getContext("2d");

  canvas.style.cssText =
    "display:block;" +
    "width:100%;" +
    "height:auto;" +
    "background:white;" +
    "touch-action:none;" +
    "cursor:grab;" +
    "outline-offset:3px;";

  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "회전 가능한 3D 곡면. 방향키로 회전하고 Home 키로 시점을 초기화합니다."
  );

  var caption = document.createElement("div");
  caption.style.cssText =
    "padding:10px 2px 4px;" +
    "font-size:13px;" +
    "line-height:1.8;" +
    "color:" + rgba(INK, 0.82) + ";" +
    "white-space:pre-wrap;" +
    "overflow-wrap:anywhere;";

  root.appendChild(caption);

  var accessibilityNote = document.createElement("p");
  accessibilityNote.textContent =
    "마우스·터치 드래그 또는 방향키로 회전할 수 있습니다. " +
    "Home 키는 시점을 초기화합니다.";
  accessibilityNote.style.cssText =
    "font-size:12px;" +
    "line-height:1.6;" +
    "margin:4px 2px 0;" +
    "color:" + rgba(INK, 0.68) + ";";

  root.appendChild(accessibilityNote);

  // ------------------------------------------------------------
  // Canvas dimensions and responsive layout
  // ------------------------------------------------------------

  var W = 720;
  var H = 400;
  var dpr = 1;
  var narrow = false;

  function resizeCanvas() {
    var rect = canvasHolder.getBoundingClientRect();
    var width = Math.max(1, rect.width - 2);

    W = width;
    narrow = W < 450;

    if (narrow && showContours) {
      H = 510;
    } else if (narrow) {
      H = Math.max(280, W * 0.82);
    } else {
      H = Math.max(330, W * 400 / 720);
    }

    dpr = clamp(window.devicePixelRatio || 1, 1, 3);

    var pixelWidth = Math.max(1, Math.round(W * dpr));
    var pixelHeight = Math.max(1, Math.round(H * dpr));

    if (
      canvas.width !== pixelWidth ||
      canvas.height !== pixelHeight
    ) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    canvas.style.width = W + "px";
    canvas.style.height = H + "px";

    ctx.setTransform(
      pixelWidth / W, 0,
      0, pixelHeight / H,
      0, 0
    );
  }

  function panels() {
    if (!showContours) {
      return {
        three: { x: 0, y: 0, w: W, h: H },
        two: null
      };
    }

    if (narrow) {
      return {
        three: { x: 0, y: 0, w: W, h: 270 },
        two: { x: 0, y: 270, w: W, h: H - 270 }
      };
    }

    var left = W * 0.60;
    var gap = 16;

    return {
      three: { x: 0, y: 0, w: left, h: H },
      two: {
        x: left + gap,
        y: 0,
        w: W - left - gap,
        h: H
      }
    };
  }

  // ------------------------------------------------------------
  // Drawing helpers
  // ------------------------------------------------------------

  function line(a, b, color, width, alpha, dashed) {
    if (!a || !b) return;

    ctx.save();
    ctx.strokeStyle = color || INK;
    ctx.lineWidth = width || 1;
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;

    if (dashed) ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function dot(p, color, radius) {
    if (!p) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, (radius || 4) + 1.5, 0, TAU);
    ctx.fillStyle = "white";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius || 4, 0, TAU);
    ctx.fillStyle = color || RED;
    ctx.fill();
    ctx.restore();
  }

  function textAt(value, x, y, options) {
    options = options || {};

    ctx.save();
    ctx.fillStyle = options.color || INK;
    ctx.font =
      (options.weight || 400) + " " +
      (options.size || 12) + "px " + FONT;
    ctx.textAlign = options.align || "left";
    ctx.textBaseline = options.baseline || "middle";
    ctx.fillText(String(value), x, y);
    ctx.restore();
  }

  function projection(panel) {
    var ca = Math.cos(azim);
    var sa = Math.sin(azim);
    var ce = Math.cos(elev);
    var se = Math.sin(elev);

    var scale = Math.min(panel.w, panel.h) * 0.37;
    var cx = panel.x + panel.w / 2;
    var cy = panel.y + panel.h * 0.53;

    return function(x, y, z) {
      if (!finite(x) || !finite(y) || !finite(z)) return null;

      var X = 2 * (x - xmid) / dx;
      var Y = 2 * (y - ymid) / dy;
      var Z = 2 * (z - zmid) / dz;

      var horizontal = ca * X - sa * Y;
      var depth = sa * X + ca * Y;
      var vertical = se * depth - ce * Z;

      return {
        x: cx + horizontal * scale,
        y: cy + vertical * scale,
        depth: ce * depth + se * Z
      };
    };
  }

  // ------------------------------------------------------------
  // Numerical sampling and discontinuity detection
  // ------------------------------------------------------------

  var surfaceGrid = [];
  var contours = [];
  var constraintSegments = [];
  var constraintComponents = [];
  var extrema = null;
  var tangent = null;
  var stats = {
    clipped: false,
    invalid: false,
    uncertain: false
  };

  var CONTOUR_N = 120;
  var CONSTRAINT_N = 192;

  function sampleGrid(fn, nx, ny) {
    var values = [];

    for (var j = 0; j <= ny; j++) {
      var row = [];
      var y = ymin + dy * j / ny;

      for (var i = 0; i <= nx; i++) {
        var x = xmin + dx * i / nx;
        row.push(evaluate(fn, x, y));
      }

      values.push(row);
    }

    return values;
  }

  function interpolate(a, b, va, vb, level) {
    var denominator = vb - va;
    var t = Math.abs(denominator) < 1e-15
      ? 0.5
      : clamp((level - va) / denominator, 0, 1);

    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t
    };
  }

  function marchingSquares(values, nx, ny, level, fn) {
    var segments = [];

    function crosses(a, b) {
      return (a < level && b >= level) ||
             (a >= level && b < level);
    }

    for (var j = 0; j < ny; j++) {
      var y0 = ymin + dy * j / ny;
      var y1 = ymin + dy * (j + 1) / ny;

      for (var i = 0; i < nx; i++) {
        var x0 = xmin + dx * i / nx;
        var x1 = xmin + dx * (i + 1) / nx;

        var vs = [
          values[j][i],
          values[j][i + 1],
          values[j + 1][i + 1],
          values[j + 1][i]
        ];

        if (!vs.every(finite)) continue;

        var ps = [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 }
        ];

        var hits = [];

        for (var e = 0; e < 4; e++) {
          var n = (e + 1) % 4;

          if (crosses(vs[e], vs[n])) {
            hits.push({
              edge: e,
              point: interpolate(
                ps[e], ps[n], vs[e], vs[n], level
              )
            });
          }
        }

        if (hits.length === 2) {
          segments.push([
            hits[0].point,
            hits[1].point
          ]);
        } else if (hits.length === 4) {
          // Evaluate the actual center rather than averaging corners.
          var center = evaluate(
            fn,
            (x0 + x1) / 2,
            (y0 + y1) / 2
          );

          if (!finite(center)) continue;

          var same = (center >= level) === (vs[0] >= level);

          var pairs = same
            ? [[0, 1], [2, 3]]
            : [[0, 3], [1, 2]];

          pairs.forEach(function(pair) {
            segments.push([
              hits[pair[0]].point,
              hits[pair[1]].point
            ]);
          });
        }
      }
    }

    return segments;
  }

  // An endpoint-valid line is not automatically continuous.
  // Check intermediate values and reject obvious singular jumps.
  function safeSegment(fn, a, b, va, vb, tolerance) {
    if (!finite(va) || !finite(vb)) return false;

    var tvals = [0.25, 0.5, 0.75];
    var previous = va;
    var values = [va];

    for (var i = 0; i < tvals.length; i++) {
      var t = tvals[i];
      var x = a.x + (b.x - a.x) * t;
      var y = a.y + (b.y - a.y) * t;
      var v = evaluate(fn, x, y);

      if (!finite(v)) return false;
      values.push(v);
    }

    values.push(vb);

    var bound = Math.max(
      Math.abs(tolerance),
      Math.abs(va) * 3,
      Math.abs(vb) * 3,
      1
    );

    for (var k = 1; k < values.length; k++) {
      if (Math.abs(values[k] - values[k - 1]) > bound) {
        return false;
      }
      previous = values[k];
    }

    // This heuristic cannot certify mathematical continuity.
    return true;
  }

  // ------------------------------------------------------------
  // Constraint refinement
  // ------------------------------------------------------------

  function refineConstraintPoint(p) {
    var x = p.x;
    var y = p.y;

    for (var k = 0; k < 10; k++) {
      var residual = g(x, y) - constraintLevel;
      var gx = partial(rawG, x, y, 0);
      var gy = partial(rawG, x, y, 1);

      if (
        !finite(residual) ||
        !finite(gx) ||
        !finite(gy)
      ) break;

      var norm = gx * gx + gy * gy;
      if (norm < 1e-18) break;

      var factor = residual / norm;

      // Damped projection, bounded by the local grid scale.
      var limit = Math.min(dx, dy) / 20;
      var sx = factor * gx;
      var sy = factor * gy;
      var length = Math.hypot(sx, sy);

      if (length > limit) {
        sx *= limit / length;
        sy *= limit / length;
      }

      var nx = clamp(x - sx, xmin, xmax);
      var ny = clamp(y - sy, ymin, ymax);

      if (Math.hypot(nx - x, ny - y) < 1e-12) {
        x = nx;
        y = ny;
        break;
      }

      x = nx;
      y = ny;
    }

    return { x: x, y: y };
  }

  function residualOK(p) {
    var value = g(p.x, p.y);
    var gx = partial(rawG, p.x, p.y, 0);
    var gy = partial(rawG, p.x, p.y, 1);

    if (!finite(value) || !finite(gx) || !finite(gy)) {
      return false;
    }

    var scale = Math.max(1, Math.abs(constraintLevel));
    return Math.abs(value - constraintLevel) <= 1e-5 * scale;
  }

  function pointDistance(a, b) {
    return Math.hypot(
      (a.x - b.x) / dx,
      (a.y - b.y) / dy
    );
  }

  function connectSegments(segments) {
    var tolerance = 2 / CONSTRAINT_N * 0.12;
    var chains = [];
    var remaining = segments.map(function(s) {
      return [s[0], s[1]];
    });

    while (remaining.length) {
      var chain = remaining.pop().slice();
      var changed = true;

      while (changed) {
        changed = false;

        for (var i = remaining.length - 1; i >= 0; i--) {
          var s = remaining[i];
          var first = chain[0];
          var last = chain[chain.length - 1];

          if (pointDistance(last, s[0]) < tolerance) {
            chain.push(s[1]);
          } else if (pointDistance(last, s[1]) < tolerance) {
            chain.push(s[0]);
          } else if (pointDistance(first, s[1]) < tolerance) {
            chain.unshift(s[0]);
          } else if (pointDistance(first, s[0]) < tolerance) {
            chain.unshift(s[1]);
          } else {
            continue;
          }

          remaining.splice(i, 1);
          changed = true;
        }
      }

      chains.push(chain);
    }

    return chains;
  }

  function interpolatePath(a, b, t) {
    return refineConstraintPoint({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t
    });
  }

  function optimizeSegment(a, b, maximize) {
    // Golden-section refinement along a locally projected segment.
    // This is a numerical refinement, not a global-optimality proof.
    var left = 0;
    var right = 1;
    var ratio = (Math.sqrt(5) - 1) / 2;

    function objective(t) {
      var p = interpolatePath(a, b, t);
      if (!residualOK(p)) return Infinity;

      var value = f(p.x, p.y);
      if (!finite(value)) return Infinity;

      return maximize ? -value : value;
    }

    var c = right - ratio * (right - left);
    var d = left + ratio * (right - left);
    var fc = objective(c);
    var fd = objective(d);

    for (var k = 0; k < 28; k++) {
      if (fc <= fd) {
        right = d;
        d = c;
        fd = fc;
        c = right - ratio * (right - left);
        fc = objective(c);
      } else {
        left = c;
        c = d;
        fc = fd;
        d = left + ratio * (right - left);
        fd = objective(d);
      }
    }

    var p = interpolatePath(a, b, (left + right) / 2);

    if (!residualOK(p)) return null;

    var z = f(p.x, p.y);
    if (!finite(z)) return null;

    return { x: p.x, y: p.y, z: z };
  }

  function computeConstraint() {
    constraintSegments = [];
    constraintComponents = [];
    extrema = null;

    if (!hasConstraint) return;

    var data = sampleGrid(rawG, CONSTRAINT_N, CONSTRAINT_N);
    var raw = marchingSquares(
      data,
      CONSTRAINT_N,
      CONSTRAINT_N,
      constraintLevel,
      rawG
    );

    raw.forEach(function(s) {
      var a = refineConstraintPoint(s[0]);
      var b = refineConstraintPoint(s[1]);

      if (!residualOK(a) || !residualOK(b)) return;

      var ga = g(a.x, a.y);
      var gb = g(b.x, b.y);
      var midpoint = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      };

      if (!safeSegment(rawG, a, b, ga, gb, Math.max(dx, dy))) {
        stats.uncertain = true;
        return;
      }

      var gm = g(midpoint.x, midpoint.y);
      if (!finite(gm)) {
        stats.uncertain = true;
        return;
      }

      constraintSegments.push([a, b]);
    });

    constraintComponents = connectSegments(constraintSegments);

    var candidates = [];

    constraintSegments.forEach(function(s) {
      [s[0], s[1]].forEach(function(p) {
        if (!residualOK(p)) return;
        var z = f(p.x, p.y);
        if (finite(z)) {
          candidates.push({ x: p.x, y: p.y, z: z });
        }
      });

      var minimum = optimizeSegment(s[0], s[1], false);
      var maximum = optimizeSegment(s[0], s[1], true);

      if (minimum) candidates.push(minimum);
      if (maximum) candidates.push(maximum);
    });

    // Additional samples along the connected components.
    constraintComponents.forEach(function(chain) {
      for (var i = 0; i + 1 < chain.length; i++) {
        var a = chain[i];
        var b = chain[i + 1];

        [0.25, 0.5, 0.75].forEach(function(t) {
          var p = interpolatePath(a, b, t);
          if (!residualOK(p)) return;

          var z = f(p.x, p.y);
          if (finite(z)) {
            candidates.push({ x: p.x, y: p.y, z: z });
          }
        });
      }
    });

    if (!candidates.length) return;

    var minimum = candidates[0];
    var maximum = candidates[0];

    candidates.forEach(function(p) {
      if (p.z < minimum.z) minimum = p;
      if (p.z > maximum.z) maximum = p;
    });

    extrema = {
      min: minimum,
      max: maximum,
      approximate: true
    };
  }

  // ------------------------------------------------------------
  // Surface, contours and tangent
  // ------------------------------------------------------------

  function computeContours() {
    contours = [];
    if (!showContours) return;

    var data = sampleGrid(rawF, CONTOUR_N, CONTOUR_N);

    for (var i = 1; i <= 9; i++) {
      var level = zmin + dz * i / 10;

      contours.push({
        level: level,
        segments: marchingSquares(
          data,
          CONTOUR_N,
          CONTOUR_N,
          level,
          rawF
        )
      });
    }
  }

  function computeTangent() {
    tangent = null;
    if (!cfg.plane) return;

    var x0 = Number(cfg.plane.x0);
    var y0 = Number(cfg.plane.y0);

    if (!finite(x0) || !finite(y0)) return;

    var z0 = f(x0, y0);
    var fx = partial(rawF, x0, y0, 0);
    var fy = partial(rawF, x0, y0, 1);

    if (
      !finite(z0) ||
      !finite(fx) ||
      !finite(fy)
    ) return;

    tangent = {
      x: x0,
      y: y0,
      z: z0,
      fx: fx,
      fy: fy
    };
  }

  function tangentZ(x, y) {
    return tangent.z +
      tangent.fx * (x - tangent.x) +
      tangent.fy * (y - tangent.y);
  }

  function computeSurface() {
    surfaceGrid = sampleGrid(rawF, mesh, mesh);

    for (var j = 0; j <= mesh; j++) {
      for (var i = 0; i <= mesh; i++) {
        var z = surfaceGrid[j][i];

        if (!finite(z)) stats.invalid = true;
        if (outsideZ(z)) stats.clipped = true;
      }
    }
  }

  // ------------------------------------------------------------
  // Drawing: 3D
  // ------------------------------------------------------------

  function drawAxes(project) {
    var axes = [
      {
        a: [xmin, ymin, zmin],
        b: [xmax, ymin, zmin],
        label: "x"
      },
      {
        a: [xmin, ymin, zmin],
        b: [xmin, ymax, zmin],
        label: "y"
      },
      {
        a: [xmin, ymin, zmin],
        b: [xmin, ymin, zmax],
        label: "z"
      }
    ];

    axes.forEach(function(axis) {
      var a = project.apply(null, axis.a);
      var b = project.apply(null, axis.b);

      line(a, b, rgba(INK, 0.45), 1);

      if (b) {
        textAt(axis.label, b.x + 6, b.y - 8, {
          size: 13,
          color: rgba(INK, 0.75)
        });
      }
    });

    var corners = [
      [xmin, ymin],
      [xmax, ymin],
      [xmax, ymax],
      [xmin, ymax]
    ];

    for (var i = 0; i < 4; i++) {
      var a = corners[i];
      var b = corners[(i + 1) % 4];

      line(
        project(a[0], a[1], zmin),
        project(b[0], b[1], zmin),
        GRID,
        1
      );
    }
  }

  function drawSurface(project) {
    var segments = [];

    function append(a, b, va, vb) {
      if (!a || !b || !finite(va) || !finite(vb)) return;

      var pa = project(a.x, a.y, clippedZ(va));
      var pb = project(b.x, b.y, clippedZ(vb));

      if (!pa || !pb) return;

      segments.push({
        a: pa,
        b: pb,
        depth: (pa.depth + pb.depth) / 2,
        clipped: outsideZ(va) || outsideZ(vb)
      });
    }

    for (var j = 0; j <= mesh; j++) {
      for (var i = 0; i <= mesh; i++) {
        var x = xmin + dx * i / mesh;
        var y = ymin + dy * j / mesh;
        var z = surfaceGrid[j][i];

        var p = { x: x, y: y };

        if (i < mesh) {
          var nx = xmin + dx * (i + 1) / mesh;
          var nz = surfaceGrid[j][i + 1];
          var qx = { x: nx, y: y };

          if (safeSegment(rawF, p, qx, z, nz, dz * 2)) {
            append(p, qx, z, nz);
          } else {
            stats.uncertain = true;
          }
        }

        if (j < mesh) {
          var ny = ymin + dy * (j + 1) / mesh;
          var nz2 = surfaceGrid[j + 1][i];
          var qy = { x: x, y: ny };

          if (safeSegment(rawF, p, qy, z, nz2, dz * 2)) {
            append(p, qy, z, nz2);
          } else {
            stats.uncertain = true;
          }
        }
      }
    }

    segments.sort(function(a, b) {
      return b.depth - a.depth;
    });

    segments.forEach(function(s) {
      line(
        s.a,
        s.b,
        INK,
        s.clipped ? 1.1 : 0.9,
        s.clipped ? 0.38 : 0.72,
        s.clipped
      );
    });
  }

  function drawTangent(project) {
    if (!tangent) return;

    var sx = dx * 0.19;
    var sy = dy * 0.19;
    var n = 5;

    function point(u, v) {
      var x = tangent.x + u * sx;
      var y = tangent.y + v * sy;

      return project(x, y, clippedZ(tangentZ(x, y)));
    }

    for (var i = 0; i <= n; i++) {
      var t = -1 + 2 * i / n;

      line(point(t, -1), point(t, 1), RED, 1.7, 0.9);
      line(point(-1, t), point(1, t), RED, 1.7, 0.9);
    }

    var center = project(
      tangent.x,
      tangent.y,
      clippedZ(tangent.z)
    );

    dot(center, RED, 5);

    if (center) {
      textAt("접점", center.x + 8, center.y - 12, {
        color: RED,
        size: 13,
        weight: 600
      });
    }
  }

  function drawConstraint3D(project) {
    if (!hasConstraint) return;

    constraintSegments.forEach(function(s) {
      var a = s[0];
      var b = s[1];
      var za = f(a.x, a.y);
      var zb = f(b.x, b.y);

      if (!finite(za) || !finite(zb)) return;

      line(
        project(a.x, a.y, clippedZ(za)),
        project(b.x, b.y, clippedZ(zb)),
        RED,
        2.5,
        1,
        outsideZ(za) || outsideZ(zb)
      );
    });

    if (!extrema) return;

    [
      { p: extrema.max, label: "최대" },
      { p: extrema.min, label: "최소" }
    ].forEach(function(item) {
      var p = project(
        item.p.x,
        item.p.y,
        clippedZ(item.p.z)
      );

      dot(p, RED, 5);

      if (p) {
        textAt(item.label, p.x + 8, p.y - 12, {
          color: RED,
          size: 13,
          weight: 600
        });
      }
    });
  }

  function drawThree(panel) {
    var project = projection(panel);

    ctx.save();
    ctx.beginPath();
    ctx.rect(panel.x, panel.y, panel.w, panel.h);
    ctx.clip();

    drawAxes(project);
    drawSurface(project);
    drawTangent(project);
    drawConstraint3D(project);

    textAt("3D 곡면", panel.x + 12, panel.y + 18, {
      color: rgba(INK, 0.7),
      size: 13
    });

    ctx.restore();
  }

  // ------------------------------------------------------------
  // Drawing: 2D contours
  // ------------------------------------------------------------

  function contourMap(panel) {
    var leftPad = 44;
    var rightPad = 17;
    var topPad = 38;
    var bottomPad = 42;

    var availableW = Math.max(
      20,
      panel.w - leftPad - rightPad
    );

    var availableH = Math.max(
      20,
      panel.h - topPad - bottomPad
    );

    var pw = Math.min(availableW, availableH * dx / dy);
    var ph = pw * dy / dx;

    if (ph > availableH) {
      ph = availableH;
      pw = ph * dx / dy;
    }

    var left =
      panel.x + leftPad + (availableW - pw) / 2;

    var top =
      panel.y + topPad + (availableH - ph) / 2;

    return {
      left: left,
      top: top,
      width: pw,
      height: ph,
      map: function(x, y) {
        return {
          x: left + (x - xmin) / dx * pw,
          y: top + (ymax - y) / dy * ph
        };
      }
    };
  }

  function drawContours(panel) {
    if (!panel) return;

    var info = contourMap(panel);
    var map = info.map;

    ctx.save();
    ctx.beginPath();
    ctx.rect(panel.x, panel.y, panel.w, panel.h);
    ctx.clip();

    textAt("등고선 · xy 평면", panel.x + 12, panel.y + 18, {
      color: rgba(INK, 0.7),
      size: 13
    });

    ctx.strokeStyle = rgba(INK, 0.5);
    ctx.lineWidth = 1;
    ctx.strokeRect(
      info.left,
      info.top,
      info.width,
      info.height
    );

    for (var i = 1; i < 4; i++) {
      var x = xmin + dx * i / 4;
      var y = ymin + dy * i / 4;

      line(map(x, ymin), map(x, ymax), GRID, 1);
      line(map(xmin, y), map(xmax, y), GRID, 1);
    }

    if (xmin <= 0 && xmax >= 0) {
      line(
        map(0, ymin),
        map(0, ymax),
        rgba(INK, 0.38),
        1
      );
    }

    if (ymin <= 0 && ymax >= 0) {
      line(
        map(xmin, 0),
        map(xmax, 0),
        rgba(INK, 0.38),
        1
      );
    }

    contours.forEach(function(contour) {
      contour.segments.forEach(function(s) {
        var a = s[0], b = s[1];

        // Suppress clearly discontinuous contour connections.
        var va = f(a.x, a.y);
        var vb = f(b.x, b.y);

        if (!safeSegment(rawF, a, b, va, vb, dz * 2)) {
          return;
        }

        line(
          map(a.x, a.y),
          map(b.x, b.y),
          INK,
          1,
          0.72
        );
      });
    });

    if (hasConstraint) {
      constraintSegments.forEach(function(s) {
        line(
          map(s[0].x, s[0].y),
          map(s[1].x, s[1].y),
          RED,
          2.5
        );
      });

      if (extrema) {
        var maxP = map(extrema.max.x, extrema.max.y);
        var minP = map(extrema.min.x, extrema.min.y);

        dot(maxP, RED, 5);
        dot(minP, RED, 5);

        textAt("최대", maxP.x + 8, maxP.y - 11, {
          color: RED,
          weight: 600,
          size: 12
        });

        textAt("최소", minP.x + 8, minP.y + 13, {
          color: RED,
          weight: 600,
          size: 12
        });
      }
    }

    if (tangent) {
      dot(map(tangent.x, tangent.y), RED, 5);
    }

    textAt(fmt(xmin), info.left,
      info.top + info.height + 19, {
        color: rgba(INK, 0.75),
        size: 12
      }
    );

    textAt(fmt(xmax), info.left + info.width,
      info.top + info.height + 19, {
        color: rgba(INK, 0.75),
        size: 12,
        align: "right"
      }
    );

    textAt(fmt(ymin), info.left - 7,
      info.top + info.height, {
        color: rgba(INK, 0.75),
        size: 12,
        align: "right"
      }
    );

    textAt(fmt(ymax), info.left - 7,
      info.top, {
        color: rgba(INK, 0.75),
        size: 12,
        align: "right"
      }
    );

    textAt("x", info.left + info.width,
      info.top + info.height + 36, {
        align: "right",
        size: 13
      }
    );

    textAt("y", info.left - 17,
      info.top - 13, {
        size: 13
      }
    );

    ctx.restore();
  }

  // ------------------------------------------------------------
  // Captions
  // ------------------------------------------------------------

  function updateCaption() {
    var lines = [];

    if (tangent) {
      lines.push(
        "접점: (" +
        fmt(tangent.x) + ", " +
        fmt(tangent.y) + ", " +
        fmt(tangent.z) + ")"
      );

      lines.push(
        "f(" + fmt(tangent.x) + ", " +
        fmt(tangent.y) + ") = " + fmt(tangent.z)
      );

      lines.push(
        "∇f = (" +
        fmt(tangent.fx) + ", " +
        fmt(tangent.fy) + ")"
      );

      lines.push(
        "접평면: z = " +
        fmt(tangent.z) +
        signed(tangent.fx) +
        "(x − (" + fmt(tangent.x) + "))" +
        signed(tangent.fy) +
        "(y − (" + fmt(tangent.y) + "))"
      );

      lines.push(
        "접평면은 접점에서 곡면의 일차 근사입니다."
      );
    } else if (cfg.plane) {
      lines.push(
        "접평면 계산 불가: 접점의 함수값 또는 편미분이 유효하지 않습니다."
      );
    }

    if (hasConstraint) {
      lines.push(
        "제약조건: g(x,y) = " + fmt(constraintLevel)
      );

      if (extrema) {
        lines.push(
          "수치 최대 ≈ " + fmt(extrema.max.z) +
          " at (" +
          fmt(extrema.max.x) + ", " +
          fmt(extrema.max.y) + ")"
        );

        lines.push(
          "수치 최소 ≈ " + fmt(extrema.min.z) +
          " at (" +
          fmt(extrema.min.x) + ", " +
          fmt(extrema.min.y) + ")"
        );

        lines.push(
          "격자 추출 후 제약곡선 투영과 국소 수치 정밀화를 적용한 근사값입니다. " +
          "표시 범위의 모든 극값 또는 전역 최적성을 보장하지 않습니다."
        );
      } else {
        lines.push(
          "표시 범위에서 유효한 제약곡선 극값 후보를 찾지 못했습니다."
        );
      }

      lines.push(
        "Lagrange 직관: 정칙 제약점의 국소 극값에서는 " +
        "∇f = λ∇g, 즉 두 기울기가 평행합니다."
      );
    }

    if (paramNames.length) {
      lines.push(
        paramNames.map(function(name) {
          return name + " = " + fmt(params[name]);
        }).join(" · ")
      );

      lines.push(
        "매개변수 변화에 따라 곡면과 등고선을 다시 계산합니다."
      );
    }

    if (stats.clipped) {
      lines.push(
        "주의: z 표시 범위를 벗어난 부분은 경계 높이로 잘라 " +
        "연한 점선으로 표시합니다. 실제 곡면이 평탄한 것은 아닙니다."
      );
    }

    if (stats.invalid || stats.uncertain) {
      lines.push(
        "주의: 정의되지 않은 값이나 급격한 변화가 감지된 " +
        "격자 선분은 생략할 수 있습니다. " +
        "이는 불연속성에 대한 수치적 추정이며 엄밀한 판정은 아닙니다."
      );
    }

    if (showContours) {
      lines.push(
        "검은 선: 곡면·등고선 · 빨간 선: 접평면 또는 제약곡선"
      );
    }

    lines.push(
      "z 표시 범위: [" + fmt(zmin) + ", " + fmt(zmax) + "]"
    );

    caption.textContent = lines.join("\n");
  }

  // ------------------------------------------------------------
  // Render scheduling
  // ------------------------------------------------------------

  function paint() {
    if (disposed || !el.isConnected || !root.isConnected) return;

    resizeCanvas();

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, W, H);

    var layout = panels();

    drawThree(layout.three);

    if (layout.two) {
      if (narrow) {
        line(
          { x: 12, y: layout.two.y },
          { x: W - 12, y: layout.two.y },
          GRID, 1
        );
      } else {
        var dividerX = layout.two.x - 8;
        line(
          { x: dividerX, y: 14 },
          { x: dividerX, y: H - 14 },
          GRID, 1
        );
      }

      drawContours(layout.two);
    }

    angleLabel.textContent =
      "방위각 " + fmt(azim * 180 / PI) +
      "° · 고도각 " + fmt(elev * 180 / PI) + "°";

    updateCaption();
  }

  function render() {
    if (disposed || renderPending) return;

    renderPending = true;
    rafId = requestAnimationFrame(function() {
      rafId = 0;
      renderPending = false;
      paint();
    });
  }

  function updateData() {
    if (disposed) return;

    stats = {
      clipped: false,
      invalid: false,
      uncertain: false
    };

    computeSurface();
    computeContours();
    computeConstraint();
    computeTangent();

    updateCaption();
    render();
  }

  function scheduleDataUpdate() {
    if (disposed || dataPending) return;

    dataPending = true;
    dataRafId = requestAnimationFrame(function() {
      dataRafId = 0;
      dataPending = false;
      updateData();
    });
  }

  // ------------------------------------------------------------
  // Pointer rotation
  // ------------------------------------------------------------

  var dragging = false;
  var pointerId = null;
  var lastX = 0;
  var lastY = 0;

  function resetView() {
    azim = initialAzim;
    elev = initialElev;
    render();
  }

  listen(resetButton, "click", resetView);

  listen(canvas, "pointerdown", function(e) {
    if (dragging) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // Rotate only on the 3D panel, leaving the contour panel
    // noninteractive for touch scrolling.
    var rect = canvas.getBoundingClientRect();
    var px = (e.clientX - rect.left) * W / rect.width;
    var py = (e.clientY - rect.top) * H / rect.height;
    var three = panels().three;

    if (
      px < three.x || px > three.x + three.w ||
      py < three.y || py > three.y + three.h
    ) return;

    dragging = true;
    pointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;

    canvas.style.cursor = "grabbing";

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    e.preventDefault();
  });

  listen(canvas, "pointermove", function(e) {
    if (!dragging || e.pointerId !== pointerId) return;

    var deltaX = e.clientX - lastX;
    var deltaY = e.clientY - lastY;

    lastX = e.clientX;
    lastY = e.clientY;

    azim += deltaX * 0.008;
    elev = clamp(
      elev + deltaY * 0.008,
      -1.35, 1.35
    );

    azim = ((azim + PI) % TAU + TAU) % TAU - PI;

    render();
    e.preventDefault();
  });

  function finishPointer(e) {
    if (!dragging || e.pointerId !== pointerId) return;

    dragging = false;
    pointerId = null;
    canvas.style.cursor = "grab";

    try {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
  }

  listen(canvas, "pointerup", finishPointer);
  listen(canvas, "pointercancel", finishPointer);

  listen(canvas, "lostpointercapture", function(e) {
    if (e.pointerId === pointerId) {
      dragging = false;
      pointerId = null;
      canvas.style.cursor = "grab";
    }
  });

  // ------------------------------------------------------------
  // Keyboard rotation
  // ------------------------------------------------------------

  listen(canvas, "keydown", function(e) {
    var step = e.shiftKey ? 0.20 : 0.07;
    var handled = true;

    switch (e.key) {
      case "ArrowLeft":
        azim -= step;
        break;

      case "ArrowRight":
        azim += step;
        break;

      case "ArrowUp":
        elev = clamp(elev - step, -1.35, 1.35);
        break;

      case "ArrowDown":
        elev = clamp(elev + step, -1.35, 1.35);
        break;

      case "Home":
        azim = initialAzim;
        elev = initialElev;
        break;

      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      render();
    }
  });

  // ------------------------------------------------------------
  // Lifecycle and remount cleanup
  // ------------------------------------------------------------

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(function() {
      if (!disposed) render();
    });

    resizeObserver.observe(canvasHolder);
  } else {
    listen(window, "resize", render);
  }

  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver(function() {
      if (disposed) return;

      // Detect both removal of el and el.innerHTML replacement.
      if (!el.isConnected || !root.isConnected) {
        cleanup();
      }
    });

    mutationObserver.observe(el, {
      childList: true,
      subtree: false
    });

    if (el.parentNode) {
      mutationObserver.observe(el.parentNode, {
        childList: true,
        subtree: false
      });
    }
  }

  updateData();
});

})();