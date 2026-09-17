// ArticleEditorPage — nueva página, solo para administradores.
// Permite editar metadatos (Ciencia, Título, Descripción corta, Nivel, Tiempo de lectura)
// y el contenido por secciones (markdown + LaTeX, con vista previa en vivo).
// Los artículos ahora viven en Firestore (compartidos entre dispositivos), así
// que cargarlos es async y el guardado usa un pequeño debounce para no escribir
// en el servidor en cada tecla.
function ArticleEditorPage() {
  if (!isAdmin()) {
    return h('div',{style:{padding:'80px 24px',textAlign:'center'}},
      h('h1',{style:{fontSize:'1.5rem'}},'Acceso restringido'),
      h('p',{style:{color:'#8a8fa8',marginTop:'8px'}},'La edición de artículos es solo para administradores.'),
      h('a',{className:'btn btn-primary',href:'workspace.html',style:{marginTop:'24px',display:'inline-block'}},'← Volver al workspace')
    );
  }

  var slug = new URLSearchParams(location.search).get('slug');
  var root = h('div',{}, h('p',{style:{padding:'80px 24px',textAlign:'center',color:'#8a8fa8'}},'Cargando artículo…'));

  getArticle(slug).then(function(original){
    root.innerHTML = '';
    if (!original) { root.appendChild(NotFound()); return; }
    root.appendChild(buildEditor(JSON.parse(JSON.stringify(original)))); // editamos una copia
  }).catch(function(err){
    root.innerHTML = '';
    root.appendChild(h('p',{style:{padding:'80px 24px',textAlign:'center',color:'#ef4444'}},'No se pudo cargar el artículo: '+(err.message||err)));
  });

  // Etiquetas legibles para los widgets disponibles (opcional: si un widget
  // nuevo no tiene entrada acá, se muestra directamente su clave).
  var WIDGET_LABELS = { 'eng-trent1000-3d': 'Motor Trent 1000 (visor 3D)' };

  function buildEditor(article) {
    // La lista de widgets sale del registro real WIDGETS de shared.js (no de
    // una lista fija acá), para no volver a desincronizarse la próxima vez
    // que se agreguen o saquen widgets. Si una sección apunta a un widget que
    // ya no existe (por ejemplo, uno de los widgets 2D viejos que se sacaron),
    // se lo agrega igual a las opciones de ESA sección, marcado como
    // "(eliminado)", para que el admin lo vea y decida qué poner en su lugar
    // en vez de perderlo en silencio.
    function widgetKeys() { return (typeof WIDGETS === 'object' && WIDGETS) ? Object.keys(WIDGETS) : []; }
    function widgetOptionsFor(current) {
      var opts = [''].concat(widgetKeys());
      if (current && opts.indexOf(current) === -1) opts.push(current);
      return opts;
    }
    function widgetLabel(w) {
      if (!w) return '(sin widget)';
      if (WIDGET_LABELS[w]) return WIDGET_LABELS[w];
      if (widgetKeys().indexOf(w) === -1) return w + ' (eliminado — elegí otro)';
      return w;
    }

    var saveTimer = null;
    function save(flash) {
      article.updated_at = new Date().toISOString();
      var statusEl = document.getElementById('ae-status');
      if (statusEl && flash !== false) statusEl.textContent = '● guardando…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function(){
        saveCustomArticle(article).then(function(){
          var el = document.getElementById('ae-status');
          if (el && flash !== false) { el.textContent = '✓ guardado'; clearTimeout(el._t); el._t = setTimeout(function(){ if(el) el.textContent=''; }, 1200); }
        }).catch(function(err){
          var el = document.getElementById('ae-status');
          if (el) el.textContent = '⚠ error al guardar';
          console.error('Error guardando artículo:', err);
        });
      }, 600); // agrupa tecleos seguidos en una sola escritura a Firestore
    }

    function updatePreview(i) {
      var el = document.getElementById('ae-preview-'+i);
      if (!el) return;
      try { el.innerHTML = renderMdMath(article.sections[i].body); }
      catch (e) { el.innerHTML = '<p style="color:#ef4444">Error al renderizar.</p>'; }
    }

    function moveSection(i, dir) {
      var j = i + dir;
      if (j < 0 || j >= article.sections.length) return;
      var tmp = article.sections[i];
      article.sections[i] = article.sections[j];
      article.sections[j] = tmp;
      save();
      renderSections();
    }

    function renderSections() {
      var wrap = document.getElementById('ae-sections');
      if (!wrap) return;
      wrap.innerHTML = '';
      article.sections.forEach(function(s, i) {
        wrap.appendChild(h('div',{className:'ae-section-box'},
          h('div',{className:'ae-section-head'},
            h('input',{value:s.title,placeholder:'Título de la sección',onInput:function(e){s.title=e.target.value;save();}}),
            h('select',{onChange:function(e){if(e.target.value){s.widget=e.target.value;}else{delete s.widget;}save();}},
              widgetOptionsFor(s.widget).map(function(w){return h('option',{value:w,selected:(s.widget||'')===w||undefined},widgetLabel(w));})
            ),
            h('button',{className:'btn btn-ghost',title:'Subir sección',disabled:i===0||undefined,onClick:function(){moveSection(i,-1);}},'↑'),
            h('button',{className:'btn btn-ghost',title:'Bajar sección',disabled:i===article.sections.length-1||undefined,onClick:function(){moveSection(i,1);}},'↓'),
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

  return root;
}

bootWorkspacePage(ArticleEditorPage);