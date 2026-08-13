// ═══════════════════════════════════════════════════════
// AtlasDelta — shared.js
// Código común a todas las páginas: helpers de DOM, sesión,
// header/nav, renderer de markdown+LaTeX y widgets interactivos.
// ═══════════════════════════════════════════════════════

function rid() { return Math.random().toString(36).slice(2, 10); }

function h(tag, attrs) {
  var el = document.createElement(tag);
  var children = Array.prototype.slice.call(arguments, 2);
  if (attrs) {
    Object.keys(attrs).forEach(function(k) {
      var v = attrs[k];
      if (k === 'className') el.className = v;
      else if (k === 'innerHTML') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0,2) === 'on') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if ((k === 'disabled' || k === 'checked' || k === 'required' || k === 'selected') && !v) {}
      else if (k === 'checked') { el.checked = true; el.setAttribute('checked',''); }
      else el.setAttribute(k, v === true ? '' : String(v));
    });
  }
  children.forEach(function appendChild(child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(appendChild); return; }
    if (typeof child === 'string' || typeof child === 'number') el.appendChild(document.createTextNode(String(child)));
    else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  });
  return el;
}

// ── UI Components ──────────────────────────────────────
function SectionHeader(index, title, subtitle) {
  return h('div', {className:'section-header'},
    h('div', {className:'index'}, index),
    h('h1', {}, title),
    subtitle ? h('p', {className:'subtitle'}, subtitle) : null
  );
}

function Panel(title, tag, children, accent) {
  accent = accent || '';
  return h('section', {className:'panel' + (accent ? ' accent-'+accent : '')},
    (title || tag) ? h('div', {className:'panel-header'},
      title ? h('h2', {}, title) : h('span'),
      tag ? h('span', {className:'panel-tag'}, tag) : null
    ) : null,
    h('div', {className:'panel-body'},
      Array.isArray(children) ? children : [children]
    )
  );
}

function Tag(text, tone) {
  tone = tone || 'primary';
  return h('span', {className:'tag tag-'+tone}, text);
}

function BulletList(items) {
  return h('ul', {className:'bullet-list'},
    items.map(function(i) { return h('li', {}, i); })
  );
}

function CodeBlock(text) {
  return h('pre', {className:'code-block'}, h('code', {}, text));
}

function KeyVal(k, v) {
  return h('div', {className:'kv'},
    h('span', {className:'kv-k'}, k),
    h('span', {className:'kv-v'}, String(v))
  );
}

// ── Session / Auth ──────────────────────────────────────
function getUser() {
  try { return JSON.parse(localStorage.getItem('ad_user') || 'null'); } catch(e) { return null; }
}
function getU() { return getUser() ? getUser().email : 'anon'; }
var DEFAULT_LATEX = '\\documentclass{article}\n\\title{Documento sin título}\n\\author{}\n\\date{}\n\n\\begin{document}\n\\maketitle\n\n\\section{Introducción}\nEscribe aquí. Soporta \\textbf{negrita}, \\emph{cursiva} y $E = mc^2$.\n\n\\begin{equation}\n  \\frac{\\partial u}{\\partial t} + (u \\cdot \\nabla) u = -\\frac{1}{\\rho}\\nabla p + \\nu \\nabla^2 u\n\\end{equation}\n\n\\subsection{Lista}\n\\begin{itemize}\n  \\item Primer punto\n  \\item Segundo punto\n\\end{itemize}\n\n\\end{document}\n';
var ADMIN_EMAIL = 'ezesouto2@gmail.com';
function isAdmin() { var u = getUser(); return !!(u && u.email === ADMIN_EMAIL); }

// ── Supabase (backend real: base de datos + auth) ────────
// Completá estos dos valores con los de tu propio proyecto (gratis) en
// https://supabase.com → tu proyecto → Project Settings → API.
// Sin esto, el login/registro/recuperación de contraseña no van a funcionar.
var SUPABASE_URL = 'https://fyztxoxejbzkuthvcpus.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_J2uKmgVrKJrvZogQfGUm1g_dzOHfQ2h';
var _supabaseClient = null;
function getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  if (typeof window.supabase === 'undefined') {
    console.error('Falta cargar la librería de Supabase (script CDN) en esta página.');
    return null;
  }
  _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabaseClient;
}
// ═══════════════════════════════════════════════════════
// Copiloto científico — llamadas directas a la API de Anthropic desde el
// navegador. La clave la pega cada usuario en settings.html y queda SOLO en
// su localStorage — nunca se envía a ningún servidor propio (no hay backend).
// Nota de seguridad: cualquiera con acceso a las devtools del navegador puede
// ver esta clave. Está bien para uso personal; no es apto para publicar el
// sitio con una clave compartida entre visitantes.
//
// Dos proveedores a elección del usuario (ver settings.html):
//  - "anthropic": Claude. Pago por token, pero las cuentas nuevas arrancan con
//    ~US$5 de crédito de prueba (sin tarjeta). El copiloto más capaz.
//  - "groq": modelos de código abierto (Llama, Qwen) en la infraestructura de
//    Groq. Nivel gratuito real, sin tarjeta — a cambio de un análisis más
//    limitado que Claude.
// ═══════════════════════════════════════════════════════
var AI_PROVIDERS = {
  anthropic: { label:'Anthropic (Claude) — de pago, con crédito inicial gratis', defaultModel:'claude-sonnet-5', keyPlaceholder:'sk-ant-...' },
  groq:      { label:'Groq — gratis, modelos de código abierto', defaultModel:'llama-3.3-70b-versatile', keyPlaceholder:'gsk_...' },
  gemini:    { label:'Gemini (Google) — gratis, sin tarjeta', defaultModel:'gemini-2.5-flash', keyPlaceholder:'AIzaSy...' }
};
function getApiProvider() { return localStorage.getItem('ad_api_provider') || 'anthropic'; }
function setApiProvider(p) { localStorage.setItem('ad_api_provider', p || 'anthropic'); }
function getApiKey(provider) { return localStorage.getItem('ad_api_key_' + (provider || getApiProvider())) || ''; }
function setApiKey(k, provider) { localStorage.setItem('ad_api_key_' + (provider || getApiProvider()), k || ''); }
function getApiModel(provider) { provider = provider || getApiProvider(); return localStorage.getItem('ad_api_model_' + provider) || AI_PROVIDERS[provider].defaultModel; }
function setApiModel(m, provider) { localStorage.setItem('ad_api_model_' + (provider || getApiProvider()), m || ''); }
function hasApiKey() { return !!getApiKey(); }

function callClaude(systemPrompt, userPrompt) {
  var provider = getApiProvider();
  var key = getApiKey(provider);
  if (!key) return Promise.reject(new Error('MISSING_KEY'));

  if (provider === 'gemini') {
    // API REST de Google AI Studio. Misma advertencia que con Groq: no pude
    // verificar en vivo si acepta llamadas directas desde el navegador.
    var model = getApiModel(provider);
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    }).then(function(res) {
      if (!res.ok) {
        return res.json().catch(function(){ return {}; }).then(function(errBody){
          throw new Error((errBody.error && errBody.error.message) || ('HTTP ' + res.status));
        });
      }
      return res.json();
    }).then(function(data) {
      var cand = (data.candidates || [])[0];
      var parts = cand && cand.content && cand.content.parts || [];
      return parts.map(function(p){ return p.text || ''; }).join('\n');
    });
  }

  if (provider === 'groq') {
    // API compatible con OpenAI. No pude verificar en vivo si Groq acepta
    // llamadas directas desde el navegador (sin backend) — si tu navegador
    // muestra un error de CORS acá, avisame y armamos un pequeño proxy.
    return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: getApiModel(provider),
        max_tokens: 1024,
        messages: [{role:'system', content: systemPrompt}, {role:'user', content: userPrompt}]
      })
    }).then(function(res) {
      if (!res.ok) {
        return res.json().catch(function(){ return {}; }).then(function(errBody){
          throw new Error((errBody.error && errBody.error.message) || ('HTTP ' + res.status));
        });
      }
      return res.json();
    }).then(function(data) {
      return ((data.choices||[])[0] || {}).message ? data.choices[0].message.content : '';
    });
  }

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: getApiModel(provider),
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{role:'user', content: userPrompt}]
    })
  }).then(function(res) {
    if (!res.ok) {
      return res.json().catch(function(){ return {}; }).then(function(errBody){
        var msg = (errBody.error && errBody.error.message) || ('HTTP ' + res.status);
        throw new Error(msg);
      });
    }
    return res.json();
  }).then(function(data) {
    return (data.content || []).filter(function(b){ return b.type === 'text'; }).map(function(b){ return b.text; }).join('\n');
  });
}

