// renderLatexPreview + DocumentEditorPage — extraídas y adaptadas de app.js
function renderLatexPreview(src) {
  var body = src;
  var m = body.match(/\\begin\{document\}([\s\S]*)\\end\{document\}/);
  if (m) body = m[1];
  var title = (src.match(/\\title\{([^}]*)\}/)||[])[1];
  var author = (src.match(/\\author\{([^}]*)\}/)||[])[1];
  var dateM = (src.match(/\\date\{([^}]*)\}/)||[])[1];
  var out = '';
  if (/\\maketitle/.test(body)) {
    out += '<div style="text-align:center;margin-bottom:24px">';
    if (title) out += '<h1 style="font-size:1.6em;margin-bottom:6px">'+title+'</h1>';
    if (author) out += '<div style="color:#555">'+author+'</div>';
    if (dateM) out += '<div style="color:#888;font-size:0.9em">'+dateM+'</div>';
    out += '</div>';
    body = body.replace(/\\maketitle/, '');
  }
  body = body.replace(/\\title\{[^}]*\}|\\author\{[^}]*\}|\\date\{[^}]*\}/g, '');

  var slots = [];
  function slot(html) { slots.push(html); return '\x00L'+(slots.length-1)+'\x00'; }

  // Display math: \begin{equation}...\end{equation} and \[ ... \]
  body = body.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, function(_, e) { return slot(renderKatex(e.trim(), true)); });
  body = body.replace(/\\\[([\s\S]*?)\\\]/g, function(_, e) { return slot(renderKatex(e.trim(), true)); });
  // Inline math: $...$
  body = body.replace(/\$([^$\n]+?)\$/g, function(_, e) { return slot(renderKatex(e.trim(), false)); });

  // Sections
  body = body.replace(/\\section\{([^}]*)\}/g, '<h2 style="font-size:1.3em;margin:24px 0 10px">$1</h2>');
  body = body.replace(/\\subsection\{([^}]*)\}/g, '<h3 style="font-size:1.1em;margin:18px 0 8px">$1</h3>');
  // Bold / italic
  body = body.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  body = body.replace(/\\emph\{([^}]*)\}|\\textit\{([^}]*)\}/g, function(_, a, b) { return '<em>'+(a||b)+'</em>'; });
  // Lists
  body = body.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, function(_, items) {
    var lis = items.split('\\item').slice(1).map(function(i){ return '<li>'+i.trim()+'</li>'; }).join('');
    return '<ul style="margin:8px 0 8px 20px">'+lis+'</ul>';
  });
  body = body.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, function(_, items) {
    var lis = items.split('\\item').slice(1).map(function(i){ return '<li>'+i.trim()+'</li>'; }).join('');
    return '<ol style="margin:8px 0 8px 20px">'+lis+'</ol>';
  });
  // Remove any remaining unknown commands' braces (basic cleanup) and comments
  body = body.replace(/%.*$/gm, '');

  // Paragraphs: split on blank lines, wrap plain text lines (skip lines already turned into block HTML)
  var paras = body.split(/\n\s*\n/).map(function(p) {
    p = p.trim();
    if (!p) return '';
    if (/^<(h2|h3|ul|ol|div)/.test(p)) return p;
    return '<p style="margin-bottom:1em">'+p.replace(/\n/g,' ')+'</p>';
  }).join('');

  out += paras;
  out = out.replace(/\x00L(\d+)\x00/g, function(_, i) { return slots[Number(i)] || ''; });
  return out;
}

