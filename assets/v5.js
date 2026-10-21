/* study-note v5 enhancements. 전부 선택적 향상: JS가 꺼져도 읽을 수 있음. </body> 직전에 <script src="assets/v5.js"></script> */
(function(){
  var d=document, root=d.documentElement;
  function $(s,c){return (c||d).querySelector(s)}
  function $$(s,c){return Array.prototype.slice.call((c||d).querySelectorAll(s))}
  function ready(f){d.readyState==='loading'?d.addEventListener('DOMContentLoaded',f):f()}
  ready(function(){
    var paper=$('.paper')||d.body;
    var main=$('.body.notes')||$('.body')||$('.notes')||paper;
    if(!paper.id)paper.id='main';

    // skip link + top anchor
    if(!$('.skip-link')){var sk=d.createElement('a');sk.className='skip-link';sk.href='#'+paper.id;sk.textContent='본문으로 건너뛰기';d.body.insertBefore(sk,d.body.firstChild)}
    if(!d.getElementById('top')){var t=d.createElement('span');t.id='top';d.body.insertBefore(t,d.body.firstChild)}

    // theme toggle -> inside header (theme.js가 만든 고정 버튼을 옮김, 없으면 직접 생성)
    var btn=$('.theme-toggle');
    if(!btn){
      var k='site-theme',s=null;try{s=localStorage.getItem(k)}catch(e){}
      var sys=function(){return matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'};
      root.setAttribute('data-theme',s||sys());
      btn=d.createElement('button');btn.type='button';btn.className='theme-toggle';
      var lab=function(){btn.textContent=root.getAttribute('data-theme')==='dark'?'라이트':'다크';btn.setAttribute('aria-label','화면 모드 전환')};
      lab();btn.onclick=function(){var n=root.getAttribute('data-theme')==='dark'?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem(k,n)}catch(e){}lab()};
    }
    var ph=$('.phead');
    if(ph){ph.appendChild(btn)}
    else{var bar=d.createElement('div');bar.className='v5-bar';bar.appendChild(btn);paper.insertBefore(bar,paper.firstChild)}

    // details -> 통일 스타일 훅
    $$('details').forEach(function(x){x.classList.add('v5d')});

    // 헤딩 id + ¶ 앵커
    var used={};
    $$('h2,h3',main).forEach(function(h){
      if(h.closest('summary'))return;
      if(!h.id){
        var base=(h.textContent||'').replace(/¶/g,'').trim().toLowerCase().replace(/[^\w\u3131-\uD79D]+/g,'-').replace(/^-+|-+$/g,'')||'sec';
        var id=base,n=2;while(d.getElementById(id)||used[id])id=base+'-'+n++;h.id=id;
      }
      used[h.id]=1;
      var a=d.createElement('a');a.className='v5-anchor';a.href='#'+h.id;a.textContent='¶';a.setAttribute('aria-label','이 절 링크');
      h.appendChild(a);
    });

    // 표: 래퍼 + 스크롤 힌트 + 긴 표 sticky
    $$('table',main).forEach(function(tb){
      var w=tb.parentElement;
      if(!w.classList.contains('tblwrap')){w=d.createElement('div');w.className='tblwrap';tb.parentNode.insertBefore(w,tb);w.appendChild(tb)}
      if(tb.tBodies[0]&&tb.tBodies[0].rows.length>12&&tb.tHead)w.classList.add('long');
    });
    function hint(){$$('.tblwrap').forEach(function(w){var more=w.scrollWidth-w.clientWidth-w.scrollLeft>4;w.classList.toggle('can-r',more)})}
    hint();addEventListener('resize',hint);$$('.tblwrap').forEach(function(w){w.addEventListener('scroll',hint,{passive:true})});

    // 상단 목차 (h2 3개 이상이고 .toc가 없을 때)
    var h2s=$$('h2[id]',main).filter(function(h){return !h.classList.contains('solo-h')});
    if(h2s.length>=3&&!$('.toc')&&!$('nav.v5-toc')){
      var nav=d.createElement('nav');nav.className='v5-toc toc';nav.setAttribute('aria-label','이 페이지 목차');
      var tt=d.createElement('div');tt.className='v5-toc-t';tt.textContent='이 페이지';nav.appendChild(tt);
      var ol=d.createElement('ol');
      h2s.forEach(function(h){var li=d.createElement('li'),a=d.createElement('a');a.href='#'+h.id;var c=h.cloneNode(true);$$('.v5-anchor',c).forEach(function(x){x.remove()});var no=$('.h2no',c);var nt=no?no.textContent.trim()+'. ':'';if(no)no.remove();a.textContent=nt+(c.textContent||'').trim();li.appendChild(a);ol.appendChild(li)});
      nav.appendChild(ol);
      var first=h2s[0];first.parentNode.insertBefore(nav,first);
    }
    // TOC 현재 위치
    var tl=$$('.toc a[href^="#"]');
    if(tl.length&&'IntersectionObserver' in window){
      var heads=tl.map(function(a){return d.getElementById(decodeURIComponent(a.hash.slice(1)))}).filter(Boolean);
      var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){tl.forEach(function(a){a.classList.toggle('active',a.hash==='#'+en.target.id);if(a.hash==='#'+en.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});try{history.replaceState(null,'','#'+en.target.id)}catch(e){}}})},{rootMargin:'-70px 0px -70% 0px'});
      heads.forEach(function(h){io.observe(h)});
    }

    // 하단 이전/다음: .pnav 있으면 보강, 없으면 <link rel=prev/next> 또는 window.__prev/__next 로 생성
    var lp=$('link[rel=prev]'),ln=$('link[rel=next]');
    var prev=window.__prev||(lp&&lp.getAttribute('href')),next=window.__next||(ln&&ln.getAttribute('href'));
    var pn=$('.pnav');
    if(pn){
      if(prev&&!$('a[href="'+prev+'"]',pn)){var sp=pn.firstElementChild;var a=d.createElement('a');a.href=prev;a.rel='prev';a.textContent='‹ 이전 문제';if(sp&&sp.tagName==='SPAN'&&!sp.textContent.trim())sp.appendChild(a);else pn.insertBefore(a,pn.firstChild)}
    }else if(prev||next){
      var nv=d.createElement('nav');nv.className='v5-pn';nv.setAttribute('aria-label','이전/다음');
      var l=d.createElement('span'),r=d.createElement('span');
      if(prev){var a1=d.createElement('a');a1.href=prev;a1.rel='prev';a1.textContent='‹ '+(lp&&lp.title||'이전');l.appendChild(a1)}
      if(next){var a2=d.createElement('a');a2.href=next;a2.rel='next';a2.textContent=(ln&&ln.title||'다음')+' ›';r.appendChild(a2)}
      nv.appendChild(l);nv.appendChild(r);paper.appendChild(nv);
    }

    // 맨 위로
    var tp=d.createElement('a');tp.className='to-top';tp.href='#top';tp.textContent='↑ 맨 위로';d.body.appendChild(tp);
    var tick=false;addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){tp.classList.toggle('show',scrollY>700);tick=false})},{passive:true});

    // 인쇄 전 details 펼침
    addEventListener('beforeprint',function(){$$('details').forEach(function(x){x.dataset.wasOpen=x.open?'1':'0';x.open=true})});
    addEventListener('afterprint',function(){$$('details').forEach(function(x){if(x.dataset.wasOpen==='0')x.open=false})});
  });

  // hover prefetch
  d.addEventListener('mouseover',function(e){
    var a=e.target.closest&&e.target.closest('a[href]');
    if(!a||a.dataset.pf||a.origin!==location.origin||a.pathname===location.pathname)return;
    var l=d.createElement('link');l.rel='prefetch';l.href=a.href;d.head.appendChild(l);a.dataset.pf='1';
  },{passive:true});
})();