// Panel de copiloto reutilizable: cada página lo integra con su propia clase
// contenedora (ver shared.css) pero comparten la misma lógica de llamada.
// opts: {id, label, hint, buildPrompt: () => {system, user}}
function CompanionPanel(opts) {
  var box = h('div', {className:'companion-panel'},
    h('div', {className:'companion-header'},
      h('span', {}, '🤖 Copiloto científico'),
      h('button', {className:'btn btn-outline companion-btn'}, opts.label || 'Analizar')
    ),
    opts.hint ? h('div', {className:'companion-hint'}, opts.hint) : null,
    h('div', {className:'companion-body', id:'companion-body-'+opts.id}, h('p',{className:'companion-placeholder'},'Apretá "'+(opts.label||'Analizar')+'" cuando quieras que te explique lo que tenés en pantalla.'))
  );
  setTimeout(function(){
    var btn = box.querySelector('.companion-btn');
    var body = document.getElementById('companion-body-'+opts.id);
    if (!btn || !body) return;
    btn.addEventListener('click', function(){
      if (!hasApiKey()) {
        body.innerHTML = '<p class="companion-error">Necesitás configurar tu clave de API de Anthropic antes de usar el copiloto. <a href="settings.html">Ir a Configuración →</a></p>';
        return;
      }
      var built;
      try { built = opts.buildPrompt(); }
      catch(e) { body.innerHTML = '<p class="companion-error">No pude armar el contexto para analizar: '+e.message+'</p>'; return; }
      btn.disabled = true; var origLabel = btn.textContent; btn.textContent = 'Analizando…';
      body.innerHTML = '<p class="companion-loading">Pensando…</p>';
      callClaude(built.system, built.user).then(function(text){
        body.innerHTML = renderMdMath(text);
      }).catch(function(err){
        var msg = err && err.message === 'MISSING_KEY' ? 'Falta configurar tu clave de API.' : (err && err.message ? err.message : 'Algo salió mal al llamar a la API.');
        body.innerHTML = '<p class="companion-error">⚠ '+msg+' <a href="settings.html">Revisar configuración →</a></p>';
      }).then(function(){
        btn.disabled = false; btn.textContent = origLabel;
      });
    });
  }, 0);
  return box;
}

function requireAuth() {
  if (!getUser()) { location.href = 'auth.html'; return false; }
  return true;
}
function signOut() {
  if (typeof window.supabase !== 'undefined') { try { getSupabaseClient().auth.signOut(); } catch(e) {} }
  localStorage.removeItem('ad_user');
  location.href = 'index.html';
}

// ── Header (páginas de marketing / repositorio) ─────────
// currentPage: 'home' | 'architecture' | 'modules' | ... | 'library'
function Header(currentPage) {
  var user = getUser();
  return h('header', {className:'header'},
    h('div', {className:'header-inner'},
      h('a', {className:'header-brand', href:'index.html'}, 'AtlasDelta', h('span',{},'//Revamped')),
      h('nav', {className:'nav-links', style:{display:window.innerWidth<640?'none':'flex'}},
        h('a', {className:'nav-link, btn-primary'+(currentPage==='library'?' active':''), href:'library.html'}, 'Repositorio')
      ),
      h('div', {className:'header-right'},
        user
          ? [h('a', {className:'btn btn-primary', href:'workspace.html'}, 'Abrir workspace'),
             h('a', {className:'btn btn-primary', onClick:signOut}, 'salir')]
          : h('a', {className:'btn btn-primary', href:'auth.html'}, 'Acceder')
      )
    )
  );
}

// ── WorkspaceHeader (workspace y editores) ──────────────
function WorkspaceHeader() {
  var user = getUser();
  return h('header', {className:'ws-header'},
    h('div', {className:'ws-header-inner'},
      h('a', {className:'ws-brand', href:'workspace.html'}, 'AtlasDelta', h('span',{style:{color:'#22d3ee'}}, ' · workspace')),
      h('a', {className:'btn btn-primary', href:'index.html'}, '← Inicio'),
      h('a', {className:'btn btn-primary', href:'library.html'}, 'Repositorio'),
      h('a', {className:'btn btn-primary', href:'settings.html'}, '🤖 Copiloto'),
      h('div', {style:{marginLeft:'auto',display:'flex',alignItems:'center',gap:'16px',fontSize:'12px'}},
        user ? h('span', {style:{color:'#8a8fa8'}}, user.email + (isAdmin()?' · admin':'')) : null,
        h('a', {className:'btn btn-primary', onClick:signOut}, 'salir')
      )
    )
  );
}

function NotFound() {
  return h('div',{className:'not-found'},
    h('div',{},h('div',{className:'nf-code'},'ERR_ROUTE_404'),h('h1',{className:'nf-title'},'404'),h('h2',{className:'nf-sub'},'Página no encontrada'),h('p',{className:'nf-desc'},'El recurso solicitado no existe.'),h('a',{className:'btn btn-primary',href:'index.html',style:{marginTop:'24px',display:'inline-block'}},'▸ Volver al overview'))
  );
}

