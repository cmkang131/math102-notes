#!/bin/sh
# Interaction screenshots: run JS (button clicks, slider input, pointer drag) after load, then capture.
# usage: (repo root, http server on 8765) sh verify/b-interact.sh
enc(){ python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$1"; }
J1=$(enc "var b=[...document.querySelectorAll('#gd-quad .v6-btn')];b[0].click();b[2].click();b[2].click();var r=document.querySelector('#gd-quad input[type=range]');r.value=4;r.dispatchEvent(new Event('input'))")
J2=$(enc "[...document.querySelectorAll('#qf-pd .v6-btn')].find(b=>b.textContent.startsWith('부정')).click()")
J3=$(enc "var c=document.querySelector('#dp-acute canvas'),R=c.getBoundingClientRect(),s=R.width/720;function ev(t,x,y){c.dispatchEvent(new PointerEvent(t,{clientX:R.left+x*s,clientY:R.top+y*s,pointerId:1,bubbles:true}))};var x0=241+2.5*Math.cos(15*Math.PI/180)*(310/6.6),y0=177-2.5*Math.sin(15*Math.PI/180)*(310/6.6);ev('pointerdown',x0,y0);ev('pointermove',141,117);ev('pointerup',141,117)")
J4=$(enc "[...document.querySelectorAll('#dd-basic .v6-btn')].find(b=>b.textContent.includes('접선')).click()")
J5=$(enc "var i=document.querySelector('#gd-2d input[type=checkbox]');i.click();var r=[...document.querySelectorAll('#gd-2d input[type=range]')];r[0].value=50;r[0].dispatchEvent(new Event('input'));r[1].value=0.99;r[1].dispatchEvent(new Event('input'))")
J6=$(enc "var r=[...document.querySelectorAll('#lm-default input[type=range]')];r[3].value=-1;r[3].dispatchEvent(new Event('input'))")
node verify/b-shoot.mjs http://127.0.0.1:8765/demo-b.html "gd-quad@$J1#int" "qf-pd@$J2#int" "dp-acute@$J3#int" "dd-basic@$J4#int" "gd-2d@$J5#int" "lm-default@$J6#int"
