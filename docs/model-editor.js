// ModelEditorPage — extraída y adaptada de app.js (navegación real vía ?id=)
function ModelEditorPage() {
  var id = new URLSearchParams(location.search).get('id');
  var u = getU();
  var models = JSON.parse(localStorage.getItem('ad_models_'+u) || '[]');
  var model = models.find(function(m){return m.id===id;});
  if (!model) return NotFound();

  var graph = model.graph || {nodes:[],edges:[]};
  if (!graph.edges) graph.edges = [];
  var dragging = null, dragOffX = 0, dragOffY = 0, dragStartClientX = 0, dragStartClientY = 0;
  var panX = 0, panY = 0, panning = false, panSX = 0, panSY = 0;
  var connecting = null; // {fromNode, fromPort, fromDir, curX, curY} while dragging a cable

  function saveGraph(g) {
    var models = JSON.parse(localStorage.getItem('ad_models_'+u) || '[]');
    var idx = models.findIndex(function(m){return m.id===id;});
    if (idx >= 0) { models[idx].graph = g; models[idx].updated_at = new Date().toISOString(); }
    localStorage.setItem('ad_models_'+u, JSON.stringify(models));
  }

  function findPortById(node, portId) {
    var ports = node.ports || [];
    for (var i=0;i<ports.length;i++) if (ports[i].id === portId) return {port:ports[i], idx:i};
    return null;
  }
  function portPos(node, port, idx) {
    return { x: port.dir==='in' ? node.x : node.x+140, y: node.y + 30 + (idx+1)*18 };
  }
  function findPortAt(mx, my) {
    for (var ni = graph.nodes.length-1; ni >= 0; ni--) {
      var n = graph.nodes[ni], ports = n.ports || [];
      for (var pi = 0; pi < ports.length; pi++) {
        var pos = portPos(n, ports[pi], pi);
        var dx = mx-pos.x, dy = my-pos.y;
        if (dx*dx+dy*dy <= 81) return {node:n, port:ports[pi], idx:pi};
      }
    }
    return null;
  }
  function findEdgeAt(mx, my) {
    for (var i = graph.edges.length-1; i >= 0; i--) {
      var e = graph.edges[i];
      var sn = graph.nodes.find(function(n){return n.id===e.source;});
      var tn = graph.nodes.find(function(n){return n.id===e.target;});
      if (!sn || !tn) continue;
      var sInfo = findPortById(sn, e.sourcePort), tInfo = findPortById(tn, e.targetPort);
      var sp = sInfo ? portPos(sn, sInfo.port, sInfo.idx) : {x:sn.x+140,y:sn.y+30};
      var tp = tInfo ? portPos(tn, tInfo.port, tInfo.idx) : {x:tn.x,y:tn.y+30};
      // distance from point to segment
      var dx = tp.x-sp.x, dy = tp.y-sp.y, len2 = dx*dx+dy*dy || 1;
      var t = Math.max(0, Math.min(1, ((mx-sp.x)*dx+(my-sp.y)*dy)/len2));
      var px = sp.x+t*dx, py = sp.y+t*dy, dist2 = (mx-px)*(mx-px)+(my-py)*(my-py);
      if (dist2 <= 49) return e;
    }
    return null;
  }

  function drawCanvas() {
    var canvas = document.getElementById('graph-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var parent = canvas.parentElement;
    var w = parent.clientWidth, h = parent.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    
    // Grid
    ctx.strokeStyle = 'rgba(55,65,81,0.2)'; ctx.lineWidth = 0.5;
    var gs = 48;
    for (var x = ((panX % gs) + gs) % gs; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for (var y = ((panY % gs) + gs) % gs; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    
    // Edges (cables)
    graph.edges.forEach(function(e) {
      var sn = graph.nodes.find(function(n){return n.id===e.source;});
      var tn = graph.nodes.find(function(n){return n.id===e.target;});
      if (!sn || !tn) return;
      var sInfo = findPortById(sn, e.sourcePort), tInfo = findPortById(tn, e.targetPort);
      var sp = sInfo ? portPos(sn, sInfo.port, sInfo.idx) : {x:sn.x+140,y:sn.y+30};
      var tp = tInfo ? portPos(tn, tInfo.port, tInfo.idx) : {x:tn.x,y:tn.y+30};
      var sx = sp.x+panX, sy = sp.y+panY, tx = tp.x+panX, ty = tp.y+panY;
      var color = DOMAIN_COLOR[(sInfo&&sInfo.port.domain)] || 'rgba(34,211,238,0.8)';
      var midX = (sx+tx)/2;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.bezierCurveTo(midX,sy,midX,ty,tx,ty); ctx.stroke();
      var ang = Math.atan2(ty-sy, tx-sx);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx-8*Math.cos(ang-0.4),ty-8*Math.sin(ang-0.4)); ctx.lineTo(tx-8*Math.cos(ang+0.4),ty-8*Math.sin(ang+0.4)); ctx.closePath(); ctx.fill();
    });
    // Cable being dragged right now
    if (connecting) {
      var fn = graph.nodes.find(function(n){return n.id===connecting.fromNode;});
      if (fn) {
        var fpInfo = findPortById(fn, connecting.fromPort);
        var fp = fpInfo ? portPos(fn, fpInfo.port, fpInfo.idx) : {x:fn.x,y:fn.y};
        ctx.strokeStyle = 'rgba(251,191,36,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([5,3]);
        ctx.beginPath(); ctx.moveTo(fp.x+panX, fp.y+panY); ctx.lineTo(connecting.curX+panX, connecting.curY+panY); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    // Nodes
    graph.nodes.forEach(function(n) {
      var nx = n.x + panX, ny = n.y + panY, nh = n.h || 60;
      ctx.fillStyle = 'rgba(30,37,52,0.95)';
      ctx.strokeStyle = (dragging && n.id === dragging.id) ? '#22d3ee' : 'rgba(100,116,139,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); roundRect(ctx, nx, ny, 140, nh, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(35,42,56,0.5)';
      ctx.beginPath(); roundRect(ctx, nx, ny, 140, 28, [4,4,0,0]); ctx.fill();
      ctx.fillStyle = '#e2e8f0'; ctx.font = '12px "Space Grotesk", sans-serif';
      ctx.fillText(n.label || n.type || 'Block', nx+10, ny+19);
      // Botón de borrar (×)
      ctx.fillStyle = 'rgba(239,68,68,0.15)';
      ctx.beginPath(); ctx.arc(nx+140-14, ny+14, 8, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(nx+140-14-3.5, ny+14-3.5); ctx.lineTo(nx+140-14+3.5, ny+14+3.5);
      ctx.moveTo(nx+140-14+3.5, ny+14-3.5); ctx.lineTo(nx+140-14-3.5, ny+14+3.5);
      ctx.stroke();
      if (n.params && Object.keys(n.params).length) {
        ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(nx+140-30, ny+14, 3, 0, Math.PI*2); ctx.fill();
      }
      var ports = n.ports || [{id:'in',dir:'in',label:'input'},{id:'out',dir:'out',label:'output'}];
      ports.forEach(function(p, i) {
        var py = ny + 30 + (i+1)*18;
        var px = p.dir === 'in' ? nx : nx + 140;
        ctx.fillStyle = DOMAIN_COLOR[p.domain] || '#22d3ee';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#8a8fa8'; ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = p.dir === 'in' ? 'left' : 'right';
        ctx.fillText(p.label, p.dir === 'in' ? nx+12 : nx+128, py+4);
        ctx.textAlign = 'start';
      });
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (typeof r === 'number') r = [r,r,r,r];
    ctx.moveTo(x+r[0], y);
    ctx.lineTo(x+w-r[1], y); ctx.arcTo(x+w, y, x+w, y+r[1], r[1]);
    ctx.lineTo(x+w, y+h-r[2]); ctx.arcTo(x+w, y+h, x+w-r[2], y+h, r[2]);
    ctx.lineTo(x+r[3], y+h); ctx.arcTo(x, y+h, x, y+h-r[3], r[3]);
    ctx.lineTo(x, y+r[0]); ctx.arcTo(x, y, x+r[0], y, r[0]);
  }

  function addNode(type) {
    var bt = {
      compressor:{label:'Compressor',ports:[{id:'in',dir:'in',label:'inlet',domain:'fluid'},{id:'out',dir:'out',label:'outlet',domain:'fluid'},{id:'shaft',dir:'in',label:'shaft',domain:'mechanical'}]},
      turbine:{label:'Turbine',ports:[{id:'in',dir:'in',label:'gas',domain:'fluid'},{id:'out',dir:'out',label:'exhaust',domain:'fluid'},{id:'shaft',dir:'out',label:'shaft',domain:'mechanical'}]},
      chamber:{label:'CombChamber',ports:[{id:'in',dir:'in',label:'air',domain:'fluid'},{id:'fuel',dir:'in',label:'fuel',domain:'fluid'},{id:'out',dir:'out',label:'gas',domain:'fluid'}]},
      pump:{label:'Pump',ports:[{id:'in',dir:'in',label:'inlet',domain:'fluid'},{id:'out',dir:'out',label:'outlet',domain:'fluid'},{id:'shaft',dir:'in',label:'shaft',domain:'mechanical'}]},
      valve:{label:'Valve',ports:[{id:'in',dir:'in',label:'in',domain:'fluid'},{id:'out',dir:'out',label:'out',domain:'fluid'},{id:'cmd',dir:'in',label:'cmd',domain:'signal'}]},
      resistor:{label:'Resistor',ports:[{id:'a',dir:'in',label:'a',domain:'electrical'},{id:'b',dir:'out',label:'b',domain:'electrical'}]},
      capacitor:{label:'Capacitor',ports:[{id:'a',dir:'in',label:'a',domain:'electrical'},{id:'b',dir:'out',label:'b',domain:'electrical'}]},
      inductor:{label:'Inductor',ports:[{id:'a',dir:'in',label:'a',domain:'electrical'},{id:'b',dir:'out',label:'b',domain:'electrical'}]},
      voltage_src:{label:'VoltageSrc',ports:[{id:'pos',dir:'out',label:'+',domain:'electrical'},{id:'neg',dir:'out',label:'-',domain:'electrical'}]},
      source:{label:'Source',ports:[{id:'out',dir:'out',label:'out',domain:'signal'}]},
      sink:{label:'Sink',ports:[{id:'in',dir:'in',label:'in',domain:'signal'}]},
      gain:{label:'Gain',ports:[{id:'in',dir:'in',label:'u',domain:'signal'},{id:'out',dir:'out',label:'y',domain:'signal'}]},
      sum:{label:'Sum',ports:[{id:'a',dir:'in',label:'a',domain:'signal'},{id:'b',dir:'in',label:'b',domain:'signal'},{id:'out',dir:'out',label:'y',domain:'signal'}]},
      pid:{label:'PID',ports:[{id:'ref',dir:'in',label:'ref',domain:'signal'},{id:'fb',dir:'in',label:'fb',domain:'signal'},{id:'out',dir:'out',label:'u',domain:'signal'}]},
      heat_exchanger:{label:'HeatExch',ports:[{id:'hin',dir:'in',label:'hot in',domain:'thermal'},{id:'hout',dir:'out',label:'hot out',domain:'thermal'},{id:'cin',dir:'in',label:'cold in',domain:'thermal'},{id:'cout',dir:'out',label:'cold out',domain:'thermal'}]},
      heat_source:{label:'HeatSource',ports:[{id:'out',dir:'out',label:'Q',domain:'thermal'}]},
      thermal_mass:{label:'ThermalMass',ports:[{id:'in',dir:'in',label:'Q',domain:'thermal'},{id:'T',dir:'out',label:'T',domain:'thermal'}]},
      mass:{label:'Mass',ports:[{id:'f',dir:'in',label:'F',domain:'mechanical'},{id:'v',dir:'out',label:'v',domain:'mechanical'}]},
      spring_damper:{label:'SpringDamper',ports:[{id:'a',dir:'in',label:'a',domain:'mechanical'},{id:'b',dir:'out',label:'b',domain:'mechanical'}]},
      gearbox:{label:'Gearbox',ports:[{id:'in',dir:'in',label:'shaft in',domain:'mechanical'},{id:'out',dir:'out',label:'shaft out',domain:'mechanical'}]},
      reactor:{label:'Reactor',ports:[{id:'in',dir:'in',label:'feed',domain:'chemical'},{id:'out',dir:'out',label:'product',domain:'chemical'}]},
      mixer:{label:'Mixer',ports:[{id:'a',dir:'in',label:'a',domain:'chemical'},{id:'b',dir:'in',label:'b',domain:'chemical'},{id:'out',dir:'out',label:'mix',domain:'chemical'}]},
      separator:{label:'Separator',ports:[{id:'in',dir:'in',label:'feed',domain:'chemical'},{id:'top',dir:'out',label:'top',domain:'chemical'},{id:'bottom',dir:'out',label:'bottom',domain:'chemical'}]},
      and_gate:{label:'AND',ports:[{id:'a',dir:'in',label:'a',domain:'digital'},{id:'b',dir:'in',label:'b',domain:'digital'},{id:'out',dir:'out',label:'y',domain:'digital'}]},
      or_gate:{label:'OR',ports:[{id:'a',dir:'in',label:'a',domain:'digital'},{id:'b',dir:'in',label:'b',domain:'digital'},{id:'out',dir:'out',label:'y',domain:'digital'}]},
      adc:{label:'ADC',ports:[{id:'in',dir:'in',label:'analog',domain:'signal'},{id:'out',dir:'out',label:'digital',domain:'digital'}]},
      sensor:{label:'Sensor',ports:[{id:'in',dir:'in',label:'measurand',domain:'signal'},{id:'out',dir:'out',label:'data',domain:'data'}]},
      logger:{label:'DataLogger',ports:[{id:'in',dir:'in',label:'data',domain:'data'}]}
    };
    var t = bt[type] || {label:type,ports:[{id:'in',dir:'in',label:'in',domain:'signal'},{id:'out',dir:'out',label:'out',domain:'signal'}]};
    var n = {id:rid(),type:type,label:t.label,x:-panX+100+Math.random()*200,y:-panY+100+Math.random()*200,w:140,h:28+(t.ports.length+1)*18+8,ports:t.ports,params:{}};
    graph.nodes.push(n);
    saveGraph(graph);
    drawCanvas();
  }

  var DOMAIN_COLOR = {fluid:'#7dd3fc',thermal:'#fb923c',mechanical:'#a3e635',electrical:'#facc15',chemical:'#c084fc',signal:'#94a3b8',digital:'#22d3ee',data:'#f472b6'};
  var blockCategories = [
    {label:'Fluido',types:['compressor','turbine','chamber','pump','valve']},
    {label:'Eléctrico',types:['resistor','capacitor','inductor','voltage_src']},
    {label:'Señal/Control',types:['source','sink','gain','sum','pid','adc']},
    {label:'Térmico',types:['heat_exchanger','heat_source','thermal_mass']},
    {label:'Mecánico',types:['mass','spring_damper','gearbox']},
    {label:'Químico',types:['reactor','mixer','separator']},
    {label:'Digital/Datos',types:['and_gate','or_gate','sensor','logger']}
  ];
  var blockTypes = blockCategories.reduce(function(acc,c){return acc.concat(c.types);},[]);

  function closeBtnPos(n) { return { x: n.x+140-14, y: n.y+14 }; }
  function findCloseBtnAt(mx, my) {
    for (var i = graph.nodes.length-1; i >= 0; i--) {
      var pos = closeBtnPos(graph.nodes[i]);
      var dx = mx-pos.x, dy = my-pos.y;
      if (dx*dx+dy*dy <= 100) return graph.nodes[i];
    }
    return null;
  }
  function deleteNode(node) {
    graph.nodes = graph.nodes.filter(function(n){return n.id!==node.id;});
    graph.edges = graph.edges.filter(function(e){return e.source!==node.id && e.target!==node.id;});
    saveGraph(graph);
    drawCanvas();
  }

  function openNodeEditor(node) {
    var overlay = document.createElement('div');
    overlay.className = 'ws-modal-overlay';
    overlay.addEventListener('click', function(e){ if (e.target===overlay) overlay.remove(); });
    var labelVal = node.label;
    var paramRows = Object.keys(node.params||{}).map(function(k){ return {key:k, value:node.params[k]}; });
    if (paramRows.length === 0) paramRows.push({key:'', value:''});
    var paramsList = h('div',{id:'node-params-list'});
    function renderParams() {
      paramsList.innerHTML = '';
      paramRows.forEach(function(row, i){
        paramsList.appendChild(h('div',{style:{display:'flex',gap:'6px',marginBottom:'8px'}},
          h('input',{value:row.key,placeholder:'nombre (ej: función, ganancia)',style:{flex:'1',background:'#0f172a',border:'1px solid rgba(55,65,81,.8)',padding:'6px 8px',color:'#e2e8f0',fontFamily:'var(--font-mono)',fontSize:'12px'},onInput:function(e){row.key=e.target.value;}}),
          h('input',{value:row.value,placeholder:'valor (ej: sin(x), 2.5)',style:{flex:'1',background:'#0f172a',border:'1px solid rgba(55,65,81,.8)',padding:'6px 8px',color:'#e2e8f0',fontFamily:'var(--font-mono)',fontSize:'12px'},onInput:function(e){row.value=e.target.value;}}),
          h('button',{className:'btn btn-ghost',type:'button',style:{color:'#ef4444'},onClick:function(){paramRows.splice(i,1); if(!paramRows.length)paramRows.push({key:'',value:''}); renderParams();}},'×')
        ));
      });
    }
    renderParams();

    var form = h('form',{className:'ws-modal',style:{maxWidth:'440px'},onSubmit:function(e){
      e.preventDefault();
      node.label = labelInput.value.trim() || node.type;
      var newParams = {};
      paramRows.forEach(function(row){ if (row.key.trim()) newParams[row.key.trim()] = row.value; });
      node.params = newParams;
      saveGraph(graph);
      drawCanvas();
      overlay.remove();
    }},
      h('div',{className:'ws-modal-header'},h('h2',{style:{fontWeight:600}},'Editar bloque'),h('span',{style:{fontSize:'10px',letterSpacing:'0.1em',color:'#8a8fa8'}},'ID '+node.id)),
      h('div',{className:'ws-modal-body'},
        h('label',{},'Nombre del bloque'),
        (function(){ var inp = h('input',{value:labelVal,autoFocus:true}); labelInput = inp; return inp; })(),
        h('div',{style:{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.08em',color:'#8a8fa8',margin:'12px 0 8px'}},'Parámetros (funciones, características, etc.)'),
        paramsList,
        h('button',{className:'btn btn-outline',type:'button',style:{fontSize:'11px'},onClick:function(){paramRows.push({key:'',value:''});renderParams();}},'+ Agregar parámetro'),
        h('div',{style:{fontSize:'10px',color:'#8a8fa8',marginTop:'12px'}},'El identificador interno del bloque (ID) no cambia nunca, aunque renombres el bloque — así los cables no se rompen.')
      ),
      h('div',{className:'ws-modal-footer'},
        h('button',{className:'btn btn-ghost',type:'button',style:{color:'#ef4444',marginRight:'auto'},onClick:function(){ if(confirm('¿Eliminar este componente y sus cables conectados?')){ deleteNode(node); overlay.remove(); } }},'🗑 Eliminar componente'),
        h('button',{className:'btn btn-ghost',type:'button',onClick:function(){overlay.remove();}},'Cancelar'),
        h('button',{className:'btn btn-primary',type:'submit'},'Guardar')
      )
    );
    var labelInput; // asignado en el IIFE de arriba antes de usarse en el submit
    overlay.appendChild(form);
    document.body.appendChild(overlay);
  }

  function onDown(e) {
    var canvas = document.getElementById('graph-canvas'); if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left - panX, my = e.clientY - rect.top - panY;
    var portHit = findPortAt(mx, my);
    if (portHit) { connecting = {fromNode:portHit.node.id, fromPort:portHit.port.id, fromDir:portHit.port.dir, curX:mx, curY:my}; drawCanvas(); return; }
    for (var i = graph.nodes.length-1; i >= 0; i--) {
      var n = graph.nodes[i];
      if (mx >= n.x && mx <= n.x+140 && my >= n.y && my <= n.y+(n.h||60)) {
        dragging = {id:n.id, node:n}; dragOffX = mx-n.x; dragOffY = my-n.y; dragStartClientX = e.clientX; dragStartClientY = e.clientY; return;
      }
    }
    var edgeHit = findEdgeAt(mx, my);
    if (edgeHit) { graph.edges.splice(graph.edges.indexOf(edgeHit),1); saveGraph(graph); drawCanvas(); return; }
    panning = true; panSX = e.clientX - panX; panSY = e.clientY - panY;
  }
  function onMove(e) {
    var canvas = document.getElementById('graph-canvas'); if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    if (connecting) {
      connecting.curX = e.clientX - rect.left - panX;
      connecting.curY = e.clientY - rect.top - panY;
      drawCanvas();
    } else if (dragging) {
      dragging.node.x = e.clientX - rect.left - panX - dragOffX;
      dragging.node.y = e.clientY - rect.top - panY - dragOffY;
      drawCanvas();
    } else if (panning) {
      panX = e.clientX - panSX; panY = e.clientY - panSY;
      drawCanvas();
    } else {
      var mx = e.clientX - rect.left - panX, my = e.clientY - rect.top - panY;
      canvas.style.cursor = findPortAt(mx,my) ? 'crosshair' : (findEdgeAt(mx,my) ? 'pointer' : 'default');
    }
  }
  function onUp(e) {
    if (connecting) {
      var canvas = document.getElementById('graph-canvas');
      if (canvas && e && typeof e.clientX === 'number') {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left - panX, my = e.clientY - rect.top - panY;
        var hit = findPortAt(mx, my);
        if (hit && hit.node.id !== connecting.fromNode && hit.port.dir !== connecting.fromDir) {
          var src = connecting.fromDir === 'out' ? {node:connecting.fromNode, port:connecting.fromPort} : {node:hit.node.id, port:hit.port.id};
          var tgt = connecting.fromDir === 'out' ? {node:hit.node.id, port:hit.port.id} : {node:connecting.fromNode, port:connecting.fromPort};
          var exists = graph.edges.some(function(ed){return ed.source===src.node&&ed.sourcePort===src.port&&ed.target===tgt.node&&ed.targetPort===tgt.port;});
          if (!exists) { graph.edges.push({id:rid(), source:src.node, sourcePort:src.port, target:tgt.node, targetPort:tgt.port}); saveGraph(graph); }
        }
      }
      connecting = null; drawCanvas(); return;
    }
    if (dragging) {
      var moved = false;
      if (e && typeof e.clientX === 'number') {
        var ddx = e.clientX - dragStartClientX, ddy = e.clientY - dragStartClientY;
        moved = Math.sqrt(ddx*ddx + ddy*ddy) > 4;
      }
      saveGraph(graph);
      var clickedNode = dragging.node;
      dragging = null;
      if (!moved) { openNodeEditor(clickedNode); }
    }
    panning = false; drawCanvas();
  }

  function describeGraph() {
    if (!graph.nodes.length) return 'El diagrama está vacío (sin componentes todavía).';
    var lines = ['Modelo: "'+model.name+'" (dominio declarado: '+model.domain+')', '', 'Componentes:'];
    graph.nodes.forEach(function(n){
      var ports = (n.ports||[]).map(function(p){return p.label+'('+p.domain+','+p.dir+')';}).join(', ');
      lines.push('- '+n.label+' [tipo: '+n.type+'] — puertos: '+ports);
    });
    lines.push('', 'Conexiones:');
    if (!graph.edges.length) lines.push('(ninguna conexión todavía)');
    graph.edges.forEach(function(e){
      var sn=graph.nodes.find(function(n){return n.id===e.source;});
      var tn=graph.nodes.find(function(n){return n.id===e.target;});
      lines.push('- '+(sn?sn.label:e.source)+'.'+e.sourcePort+' → '+(tn?tn.label:e.target)+'.'+e.targetPort);
    });
    return lines.join('\n');
  }

  var nodeEditorSidebar = h('div',{id:'node-editor-sidebar',className:'companion-sidebar',style:{display:'none'}});

  function ensureParams(n) { if (!n.params) n.params = {}; return n.params; }

  function openNodeEditor(node) {
    var params = ensureParams(node);
    nodeEditorSidebar.innerHTML = '';

    var paramRows = h('div',{});
    function rebuildRows() {
      paramRows.innerHTML = '';
      Object.keys(params).forEach(function(k){
        var keyInput = h('input',{value:k,placeholder:'nombre',style:{width:'44%',background:'#0f172a',border:'1px solid rgba(55,65,81,.8)',padding:'4px 6px',color:'#e2e8f0',fontFamily:'var(--font-mono)',fontSize:'11px'}});
        var valInput = h('input',{value:params[k],placeholder:'valor',style:{width:'40%',background:'#0f172a',border:'1px solid rgba(55,65,81,.8)',padding:'4px 6px',color:'#e2e8f0',fontFamily:'var(--font-mono)',fontSize:'11px'}});
        keyInput.addEventListener('change',function(){
          var newKey = keyInput.value.trim();
          var val = params[k];
          delete params[k];
          if (newKey) params[newKey] = val;
          saveGraph(graph); rebuildRows();
        });
        valInput.addEventListener('input',function(){ params[k] = valInput.value; saveGraph(graph); });
        var delBtn = h('button',{className:'btn btn-ghost',style:{fontSize:'12px',padding:'2px 8px',color:'#ef4444'},onClick:function(){ delete params[k]; saveGraph(graph); rebuildRows(); }},'×');
        paramRows.appendChild(h('div',{style:{display:'flex',gap:'4px',marginBottom:'6px',alignItems:'center'}}, keyInput, valInput, delBtn));
      });
    }
    rebuildRows();

    var labelInput = h('input',{value:node.label,style:{width:'100%',background:'#0f172a',border:'1px solid rgba(55,65,81,.8)',padding:'6px 8px',color:'#e2e8f0',fontFamily:'var(--font-mono)',fontSize:'13px'}});
    labelInput.addEventListener('input',function(){ node.label = labelInput.value; saveGraph(graph); drawCanvas(); });

    nodeEditorSidebar.appendChild(
      h('div',{style:{display:'flex',flexDirection:'column',height:'100%'}},
        h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid rgba(55,65,81,.8)'}},
          h('span',{style:{fontSize:'11px',fontWeight:'600',color:'#e2e8f0',textTransform:'uppercase',letterSpacing:'.05em'}},'Editar componente'),
          h('button',{className:'btn btn-ghost',style:{fontSize:'11px'},onClick:function(){ nodeEditorSidebar.style.display='none'; }},'✕')
        ),
        h('div',{style:{padding:'14px',overflow:'auto',flex:'1',display:'flex',flexDirection:'column',gap:'16px'}},
          h('div',{style:{fontSize:'10px',color:'#8a8fa8'}}, 'ID: '+node.id+' · tipo: '+node.type+' (no editables — identifican al componente)'),
          h('label',{},
            h('div',{style:{fontSize:'11px',marginBottom:'6px',color:'#8a8fa8'}},'Nombre del bloque'),
            labelInput
          ),
          h('div',{},
            h('div',{style:{fontSize:'11px',marginBottom:'8px',color:'#8a8fa8'}},'Parámetros (funciones / características)'),
            paramRows,
            h('button',{className:'btn btn-outline',style:{fontSize:'11px',marginTop:'4px'},onClick:function(){
              var i=1, key='parametro'; while(params[key+(i>1?'_'+i:'')]!==undefined) i++;
              params[key+(i>1?'_'+i:'')] = '';
              saveGraph(graph); rebuildRows();
            }},'+ Agregar parámetro')
          ),
          h('button',{className:'btn btn-outline',style:{fontSize:'12px',color:'#ef4444',borderColor:'rgba(239,68,68,.5)',marginTop:'auto'},onClick:function(){
            if (!confirm('¿Borrar este componente y los cables conectados a él?')) return;
            graph.nodes = graph.nodes.filter(function(n){return n.id!==node.id;});
            graph.edges = graph.edges.filter(function(e){return e.source!==node.id && e.target!==node.id;});
            saveGraph(graph); drawCanvas();
            nodeEditorSidebar.style.display = 'none';
          }},'🗑 Borrar componente')
        )
      )
    );
    nodeEditorSidebar.style.display = 'flex';
  }

  var companionSidebar = h('div',{className:'companion-sidebar',style:{display:'none'}},
    CompanionPanel({
      id:'model',
      label:'Analizar diagrama',
      hint:'Te explico qué sistema representa este diagrama y te doy sugerencias.',
      buildPrompt:function(){
        return {
          system:'Sos un copiloto científico integrado en una herramienta de modelado por bloques (estilo Simulink/Modelica) para física, ingeniería y química. Se te va a mostrar la descripción textual de un diagrama de bloques con sus componentes, puertos y conexiones. Explicá en español, de forma clara y concisa (2-4 párrafos cortos o una lista breve): (1) qué sistema físico parece representar, (2) qué tipo de análisis se podría hacer con él, (3) sugerencias concretas de qué le falta o qué se podría mejorar/agregar. Si el diagrama está vacío o incompleto, decilo directamente y sugerí por dónde empezar.',
          user: describeGraph()
        };
      }
    })
  );

  var page = h('div',{style:{flex:'1',display:'flex',flexDirection:'column',minHeight:'0'}},
    h('div',{className:'model-editor-bar'},
      h('a',{className:'btn btn-ghost',href:'workspace.html'},'← Volver'),
      h('input',{value:model.name,onInput:function(e){model.name=e.target.value;var mods=JSON.parse(localStorage.getItem('ad_models_'+u)||'[]');var idx=mods.findIndex(function(m){return m.id===id;});if(idx>=0){mods[idx].name=e.target.value;mods[idx].updated_at=new Date().toISOString();localStorage.setItem('ad_models_'+u,JSON.stringify(mods));}}}),
      h('span',{style:{marginLeft:'auto',fontSize:'10px',color:'#8a8fa8',whiteSpace:'nowrap'}},'Click en un bloque para editarlo/borrarlo · arrastrá desde un puerto (●) para conectar'),
      h('button',{className:'btn btn-outline',style:{whiteSpace:'nowrap'},onClick:function(){companionSidebar.style.display = companionSidebar.style.display==='none' ? 'flex' : 'none';}},'🤖 Copiloto'),
      h('span',{style:{fontSize:'11px',color:'#34d399',whiteSpace:'nowrap'}},'✓ guardado')
    ),
    h('div',{style:{flex:'1',display:'flex',minHeight:'0'}},
      h('div',{className:'model-editor-palette'},
        blockCategories.map(function(cat){
          return h('div',{className:'palette-cat'},
            h('div',{className:'palette-cat-label'},cat.label),
            h('div',{className:'palette-cat-items'},
              cat.types.map(function(t){return h('button',{className:'palette-btn',onClick:function(){addNode(t);}},t.replace(/_/g,' '));})
            )
          );
        })
      ),
      h('div',{className:'model-editor-canvas',id:'graph-canvas-parent'},
        h('canvas',{id:'graph-canvas',onMouseDown:onDown,onMouseMove:onMove,onMouseUp:onUp,onMouseLeave:onUp})
      ),
      companionSidebar,
      nodeEditorSidebar
    )
  );
  setTimeout(drawCanvas, 100);
  return page;
}

bootWorkspacePage(ModelEditorPage);
