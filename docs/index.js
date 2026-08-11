// HomePage — página de marketing (extraída de app.js)
function HomePage() {
  var headlines = [
    {pre:'Un lugar para',hl:'imaginar cómo funciona el mundo',post:'y verlo cobrar vida.'},
    {pre:'Aprende ciencia',hl:'jugando con ideas',post:'en lugar de memorizarlas.'},
    {pre:'Convierte tus dudas en',hl:'experimentos visuales',post:'que puedes tocar y modificar.'},
    {pre:'Una biblioteca abierta de',hl:'ciencia explicada con claridad',post:'para curiosos de cualquier nivel.'},
    {pre:'Crea, escribe y comparte',hl:'tus propias ideas',post:'junto a otras mentes inquietas.'},
    {pre:'Donde los dibujos, las fórmulas',hl:'y la intuición',post:'se encuentran en un mismo lugar.'},
    {pre:'Explora la ciencia',hl:'sin necesidad de programar',post:'ni saberlo todo de antemano.'},
    {pre:'Un espacio pensado para',hl:'estudiantes, curiosos y creadores',post:'que quieren entender el porqué.'}
  ];
  var idx = 0;
  var h1 = h('h1', {className:'home-headline'});
  function update() {
    var c = headlines[idx];
    h1.innerHTML = c.pre + '<br><span class="highlight">' + c.hl + '</span><br>' + c.post;
    h1.classList.remove('fade-out');
  }
  update();
  setInterval(function() {
    h1.classList.add('fade-out');
    setTimeout(function() { idx = (idx + 1) % headlines.length; update(); }, 350);
  }, 4500);
  var copilotSection = h('div', {},
    SectionHeader('// COPILOTO', 'Activá el copiloto científico', 'El análisis con IA no viene incluido ni tiene suscripción — vos conectás tu propia clave, y solo pagás (si elegís pagar) lo que efectivamente uses.'),
    h('div', {className:'copilot-cards', style:{gridTemplateColumns:window.innerWidth<720?'1fr':'1fr 1fr',gap:'20px',marginTop:'8px'}},
      Panel('Anthropic (Claude)', 'RECOMENDADO', [
        h('p',{},'El copiloto más capaz: lee diagramas, código LaTeX y gráficas con mayor profundidad de análisis.'),
        BulletList([
          'Pago por token, pero las cuentas nuevas arrancan con crédito de prueba gratis (usualmente unos pocos dólares, sin necesitar tarjeta).',
          'El modelo económico (Haiku) cuesta centavos de dólar por miles de análisis — para uso personal, rara vez vas a gastar el crédito inicial.',
          'Los precios y montos de crédito los define Anthropic y pueden cambiar; revisá el valor actual en su sitio antes de cargar saldo.'
        ]),
        h('div',{className:'panel-cta'},h('a',{className:'btn btn-primary',href:'https://console.anthropic.com',target:'_blank',style:{display:'inline-block'}},'Anthropic →'))
      ], 'primary'),
      Panel('IA gratis (Groq o Gemini)', 'SIN COSTO', [
        h('p',{},'Corren modelos de código abierto en vez de Claude — análisis más limitado, pero sin costo alguno. Elegí uno de los dos en Configuración.'),
        BulletList([
          'Groq: nivel gratuito real, sin tarjeta ni límite de tiempo de prueba, con modelos Llama/Qwen.',
          'Gemini (Google): también gratis y sin tarjeta, vía Google AI Studio, con modelos "Flash".',
          'Ideal para probar el copiloto o usarlo ocasionalmente sin pensar en costos; la calidad de las explicaciones es menor que con Claude, en especial en diagramas o matemática compleja.'
        ]),
        h('div',{className:'panel-cta',style:{display:'flex',gap:'10px',flexWrap:'wrap'}},
          h('a',{className:'btn btn-primary',href:'https://console.groq.com',target:'_blank'},'Groq →'),
          h('a',{className:'btn btn-primary',href:'https://aistudio.google.com/apikey',target:'_blank'},'Gemini →')
        )
      ], 'success')
    ),
    h('div',{style:{marginTop:'20px',textAlign:'center'}},
      h('a',{className:'btn btn-ghost',href:'settings.html'},'⚙ Ir a Configuración del copiloto →')
    )
  );

  return h('div', {}, h('div', {className:'home-section'}, h1), copilotSection);
}

console.log("AtlasDelta core loaded - " + new Date().toISOString());

// ── Architecture Page ──────────────────────────────────

bootPage('home', HomePage);