// ── ARTICLE DATA ───────────────────────────────────────
var ARTICLES = [];
(function() {
  ARTICLES.push(
    {slug:"mecanica-clasica",title:"Mecánica clásica",category:"fisica",level:"introductorio",readingMinutes:28,summary:"Cinemática, leyes de Newton, fuerzas, fricción, trabajo, energía y momento.",
      sections:[
        {id:"historia",title:"Historia y contexto",keywords:["historia"],body:"La mecánica clásica nace con **Galileo** (s.XVII) y **Newton** (*Principia*, 1687), quien sintetizó los trabajos previos en tres leyes y la gravitación universal. **Lagrange (1788)** y **Hamilton (1833)** la reformularon con principios variacionales."},
        {id:"cinematica",title:"Cinemática",keywords:["MRU","MRUA"],body:"$$v(t)=\\frac{dx}{dt},\\quad a(t)=\\frac{dv}{dt}$$\n\nPara aceleración constante: $v=v_0+at$, $x=x_0+v_0t+\\frac{1}{2}at^2$, $v^2=v_0^2+2a\\Delta x$.\n\n| Movimiento | Condición | Ejemplo |\n|------------|-----------|--------|\n| MRU | a=0 | Auto velocidad constante |\n| MRUA | a=constante | Caída libre |",widget:"phys-projectile"},
        {id:"leyes-newton",title:"Leyes de Newton",keywords:["Newton","F=ma"],body:"**1ª (Inercia):** reposo o MRU sin fuerza neta.\n**2ª:** $\\vec F=m\\vec a$.\n**3ª (Acción-Reacción):** fuerzas iguales y opuestas."},
        {id:"friccion",title:"Fricción",keywords:["fricción","rozamiento"],body:"$f_e\\leq\\mu_e N$ (estática), $f_k=\\mu_k N$ (cinética). En plano inclinado, desliza si $\\tan\\theta>\\mu_e$.",widget:"phys-friction"},
        {id:"energia",title:"Trabajo y energía",keywords:["trabajo","energía"],body:"$W=\\vec F\\cdot\\Delta\\vec r$, $K=\\frac{1}{2}mv^2$, $U_g=mgh$. Conservación: $K+U=$ constante.",widget:"phys-energy"},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"**Fórmulas:** $\\sum F=ma$, $f_k=\\mu_k N$, $K=\\frac{1}{2}mv^2$, $U=mgh$, $W=Fd\\cos\\theta$.\n\n**Ejemplo:** $v_0=20$ m/s, $\\theta=30°$, $g=9.81$: alcance $R=35.3$ m."}
      ]
    },
    {slug:"ondas-y-optica",title:"Ondas y óptica",category:"fisica",level:"intermedio",readingMinutes:24,summary:"Ondas mecánicas y electromagnéticas, interferencia, difracción, óptica geométrica.",
      sections:[
        {id:"onda",title:"Onda armónica",keywords:["onda","frecuencia"],body:"$y(x,t)=A\\sin(kx-\\omega t+\\phi)$, $k=2\\pi/\\lambda$, $\\omega=2\\pi f$, $v=\\lambda f$.",widget:"phys-wave"},
        {id:"interferencia",title:"Interferencia",keywords:["Young","difracción"],body:"**Doble rendija:** $d\\sin\\theta=m\\lambda$. **Difracción:** $a\\sin\\theta=m\\lambda$ (mínimos)."},
        {id:"optica",title:"Óptica geométrica",keywords:["Snell","lentes"],body:"**Snell:** $n_1\\sin\\theta_1=n_2\\sin\\theta_2$.\n**Lente delgada:** $1/f=1/d_o+1/d_i$, $M=-d_i/d_o$.",widget:"phys-snell"},
        {id:"doppler",title:"Efecto Doppler",keywords:["Doppler"],body:"$f_o=f_s\\cdot c/(c-v_s)$. Frecuencia aumenta si la fuente se acerca.",widget:"phys-doppler"},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"$y=A\\sin(kx-\\omega t)$, $v=\\lambda f$, $n_1\\sin\\theta_1=n_2\\sin\\theta_2$, $1/f=1/d_o+1/d_i$."}
      ]
    },
    {slug:"termodinamica",title:"Termodinámica",category:"fisica",level:"intermedio",readingMinutes:22,summary:"Calor, temperatura, leyes, entropía y máquinas térmicas.",
      sections:[
        {id:"leyes",title:"Leyes de la termodinámica",keywords:["entropía","Carnot"],body:"**1ª:** $\\Delta U=Q-W$.\n**2ª:** $\\Delta S\\geq\\int dQ/T$.\n**Eficiencia de Carnot:** $\\eta=1-T_C/T_H$."},
        {id:"gases",title:"Gases ideales",keywords:["PV=nRT"],body:"$PV=nRT$, $U=\\frac{f}{2}nRT$. $f=3$ (monoatómico), $f=5$ (diatómico)."},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"$PV=nRT$, $\\Delta U=Q-W$, $\\eta_\\text{Carnot}=1-T_C/T_H$.\n**Ejemplo:** $T_H=500$K, $T_C=300$K: $\\eta=40\\%$."}
      ]
    },
    {slug:"electromagnetismo",title:"Electromagnetismo",category:"fisica",level:"intermedio",readingMinutes:26,summary:"Campos eléctricos y magnéticos, ecuaciones de Maxwell, ondas EM.",
      sections:[
        {id:"electrostatica",title:"Electrostática",keywords:["Coulomb"],body:"$F=k\\frac{q_1q_2}{r^2}$, $E=F/q$, $V=kq/r$.",widget:"phys-ohm"},
        {id:"magnetismo",title:"Magnetismo",keywords:["Lorentz"],body:"$\\vec F=q(\\vec E+\\vec v\\times\\vec B)$, $\\oint\\vec B\\cdot d\\vec l=\\mu_0 I_\\text{enc}}$."},
        {id:"maxwell",title:"Ecuaciones de Maxwell",keywords:["Maxwell"],body:"$$\\nabla\\cdot\\vec E=\\frac{\\rho}{\\epsilon_0}$$\n$$\\nabla\\cdot\\vec B=0$$\n$$\\nabla\\times\\vec E=-\\frac{\\partial\\vec B}{\\partial t}$$\n$$\\nabla\\times\\vec B=\\mu_0\\vec J+\\mu_0\\epsilon_0\\frac{\\partial\\vec E}{\\partial t}$$"},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"$c=1/\\sqrt{\\mu_0\\epsilon_0}\\approx3\\times10^8$ m/s. Ondas EM: $\\vec E\\perp\\vec B\\perp\\vec v$."}
      ]
    },
    {slug:"estructura-atomica",title:"Estructura atómica",category:"quimica",level:"introductorio",readingMinutes:22,summary:"Modelos atómicos, números cuánticos y configuración electrónica.",
      sections:[
        {id:"modelos",title:"Modelos atómicos",keywords:["Dalton","Bohr"],body:"**Dalton (1808):** átomos indivisibles. **Thomson (1897):** electrón. **Rutherford (1911):** núcleo. **Bohr (1913):** $E_n=-13.6/n^2$ eV."},
        {id:"cuanticos",title:"Números cuánticos",keywords:["n","l","m","s"],body:"| Símbolo | Nombre | Valores |\n|---------|--------|--------|\n| n | Principal | 1,2,3... |\n| l | Azimutal | 0 a n-1 |\n| m_l | Magnético | -l a +l |\n| m_s | Spin | ±1/2 |\n\n**Pauli:** dos electrones no pueden tener los 4 números iguales."},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"$E_n=-13.6/n^2$ eV, $\\lambda=h/p$, $\\Delta x\\Delta p\\geq\\hbar/2$. Radio de Bohr: $a_0=0.529$ Å."}
      ]
    },
    {slug:"equilibrio-quimico",title:"Equilibrio químico",category:"quimica",level:"intermedio",readingMinutes:18,summary:"Constante de equilibrio, Le Châtelier, ácidos y bases, pH.",
      sections:[
        {id:"constante",title:"Constante de equilibrio",keywords:["K","equilibrio"],body:"$K_c=\\frac{[C]^c[D]^d}{[A]^a[B]^b}$, $K_p=K_c(RT)^{\\Delta n}$. Si $K>1$ favorece productos.",widget:"chem-equilibrium"},
        {id:"le-chatelier",title:"Le Châtelier",keywords:["Le Châtelier"],body:"Al perturbar un sistema en equilibrio, este se desplaza para contrarrestar el cambio.",widget:"chem-lechatelier"},
        {id:"acido-base",title:"Ácidos y bases",keywords:["pH","pKa"],body:"$\\text{pH}=-\\log[H^+]$. Ácido débil: $\\text{pH}\\approx\\frac{1}{2}(\\text{p}K_a-\\log c_0)$. Buffer: $\\text{pH}=\\text{p}K_a+\\log([A^-]/[HA])$.",widget:"chem-ph"},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"$\\Delta G°=-RT\\ln K$, pH$=-\\log[H^+]$, pH+pOH=14. **Ejemplo:** $K_a=1.8\\times10^{-5}$, $c_0=0.1$M: pH$=2.87$."}
      ]
    },
    {slug:"calculo-diferencial",title:"Cálculo diferencial",category:"matematica",level:"introductorio",readingMinutes:24,summary:"Límites, derivadas, reglas de derivación y optimización.",
      sections:[
        {id:"limites",title:"Límites",keywords:["límite"],body:"$\\lim_{x\\to a}f(x)=L$: $f(x)$ se acerca a $L$ cuando $x$ se acerca a $a$."},
        {id:"derivada",title:"Derivada",keywords:["derivada"],body:"$f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}$. Reglas: $(x^n)'=nx^{n-1}$, $(e^x)'=e^x$, $(\\ln x)'=1/x$, $(\\sin x)'=\\cos x$.",widget:"math-derivative"},
        {id:"aplicaciones",title:"Aplicaciones",keywords:["optimización","Newton"],body:"Optimización: $f'(x)=0$, clasificar con $f''$. **Newton-Raphson:** $x_{n+1}=x_n-f(x_n)/f'(x_n)$.",widget:"math-newton-raphson"},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"Regla del producto: $(fg)'=f'g+fg'$. Regla de la cadena: $(f(g))'=f'(g)g'$."}
      ]
    },
    {slug:"algebra-lineal",title:"Álgebra lineal",category:"matematica",level:"intermedio",readingMinutes:22,summary:"Matrices, determinantes, sistemas de ecuaciones, valores propios.",
      sections:[
        {id:"matrices",title:"Matrices",keywords:["matriz"],body:"$(AB)_{ij}=\\sum_k A_{ik}B_{kj}$. Inversa: $A^{-1}$ si $\\det A\\neq0$.",widget:"math-eigen"},
        {id:"determinantes",title:"Determinantes",keywords:["determinante"],body:"$\\det\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}=ad-bc$. $\\det(AB)=\\det A\\cdot\\det B$."},
        {id:"eigen",title:"Valores propios",keywords:["eigenvalor"],body:"$A\\vec v=\\lambda\\vec v$. $\\det(A-\\lambda I)=0$. Diagonalización: $A=PDP^{-1}$."},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"$\\text{tr}(A)=\\sum\\lambda_i$, $\\det A=\\prod\\lambda_i$. **Ejemplo:** $A=\\begin{pmatrix}2&1\\\\1&2\\end{pmatrix}$, $\\lambda=1,3$."}
      ]
    },
    {slug:"control-automatico",title:"Control automático",category:"ingenieria",level:"intermedio",readingMinutes:26,summary:"Realimentación, PID, sintonía y estabilidad.",
      sections:[
        {id:"realimentacion",title:"Realimentación",keywords:["feedback"],body:"$e(t)=r(t)-y(t)$. El controlador compara salida con referencia.",widget:"eng-pid"},
        {id:"pid",title:"Control PID",keywords:["PID"],body:"$u(t)=K_p e+K_i\\int e\\,dt+K_d\\frac{de}{dt}$."},
        {id:"bode",title:"Análisis en frecuencia",keywords:["Bode"],body:"Diagrama de Bode: magnitud (dB) y fase vs frecuencia.",widget:"eng-bode"},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"Ziegler-Nichols: $K_p=0.6K_u$, $T_i=0.5T_u$, $T_d=0.125T_u$."}
      ]
    },
    {slug:"mecanica-materiales",title:"Mecánica de materiales",category:"ingenieria",level:"intermedio",readingMinutes:20,summary:"Esfuerzo, deformación, elasticidad, vigas y pandeo.",
      sections:[
        {id:"esfuerzo",title:"Esfuerzo y deformación",keywords:["Hooke","Young"],body:"$\\sigma=F/A$, $\\varepsilon=\\Delta L/L_0$. Hooke: $\\sigma=E\\varepsilon$. Acero: $E=200$ GPa.",widget:"eng-beam"},
        {id:"vigas",title:"Vigas",keywords:["viga","deflexión"],body:"$EI\\frac{d^2y}{dx^2}=M(x)$. Voladizo: $\\delta_\\text{max}=PL^3/(3EI)$. Pandeo: $P_\\text{cr}=\\pi^2EI/(KL)^2$."},
        {id:"formulario",title:"Formulario",keywords:["formulario"],body:"$\\sigma=E\\varepsilon$, $\\delta=PL^3/(3EI)$. **Ejemplo:** viga L=2m, P=5kN: $\\delta=8.3$ mm."}
      ]
    }
  );
})();

var CATEGORY_META = {
  fisica:{label:"Física",description:"Mecánica, ondas, electromagnetismo, termodinámica, óptica.",tone:"primary"},
  quimica:{label:"Química",description:"Estructura atómica, reacciones, equilibrio, cinética.",tone:"accent"},
  matematica:{label:"Matemática",description:"Cálculo, álgebra lineal, EDO, Fourier, métodos numéricos.",tone:"success"},
  ingenieria:{label:"Ingeniería",description:"Control, señales, mecánica de materiales, transferencia de calor.",tone:"warn"}
};
var LEVEL_META = {
  introductorio:{label:"Introductorio"},
  intermedio:{label:"Intermedio"},
  avanzado:{label:"Avanzado"}
};

