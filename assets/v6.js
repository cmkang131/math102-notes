/* v6 interactive runtime. Pages embed widgets declaratively:
   <div class="v6-widget" data-widget="slider-plot" data-config='{...}'></div>
   Config is JSON. All drawing is canvas, ink #1a1a1a, accent #9e2b25 only.
   Course modules: a site may add assets/v6-extra.js registering more widgets
   via V6.register(name, mountFn). */
(function(){
"use strict";
var INK="#1a1a1a", RED="#9e2b25", GRID="#e8e6e0";
var widgets={};
function register(name,fn){widgets[name]=fn;}
function parse(el){try{return JSON.parse(el.getAttribute("data-config")||"{}");}catch(e){return null;}}
function canvas(el,h){var c=document.createElement("canvas");c.width=720;c.height=h||380;
  c.style.width="100%";el.appendChild(c);return c;}
function title(el,t){if(!t)return;var d=document.createElement("div");d.className="v6-title";d.textContent=t;el.appendChild(d);}
/* safe function evaluator: vars + Math whitelist */
function makeFn(src,names){
  var body='"use strict";var abs=Math.abs,sqrt=Math.sqrt,pow=Math.pow,exp=Math.exp,log=Math.log,'+
    'sin=Math.sin,cos=Math.cos,tan=Math.tan,pi=Math.PI,e=Math.E,min=Math.min,max=Math.max;'+
    'return ('+src+');';
  var f=new Function(names.join(","),body);
  return function(vals){try{var v=f.apply(null,vals);return (typeof v==="number"&&isFinite(v))?v:NaN;}catch(e){return NaN;}};
}
function axes(ctx,W,H,xr,yr){
  ctx.strokeStyle=GRID;ctx.lineWidth=1;
  for(var i=1;i<8;i++){ctx.beginPath();ctx.moveTo(W*i/8,0);ctx.lineTo(W*i/8,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,H*i/8);ctx.lineTo(W,H*i/8);ctx.stroke();}
  ctx.strokeStyle=INK;ctx.lineWidth=1.2;
  var zx=(0-xr[0])/(xr[1]-xr[0])*W, zy=H-(0-yr[0])/(yr[1]-yr[0])*H;
  if(zx>=0&&zx<=W){ctx.beginPath();ctx.moveTo(zx,0);ctx.lineTo(zx,H);ctx.stroke();}
  if(zy>=0&&zy<=H){ctx.beginPath();ctx.moveTo(0,zy);ctx.lineTo(W,zy);ctx.stroke();}
  return {px:function(x){return (x-xr[0])/(xr[1]-xr[0])*W;},
          py:function(y){return H-(y-yr[0])/(yr[1]-yr[0])*H;}};
}
/* slider-plot: {title,f:"a*x^2+b*x",x:[-5,5],y:[-10,10],params:{a:[min,max,init,step],...},curves?} */
register("slider-plot",function(el,cfg){
  title(el,cfg.title);
  var c=canvas(el,cfg.h||380),ctx=c.getContext("2d");
  var names=Object.keys(cfg.params||{});names.push("x");
  var f=makeFn(cfg.f,names);
  var curves=cfg.curves||[{f:cfg.f,color:INK}];
  var fns=curves.map(function(cv){return {fn:makeFn(cv.f,names),color:cv.color||INK,dash:cv.dash,label:cv.label};});
  var vals={};names.slice(0,-1).forEach(function(n){vals[n]=cfg.params[n][2];});
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    var m=axes(ctx,c.width,c.height,cfg.x,cfg.y);
    fns.forEach(function(cv){
      ctx.strokeStyle=cv.color;ctx.lineWidth=2;ctx.setLineDash(cv.dash||[]);ctx.beginPath();
      var started=false;
      for(var px=0;px<=c.width;px+=2){
        var x=cfg.x[0]+(cfg.x[1]-cfg.x[0])*px/c.width;
        var args=names.map(function(n){return n==="x"?x:vals[n];});
        var y=cv.fn(args);if(isNaN(y)){started=false;continue;}
        var py=m.py(y);
        if(py<-50||py>c.height+50){started=false;continue;}
        if(!started){ctx.moveTo(px,py);started=true;}else ctx.lineTo(px,py);
      }
      ctx.stroke();ctx.setLineDash([]);
      if(cv.label){ctx.fillStyle=cv.color;ctx.font="12px 'Noto Sans KR'";ctx.fillText(cv.label,10,16+fns.indexOf(cv)*16);}
    });
  }
  var ctl=document.createElement("div");ctl.className="v6-controls";
  names.slice(0,-1).forEach(function(n){
    var p=cfg.params[n],lab=document.createElement("label");
    lab.textContent=n+" ";
    var r=document.createElement("input");r.type="range";r.min=p[0];r.max=p[1];r.step=p[3]||0.1;r.value=p[2];
    var v=document.createElement("span");v.className="v6-val";v.textContent=p[2];
    r.oninput=function(){vals[n]=parseFloat(r.value);v.textContent=r.value;draw();};
    lab.appendChild(r);lab.appendChild(v);ctl.appendChild(lab);
  });
  el.appendChild(ctl);draw();
});
/* stepthrough: {title,steps:[{svg?,state?(html),note}],...} generic prev/next player.
   Each step svg is inline SVG markup string OR a draw(stepEl) id handled by course modules. */
register("stepthrough",function(el,cfg){
  title(el,cfg.title);
  var stage=document.createElement("div"),state=document.createElement("div");
  state.className="v6-state";el.appendChild(stage);el.appendChild(state);
  var i=0,bar=document.createElement("div");bar.className="v6-stepbar";
  var prev=document.createElement("button"),next=document.createElement("button");
  prev.className="v6-btn";next.className="v6-btn";prev.textContent="← 이전";next.textContent="다음 →";
  var pos=document.createElement("span");
  function show(){
    var s=cfg.steps[i];
    stage.innerHTML=s.svg||"";
    state.innerHTML=(s.note?"<b>"+(i+1)+".</b> "+s.note:"")+(s.state||"");
    pos.textContent=(i+1)+" / "+cfg.steps.length;
    prev.disabled=i===0;next.disabled=i===cfg.steps.length-1;
  }
  prev.onclick=function(){if(i>0){i--;show();}};
  next.onclick=function(){if(i<cfg.steps.length-1){i++;show();}};
  bar.appendChild(prev);bar.appendChild(next);bar.appendChild(pos);el.appendChild(bar);
  show();
});
function boot(){
  document.querySelectorAll(".v6-widget[data-widget]").forEach(function(el){
    var cfg=parse(el);if(!cfg)return;
    var fn=widgets[el.getAttribute("data-widget")];
    if(fn)try{fn(el,cfg);}catch(e){el.insertAdjacentHTML("beforeend","<div style='color:#9e2b25;font-size:12px'>widget error</div>");}
  });
}
window.V6={register:register,makeFn:makeFn,axes:axes,canvas:canvas,title:title,INK:INK,RED:RED,GRID:GRID};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
