// LibraryIndex — extraída y adaptada de app.js (navegación real, incluye artículos de admin)
function LibraryIndex() {
  var ALL = getAllArticles();
  var container = h('div',{});
  container.appendChild(h('div',{className:'library-header'},
    h('div',{style:{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:'#8a8fa8',marginBottom:'16px'}},
      h('a',{className:'btn btn-ghost',href:'index.html'},'Inicio'),h('span',{},'/'),h('span',{},'Repositorio')
    ),
    h('h1',{},'Repositorio científico'),
    h('p',{className:'desc'},'Artículos profundos sobre conceptos fundamentales en cuatro áreas.'),
    h('div',{className:'search-box'},
      h('span',{innerHTML:'🔍',style:{fontSize:'14px'}}),
      h('input',{type:'text',id:'search-input',placeholder:'Buscar p.ej. "fricción", "Bernoulli", "PID"...',onInput:function(e){
        var q=e.target.value.trim().toLowerCase();
        var results=document.getElementById('search-results');
        if(q.length<2){results.classList.remove('open');return;}
        var matches=[];
        ALL.forEach(function(a){a.sections.forEach(function(s){
          var t=(a.title+' '+s.title+' '+(s.keywords||[]).join(' ')+' '+s.body).toLowerCase();
          if(t.indexOf(q)>=0)matches.push({slug:a.slug,title:a.title,cat:a.category,sid:s.id,stitle:s.title});
        });});
        results.innerHTML='';
        if(matches.length===0)results.innerHTML='<div style="padding:12px;font-size:12px;color:#8a8fa8">Sin resultados.</div>';
        else matches.slice(0,10).forEach(function(m){
          results.appendChild(h('a',{className:'search-result-item',href:'article.html?slug='+encodeURIComponent(m.slug)+'#'+m.sid},
            h('div',{className:'sr-title'},m.title+' → '+m.stitle),
            h('div',{className:'sr-sub'},CATEGORY_META[m.cat]?CATEGORY_META[m.cat].label:m.cat)));
        });
        results.classList.add('open');
      }}),
      h('div',{className:'search-results',id:'search-results'})
    ),
    h('div',{className:'cat-pills'},
      Object.keys(CATEGORY_META).map(function(k){
        var v=CATEGORY_META[k], count=ALL.filter(function(a){return a.category===k;}).length;
        return h('button',{className:'cat-pill',onClick:function(){var el=document.getElementById(k);if(el)el.scrollIntoView({behavior:'smooth'});}},v.label+' · '+count);
      })
    )
  ));

  Object.keys(CATEGORY_META).forEach(function(catKey){
    var catMeta=CATEGORY_META[catKey];
    var items=ALL.filter(function(a){return a.category===catKey;});
    container.appendChild(h('section',{id:catKey,style:{scrollMarginTop:'80px',marginBottom:'40px'}},
      h('div',{style:{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:'16px'}},
        h('div',{},h('h2',{style:{fontSize:'1.5rem',fontWeight:600,fontFamily:'var(--font-display)'}},catMeta.label),h('p',{style:{fontSize:'14px',color:'#8a8fa8'}},catMeta.description)),
        h('span',{style:{fontSize:'12px',color:'#8a8fa8'}},items.length+' artículo'+(items.length===1?'':'s'))
      ),
      h('div',{className:'article-grid'},
        items.map(function(a){return h('a',{className:'article-card',href:'article.html?slug='+encodeURIComponent(a.slug)},
          h('div',{className:'ac-meta'},Tag((LEVEL_META[a.level]||{}).label||a.level,a.level==='introductorio'?'muted':a.level==='intermedio'?'primary':'warn'),h('span',{},a.readingMinutes+' min')),
          h('h3',{},a.title),h('p',{className:'ac-summary'},a.summary),
          h('div',{className:'ac-bottom'},h('span',{},a.sections.length+' secciones'),h('span',{style:{color:'#22d3ee'}},'Leer artículo →')));})
      )
    ));
  });

  setTimeout(function(){
    document.addEventListener('click',function(e){
      var sr=document.getElementById('search-results'),si=document.getElementById('search-input');
      if(sr&&!sr.contains(e.target)&&e.target!==si)sr.classList.remove('open');
    });
  },100);
  return container;
}

bootPage('library', LibraryIndex);