// ── Artículos: overrides/borrados sobre los precargados + artículos nuevos ─
// Los artículos de ejemplo (Mecánica Clásica, Electromagnetismo, etc.) viven
// hardcodeados en ARTICLES. Como no se puede reescribir ese array desde el
// navegador, guardamos ediciones como "overrides" (slug -> versión editada) y
// borrados como una lista de slugs ocultos ("tombstones"), todo en localStorage.
var BUILTIN_ARTICLES = ARTICLES;
function isBuiltInSlug(slug) { return BUILTIN_ARTICLES.some(function(a){return a.slug===slug;}); }
function getArticleOverrides() {
  try { return JSON.parse(localStorage.getItem('ad_article_overrides') || '{}'); } catch(e) { return {}; }
}
function getDeletedBuiltins() {
  try { return JSON.parse(localStorage.getItem('ad_article_deletions') || '[]'); } catch(e) { return []; }
}
function getCustomArticles() {
  try { return JSON.parse(localStorage.getItem('ad_articles') || '[]'); } catch(e) { return []; }
}
function getArticle(slug) {
  var custom = getCustomArticles().find(function(a){return a.slug===slug;});
  if (custom) return custom;
  var overrides = getArticleOverrides();
  if (overrides[slug]) return overrides[slug];
  if (getDeletedBuiltins().indexOf(slug) >= 0) return undefined;
  return BUILTIN_ARTICLES.find(function(a){return a.slug===slug;});
}
function getAllArticles() {
  var deleted = getDeletedBuiltins(), overrides = getArticleOverrides();
  var builtins = BUILTIN_ARTICLES
    .filter(function(a){ return deleted.indexOf(a.slug) < 0; })
    .map(function(a){ return overrides[a.slug] || a; });
  return builtins.concat(getCustomArticles());
}
// Guarda un artículo: si el slug corresponde a uno precargado, lo guarda como
// override; si es nuevo (creado desde el workspace), va a la lista de artículos propios.
function saveCustomArticle(article) {
  if (isBuiltInSlug(article.slug)) {
    var overrides = getArticleOverrides();
    overrides[article.slug] = article;
    localStorage.setItem('ad_article_overrides', JSON.stringify(overrides));
    return;
  }
  var all = getCustomArticles();
  var idx = all.findIndex(function(a){return a.slug===article.slug;});
  if (idx >= 0) all[idx] = article; else all.push(article);
  localStorage.setItem('ad_articles', JSON.stringify(all));
}
// Borra un artículo: si es precargado, lo oculta (tombstone) sin tocar el array
// original; si es propio, lo elimina directamente.
function deleteCustomArticle(slug) {
  if (isBuiltInSlug(slug)) {
    var deleted = getDeletedBuiltins();
    if (deleted.indexOf(slug) < 0) deleted.push(slug);
    localStorage.setItem('ad_article_deletions', JSON.stringify(deleted));
    var overrides = getArticleOverrides();
    delete overrides[slug];
    localStorage.setItem('ad_article_overrides', JSON.stringify(overrides));
    return;
  }
  var all = getCustomArticles().filter(function(a){return a.slug!==slug;});
  localStorage.setItem('ad_articles', JSON.stringify(all));
}
function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

// ── Markdown + LaTeX Renderer ──────────────────────────
function renderMdMath(src) {
  var slots = [];
  function slot(h) { slots.push(h); return '\x00M'+(slots.length-1)+'\x00'; }
  var s = src.replace(/\$\$([\s\S]+?)\$\$/g, function(_,e){return slot(renderKatex(e.trim(),true));});
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, function(_,e){return slot(renderKatex(e.trim(),true));});
  s = s.replace(/\$([^$\n]+?)\$/g, function(_,e){return slot(renderKatex(e.trim(),false));});

  // Tables: consume whole consecutive block of "| ... |" lines (header + separator + rows) as one unit.
  s = s.replace(/(^\|.*\|[ \t]*(?:\n|$)){2,}/gm, function(block) {
    var lines = block.trim().split('\n').filter(function(l){return l.trim();});
    if (lines.length < 2 || lines[1].indexOf('---') < 0) return block; // not a real table
    function cells(line) { return line.split('|').map(function(c){return c.trim();}).filter(function(c,i,arr){return !(i===0&&c==='')&&!(i===arr.length-1&&c==='');}); }
    var head = cells(lines[0]);
    var rows = lines.slice(2).map(cells);
    var out = '<table><thead><tr>'+head.map(function(c){return '<th>'+c+'</th>';}).join('')+'</tr></thead><tbody>';
    rows.forEach(function(r){ out += '<tr>'+r.map(function(c){return '<td>'+c+'</td>';}).join('')+'</tr>'; });
    out += '</tbody></table>';
    return slot(out);
  });

  var h = s.replace(/^### (.+)$/gm,'<h4>$1</h4>').replace(/^## (.+)$/gm,'<h3>$1</h3>').replace(/^# (.+)$/gm,'<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>').replace(/^> (.+)$/gm,'<blockquote><p>$1</p></blockquote>')
    .replace(/^- (.+)$/gm,'<li>$1</li>').replace(/\n\n/g,'</p><p>');
  h = '<p>'+h+'</p>';
  h = h.replace(/(<li>.*<\/li>)/g,'<ul>$1</ul>');
  h = h.replace(/\x00M(\d+)\x00/g, function(_,i){return slots[Number(i)]||'';});
  return h;
}

function renderKatex(expr, dm) {
  try {
    if (typeof katex !== 'undefined') return katex.renderToString(expr, {displayMode:dm, throwOnError:false, strict:'ignore'});
  } catch(e) {}
  return '<code style="color:#fbbf24">'+expr+'</code>';
}

// ── WIDGETS ────────────────────────────────────────────

// Calcula el máximo (o mínimo) de fn(params) muestreando toda la grilla de combinaciones
// posibles de los sliders declarados en sliderDefs = {clave: {min, max}, ...}.
// Se usa para "escala fija": en vez de congelar la vista actual, calculamos de una vez
// el rango que abarca la curva más extrema posible en todo el dominio de parámetros.
function maxOverGrid(sliderDefs, fn, steps) {
  steps = steps || 16;
  var keys = Object.keys(sliderDefs);
  var best = -Infinity;
  function rec(i, params) {
    if (i === keys.length) { var v = fn(params); if (isFinite(v) && v > best) best = v; return; }
    var k = keys[i], def = sliderDefs[k];
    for (var s = 0; s <= steps; s++) {
      params[k] = def.min + (def.max - def.min) * s / steps;
      rec(i + 1, params);
    }
  }
  rec(0, {});
  return best;
}

function drawAxes(ctx, pad, pw, ph, xMin, xMax, yMin, yMax, nTicks) {
  nTicks = nTicks || 4;
  ctx.strokeStyle = 'rgba(100,116,139,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t+ph); ctx.lineTo(pad.l+pw, pad.t+ph);
  ctx.stroke();
  ctx.fillStyle = '#8a8fa8'; ctx.font = '9px JetBrains Mono';
  function fmt(v) { var a = Math.abs(v); return a!==0 && a<0.01 ? v.toExponential(1) : (a>=100?v.toFixed(0):v.toFixed(2)); }
  for (var i=0;i<=nTicks;i++) {
    var xv = xMin + (xMax-xMin)*i/nTicks, sx = pad.l + pw*i/nTicks;
    ctx.strokeStyle='rgba(100,116,139,0.6)';ctx.beginPath();ctx.moveTo(sx,pad.t+ph);ctx.lineTo(sx,pad.t+ph+4);ctx.stroke();
    ctx.textAlign='center';ctx.fillText(fmt(xv), sx, pad.t+ph+14);
    var yv = yMin + (yMax-yMin)*(nTicks-i)/nTicks, sy = pad.t + ph*i/nTicks;
    ctx.beginPath();ctx.moveTo(pad.l-4,sy);ctx.lineTo(pad.l,sy);ctx.stroke();
    ctx.textAlign='right';ctx.fillText(fmt(yv), pad.l-6, sy+3);
  }
  ctx.textAlign='start';
}

