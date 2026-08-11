// LibraryArticle — extraída y adaptada de app.js (navegación real vía ?slug=)
function LibraryArticle() {
  var slug = new URLSearchParams(location.search).get('slug');
  var article = getArticle(slug);
  if (!article) return NotFound();
  var meta = CATEGORY_META[article.category] || {label:article.category, tone:'primary'};
  var ALL = getAllArticles();
  var related = ALL.filter(function(a){return a.category===article.category&&a.slug!==article.slug;}).slice(0,4);
  var canEdit = isAdmin();

  var c = h('div',{className:'article-layout'});
  var ae = h('article',{className:'article-view',style:{minWidth:'0'}},
    h('nav',{className:'breadcrumb'},
      h('a',{className:'btn btn-ghost',href:'index.html'},'Inicio'),h('span',{},'/'),
      h('a',{className:'btn btn-ghost',href:'library.html'},'Repositorio'),h('span',{},'/'),
      h('a',{className:'btn btn-ghost',href:'library.html#'+article.category},meta.label)
    ),
    h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'32px'}},
      h('a',{className:'btn btn-ghost',href:'library.html'},'← Volver al repositorio'),
      canEdit ? h('a',{className:'btn btn-outline',href:'article-editor.html?slug='+encodeURIComponent(article.slug)},'✎ Editar artículo') : null
    ),
    h('header',{},
      h('div',{className:'art-meta'},Tag((LEVEL_META[article.level]||{}).label||article.level,article.level==='introductorio'?'muted':article.level==='intermedio'?'primary':'warn'),Tag(meta.label,meta.tone),Tag(article.readingMinutes+' min','muted')),
      h('h1',{},article.title),h('p',{className:'art-summary'},article.summary)
    ),
    h('div',{className:'companion-article'},
      CompanionPanel({
        id:'article',
        label:'Explicar este artículo',
        hint:'Te doy un resumen interpretativo y contexto adicional sobre este artículo.',
        buildPrompt:function(){
          var body = article.sections.map(function(s){ return '## '+s.title+'\n'+s.body; }).join('\n\n');
          return {
            system:'Sos un copiloto científico integrado en un repositorio de artículos de física, química, matemática e ingeniería. Se te va a mostrar el título, resumen y contenido completo (en markdown con fórmulas LaTeX) de un artículo. Explicá en español, de forma clara y concisa (2-4 párrafos cortos): (1) una reexplicación del concepto central con tus propias palabras, más accesible que el texto original, (2) en qué contextos reales o aplicaciones se usa esto, (3) qué otros temas relacionados le convendría investigar después a alguien que está estudiando esto. No repitas el resumen textualmente.',
            user: 'Título: '+article.title+'\nCategoría: '+meta.label+'\nResumen: '+article.summary+'\n\n'+body
          };
        }
      })
    ),
    article.sections.map(function(s,i){
      return h('section',{className:'art-section',id:s.id},
        h('h2',{},h('span',{style:{fontSize:'12px',color:'#8a8fa8',marginRight:'8px'}},String(i+1).padStart(2,'0')),' ',s.title),
        h('div',{className:'art-body',innerHTML:renderMdMath(s.body)}),
        s.widget?renderWidget(s.widget):null
      );
    }),
    related.length>0?h('section',{className:'related-section'},h('h2',{},'Más en '+meta.label),h('div',{className:'related-grid'},
      related.map(function(r){return h('a',{className:'related-card',href:'article.html?slug='+encodeURIComponent(r.slug)},h('h3',{},r.title),h('p',{},r.summary));}))):null
  );
  var toc = h('aside',{className:'toc-sidebar'},h('div',{className:'toc-sticky'},
    h('div',{className:'toc-label'},'Contenido'),
    h('ol',{},article.sections.map(function(s,i){return h('li',{},h('a',{href:'#'+s.id,onClick:function(e){e.preventDefault();var el=document.getElementById(s.id);if(el)el.scrollIntoView({behavior:'smooth'});}},h('span',{style:{marginRight:'8px'}},String(i+1).padStart(2,'0')),s.title));}))
  ));
  c.appendChild(ae); c.appendChild(toc);

  setTimeout(function(){var hash=location.hash.slice(1);if(hash){var el=document.getElementById(hash);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}},100);
  return c;
}

bootPage('library', LibraryArticle);