// ── Document Editor ────────────────────────────────────
function DocumentEditorPage() {
  var id = new URLSearchParams(location.search).get('id');
  var u = getU();
  var docs = JSON.parse(localStorage.getItem('ad_docs_'+u) || '[]');
  var doc = docs.find(function(d){return d.id===id;});
  if (!doc) return NotFound();

  function saveContent(text) {
    doc.content = text; doc.updated_at = new Date().toISOString();
    var allDocs = JSON.parse(localStorage.getItem('ad_docs_'+u) || '[]');
    var idx = allDocs.findIndex(function(d){return d.id===id;});
    if (idx >= 0) allDocs[idx] = doc;
    localStorage.setItem('ad_docs_'+u, JSON.stringify(allDocs));
  }

  function updatePreview(text) {
    var preview = document.getElementById('latex-preview');
    if (!preview) return;
    try { preview.innerHTML = renderLatexPreview(text); }
    catch (e) { preview.innerHTML = '<p style="color:#c00">Error al renderizar el documento.</p>'; }
  }

  function downloadPdf() {
    var preview = document.getElementById('latex-preview');
    var html = preview ? preview.innerHTML : '';
    var w = window.open('', '_blank');
    if (!w) { alert('El navegador bloqueó la ventana emergente. Habilitá los popups para descargar el PDF.'); return; }
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+doc.title+'</title>'+
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">'+
      '<style>body{font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#111;max-width:700px;margin:32px auto;padding:0 16px}</style>'+
      '</head><body>'+html+'</body></html>'
    );
    w.document.close();
    w.onload = function() { w.focus(); w.print(); };
  }

  var companionDrawer = h('div',{className:'companion-inline',style:{display:'none',borderTop:'1px solid rgba(55,65,81,0.8)',margin:'0'}},
    CompanionPanel({
      id:'doc',
      label:'Explicar este documento',
      hint:'Interpreto el contenido y las fórmulas de tu documento LaTeX.',
      buildPrompt:function(){
        return {
          system:'Sos un copiloto científico integrado en un editor de documentos LaTeX (física, química, matemática o ingeniería). Se te va a mostrar el código fuente LaTeX completo de un documento. Explicá en español, de forma clara y concisa: (1) de qué tema trata el documento, (2) interpretá el significado físico/matemático de las fórmulas presentes (si hay ecuaciones en modo $...$ o \\begin{equation}), (3) sugerencias de qué podría faltar o agregarse para completarlo mejor. Si el documento está prácticamente vacío (solo la plantilla por defecto), decilo y sugerí cómo empezar a desarrollarlo.',
          user: doc.content || DEFAULT_LATEX
        };
      }
    })
  );

  var page = h('div',{style:{flex:'1',display:'flex',flexDirection:'column',minHeight:'0'}},
    h('div',{className:'model-editor-bar'},
      h('a',{className:'btn btn-ghost',href:'workspace.html'},'← Volver'),
      h('input',{value:doc.title,onInput:function(e){doc.title=e.target.value;var allDocs=JSON.parse(localStorage.getItem('ad_docs_'+u)||'[]');var idx=allDocs.findIndex(function(d){return d.id===id;});if(idx>=0){allDocs[idx].title=e.target.value;allDocs[idx].updated_at=new Date().toISOString();localStorage.setItem('ad_docs_'+u,JSON.stringify(allDocs));}}}),
      h('button',{className:'btn btn-outline',style:{marginLeft:'auto'},onClick:function(){companionDrawer.style.display = companionDrawer.style.display==='none' ? 'block' : 'none';}},'🤖 Copiloto'),
      h('button',{className:'btn btn-outline',onClick:downloadPdf},'⬇ Descargar PDF'),
      h('span',{style:{fontSize:'11px',color:'#34d399'}},'✓ autosave')
    ),
    h('div',{style:{flex:'1',display:'grid',gridTemplateColumns:'1fr 1fr',minHeight:'0'}},
      h('div',{style:{borderRight:'1px solid rgba(55,65,81,0.8)',overflow:'hidden',background:'#1a1f2e'}},
        h('textarea',{style:{width:'100%',height:'100%',background:'transparent',border:'none',color:'#e2e8f0',fontFamily:'var(--font-mono)',fontSize:'13px',padding:'16px',resize:'none',outline:'none',lineHeight:'1.6'},onInput:function(e){saveContent(e.target.value);updatePreview(e.target.value);}},doc.content||DEFAULT_LATEX)
      ),
      h('div',{style:{overflow:'auto',background:'#fff'}},
        h('div',{id:'latex-preview',style:{maxWidth:'700px',margin:'0 auto',padding:'32px',fontFamily:'Georgia, serif',fontSize:'15px',color:'#111',lineHeight:'1.6'}})
      )
    ),
    companionDrawer
  );
  setTimeout(function(){ updatePreview(doc.content||DEFAULT_LATEX); }, 0);
  return page;
}

bootWorkspacePage(DocumentEditorPage);