function WidgetFigure(title, sliders, drawFn, caption, height, animate) {
  height = height || 260;
  if (animate === undefined) animate = true;
  var fig = document.createElement('figure');
  fig.className = 'widget-figure';
  if (title) {
    var cap = document.createElement('figcaption');
    cap.innerHTML = '<span>'+title+'</span>';
    var controls = '<span class="widget-controls">';
    if (animate) controls += '<button class="widget-pause">Pausar</button><button class="widget-reset">Reiniciar</button>';
    controls += '<button class="widget-lock" title="Fijá la escala de los ejes para comparar cómo cambia la curva; liberala para que los ejes se ajusten automáticamente.">🔓 Escala libre</button>';
    controls += '</span>';
    cap.innerHTML += controls;
    fig.appendChild(cap);
  }
  var body = document.createElement('div'); body.className = 'widget-body';
  var wrap = document.createElement('div'); wrap.className = 'widget-canvas-wrap';
  var canvas = document.createElement('canvas'); canvas.style.height = height+'px'; wrap.appendChild(canvas); body.appendChild(wrap);
  var sliderDiv = document.createElement('div'); sliderDiv.className = 'widget-sliders';
  var params = {};
  var scale = {locked:false, range:null}; // widgets can opt in to reading/writing scale.range
  sliders.forEach(function(s) {
    params[s.key] = s.initial;
    var lbl = document.createElement('label');
    lbl.innerHTML = '<div class="slider-head"><span>'+s.label+'</span><span class="slider-val">'+s.initial+(s.unit||'')+'</span></div>';
    var inp = document.createElement('input'); inp.type='range'; inp.min=s.min; inp.max=s.max; inp.step=s.step; inp.value=s.initial;
    inp.addEventListener('input',function(){params[s.key]=Number(inp.value);lbl.querySelector('.slider-val').textContent=Number(inp.value)+(s.unit||'');if(!animate)tick(performance.now());});
    lbl.appendChild(inp); sliderDiv.appendChild(lbl);
  });
  body.appendChild(sliderDiv); fig.appendChild(body);
  if (caption) { var cd = document.createElement('div'); cd.className='widget-caption'; cd.textContent=caption; fig.appendChild(cd); }
  var running = true, startT = performance.now(), elapsed = 0;
  var resizeTries = 0;
  function resize() {
    var dpr = window.devicePixelRatio||1, rect = canvas.getBoundingClientRect();
    if (rect.width === 0 && resizeTries < 20) {
      // Container not laid out yet (e.g. still off-screen or mid-reflow); retry shortly.
      resizeTries++;
      setTimeout(resize, 60);
      return;
    }
    canvas.width = Math.max(1, rect.width*dpr); canvas.height = Math.max(1, rect.height*dpr);
    canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
  }
  function tick(now) {
    if (running) elapsed = (now-startT)/1000;
    var ctx = canvas.getContext('2d'), rect = canvas.getBoundingClientRect();
    ctx.clearRect(0,0,rect.width,rect.height);
    try { drawFn(ctx, rect.width, rect.height, elapsed, params, scale); } catch(e) { console.error('Widget draw error:', e); }
    if (animate) requestAnimationFrame(tick);
  }
  window.addEventListener('resize', resize);
  setTimeout(function(){resize();requestAnimationFrame(tick);},50);
  setTimeout(function(){
    var pb = fig.querySelector('.widget-pause'), rb = fig.querySelector('.widget-reset'), lb = fig.querySelector('.widget-lock');
    if (pb) pb.addEventListener('click',function(){running=!running;pb.textContent=running?'Pausar':'Reanudar';if(running){startT=performance.now()-elapsed*1000;requestAnimationFrame(tick);}});
    if (rb) rb.addEventListener('click',function(){startT=performance.now();elapsed=0;running=true;if(pb)pb.textContent='Pausar';requestAnimationFrame(tick);});
    if (lb) lb.addEventListener('click',function(){
      scale.locked = !scale.locked;
      lb.textContent = scale.locked ? '🔒 Escala fija' : '🔓 Escala libre';
      if (!scale.locked) scale.range = null;
      tick(performance.now());
    });
  },100);
  return fig;
}

var WIDGETS = {};

// Widget implementations
WIDGETS['phys-projectile'] = function() {
  var sliderDefs = {v0:{min:5,max:60}, ang:{min:5,max:85}, g:{min:1.6,max:25}};
  function rangeFn(p) { var th=p.ang*Math.PI/180; return p.v0*p.v0*Math.sin(2*th)/p.g; }
  return WidgetFigure('Tiro parabólico — y(x)', [
    {key:'v0',label:'Velocidad inicial v₀',min:5,max:60,step:1,initial:25,unit:' m/s'},
    {key:'ang',label:'Ángulo θ',min:5,max:85,step:1,initial:45,unit:'°'},
    {key:'g',label:'Gravedad g',min:1.6,max:25,step:0.1,initial:9.81,unit:' m/s²'}
  ], function(ctx,w,h,t,p,scale) {
    var th=p.ang*Math.PI/180, vx=p.v0*Math.cos(th), vy=p.v0*Math.sin(th);
    var tEnd=2*vy/p.g, xEnd=vx*tEnd, pad={l:50,r:30,t:20,b:40}, pw=w-pad.l-pad.r, ph=h-pad.t-pad.b;
    var xEndView, yMaxView;
    if (scale.locked) {
      if (!scale.range) scale.range = {xEndMax: maxOverGrid(sliderDefs, rangeFn)};
      xEndView = scale.range.xEndMax; yMaxView = xEndView*0.3;
    } else {
      xEndView = xEnd; yMaxView = xEnd*0.3;
    }
    drawAxes(ctx,pad,pw,ph,0,xEndView,0,yMaxView,4);
    ctx.strokeStyle='#22d3ee';ctx.lineWidth=2;ctx.beginPath();
    for(var i=0;i<=80;i++){var x=i/80*xEnd, tt=x/vx, yy=vy*tt-0.5*p.g*tt*tt;
      var sx=pad.l+x/xEndView*pw, sy=pad.t+ph-yy/yMaxView*ph*0.7;
      if(i===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);}
    ctx.stroke();
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText('R='+xEnd.toFixed(1)+'m',pad.l+pw/2,pad.t+16);
  },'R = v₀² sin(2θ)/g, máximo en θ = 45°. Con escala fija ves el alcance real comparado contra el máximo posible.',240,false);
};

WIDGETS['phys-friction'] = function() {
  return WidgetFigure('Bloque con fricción', [
    {key:'ang',label:'Inclinación θ',min:0,max:60,step:1,initial:25,unit:'°'},
    {key:'mu',label:'Coef. fricción μ',min:0,max:0.8,step:0.01,initial:0.25},
    {key:'g',label:'Gravedad g',min:1,max:20,step:0.1,initial:9.81,unit:' m/s²'}
  ], function(ctx,w,h,t,p) {
    var th=p.ang*Math.PI/180, aSlide=p.g*(Math.sin(th)-p.mu*Math.cos(th)), a=aSlide>0?aSlide:0;
    var Lmax=Math.min(w,h)*0.7, period=a>0?Math.sqrt(2*Lmax/a):4, tt=t%(period+0.6), s=a>0?Math.min(0.5*a*tt*tt,Lmax):0;
    // Origen arriba-izquierda (punto alto); la rampa desciende hacia la derecha.
    var ox=w*0.15, oy=h*0.15;
    var baseX=ox+Lmax*Math.cos(th), baseY=oy+Lmax*Math.sin(th), cornerX=ox, cornerY=baseY;
    // Triángulo cerrado (rampa) relleno
    ctx.fillStyle='rgba(100,116,139,0.15)';
    ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(baseX,baseY);ctx.lineTo(cornerX,cornerY);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(180,200,220,0.9)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(cornerX,cornerY);ctx.lineTo(baseX,baseY);ctx.lineTo(ox,oy);ctx.stroke();
    // Bloque: se desliza hacia la derecha y abajo, apoyado flush sobre la rampa
    var bx=ox+s*Math.cos(th), by=oy+s*Math.sin(th);
    ctx.save();
    ctx.translate(bx,by);ctx.rotate(th);
    ctx.fillStyle='rgba(34,211,238,0.9)';ctx.fillRect(-12,-20,24,20);
    ctx.restore();
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText('μ='+p.mu.toFixed(2)+' θ='+p.ang+'°',12,h-30);
    ctx.fillStyle=a>0&&s>0.01?'#fbbf24':'#34d399';
    ctx.fillText(a>0&&s>0.01?'Deslizando':'En reposo',12,h-14);
  },'mg(sinθ − μcosθ). Si μ < tanθ, desliza.',240);
};

WIDGETS['phys-spring'] = function() {
  return WidgetFigure('Oscilador masa-resorte', [
    {key:'m',label:'Masa m',min:0.1,max:5,step:0.1,initial:1,unit:' kg'},
    {key:'k',label:'Rigidez k',min:1,max:50,step:1,initial:10,unit:' N/m'},
    {key:'A',label:'Amplitud A',min:10,max:80,step:1,initial:40,unit:' px'}
  ], function(ctx,w,h,t,p) {
    var omega=Math.sqrt(p.k/p.m), x=p.A*Math.cos(omega*t), cx=w/2, cy=h/2, wall=cx-100;
    ctx.strokeStyle='rgba(150,170,200,0.6)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(wall,cy);ctx.lineTo(cx+x,cy);ctx.stroke();
    ctx.fillStyle='rgba(34,211,238,0.9)';ctx.fillRect(cx+x-18,cy-18,36,36);
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText('ω='+omega.toFixed(2)+' rad/s T='+(2*Math.PI/omega).toFixed(2)+'s',12,18);
  },'x(t) = A cos(ωt), ω = √(k/m)',220);
};

