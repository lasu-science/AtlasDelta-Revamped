// PlotEditorPage — extraída y adaptada de app.js
function PlotEditorPage() {
  var id = new URLSearchParams(location.search).get('id');
  var u = getU();
  var plots = JSON.parse(localStorage.getItem('ad_plots_'+u) || '[]');
  var plot = plots.find(function(p){return p.id===id;});
  if (!plot) return NotFound();
  if (!plot.spec.view) plot.spec.view = {xMin:-10,xMax:10,xLabel:'x',yLabel:'y'};
  if (plot.spec.view.xMin === undefined) { plot.spec.view.xMin = -10; plot.spec.view.xMax = 10; }

  function saveSpec() {
    plot.updated_at = new Date().toISOString();
    var allPlots = JSON.parse(localStorage.getItem('ad_plots_'+u) || '[]');
    var idx = allPlots.findIndex(function(p){return p.id===id;});
    if (idx >= 0) allPlots[idx] = plot;
    localStorage.setItem('ad_plots_'+u, JSON.stringify(allPlots));
    renderSvg();
  }

  function compileExpr(expr) {
    // Map bare math function/constant names to Math.* so expressions like "sin(x)" work.
    var mapped = expr.replace(/\b(sin|cos|tan|asin|acos|atan|atan2|sqrt|cbrt|abs|exp|log|log2|log10|pow|min|max|floor|ceil|round|sign|hypot)\s*\(/g, 'Math.$1(')
                      .replace(/\bPI\b/g, 'Math.PI')
                      .replace(/\bE\b/g, 'Math.E')
                      .replace(/\^/g, '**');
    return new Function('x', 'return ' + mapped);
  }

  function zoom(factor, centerX) {
    var v = plot.spec.view, range = v.xMax - v.xMin;
    var c = centerX !== undefined ? centerX : (v.xMin+v.xMax)/2;
    var ratio = (c - v.xMin) / range;
    var newRange = Math.max(1e-6, range * factor);
    v.xMin = c - newRange*ratio;
    v.xMax = v.xMin + newRange;
    saveSpec();
  }
  function resetView() { plot.spec.view.xMin = -10; plot.spec.view.xMax = 10; saveSpec(); }

  function analyze(points) {
    var roots = [], extrema = [];
    for (var i=1;i<points.length;i++) {
      var a = points[i-1], b = points[i];
      if ((a.y<0&&b.y>=0)||(a.y>0&&b.y<=0)) {
        var t = a.y/(a.y-b.y);
        roots.push(a.x + t*(b.x-a.x));
      }
    }
    for (var j=1;j<points.length-1;j++) {
      var d1 = points[j].y-points[j-1].y, d2 = points[j+1].y-points[j].y;
      if (d1>0&&d2<0) extrema.push({x:points[j].x,y:points[j].y,type:'máx'});
      else if (d1<0&&d2>0) extrema.push({x:points[j].x,y:points[j].y,type:'mín'});
    }
    return {roots:roots.slice(0,6), extrema:extrema.slice(0,6)};
  }

  var dragging = false, dragX0 = 0, dragView0 = null, lastAnalysisText = '';

  function renderSvg() {
    var div = document.getElementById('plot-render');
    var aDiv = document.getElementById('plot-analysis');
    if (!div) return;
    var s = plot.spec.series[0];
    if (!s || s.kind !== 'function-2d') { div.innerHTML = '<p style="color:#8a8fa8;padding:40px;text-align:center">Editor de gráficas simplificado</p>'; if(aDiv) aDiv.innerHTML=''; lastAnalysisText=''; return; }
    var v = plot.spec.view, xMin = v.xMin, xMax = v.xMax;
    var n = s.samples || 400;
    var dx = (xMax - xMin) / (n - 1);
    var points = [];
    var fn;
    try { fn = compileExpr(s.expr); } catch(e) { div.innerHTML = '<p style="color:#ef4444;padding:40px;text-align:center">Error en expresión</p>'; if(aDiv) aDiv.innerHTML=''; lastAnalysisText=''; return; }
    for (var i = 0; i < n; i++) {
      var x = xMin + i * dx, y;
      try { y = fn(x); } catch(e) { y = NaN; }
      if (isFinite(y)) points.push({x:x, y:y});
    }
    if (points.length < 2) { div.innerHTML = '<p style="color:#8a8fa8;padding:40px;text-align:center">Sin datos en este rango — probá "Restablecer zoom"</p>'; if(aDiv) aDiv.innerHTML=''; lastAnalysisText=''; return; }
    var rect = div.getBoundingClientRect();
    var w = Math.max(200, rect.width), hh = Math.max(150, rect.height);
    var pad = {top:16, right:20, bottom:32, left:60};
    var pw = w - pad.left - pad.right, ph = hh - pad.top - pad.bottom;
    var yVals = points.map(function(p){return p.y;});
    var y0 = Math.min.apply(null, yVals), y1 = Math.max.apply(null, yVals);
    var margin = (y1-y0)*0.08 || 1; y0 -= margin; y1 += margin;
    var yr = (y1 - y0) || 1;
    function tx(x) { return pad.left + ((x-xMin)/(xMax-xMin||1))*pw; }
    function ty(y) { return pad.top + ph - ((y-y0)/yr)*ph; }
    var path = '';
    points.forEach(function(p, i) { path += (i===0?'M':'L') + tx(p.x).toFixed(1) + ' ' + ty(p.y).toFixed(1); });
    var ticks = '';
    for (var j = 0; j <= 5; j++) {
      var gy = y0 + yr*j/5, sy = ty(gy);
      ticks += '<line x1="'+pad.left+'" y1="'+sy+'" x2="'+(pad.left+pw)+'" y2="'+sy+'" stroke="rgba(55,65,81,0.4)" stroke-dasharray="2,4"/>';
      ticks += '<text x="'+(pad.left-8)+'" y="'+(sy+3)+'" fill="#8a8fa8" font-size="10" text-anchor="end">'+gy.toFixed(2)+'</text>';
      var gx = xMin + (xMax-xMin)*j/5, sx = tx(gx);
      ticks += '<line x1="'+sx+'" y1="'+pad.top+'" x2="'+sx+'" y2="'+(pad.top+ph)+'" stroke="rgba(55,65,81,0.25)" stroke-dasharray="2,4"/>';
      ticks += '<text x="'+sx+'" y="'+(pad.top+ph+16)+'" fill="#8a8fa8" font-size="10" text-anchor="middle">'+gx.toFixed(2)+'</text>';
    }
    // zero axes, when in view
    var zeroX = xMin<=0&&xMax>=0 ? '<line x1="'+tx(0)+'" y1="'+pad.top+'" x2="'+tx(0)+'" y2="'+(pad.top+ph)+'" stroke="rgba(148,163,184,0.7)"/>' : '';
    var zeroY = y0<=0&&y1>=0 ? '<line x1="'+pad.left+'" y1="'+ty(0)+'" x2="'+(pad.left+pw)+'" y2="'+ty(0)+'" stroke="rgba(148,163,184,0.7)"/>' : '';
    var a = analyze(points);
    lastAnalysisText = 'f(x) = ' + s.expr + '\nRango visible de x: [' + xMin.toFixed(3) + ', ' + xMax.toFixed(3) + ']\n' +
      'Rango de y en ese tramo: [' + (y0+margin).toFixed(3) + ', ' + (y1-margin).toFixed(3) + ']\n' +
      'Raíces (f(x)=0) encontradas: ' + (a.roots.length ? a.roots.map(function(r){return r.toFixed(4);}).join(', ') : 'ninguna en este rango') + '\n' +
      'Extremos locales encontrados: ' + (a.extrema.length ? a.extrema.map(function(e){return e.type+' en x='+e.x.toFixed(3)+', f(x)='+e.y.toFixed(3);}).join('; ') : 'ninguno en este rango');
    var markers = a.roots.map(function(r){return '<circle cx="'+tx(r)+'" cy="'+ty(0)+'" r="4" fill="#fbbf24"/>';}).join('')+
                  a.extrema.map(function(e){return '<circle cx="'+tx(e.x)+'" cy="'+ty(e.y)+'" r="4" fill="#34d399"/>';}).join('');
    div.innerHTML = '<svg width="'+w+'" height="'+hh+'" style="display:block;background:#0f172a;cursor:grab">'+
      ticks+zeroX+zeroY+
      '<rect x="'+pad.left+'" y="'+pad.top+'" width="'+pw+'" height="'+ph+'" fill="none" stroke="rgba(100,116,139,0.5)"/>'+
      '<path d="'+path+'" fill="none" stroke="'+(s.color||'#22d3ee')+'" stroke-width="2"/>'+
      markers+
      '<text x="'+(pad.left+pw/2)+'" y="'+(hh-4)+'" fill="#8a8fa8" font-size="11" text-anchor="middle">'+(v.xLabel||'x')+'</text>'+
      '<text x="14" y="'+(pad.top+ph/2)+'" fill="#8a8fa8" font-size="11" text-anchor="middle" transform="rotate(-90,14,'+(pad.top+ph/2)+')">'+(v.yLabel||'y')+'</text>'+
      '</svg>';
    if (aDiv) {
      aDiv.innerHTML =
        '<div class="plot-analysis-row"><span>Rango visible x</span><b>['+xMin.toFixed(2)+', '+xMax.toFixed(2)+']</b></div>'+
        '<div class="plot-analysis-row"><span>Rango y</span><b>['+(y0+margin).toFixed(2)+', '+(y1-margin).toFixed(2)+']</b></div>'+
        '<div class="plot-analysis-row"><span>Raíces (f(x)=0)</span><b>'+(a.roots.length?a.roots.map(function(r){return r.toFixed(3);}).join(', '):'ninguna visible')+'</b></div>'+
        '<div class="plot-analysis-row"><span>Extremos locales</span><b>'+(a.extrema.length?a.extrema.map(function(e){return e.type+' en x='+e.x.toFixed(2);}).join(', '):'ninguno visible')+'</b></div>';
    }
  }

  function onWheel(e) {
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.15 : 1/1.15, xAtClientX(e.clientX));
  }
  function xAtClientX(clientX) {
    var div = document.getElementById('plot-render');
    var rect = div.getBoundingClientRect();
    var pad = {left:60, right:20};
    var pw = rect.width - pad.left - pad.right;
    var frac = (clientX - rect.left - pad.left) / pw;
    var v = plot.spec.view;
    return v.xMin + frac*(v.xMax-v.xMin);
  }
  function onDown(e) { dragging = true; dragX0 = e.clientX; dragView0 = {xMin:plot.spec.view.xMin, xMax:plot.spec.view.xMax}; }
  function onMove(e) {
    if (!dragging) return;
    var div = document.getElementById('plot-render');
    var rect = div.getBoundingClientRect();
    var pad = {left:60, right:20};
    var pw = rect.width - pad.left - pad.right;
    var dxPx = e.clientX - dragX0;
    var dxVal = -(dxPx/pw) * (dragView0.xMax - dragView0.xMin);
    plot.spec.view.xMin = dragView0.xMin + dxVal;
    plot.spec.view.xMax = dragView0.xMax + dxVal;
    renderSvg();
  }
  function onUp() { if (dragging) { dragging = false; saveSpec(); } }

  var page = h('div',{style:{flex:'1',display:'flex',flexDirection:'column',minHeight:'0'}},
    h('div',{className:'model-editor-bar'},
      h('a',{className:'btn btn-ghost',href:'workspace.html'},'← Volver'),
      h('input',{value:plot.name,onInput:function(e){plot.name=e.target.value;saveSpec();}}),
      h('div',{style:{marginLeft:'auto',display:'flex',gap:'6px'}},
        h('button',{className:'btn btn-ghost',title:'Alejar',onClick:function(){zoom(1.4);}},'−'),
        h('button',{className:'btn btn-ghost',title:'Acercar',onClick:function(){zoom(1/1.4);}},'+'),
        h('button',{className:'btn btn-ghost',onClick:resetView},'Restablecer zoom')
      ),
      h('span',{style:{fontSize:'11px',color:'#34d399'}},'✓ autosave')
    ),
    h('div',{style:{flex:'1',display:'flex',minHeight:'0'}},
      h('div',{id:'plot-render',style:{flex:'1',minWidth:'0'},onWheel:onWheel,onMouseDown:onDown,onMouseMove:onMove,onMouseUp:onUp,onMouseLeave:onUp}),
      h('div',{style:{width:'280px',flexShrink:'0',borderLeft:'1px solid rgba(55,65,81,0.8)',padding:'16px',background:'rgba(30,37,52,0.95)',overflow:'auto',display:'flex',flexDirection:'column',gap:'16px'}},
        h('label',{style:{display:'block',fontSize:'11px'}},
          h('div',{className:'slider-head'},h('span',{},'Expresión f(x)'),h('span',{className:'slider-val'},(plot.spec.series[0]||{}).expr||'sin(x)')),
          h('input',{type:'text',value:(plot.spec.series[0]||{}).expr||'sin(x)',style:{width:'100%',background:'#0f172a',border:'1px solid rgba(55,65,81,0.8)',padding:'4px 8px',color:'#e2e8f0',fontFamily:'var(--font-mono)',fontSize:'12px'},onInput:function(e){plot.spec.series[0].expr=e.target.value;saveSpec();}})
        ),
        h('div',{},
          h('div',{style:{fontSize:'10px',textTransform:'uppercase',letterSpacing:'.08em',color:'#8a8fa8',marginBottom:'8px'}},'Análisis'),
          h('div',{id:'plot-analysis',className:'plot-analysis'})
        ),
        CompanionPanel({
          id:'plot',
          label:'Explicar esta función',
          hint:'Interpreto el tipo de función y qué significan sus raíces/extremos.',
          buildPrompt:function(){
            if (!lastAnalysisText) throw new Error('No hay una gráfica válida para analizar todavía.');
            return {
              system:'Sos un copiloto científico integrado en una herramienta de graficación de funciones matemáticas. Se te va a mostrar una expresión f(x), el rango visible, y un análisis numérico ya calculado (raíces y extremos locales dentro de ese rango). Explicá en español, de forma clara y concisa: (1) qué tipo de función es (polinómica, trigonométrica, exponencial, racional, etc.) y sus propiedades generales, (2) para qué se usa este tipo de función en ciencia o ingeniería, (3) qué significan concretamente las raíces y extremos encontrados en un contexto aplicado (por ejemplo: ceros de una señal, puntos de equilibrio, máximos de una trayectoria, etc., según corresponda). No repitas los números tal cual — interpretalos.',
              user: lastAnalysisText
            };
          }
        }),
        h('div',{style:{fontSize:'10px',color:'#8a8fa8'}},'Scroll para zoom · arrastrar para desplazar')
      )
    )
  );
  setTimeout(renderSvg, 50);
  window.addEventListener('resize', function(){ if(document.getElementById('plot-render')) renderSvg(); });
  return page;
}

bootWorkspacePage(PlotEditorPage);
