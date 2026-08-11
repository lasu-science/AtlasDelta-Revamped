// ArticleEditorPage — nueva página, solo para administradores.
// Permite editar metadatos (Ciencia, Título, Descripción corta, Nivel, Tiempo de lectura)
// y el contenido por secciones (markdown + LaTeX, con vista previa en vivo).
function ArticleEditorPage() {
  if (!isAdmin()) {
    return h('div',{style:{padding:'80px 24px',textAlign:'center'}},
      h('h1',{style:{fontSize:'1.5rem'}},'Acceso restringido'),
      h('p',{style:{color:'#8a8fa8',marginTop:'8px'}},'La edición de artículos es solo para administradores.'),
      h('a',{className:'btn btn-primary',href:'workspace.html',style:{marginTop:'24px',display:'inline-block'}},'← Volver al workspace')
    );
  }

  var slug = new URLSearchParams(location.search).get('slug');
  var original = getArticle(slug);
  if (!original) return NotFound();
  var article = JSON.parse(JSON.stringify(original)); // editamos una copia; save() persiste el snapshot completo

  var WIDGET_OPTIONS = ['','phys-projectile','phys-friction','phys-spring','phys-pendulum','phys-ohm','phys-wave','phys-snell','phys-energy','phys-doppler','math-derivative','math-eigen','eng-pid','eng-bode','eng-beam','chem-equilibrium','chem-ph','chem-lechatelier','phys-decay','phys-collision','math-newton-raphson'];

  function save(flash) {
    article.updated_at = new Date().toISOString();
    saveCustomArticle(article);
    if (flash !== false) {
      var statusEl = document.getElementById('ae-status');
      if (statusEl) { statusEl.textContent = '✓ guardado'; clearTimeout(statusEl._t); statusEl._t = setTimeout(function(){ if(statusEl) statusEl.textContent=''; }, 1500); }
    }
  }

  function updatePreview(i) {
    var el = document.getElementById('ae-preview-'+i);
    if (!el) return;
    try { el.innerHTML = renderMdMath(article.sections[i].body); }
    catch (e) { el.innerHTML = '<p style="color:#ef4444">Error al renderizar.</p>'; }
  }

  function renderSections() {
    var wrap = document.getElementById('ae-sections');
    if (!wrap) return;
    wrap.innerHTML = '';
    article.sections.forEach(function(s, i) {
      wrap.appendChild(h('div',{className:'ae-section-box'},
        h('div',{className:'ae-section-head'},
          h('input',{value:s.title,placeholder:'Título de la sección',onInput:function(e){s.title=e.target.value;save();}}),
          h('select',{onChange:function(e){s.widget=e.target.value||undefined;save();}},
            WIDGET_OPTIONS.map(function(w){return h('option',{value:w,selected:(s.widget||'')===w||undefined},w||'(sin widget)');})
          ),
          article.sections.length>1 ? h('button',{className:'btn btn-ghost',style:{color:'#ef4444'},onClick:function(){article.sections.splice(i,1);save();renderSections();}},'Borrar sección') : null
        ),
        h('div',{className:'ae-section-grid'},
          h('textarea',{value:s.body,placeholder:'Markdown + LaTeX: $fórmula$, $$bloque$$, **negrita**, tablas con |...|',onInput:function(e){s.body=e.target.value;save();updatePreview(i);}}),
          h('div',{className:'art-body ae-preview',id:'ae-preview-'+i})
        )
      ));
    });
    article.sections.forEach(function(s,i){ updatePreview(i); });
  }

  function addSection() {
    article.sections.push({id:'sec-'+rid(), title:'Nueva sección', keywords:[], body:'Escribe aquí...'});
    save(false);
    renderSections();
  }

  var page = h('div',{},
    h('div',{className:'ws-content'},
      h('div',{className:'ws-section-header'},
        h('div',{},h('div',{className:'ws-index'},'// EDITOR DE ARTÍCULO'),h('h1',{id:'ae-title-display'},article.title||'Sin título')),
        h('div',{style:{display:'flex',gap:'12px',alignItems:'center'}},
          h('span',{id:'ae-status',style:{fontSize:'11px',color:'#34d399'}},''),
          h('a',{className:'btn btn-outline',href:'article.html?slug='+encodeURIComponent(article.slug)},'Ver publicado'),
          h('a',{className:'btn btn-ghost',href:'workspace.html'},'← Volver')
        )
      ),
      h('div',{className:'ae-meta-grid'},
        h('label',{},h('span',{},'Ciencia'),
          h('select',{onChange:function(e){article.category=e.target.value;save();}},
            Object.keys(CATEGORY_META).map(function(k){return h('option',{value:k,selected:article.category===k||undefined},CATEGORY_META[k].label);})
          )
        ),
        h('label',{},h('span',{},'Título'),
          h('input',{value:article.title,onInput:function(e){article.title=e.target.value;document.getElementById('ae-title-display').textContent=e.target.value||'Sin título';save();}})
        ),
        h('label',{className:'ae-meta-full'},h('span',{},'Descripción corta'),
          h('input',{value:article.summary,placeholder:'Una o dos líneas que resuman el artículo...',onInput:function(e){article.summary=e.target.value;save();}})
        ),
        h('label',{},h('span',{},'Nivel'),
          h('select',{onChange:function(e){article.level=e.target.value;save();}},
            Object.keys(LEVEL_META).map(function(k){return h('option',{value:k,selected:article.level===k||undefined},LEVEL_META[k].label);})
          )
        ),
        h('label',{},h('span',{},'Tiempo de lectura (min)'),
          h('input',{type:'number',min:'1',value:article.readingMinutes,onInput:function(e){article.readingMinutes=Number(e.target.value)||1;save();}})
        )
      ),
      h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'32px 0 12px'}},
        h('h2',{style:{fontSize:'1.1rem',fontFamily:'var(--font-display)'}},'Secciones'),
        h('button',{className:'ws-create-btn',onClick:addSection},'+ Nueva sección')
      ),
      h('div',{id:'ae-sections'})
    )
  );
  setTimeout(renderSections, 0);
  return page;
}

bootWorkspacePage(ArticleEditorPage);