WIDGETS['phys-pendulum'] = function() {
  return WidgetFigure('Péndulo simple', [
    {key:'L',label:'Longitud L',min:0.3,max:3,step:0.1,initial:1.2,unit:' m'},
    {key:'ang',label:'Ángulo θ₀',min:5,max:60,step:1,initial:30,unit:'°'},
    {key:'g',label:'Gravedad g',min:1,max:20,step:0.1,initial:9.81,unit:' m/s²'}
  ], function(ctx,w,h,t,p) {
    var omega=Math.sqrt(p.g/p.L), th0=p.ang*Math.PI/180, th=th0*Math.cos(omega*t);
    var ox=w/2, oy=h*0.2, len=Math.min(w,h)*0.5, bx=ox+len*Math.sin(th), by=oy+len*Math.cos(th);
    ctx.strokeStyle='rgba(180,200,220,0.7)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(bx,by);ctx.stroke();
    ctx.fillStyle='rgba(251,191,36,0.9)';ctx.beginPath();ctx.arc(bx,by,16,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText('T='+(2*Math.PI/omega).toFixed(2)+'s',12,18);
  },'T ≈ 2π√(L/g) para ángulos pequeños.',240);
};

WIDGETS['phys-ohm'] = function() {
  return WidgetFigure('Ley de Ohm — V=IR', [
    {key:'V',label:'Voltaje V',min:0.5,max:24,step:0.5,initial:12,unit:' V'},
    {key:'R',label:'Resistencia R',min:1,max:1000,step:1,initial:100,unit:' Ω'}
  ], function(ctx,w,h,t,p) {
    var I=p.V/p.R, P=p.V*I;
    ctx.fillStyle='#e2e8f0';ctx.font='16px Space Grotesk';ctx.textAlign='center';
    ctx.fillText('I = '+I.toFixed(3)+' A',w/2,h/2-20);
    ctx.fillText('P = '+P.toFixed(2)+' W',w/2,h/2+12);ctx.textAlign='start';
  },'I=V/R, P=VI=V²/R=I²R',180,false);
};

WIDGETS['phys-wave'] = function() {
  return WidgetFigure('Onda viajera', [
    {key:'A',label:'Amplitud A',min:10,max:60,step:1,initial:30,unit:' px'},
    {key:'f',label:'Frecuencia f',min:0.1,max:3,step:0.1,initial:1,unit:' Hz'},
    {key:'lambda',label:'Long. onda λ',min:60,max:300,step:5,initial:150,unit:' px'}
  ], function(ctx,w,h,t,p) {
    var omega=2*Math.PI*p.f, k=2*Math.PI/p.lambda, pad={l:50,r:20,t:20,b:40}, pw=w-pad.l-pad.r, ph=h-pad.t-pad.b;
    drawAxes(ctx,pad,pw,ph,0,w,-p.A,p.A,4);
    ctx.strokeStyle='#22d3ee';ctx.lineWidth=2;ctx.beginPath();
    for(var i=0;i<=pw;i+=2){var y=pad.t+ph/2-p.A*Math.sin(k*i-omega*t)/p.A*(ph/2-4);if(i===0)ctx.moveTo(pad.l+i,y);else ctx.lineTo(pad.l+i,y);}
    ctx.stroke();
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText('λ='+p.lambda+'px f='+p.f+'Hz v='+(p.lambda*p.f).toFixed(0)+'px/s',pad.l,14);
  },'v = λf = ω/k',200);
};

WIDGETS['phys-snell'] = function() {
  function arrowHead(ctx, fromX, fromY, toX, toY, color) {
    var ang = Math.atan2(toY-fromY, toX-fromX);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX-9*Math.cos(ang-0.4), toY-9*Math.sin(ang-0.4));
    ctx.lineTo(toX-9*Math.cos(ang+0.4), toY-9*Math.sin(ang+0.4));
    ctx.closePath(); ctx.fill();
  }
  return WidgetFigure('Ley de Snell', [
    {key:'n1',label:'n₁ (medio superior)',min:1,max:3,step:0.01,initial:1},
    {key:'n2',label:'n₂ (medio inferior)',min:1,max:3,step:0.01,initial:1.5},
    {key:'th1',label:'θ₁ (incidencia)',min:5,max:85,step:1,initial:45,unit:'°'}
  ], function(ctx,w,h,t,p) {
    var cx=w/2, cy=h/2, l1=Math.min(w,h)*0.38;
    // Medios con fondo distinto arriba/abajo de la interfase, para ubicar n₁ y n₂ de un vistazo
    ctx.fillStyle='rgba(125,211,252,0.07)'; ctx.fillRect(0,0,w,cy);
    ctx.fillStyle='rgba(192,132,252,0.09)'; ctx.fillRect(0,cy,w,h-cy);
    ctx.strokeStyle='rgba(200,200,200,0.5)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.stroke();
    // Normal de referencia (línea punteada) para comparar ángulos
    ctx.strokeStyle='rgba(150,150,150,0.5)';ctx.setLineDash([3,3]);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(cx,cy-l1);ctx.lineTo(cx,cy+l1);ctx.stroke();ctx.setLineDash([]);

    var th1r=p.th1*Math.PI/180, sinth2=p.n1*Math.sin(th1r)/p.n2, tir=sinth2>1;

    // Rayo incidente: llega en ángulo θ₁ real respecto de la normal (ya no siempre vertical)
    var ix=cx-l1*Math.sin(th1r), iy=cy-l1*Math.cos(th1r);
    ctx.strokeStyle='#fbbf24';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(ix,iy);ctx.lineTo(cx,cy);ctx.stroke();
    arrowHead(ctx,ix,iy,cx,cy,'#fbbf24');

    if (tir) {
      // Reflexión total interna: toda la luz rebota al mismo medio, mismo ángulo que incidencia
      var rx=cx+l1*Math.sin(th1r), ry=cy-l1*Math.cos(th1r);
      ctx.strokeStyle='#ef4444';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(rx,ry);ctx.stroke();
      arrowHead(ctx,cx,cy,rx,ry,'#ef4444');
      ctx.fillStyle='#ef4444';ctx.font='12px JetBrains Mono';ctx.textAlign='center';
      ctx.fillText('¡Reflexión total interna! (θ₁ > ángulo crítico)',cx,16);ctx.textAlign='start';
    } else {
      var th2r=Math.asin(sinth2);
      var fx=cx+l1*Math.sin(th2r), fy=cy+l1*Math.cos(th2r);
      ctx.strokeStyle='#22d3ee';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(fx,fy);ctx.stroke();
      arrowHead(ctx,cx,cy,fx,fy,'#22d3ee');
      // Reflexión parcial (siempre existe algo, se dibuja tenue para no confundir con la principal)
      var rx=cx+l1*Math.sin(th1r), ry=cy-l1*Math.cos(th1r);
      ctx.strokeStyle='rgba(251,191,36,0.3)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(rx,ry);ctx.stroke();
    }

    ctx.fillStyle='#8a8fa8';ctx.font='10px JetBrains Mono';
    ctx.fillText('n₁='+p.n1.toFixed(2),8,cy-8);
    ctx.fillText('n₂='+p.n2.toFixed(2),8,cy+16);
    ctx.fillStyle='#e2e8f0';
    ctx.fillText('θ₂='+(tir?'—':(Math.asin(sinth2)*180/Math.PI).toFixed(1)+'°'),8,h-10);
  },'n₁sinθ₁=n₂sinθ₂ · amarillo=incidente, celeste=refractado, rojo=reflexión total',240,false);
};

WIDGETS['phys-energy'] = function() {
  return WidgetFigure('Energía cinética y potencial', [
    {key:'m',label:'Masa m',min:0.1,max:10,step:0.1,initial:1,unit:' kg'},
    {key:'h',label:'Altura h',min:1,max:50,step:0.5,initial:20,unit:' m'},
    {key:'g',label:'Gravedad g',min:1,max:20,step:0.1,initial:9.81,unit:' m/s²'}
  ], function(ctx,w,h,t,p) {
    var v=Math.sqrt(2*p.g*p.h), U=p.m*p.g*p.h, K=0.5*p.m*v*v;
    ctx.fillStyle='#e2e8f0';ctx.font='14px Space Grotesk';ctx.textAlign='center';
    ctx.fillText('U='+U.toFixed(1)+' J',w/2,h/2-24);
    ctx.fillText('K='+K.toFixed(1)+' J (impacto)',w/2,h/2+4);
    ctx.fillText('v='+v.toFixed(1)+' m/s',w/2,h/2+32);ctx.textAlign='start';
  },'Caída libre: U → K, conservación de energía.',180,false);
};

WIDGETS['phys-doppler'] = function() {
  return WidgetFigure('Efecto Doppler', [
    {key:'fs',label:'Frec. fuente fₛ',min:100,max:1000,step:10,initial:440,unit:' Hz'},
    {key:'vs',label:'Vel. fuente vₛ',min:-60,max:60,step:2,initial:20,unit:' m/s'}
  ], function(ctx,w,h,t,p) {
    var c=343, fo=p.fs*c/(c-p.vs);
    ctx.fillStyle='#e2e8f0';ctx.font='14px Space Grotesk';ctx.textAlign='center';
    ctx.fillText('fₒ = '+fo.toFixed(1)+' Hz',w/2,h/2-10);
    ctx.fillText('Ratio: '+(fo/p.fs).toFixed(3),w/2,h/2+18);ctx.textAlign='start';
  },'fₒ=fₛ·c/(c−vₛ)',180,false);
};

