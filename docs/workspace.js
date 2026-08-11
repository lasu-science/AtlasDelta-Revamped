// WorkspaceHome — extraída y adaptada de app.js (navegación real + pestaña Artículos para admins)
function WorkspaceHome() {
  var tab = 'models', showNew = false, newName = '', newDomain = 'general', newKind = '2d';
  var admin = isAdmin();

  function getData() {
    var u = getU();
    return {
      models: JSON.parse(localStorage.getItem('ad_models_'+u) || '[]'),
      docs: JSON.parse(localStorage.getItem('ad_docs_'+u) || '[]'),
      plots: JSON.parse(localStorage.getItem('ad_plots_'+u) || '[]'),
      articles: getAllArticles()
    };
  }

  function refresh() { renderWsContent(getData()); updateTabs(); }

  var tabKeys = admin ? ['models','documents','plots','articles'] : ['models','documents','plots'];
  function updateTabs() {
    tabKeys.forEach(function(t) {
      var el = document.getElementById('ws-tab-'+t);
      if (el) el.className = 'ws-tab' + (tab===t ? ' active' : '');
    });
  }

  function createModel() {
    if (!newName.trim()) return;
    var u = getU();
    var models = JSON.parse(localStorage.getItem('ad_models_'+u) || '[]');
    models.unshift({id:rid(),name:newName,domain:newDomain,status:'draft',updated_at:new Date().toISOString(),graph:{nodes:[],edges:[]}});
    localStorage.setItem('ad_models_'+u, JSON.stringify(models));
    showNew = false; newName = ''; refresh();
  }

  function createDoc() {
    if (!newName.trim()) return;
    var u = getU();
    var docs = JSON.parse(localStorage.getItem('ad_docs_'+u) || '[]');
    docs.unshift({id:rid(),title:newName,content:DEFAULT_LATEX,updated_at:new Date().toISOString()});
    localStorage.setItem('ad_docs_'+u, JSON.stringify(docs));
    showNew = false; newName = ''; refresh();
  }

  function createPlot() {
    if (!newName.trim()) return;
    var u = getU();
    var plots = JSON.parse(localStorage.getItem('ad_plots_'+u) || '[]');
    plots.unshift({id:rid(),name:newName,kind:newKind,description:null,spec:{series:[{id:rid(),name:'sin(x)',kind:'function-2d',color:'#22d3ee',visible:true,expr:'sin(x)',xMin:-10,xMax:10,samples:200}],view:{xMin:-10,xMax:10,grid:true,axes:true,xLabel:'x',yLabel:'y'}},updated_at:new Date().toISOString()});
    localStorage.setItem('ad_plots_'+u, JSON.stringify(plots));
    showNew = false; newName = ''; refresh();
  }

  function createArticle() {
    if (!newName.trim()) return;
    var slug = slugify(newName) || rid();
    saveCustomArticle({
      slug: slug, title: newName, category:'fisica', level:'introductorio', readingMinutes:10,
      summary:'', sections:[{id:'contenido', title:'Contenido', keywords:[], body:'Escribe aquí el contenido del artículo.'}],
      updated_at: new Date().toISOString()
    });
    showNew = false; newName = '';
    location.href = 'article-editor.html?slug=' + encodeURIComponent(slug);
  }

  function deleteItem(key, id) {
    var u = getU();
    var items = JSON.parse(localStorage.getItem(key+'_'+u) || '[]');
    items = items.filter(function(x){return x.id !== id;});
    localStorage.setItem(key+'_'+u, JSON.stringify(items));
    refresh();
  }

  function renderWsContent(data) {
    var content = document.getElementById('ws-dynamic-content');
    if (!content) return;
    content.innerHTML = '';

    if (tab === 'models') {
      content.appendChild(h('div',{style:{marginBottom:'16px'}},h('button',{className:'ws-create-btn',onClick:function(){showNew=true;newName='';refresh();}},'+ Nuevo modelo')));
      if (showNew) renderNewModal('modelo','INIT',function(){createModel();});
      if (data.models.length === 0) content.appendChild(h('p',{style:{color:'#8a8fa8',fontSize:'14px'}},'No hay modelos aún.'));
      else data.models.forEach(function(m){
        content.appendChild(h('div',{className:'ws-card'},
          h('a',{className:'ws-card-body',href:'model-editor.html?id='+encodeURIComponent(m.id),style:{display:'block',color:'inherit'}},
            h('div',{className:'ws-card-title'},m.name),
            h('div',{className:'ws-card-meta'},h('div',{style:{display:'flex',gap:'8px'}},Tag(m.domain,'muted'),Tag(m.status,'primary')),h('span',{},new Date(m.updated_at).toLocaleDateString()))
          ),
          h('div',{style:{borderTop:'1px solid rgba(55,65,81,0.6)',padding:'4px 16px',display:'flex',justifyContent:'flex-end'}},h('button',{className:'btn btn-ghost',onClick:function(e){e.stopPropagation();e.preventDefault();deleteItem('ad_models',m.id);},style:{fontSize:'12px',color:'#ef4444'}},'Borrar'))
        ));
      });
    } else if (tab === 'documents') {
      content.appendChild(h('div',{style:{marginBottom:'16px'}},h('button',{className:'ws-create-btn',onClick:function(){showNew=true;newName='';refresh();}},'+ Nuevo documento')));
      if (showNew) renderNewModal('documento LaTeX','.TEX',function(){createDoc();});
      if (data.docs.length === 0) content.appendChild(h('p',{style:{color:'#8a8fa8',fontSize:'14px'}},'No hay documentos aún.'));
      else data.docs.forEach(function(d){
        content.appendChild(h('div',{className:'ws-card'},
          h('a',{className:'ws-card-body',href:'document-editor.html?id='+encodeURIComponent(d.id),style:{display:'block',color:'inherit'}},
            h('div',{className:'ws-card-title'},d.title),
            h('div',{className:'ws-card-meta'},h('span',{},Tag('LaTeX','accent')),h('span',{},new Date(d.updated_at).toLocaleDateString()))
          ),
          h('div',{style:{borderTop:'1px solid rgba(55,65,81,0.6)',padding:'4px 16px',display:'flex',justifyContent:'flex-end'}},h('button',{className:'btn btn-ghost',onClick:function(e){e.stopPropagation();e.preventDefault();deleteItem('ad_docs',d.id);},style:{fontSize:'12px',color:'#ef4444'}},'Borrar'))
        ));
      });
    } else if (tab === 'plots') {
      content.appendChild(h('div',{style:{marginBottom:'16px'}},h('button',{className:'ws-create-btn',onClick:function(){showNew=true;newName='';refresh();}},'+ Nueva gráfica')));
      if (showNew) renderNewModal('gráfica','PLOT',function(){createPlot();});
      if (data.plots.length === 0) content.appendChild(h('p',{style:{color:'#8a8fa8',fontSize:'14px'}},'No hay gráficas aún.'));
      else data.plots.forEach(function(p){
        content.appendChild(h('div',{className:'ws-card'},
          h('a',{className:'ws-card-body',href:'plot-editor.html?id='+encodeURIComponent(p.id),style:{display:'block',color:'inherit'}},
            h('div',{className:'ws-card-title'},p.name),
            h('div',{className:'ws-card-meta'},h('div',{style:{display:'flex',gap:'8px'}},Tag(p.kind.toUpperCase(),'primary'),Tag((p.spec&&p.spec.series?p.spec.series.length:0)+' series','muted')),h('span',{},new Date(p.updated_at).toLocaleDateString()))
          ),
          h('div',{style:{borderTop:'1px solid rgba(55,65,81,0.6)',padding:'4px 16px',display:'flex',justifyContent:'flex-end'}},h('button',{className:'btn btn-ghost',onClick:function(e){e.stopPropagation();e.preventDefault();deleteItem('ad_plots',p.id);},style:{fontSize:'12px',color:'#ef4444'}},'Borrar'))
        ));
      });
    } else if (tab === 'articles') {
      content.appendChild(h('div',{style:{marginBottom:'16px'}},h('button',{className:'ws-create-btn',onClick:function(){showNew=true;newName='';refresh();}},'+ Nuevo artículo')));
      if (showNew) renderNewModal('artículo','ART',function(){createArticle();});
      if (data.articles.length === 0) content.appendChild(h('p',{style:{color:'#8a8fa8',fontSize:'14px'}},'No hay artículos.'));
      else data.articles.forEach(function(a){
        var builtin = isBuiltInSlug(a.slug);
        content.appendChild(h('div',{className:'ws-card'},
          h('a',{className:'ws-card-body',href:'article-editor.html?slug='+encodeURIComponent(a.slug),style:{display:'block',color:'inherit'}},
            h('div',{className:'ws-card-title'},a.title),
            h('div',{className:'ws-card-meta'},h('div',{style:{display:'flex',gap:'8px'}},builtin?Tag('Precargado','muted'):null,Tag((CATEGORY_META[a.category]||{}).label||a.category,'primary'),Tag((LEVEL_META[a.level]||{}).label||a.level,'muted')),h('span',{},a.readingMinutes+' min'))
          ),
          h('div',{style:{borderTop:'1px solid rgba(55,65,81,0.6)',padding:'4px 16px',display:'flex',justifyContent:'space-between'}},
            h('a',{className:'btn btn-ghost',href:'article.html?slug='+encodeURIComponent(a.slug),style:{fontSize:'12px'}},'Ver publicado'),
            h('button',{className:'btn btn-ghost',onClick:function(e){e.stopPropagation();e.preventDefault();if(confirm(builtin?'¿Ocultar este artículo precargado del repositorio? Podés reactivarlo más adelante si lo necesitás.':'¿Borrar este artículo?'))
              {deleteCustomArticle(a.slug);refresh();}},style:{fontSize:'12px',color:'#ef4444'}},builtin?'Ocultar':'Borrar'))
        ));
      });
    }
  }

  function renderNewModal(label, tag, onCreate) {
    var overlay = document.createElement('div');
    overlay.className = 'ws-modal-overlay';
    overlay.addEventListener('click', function(e) { if (e.target === overlay) { showNew = false; refresh(); } });
    var form = h('form',{className:'ws-modal',onSubmit:function(e){e.preventDefault();onCreate();}},
      h('div',{className:'ws-modal-header'},h('h2',{style:{fontWeight:600}},'Nuevo '+label),h('span',{style:{fontSize:'10px',letterSpacing:'0.1em',color:'#8a8fa8'}},tag)),
      h('div',{className:'ws-modal-body'},
        h('label',{},'Nombre'),
        h('input',{value:newName,onInput:function(e){newName=e.target.value;},placeholder:'Nombre...',autoFocus:true})
      ),
      h('div',{className:'ws-modal-footer'},
        h('button',{className:'btn btn-ghost',type:'button',onClick:function(){showNew=false;refresh();}},'Cancelar'),
        h('button',{className:'btn btn-primary',type:'submit'},'Crear')
      )
    );
    overlay.appendChild(form);
    document.getElementById('ws-dynamic-content').appendChild(overlay);
  }

  var tabLabels = {models:'Modelos', documents:'Documentos LaTeX', plots:'Gráficas', articles:'Artículos'};
  var page = h('div',{},
    h('div',{className:'ws-content'},
      h('div',{className:'ws-section-header'},
        h('div',{},h('div',{className:'ws-index'},'// WORKSPACE'),h('h1',{},'Tu biblioteca'),h('p',{style:{fontSize:'14px',color:'#8a8fa8',marginTop:'4px'}},'Modelos, documentos y gráficas.'+(admin?' Y artículos del repositorio.':''))),
        h('div',{className:'ws-tabs'},
          tabKeys.map(function(t){
            return h('button',{id:'ws-tab-'+t,className:'ws-tab'+(tab===t?' active':''),onClick:function(){tab=t;showNew=false;refresh();}},tabLabels[t]);
          })
        )
      ),
      h('div',{id:'ws-dynamic-content'})
    )
  );
  setTimeout(function(){refresh();}, 0);
  return page;
}

bootWorkspacePage(WorkspaceHome);