WIDGETS['math-derivative'] = function() {
  return WidgetFigure('Derivada como pendiente', [
    {key:'x0',label:'x₀',min:-2.2,max:2.2,step:0.05,initial:0.75}
  ], function(ctx,w,h,t,p) {
    var pad={l:50,r:20,t:20,b:40},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
    var D=2.2;
    function f(x){return x*x*x-3*x;}function fp(x){return 3*x*x-3;}
    var yMax=Math.abs(f(D))*1.15;
    function sx(x){return pad.l+(x+D)/(2*D)*pw;}function sy(y){return pad.t+ph/2-y/yMax*(ph/2);}
    drawAxes(ctx,pad,pw,ph,-D,D,-yMax,yMax,4);
    ctx.strokeStyle='#22d3ee';ctx.lineWidth=2;ctx.beginPath();
    for(var i=0;i<=300;i++){var x=-D+i/300*2*D,y=f(x);if(i===0)ctx.moveTo(sx(x),sy(y));else ctx.lineTo(sx(x),sy(y));}
    ctx.stroke();
    var x0=p.x0,y0=f(x0),m=fp(x0);
    ctx.strokeStyle='#fbbf24';ctx.lineWidth=1.5;ctx.setLineDash([4,2]);
    ctx.beginPath();ctx.moveTo(sx(x0-0.8),sy(y0-m*0.8));ctx.lineTo(sx(x0+0.8),sy(y0+m*0.8));ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(sx(x0),sy(y0),4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText("f'("+x0.toFixed(2)+')='+m.toFixed(2),pad.l+8,pad.t+14);
  },"f(x)=x³−3x, f'(x)=3x²−3",220,false);
};

WIDGETS['math-eigen'] = function() {
  return WidgetFigure('Vectores propios en 2D', [
    {key:'a11',label:'a₁₁',min:-3,max:3,step:0.1,initial:2},
    {key:'a12',label:'a₁₂',min:-3,max:3,step:0.1,initial:1},
    {key:'a21',label:'a₂₁',min:-3,max:3,step:0.1,initial:1},
    {key:'a22',label:'a₂₂',min:-3,max:3,step:0.1,initial:2}
  ], function(ctx,w,h,t,p) {
    var tr=p.a11+p.a22, det=p.a11*p.a22-p.a12*p.a21, disc=tr*tr-4*det;
    ctx.fillStyle='#e2e8f0';ctx.font='13px Space Grotesk';ctx.textAlign='center';
    if(disc>=0){var l1=(tr+Math.sqrt(disc))/2,l2=(tr-Math.sqrt(disc))/2;ctx.fillText('λ₁='+l1.toFixed(2)+', λ₂='+l2.toFixed(2),w/2,h/2);}
    else ctx.fillText('λ₁,₂='+(tr/2).toFixed(2)+'±'+Math.sqrt(-disc)/2+'i',w/2,h/2);
    ctx.textAlign='start';
  },'det(A−λI)=λ²−tr(A)λ+det(A)=0',180,false);
};

WIDGETS['eng-pid'] = function() {
  return WidgetFigure('Respuesta PID al escalón', [
    {key:'Kp',label:'Kp',min:0.1,max:5,step:0.1,initial:1.2},
    {key:'Ki',label:'Ki',min:0,max:3,step:0.05,initial:0.5},
    {key:'Kd',label:'Kd',min:0,max:2,step:0.05,initial:0.3}
  ], function(ctx,w,h,t,p) {
    var pad={l:50,r:20,t:20,b:40},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
    drawAxes(ctx,pad,pw,ph,0,8,0,1.5,4);
    // Simulación real de lazo cerrado: planta y''+y'=u (G=1/(s(s+1))) con control PID sobre el error.
    var dt=0.005, N=1600, y=0, v=0, integral=0, prevE=1;
    ctx.strokeStyle='#22d3ee';ctx.lineWidth=2;ctx.beginPath();
    for(var i=0;i<=N;i++){
      var ti=i*dt;
      var e=1-y;
      integral=Math.max(-20,Math.min(20,integral+e*dt));
      var deriv=(e-prevE)/dt;
      var u=p.Kp*e+p.Ki*integral+p.Kd*deriv;
      var vdot=u-v; v+=vdot*dt; y+=v*dt;
      prevE=e;
      if (i%4===0) {
        var sx=pad.l+ti/8*pw,sy=pad.t+ph-Math.min(1.5,Math.max(0,y))/1.5*ph;
        if(i===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
      }
    }
    ctx.stroke();
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText('Kp='+p.Kp+' Ki='+p.Ki+' Kd='+p.Kd,pad.l+8,pad.t+14);
  },"Planta y''+y'=u con control PID en lazo cerrado — probá subir Kp o Kd",220,false);
};

WIDGETS['eng-bode'] = function() {
  return WidgetFigure('Diagrama de Bode', [
    {key:'wn',label:'ωₙ',min:0.5,max:10,step:0.5,initial:3,unit:' rad/s'},
    {key:'zeta',label:'ζ',min:0.05,max:1,step:0.05,initial:0.3}
  ], function(ctx,w,h,t,p) {
    var pad={l:55,r:20,t:20,b:40},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
    ctx.strokeStyle='rgba(100,116,139,0.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,pad.t+ph);ctx.lineTo(pad.l+pw,pad.t+ph);ctx.stroke();
    ctx.fillStyle='#8a8fa8';ctx.font='9px JetBrains Mono';
    [-40,-20,0,20].forEach(function(db){var sy=pad.t+ph-(db+40)/60*ph;ctx.beginPath();ctx.moveTo(pad.l-4,sy);ctx.lineTo(pad.l,sy);ctx.stroke();ctx.textAlign='right';ctx.fillText(db+'dB',pad.l-6,sy+3);});
    [0.1,1,10,100].forEach(function(fr){var sx=pad.l+Math.log10(fr/0.1)/3*pw;ctx.beginPath();ctx.moveTo(sx,pad.t+ph);ctx.lineTo(sx,pad.t+ph+4);ctx.stroke();ctx.textAlign='center';ctx.fillText(fr+' rad/s',sx,pad.t+ph+14);});
    ctx.textAlign='start';
    ctx.strokeStyle='#22d3ee';ctx.lineWidth=2;ctx.beginPath();
    for(var i=0;i<=400;i++){
      var omega=0.1*Math.pow(10,3*i/400),r=omega/p.wn;
      var mag=1/Math.sqrt((1-r*r)*(1-r*r)+4*p.zeta*p.zeta*r*r),db=20*Math.log10(mag);
      var sx=pad.l+i/400*pw,sy=pad.t+ph-Math.max(0,Math.min(20,db)+40)/60*ph;
      if(i===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
    }
    ctx.stroke();
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText('ωₙ='+p.wn+' ζ='+p.zeta,12,18);
  },'|G(jω)| para sistema de 2º orden',200,false);
};

WIDGETS['eng-beam'] = function() {
  return WidgetFigure('Deflexión de viga', [
    {key:'P',label:'Carga P',min:1,max:20,step:0.5,initial:5,unit:' kN'},
    {key:'L',label:'Longitud L',min:1,max:5,step:0.1,initial:2,unit:' m'}
  ], function(ctx,w,h,t,p) {
    var pad={l:50,r:20,t:20,b:40},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,E=200e9,I=8e-6;
    var P=p.P*1000,L=p.L,yTip=P*L*L*L/(3*E*I);
    ctx.strokeStyle='rgba(180,200,220,0.8)';ctx.lineWidth=9;
    ctx.beginPath();ctx.moveTo(pad.l,pad.t+ph);ctx.lineTo(pad.l+pw*0.8,pad.t+ph);ctx.stroke();
    ctx.strokeStyle='#22d3ee';ctx.lineWidth=3;ctx.beginPath();
    for(var i=0;i<=200;i++){
      var xi=i/200*L,y=P/(6*E*I)*(xi*xi*xi-3*L*xi*xi);
      var sx=pad.l+xi/L*pw*0.8,sy=pad.t+ph+y*ph*0.8;
      if(i===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
    }
    ctx.stroke();
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText('δ_max='+(yTip*1000).toFixed(2)+' mm P='+p.P+'kN L='+p.L+'m',12,18);
  },'δ_max=PL³/(3EI). Exagerado visualmente.',200,false);
};

WIDGETS['chem-equilibrium'] = function() {
  return WidgetFigure('Constante K', [{key:'logK',label:'log₁₀(K)',min:-3,max:3,step:0.05,initial:0}],
    function(ctx,w,h,t,p) {
      var K=Math.pow(10,p.logK);
      ctx.fillStyle=K>1.01?'#34d399':K<0.99?'#ef4444':'#8a8fa8';ctx.font='22px Space Grotesk';ctx.textAlign='center';
      ctx.fillText('K = '+(K>=100||K<0.01?K.toExponential(2):K.toFixed(3)),w/2,h/2-10);
      ctx.fillText(K>1.01?'Favorece PRODUCTOS':K<0.99?'Favorece REACTIVOS':'Equilibrio neutro',w/2,h/2+24);
      ctx.font='10px JetBrains Mono';ctx.fillStyle='#8a8fa8';
      ctx.fillText('log₁₀(K) = '+p.logK.toFixed(2),w/2,h/2+48);
      ctx.textAlign='start';
    },'K>1→productos, K<1→reactivos · slider en escala logarítmica',180,false);
};

WIDGETS['chem-ph'] = function() {
  return WidgetFigure('pH y pOH', [{key:'pH',label:'pH',min:0,max:14,step:0.1,initial:7}],
    function(ctx,w,h,t,p) {
      var pH=p.pH, pOH=14-pH, H=Math.pow(10,-pH), OH=Math.pow(10,-pOH);
      ctx.fillStyle=pH<6.9?'#ef4444':pH>7.1?'#22d3ee':'#8a8fa8';ctx.font='24px Space Grotesk';ctx.textAlign='center';
      ctx.fillText('pH = '+pH.toFixed(2),w/2,h/2-30);
      ctx.fillText('pOH = '+pOH.toFixed(2),w/2,h/2-2);
      ctx.font='11px JetBrains Mono';ctx.fillStyle='#8a8fa8';
      ctx.fillText('[H⁺]='+H.toExponential(2)+' M   [OH⁻]='+OH.toExponential(2)+' M',w/2,h/2+26);
      ctx.textAlign='start';
    },'pH<7 ácido, pH=7 neutro, pH>7 básico',180,false);
};

WIDGETS['phys-decay'] = function() {
  var sliderDefs = {N0:{min:10,max:500}, lambda:{min:0.01,max:0.5}};
  return WidgetFigure('Decaimiento N(t)=N₀e^(−λt)', [
    {key:'N0',label:'N₀',min:10,max:500,step:10,initial:200},
    {key:'lambda',label:'λ',min:0.01,max:0.5,step:0.01,initial:0.1,unit:' s⁻¹'}
  ], function(ctx,w,h,t,p,scale) {
    var pad={l:50,r:20,t:20,b:40},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
    var tMax, N0max;
    if (scale.locked) {
      if (!scale.range) scale.range = {tMax: 5/sliderDefs.lambda.min, N0max: sliderDefs.N0.max};
      tMax = scale.range.tMax; N0max = scale.range.N0max;
    } else { tMax = 5/p.lambda; N0max = p.N0; }
    drawAxes(ctx,pad,pw,ph,0,tMax,0,N0max,4);
    ctx.strokeStyle='#22d3ee';ctx.lineWidth=2;ctx.beginPath();
    var first=true;
    for(var i=0;i<=200;i++){var ti=i/200*tMax,N=p.N0*Math.exp(-p.lambda*ti);
      var sx=pad.l+ti/tMax*pw,sy=pad.t+ph-Math.min(1,N/N0max)*ph;
      if(sx<pad.l||sx>pad.l+pw)continue;
      if(first){ctx.moveTo(sx,sy);first=false;}else ctx.lineTo(sx,sy);}
    ctx.stroke();
    ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
    ctx.fillText('T½='+(Math.log(2)/p.lambda).toFixed(1)+'s',pad.l+8,pad.t+14);
  },'Vida media T½=ln(2)/λ · con escala fija ves N₀ y λ comparados contra sus extremos',220,false);
};

WIDGETS['phys-collision'] = function() {
  return WidgetFigure('Colisión elástica 1D', [
    {key:'m1',label:'m₁',min:0.5,max:5,step:0.1,initial:1,unit:' kg'},
    {key:'m2',label:'m₂',min:0.5,max:5,step:0.1,initial:2,unit:' kg'},
    {key:'v1',label:'v₁ inicial',min:1,max:10,step:0.2,initial:5,unit:' m/s'}
  ], function(ctx,w,h,t,p) {
    var v1f=(p.m1-p.m2)/(p.m1+p.m2)*p.v1, v2f=2*p.m1/(p.m1+p.m2)*p.v1;
    ctx.fillStyle='#e2e8f0';ctx.font='13px Space Grotesk';ctx.textAlign='center';
    ctx.fillText("v₁'="+v1f.toFixed(2)+' m/s',w/2,h/2-16);
    ctx.fillText("v₂'="+v2f.toFixed(2)+' m/s',w/2,h/2+12);ctx.textAlign='start';
  },"v₁'=(m₁−m₂)/(m₁+m₂)·v₁",180,false);
};

WIDGETS['math-newton-raphson'] = function() {
  return WidgetFigure('Newton-Raphson', [{key:'x0',label:'x₀ inicial',min:-4,max:4,step:0.05,initial:2}],
    function(ctx,w,h,t,p) {
      var pad={l:50,r:20,t:20,b:40},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
      function f(x){return x*x-2;}function fp(x){return 2*x;}
      function sx(x){return pad.l+(x+3)/6*pw;}function sy(y){return pad.t+ph/2-y/ph*40;}
      drawAxes(ctx,pad,pw,ph,-3,3,-(ph*ph/80),(ph*ph/80),4);
      ctx.strokeStyle='#22d3ee';ctx.lineWidth=2;ctx.beginPath();
      for(var i=0;i<=300;i++){var x=-3+i/300*6,y=f(x);if(i===0)ctx.moveTo(sx(x),sy(y));else ctx.lineTo(sx(x),sy(y));}
      ctx.stroke();
      var xn=p.x0;ctx.strokeStyle='#fbbf24';ctx.lineWidth=1;
      for(var j=0;j<5;j++){var yn=f(xn),mn=fp(xn),xn1=xn-yn/mn;
        ctx.beginPath();ctx.moveTo(sx(xn),sy(yn));ctx.lineTo(sx(xn1),sy(0));ctx.stroke();
        ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(sx(xn),sy(yn),3,0,Math.PI*2);ctx.fill();xn=xn1;}
      ctx.fillStyle='#22d3ee';ctx.beginPath();ctx.arc(sx(xn),sy(0),5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e2e8f0';ctx.font='10px JetBrains Mono';
      ctx.fillText('Raíz ≈ '+xn.toFixed(6)+' (√2='+Math.sqrt(2).toFixed(6)+')',pad.l+8,pad.t+14);
    },'f(x)=x²−2, buscando √2',220,false);
};

WIDGETS['chem-lechatelier'] = function() {
  return WidgetFigure('Le Châtelier', [{key:'T',label:'Temperatura',min:200,max:800,step:10,initial:400,unit:' K'}],
    function(ctx,w,h,t,p) {
      var K=p.T<400?10:p.T>600?0.1:1;
      ctx.fillStyle='#e2e8f0';ctx.font='13px Space Grotesk';ctx.textAlign='center';
      ctx.fillText('K('+p.T+'K) = '+K.toFixed(2),w/2,h/2-8);
      ctx.fillText(p.T<400?'Exotérmica→productos':p.T>600?'Endotérmica→reactivos':'ΔG°≈0',w/2,h/2+20);ctx.textAlign='start';
    },'Aumentar T en reacción exotérmica → K disminuye.',160,false);
};


function renderWidget(name) {
  var fn = WIDGETS[name];
  return fn ? fn() : document.createTextNode('');
}


// ── Dots Background (fondo animado, común a todas las páginas) ─
function initDotsBackground() {
  var canvas = document.getElementById('dots-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d'), points = [], size = {w:0,h:0}, dpr = 1;

  function spawnPoint() {
    var edge = Math.floor(Math.random()*4), speed = 0.2+Math.random()*0.25, x=0,y=0,vx=0,vy=0;
    if (edge===0) { x=Math.random()*size.w; y=-8; vx=(Math.random()-0.5)*speed; vy=speed; }
    else if (edge===1) { x=size.w+8; y=Math.random()*size.h; vx=-speed; vy=(Math.random()-0.5)*speed; }
    else if (edge===2) { x=Math.random()*size.w; y=size.h+8; vx=(Math.random()-0.5)*speed; vy=-speed; }
    else { x=-8; y=Math.random()*size.h; vx=speed; vy=(Math.random()-0.5)*speed; }
    return {x:x,y:y,vx:vx,vy:vy,life:0,ttl:500+Math.floor(Math.random()*400)};
  }

  function targetCount() { return Math.max(20, Math.min(70, Math.floor(size.w*size.h/40000))); }

  function resize() {
    dpr = window.devicePixelRatio||1;
    size.w = window.innerWidth; size.h = window.innerHeight;
    canvas.width = size.w*dpr; canvas.height = size.h*dpr;
    canvas.style.width = size.w+'px'; canvas.style.height = size.h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function draw() {
    ctx.clearRect(0,0,size.w,size.h);
    var desired = targetCount();
    while (points.length < desired) points.push(spawnPoint());
    if (points.length > desired) points.length = desired;

    for (var i=0;i<points.length;i++) {
      var p=points[i];p.x+=p.vx;p.y+=p.vy;p.vx*=0.999;p.vy*=0.999;
      p.vx+=(Math.random()-0.5)*0.005;p.vy+=(Math.random()-0.5)*0.005;
      var sp=Math.hypot(p.vx,p.vy);if(sp>0.8){p.vx=p.vx/sp*0.8;p.vy=p.vy/sp*0.8;}
      p.life+=1/p.ttl;if(p.life>=1)points[i]=spawnPoint();
    }

    for (var i=0;i<points.length;i++) {
      var a=points[i], aFade=Math.sin(Math.PI*a.life);if(aFade<=0.02)continue;
      for (var j=i+1;j<points.length;j++) {
        var b=points[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
        if(d<90){var bFade=Math.sin(Math.PI*b.life),alpha=(1-d/90)*0.12*aFade*bFade;
          if(alpha<=0.01)continue;ctx.strokeStyle='rgba(226,232,240,'+alpha+')';ctx.lineWidth=0.4;
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
      }
    }

    for (var i=0;i<points.length;i++) {
      var p=points[i], fade=Math.sin(Math.PI*p.life);if(fade<=0.02)continue;
      ctx.fillStyle='rgba(226,232,240,'+(0.25*fade)+')';
      ctx.beginPath();ctx.arc(p.x,p.y,1,0,Math.PI*2);ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();window.addEventListener('resize',resize);requestAnimationFrame(draw);
}

// ── Page boot helpers ────────────────────────────────────
// Para páginas de marketing / repositorio (con Header + wrapper .main)
function bootPage(pageKey, contentFn) {
  initDotsBackground();
  var app = document.getElementById('app');
  app.appendChild(Header(pageKey));
  var main = h('div', {className:'main'});
  main.appendChild(contentFn());
  app.appendChild(main);
}
// Para workspace y editores (con WorkspaceHeader, sin wrapper .main, requiere sesión)
function bootWorkspacePage(contentFn) {
  if (!requireAuth()) return;
  initDotsBackground();
  var app = document.getElementById('app');
  app.appendChild(WorkspaceHeader());
  app.appendChild(contentFn());
}
// Para páginas sin sesión requerida y sin header (auth.html)
function bootBarePage(contentFn) {
  initDotsBackground();
  document.getElementById('app').appendChild(contentFn());
}
