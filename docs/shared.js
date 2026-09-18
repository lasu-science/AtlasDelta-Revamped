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
      else if (k === 'value' && tag === 'textarea') el.value = v; // <textarea> no tiene atributo "value"; setAttribute no hace nada
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

// ── Firebase (backend real: base de datos + auth) ────────
// Completá estos valores con los de tu propio proyecto (gratis) en
// https://console.firebase.google.com → ⚙ Configuración del proyecto → General
// → "Tus apps" → app web → "Configuración del SDK".
// Sin esto, el login/registro/recuperación de contraseña no van a funcionar.
var FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBZIKInHfAuFGaji8dXOb95OaHZ7WzBnNM',
  authDomain: 'atlasdelta-4c992.firebaseapp.com',
  projectId: 'atlasdelta-4c992'
};
var _firebaseAuth = null;
function getFirebaseAuth() {
  if (_firebaseAuth) return _firebaseAuth;
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.error('Falta cargar la librería de Firebase Auth (script CDN) en esta página.');
    return null;
  }
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  _firebaseAuth = firebase.auth();
  return _firebaseAuth;
}
// Al cargar la página, el SDK de Firebase todavía no restauró la sesión
// guardada (es async) — si escribimos a Firestore antes de que termine, la
// escritura sale "sin autenticar" y las reglas de seguridad la rechazan.
// Esto espera a que el SDK confirme el usuario (o null) al menos una vez.
var _authReadyPromise = null;
function waitForFirebaseAuthReady() {
  if (_authReadyPromise) return _authReadyPromise;
  var auth = getFirebaseAuth();
  if (!auth) return Promise.resolve(null);
  _authReadyPromise = new Promise(function(resolve){
    var unsub = auth.onAuthStateChanged(function(user){ unsub(); resolve(user); });
  });
  return _authReadyPromise;
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
  groq:      { label:'Groq — gratis, modelos de código abierto', defaultModel:'openai/gpt-oss-120b', keyPlaceholder:'gsk_...' },
  gemini:    { label:'Gemini (Google) — gratis, sin tarjeta', defaultModel:'gemini-3.6-flash', keyPlaceholder:'AIzaSy...' }
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
  if (typeof firebase !== 'undefined') { try { getFirebaseAuth().signOut(); } catch(e) {} }
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

// ── Artículos: Firestore (compartido entre dispositivos) ────────────────
// Los artículos de ejemplo (Mecánica Clásica, Electromagnetismo, etc.) siguen
// hardcodeados en ARTICLES. Las ediciones de admin y los artículos nuevos ya
// NO viven en localStorage (eso era por-dispositivo) — viven en la colección
// 'articles' de Firestore (doc id = slug), visible para cualquiera que la lea,
// pero solo editable por ADMIN_EMAIL (reforzado con reglas de seguridad en
// Firestore, no solo acá). Los "borrados" de artículos precargados se marcan
// como un doc en 'article_deletions' (tombstone), sin tocar el array original.
var BUILTIN_ARTICLES = ARTICLES;
function isBuiltInSlug(slug) { return BUILTIN_ARTICLES.some(function(a){return a.slug===slug;}); }

var _firestoreDb = null;
function getFirestoreDb() {
  if (_firestoreDb) return _firestoreDb;
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.error('Falta cargar la librería de Firestore (script CDN) en esta página.');
    return null;
  }
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  _firestoreDb = firebase.firestore();
  return _firestoreDb;
}

// Migración de una sola vez: sube lo que haya en el localStorage de ESTE
// dispositivo/admin a Firestore, y marca la migración como hecha para no
// repetirla. No hace nada si ya se migró antes o si no hay nada que migrar.
var _migrationPromise = null;
function ensureArticlesMigrated() {
  if (_migrationPromise) return _migrationPromise;
  _migrationPromise = (function() {
    if (!isAdmin()) return Promise.resolve();
    if (localStorage.getItem('ad_articles_migrated_v1')) return Promise.resolve();
    var db = getFirestoreDb();
    if (!db) return Promise.resolve();
    var localCustom, localOverrides, localDeletions;
    try { localCustom = JSON.parse(localStorage.getItem('ad_articles') || '[]'); } catch(e) { localCustom = []; }
    try { localOverrides = JSON.parse(localStorage.getItem('ad_article_overrides') || '{}'); } catch(e) { localOverrides = {}; }
    try { localDeletions = JSON.parse(localStorage.getItem('ad_article_deletions') || '[]'); } catch(e) { localDeletions = []; }
    var toUpload = localCustom.concat(Object.keys(localOverrides).map(function(k){ return localOverrides[k]; }));
    if (toUpload.length === 0 && localDeletions.length === 0) {
      localStorage.setItem('ad_articles_migrated_v1', 'true');
      return Promise.resolve();
    }
    return waitForFirebaseAuthReady().then(function(){
      var writes = toUpload.map(function(a){ return db.collection('articles').doc(a.slug).set(a); });
      writes = writes.concat(localDeletions.map(function(slug){ return db.collection('article_deletions').doc(slug).set({deleted:true}); }));
      return Promise.all(writes);
    }).then(function(){
      localStorage.setItem('ad_articles_migrated_v1', 'true');
      console.log('Migración a Firestore completa:', toUpload.length, 'artículo(s),', localDeletions.length, 'oculto(s).');
    }).catch(function(err){
      console.error('Error migrando artículos a Firestore (se reintentará en la próxima carga):', err);
    });
  })();
  return _migrationPromise;
}

function getArticle(slug) {
  return ensureArticlesMigrated().then(function(){
    var db = getFirestoreDb();
    if (!db) return BUILTIN_ARTICLES.find(function(a){return a.slug===slug;});
    return db.collection('articles').doc(slug).get().then(function(doc){
      if (doc.exists) return doc.data();
      return db.collection('article_deletions').doc(slug).get().then(function(delDoc){
        if (delDoc.exists) return undefined;
        return BUILTIN_ARTICLES.find(function(a){return a.slug===slug;});
      });
    });
  });
}
function getAllArticles() {
  return ensureArticlesMigrated().then(function(){
    var db = getFirestoreDb();
    if (!db) return BUILTIN_ARTICLES.slice();
    return Promise.all([db.collection('articles').get(), db.collection('article_deletions').get()]).then(function(results){
      var customDocs = results[0].docs.map(function(d){ return d.data(); });
      var deletedSlugs = results[1].docs.map(function(d){ return d.id; });
      var customSlugs = customDocs.map(function(a){ return a.slug; });
      var builtins = BUILTIN_ARTICLES.filter(function(a){ return deletedSlugs.indexOf(a.slug) < 0 && customSlugs.indexOf(a.slug) < 0; });
      return builtins.concat(customDocs);
    });
  });
}
// Guarda un artículo (nuevo o edición de uno precargado) en Firestore.
// Las reglas de seguridad del lado del servidor son las que de verdad
// impiden que alguien que no sea ADMIN_EMAIL pueda escribir acá.
function saveCustomArticle(article) {
  var db = getFirestoreDb();
  if (!db) return Promise.reject(new Error('No se pudo conectar con Firestore (revisá que el script y FIREBASE_CONFIG estén cargados).'));
  return waitForFirebaseAuthReady().then(function(user){
    if (!user) return Promise.reject(new Error('No se pudo verificar tu sesión de Firebase. Si tenés un bloqueador de anuncios/rastreadores activo, puede estar impidiendo el login — desactivalo para este sitio e intentá de nuevo.'));
    return db.collection('articles').doc(article.slug).set(article);
  });
}
// Borra un artículo: si es precargado, lo oculta (tombstone) sin tocar el
// array original; si es propio, lo elimina directamente.
function deleteCustomArticle(slug) {
  var db = getFirestoreDb();
  if (!db) return Promise.reject(new Error('No se pudo conectar con Firestore (revisá que el script y FIREBASE_CONFIG estén cargados).'));
  return waitForFirebaseAuthReady().then(function(user){
    if (!user) return Promise.reject(new Error('No se pudo verificar tu sesión de Firebase. Si tenés un bloqueador de anuncios/rastreadores activo, puede estar impidiendo el login — desactivalo para este sitio e intentá de nuevo.'));
    if (isBuiltInSlug(slug)) {
      return db.collection('articles').doc(slug).delete().then(function(){
        return db.collection('article_deletions').doc(slug).set({deleted:true});
      });
    }
    return db.collection('articles').doc(slug).delete();
  });
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
    // Las celdas pueden contener placeholders de fórmulas (\x00M<i>\x00) generados
    // más arriba. La tabla entera se vuelve a "slotear" para protegerla del resto
    // del pipeline de Markdown (párrafos, listas, etc.), pero el reemplazo final
    // de placeholders NO es recursivo: solo hace una pasada sobre el string, así
    // que un placeholder de fórmula anidado dentro del placeholder de la tabla
    // quedaba sin resolver (la fórmula aparecía como texto crudo, sin renderizar).
    // Solución: resolver los placeholders de fórmula dentro de "out" ya mismo,
    // usando los slots ya generados, antes de volver a slotear la tabla completa.
    out = out.replace(/\x00M(\d+)\x00/g, function(_,i){return slots[Number(i)]||'';});
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

// ── WIDGETS 3D ───────────────────────────────────────────
// Reemplaza a los widgets 2D anteriores (errores de escala y de
// compatibilidad con pantallas chicas). Mismo contrato público que antes:
// WIDGETS['clave'] sigue siendo una función que devuelve un <figure>, y
// renderWidget(name) sigue funcionando igual para quien ya lo llame desde
// otra página — no hace falta tocar nada fuera de este archivo.
//
// three.js se carga bajo demanda desde CDN la primera vez que un widget 3D
// entra en pantalla (no pesa nada en páginas sin widgets), y cada widget se
// pausa solo cuando sale del viewport (ahorra batería en celulares).

var THREE_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
var _threeLoadPromise = null;
function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (_threeLoadPromise) return _threeLoadPromise;
  _threeLoadPromise = new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = THREE_CDN_URL;
    s.onload = function() { resolve(window.THREE); };
    s.onerror = function() { reject(new Error('No se pudo cargar three.js (revisá la conexión o algún bloqueador de scripts).')); };
    document.head.appendChild(s);
  });
  return _threeLoadPromise;
}

// CSS propio de los widgets 3D, inyectado una sola vez. Vive acá (no en
// shared.css) para que este archivo sea autosuficiente.
var _widget3dStylesInjected = false;
function ensureWidget3DStyles() {
  if (_widget3dStylesInjected) return;
  _widget3dStylesInjected = true;
  var css =
    '.widget3d-canvas-wrap{position:relative;touch-action:none;cursor:grab;' +
      'background:radial-gradient(circle at 50% 35%,#131a28 0%,#080a10 78%);' +
      'border-radius:8px;overflow:hidden}' +
    '.widget3d-canvas-wrap:active{cursor:grabbing}' +
    '.widget3d-canvas-wrap canvas{display:block;width:100%;height:100%}' +
    '.widget3d-hint{position:absolute;left:8px;bottom:8px;font:10px JetBrains Mono,monospace;' +
      'color:#8a8fa8;background:rgba(8,10,16,.55);padding:3px 7px;border-radius:5px;' +
      'pointer-events:none;letter-spacing:.02em}' +
    '.widget3d-caption{position:absolute;left:8px;top:8px;right:8px;max-width:min(420px,calc(100% - 16px));' +
      'font:12px/1.45 Space Grotesk,sans-serif;color:#e2e8f0;background:rgba(8,10,16,.7);' +
      'border:1px solid rgba(148,163,184,.18);padding:8px 10px;border-radius:7px}' +
    '.widget3d-caption b{color:#22d3ee;display:block;font:11px JetBrains Mono,monospace;' +
      'letter-spacing:.04em;margin-bottom:3px;text-transform:uppercase}' +
    '.widget3d-steps{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px}' +
    '.widget3d-step-track{flex:1 1 160px;display:flex;gap:3px;min-width:110px}' +
    '.widget3d-step-dot{flex:1;height:5px;border-radius:3px;background:rgba(148,163,184,.25);' +
      'cursor:pointer;transition:background .2s}' +
    '.widget3d-step-dot.active{background:#22d3ee}' +
    '.widget3d-step-dot.done{background:rgba(34,211,238,.45)}' +
    '.widget3d-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:8px}' +
    '.widget3d-row label{display:flex;align-items:center;gap:6px;font:11px JetBrains Mono,monospace;color:#8a8fa8}' +
    '.widget3d-row input[type=range]{width:120px}' +
    '@media (max-width:640px){.widget3d-caption{font-size:11px}.widget3d-row input[type=range]{width:86px}' +
      '.widget3d-hint{display:none}}';
  var styleEl = document.createElement('style');
  styleEl.id = 'widget3d-styles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

// Controles de órbita mínimos (mouse + touch, con pellizco para zoom) vía
// Pointer Events — evita depender del addon OrbitControls.js aparte.
function createOrbitControls(dom, camera, target, opts) {
  opts = opts || {};
  var radius = opts.radius || 6, minR = opts.minRadius || 2, maxR = opts.maxRadius || 20;
  var theta = opts.theta != null ? opts.theta : 0.7, phi = opts.phi != null ? opts.phi : 1.15;
  var pointers = {};
  var lastPinchDist = 0;
  function clampPhi(p) { return Math.max(0.15, Math.min(Math.PI - 0.15, p)); }
  function sync() {
    var sp = Math.sin(phi), cp = Math.cos(phi);
    camera.position.set(
      target.x + radius * sp * Math.sin(theta),
      target.y + radius * cp,
      target.z + radius * sp * Math.cos(theta)
    );
    camera.lookAt(target);
  }
  function ids() { return Object.keys(pointers); }
  function midDist() {
    var k = ids(), a = pointers[k[0]], b = pointers[k[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function onDown(e) {
    if (dom.setPointerCapture) { try { dom.setPointerCapture(e.pointerId); } catch (err) {} }
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (ids().length === 2) lastPinchDist = midDist();
  }
  function onMove(e) {
    if (!pointers[e.pointerId]) return;
    var prev = pointers[e.pointerId];
    var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var k = ids();
    if (k.length === 1) {
      theta -= dx * 0.006;
      phi = clampPhi(phi - dy * 0.006);
      sync();
    } else if (k.length === 2) {
      var d = midDist();
      if (lastPinchDist > 0) radius = Math.max(minR, Math.min(maxR, radius * (lastPinchDist / d)));
      lastPinchDist = d;
      sync();
    }
    e.preventDefault();
  }
  function onUp(e) { delete pointers[e.pointerId]; if (ids().length < 2) lastPinchDist = 0; }
  function onWheel(e) {
    radius = Math.max(minR, Math.min(maxR, radius * (1 + (e.deltaY > 0 ? 0.12 : -0.12))));
    sync();
    e.preventDefault();
  }
  dom.style.touchAction = 'none';
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove, { passive: false });
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('pointerleave', onUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  sync();
  return {
    update: sync,
    getState: function () { return { theta: theta, phi: phi, radius: radius }; },
    setAngles: function (t, p) { theta = t; phi = clampPhi(p); sync(); },
    setRadius: function (r) { radius = Math.max(minR, Math.min(maxR, r)); sync(); },
    dispose: function () {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('pointerleave', onUp);
      dom.removeEventListener('wheel', onWheel);
    }
  };
}

// Textura de "flujo" (una franja brillante que se repite y se desplaza) para
// animar las streamlines de temperatura del núcleo. También generada por
// canvas, sin archivos externos.
var _flowTexture = null;
function getFlowTexture(THREE) {
  if (_flowTexture) return _flowTexture;
  var c = document.createElement('canvas'); c.width = 64; c.height = 8;
  var ctx = c.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.16, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 8);
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  _flowTexture = tex;
  return tex;
}

// Textura de metal cepillado generada por canvas (nada de archivos externos).
// Se cachea: todos los widgets 3D comparten la misma instancia.
var _brushedMetalTexture = null;
function getBrushedMetalTexture(THREE) {
  if (_brushedMetalTexture) return _brushedMetalTexture;
  var c = document.createElement('canvas'); c.width = 128; c.height = 128;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 128, 128);
  for (var i = 0; i < 900; i++) {
    var y = Math.random() * 128, len = 20 + Math.random() * 90, shade = 90 + Math.random() * 110;
    ctx.strokeStyle = 'rgba(' + shade + ',' + shade + ',' + shade + ',' + (0.08 + Math.random() * 0.12) + ')';
    ctx.lineWidth = 0.6 + Math.random() * 1.1;
    ctx.beginPath(); ctx.moveTo(Math.random() * 128, y); ctx.lineTo(Math.random() * 128 + len, y + (Math.random() - 0.5) * 2); ctx.stroke();
  }
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.4);
  _brushedMetalTexture = tex;
  return tex;
}

// Mapa de reflejos "de estudio" horneado con PMREM a partir de una escena
// procedural (cielo con degradé + un par de paneles de luz) — le da a los
// metales brillo/reflejos realistas sin necesitar ningún archivo HDRI.
function makeStudioEnvironment(THREE, renderer) {
  var envScene = new THREE.Scene();
  var top = new THREE.Color(0x9fc4ec), bottom = new THREE.Color(0x11151c);
  var skyGeo = new THREE.SphereGeometry(24, 24, 16);
  var posAttr = skyGeo.attributes.position;
  var colors = new Float32Array(posAttr.count * 3);
  var v = new THREE.Vector3(), c = new THREE.Color();
  for (var i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    var f = THREE.MathUtils.clamp((v.y / 24 + 1) / 2, 0, 1);
    c.copy(bottom).lerp(top, f);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  function softbox(x, y, z, w, h, color, intensity) {
    var panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: color }));
    panel.material.color.multiplyScalar(intensity);
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    envScene.add(panel);
  }
  softbox(6, 5, 4, 6, 8, 0xffffff, 2.2);
  softbox(-7, 2, -3, 5, 6, 0xbcd4ff, 1.4);
  softbox(0, -6, 2, 8, 4, 0x33210f, 0.6);

  var pmrem = new THREE.PMREMGenerator(renderer);
  var rt = pmrem.fromScene(envScene, 0.03);
  pmrem.dispose();
  return rt.texture;
}

// Host genérico para widgets 3D. buildFn(THREE) arma la escena y devuelve
// {group, camRadius, steps:[{label,caption,camera:{x,theta,phi,radius},focus:[...]}],
//  update(dt,elapsed,speedFactor,stepIdx), setCutaway(t)}.
function WidgetFigure3D(title, caption, buildFn, opts) {
  opts = opts || {};
  ensureWidget3DStyles();
  var height = opts.height || 360;
  var fig = document.createElement('figure');
  fig.className = 'widget-figure';

  var cap = document.createElement('figcaption');
  cap.innerHTML = '<span>' + title + '</span>' +
    '<span class="widget-controls"><button class="widget-pause">Pausar giro</button>' +
    '<button class="widget-reset">Reiniciar vista</button></span>';
  fig.appendChild(cap);

  var body = document.createElement('div'); body.className = 'widget-body';
  var wrap = document.createElement('div'); wrap.className = 'widget-canvas-wrap widget3d-canvas-wrap';
  wrap.style.height = height + 'px';
  var overlay = document.createElement('div'); overlay.className = 'widget3d-caption';
  overlay.innerHTML = '<b>Cargando modelo…</b>';
  var hint = document.createElement('div'); hint.className = 'widget3d-hint';
  hint.textContent = 'Arrastrá para rotar · rueda / pellizco para zoom';
  wrap.appendChild(overlay); wrap.appendChild(hint);
  body.appendChild(wrap); fig.appendChild(body);

  var stepsBar = document.createElement('div'); stepsBar.className = 'widget3d-steps';
  var prevBtn = document.createElement('button'); prevBtn.className = 'btn btn-outline'; prevBtn.textContent = '‹ Anterior';
  var playBtn = document.createElement('button'); playBtn.className = 'btn btn-outline'; playBtn.textContent = '▶ Reproducir pasos';
  var nextBtn = document.createElement('button'); nextBtn.className = 'btn btn-outline'; nextBtn.textContent = 'Siguiente ›';
  var track = document.createElement('div'); track.className = 'widget3d-step-track';
  stepsBar.appendChild(prevBtn); stepsBar.appendChild(track); stepsBar.appendChild(playBtn); stepsBar.appendChild(nextBtn);
  fig.appendChild(stepsBar);

  var row = document.createElement('div'); row.className = 'widget3d-row';
  var cutLbl = document.createElement('label'); cutLbl.innerHTML = '<span>✂ Plano de corte</span>';
  var cutInput = document.createElement('input'); cutInput.type = 'range'; cutInput.min = 0; cutInput.max = 100; cutInput.value = 100;
  cutLbl.appendChild(cutInput); row.appendChild(cutLbl);
  var speedLbl = document.createElement('label'); speedLbl.innerHTML = '<span>🐢 Velocidad</span>';
  var speedInput = document.createElement('input'); speedInput.type = 'range'; speedInput.min = 5; speedInput.max = 100; speedInput.value = 35;
  speedLbl.appendChild(speedInput); row.appendChild(speedLbl);
  fig.appendChild(row);

  if (caption) { var cd = document.createElement('div'); cd.className = 'widget-caption'; cd.textContent = caption; fig.appendChild(cd); }

  var state = { stepIdx: 0, autoplay: false, running: true, camAnim: null };

  loadThree().then(function (THREE) {
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.localClippingEnabled = true;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    var target = new THREE.Vector3(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0a0d14, 1.15));
    var key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, 6, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0x6ab7ff, 0.55); rim.position.set(-5, -2, -4); scene.add(rim);
    try { scene.environment = makeStudioEnvironment(THREE, renderer); }
    catch (envErr) { console.warn('Widget 3D: no se pudo generar el mapa de reflejos, sigo sin él.', envErr); }

    var model = buildFn(THREE);
    scene.add(model.group);

    var camR = model.camRadius || 6;
    var controls = createOrbitControls(wrap, camera, target, {
      radius: camR, theta: 0.6, phi: 1.1, minRadius: camR * 0.32, maxRadius: camR * 2.4
    });
    wrap.appendChild(renderer.domElement);

    function resize() {
      var rect = wrap.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, rect.width < 480 ? 1.5 : 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    setTimeout(resize, 30);

    var steps = model.steps || [];
    steps.forEach(function (s, i) {
      var dot = document.createElement('div'); dot.className = 'widget3d-step-dot'; dot.title = s.label;
      dot.addEventListener('click', function () { stopAuto(); goToStep(i); });
      track.appendChild(dot);
    });
    function refreshDots() {
      Array.prototype.forEach.call(track.children, function (d, i) {
        d.className = 'widget3d-step-dot' + (i === state.stepIdx ? ' active' : (i < state.stepIdx ? ' done' : ''));
      });
    }
    function stopAuto() { state.autoplay = false; playBtn.textContent = '▶ Reproducir pasos'; }
    function goToStep(i) {
      i = Math.max(0, Math.min(steps.length - 1, i));
      state.stepIdx = i; refreshDots();
      var s = steps[i];
      overlay.innerHTML = '<b>Paso ' + (i + 1) + '/' + steps.length + ' · ' + s.label + '</b>' + s.caption;
      var from = controls.getState();
      state.camAnim = { from: { theta: from.theta, phi: from.phi, radius: from.radius, x: target.x }, to: s.camera, t0: performance.now(), dur: 1400 };
    }
    prevBtn.addEventListener('click', function () { stopAuto(); goToStep(state.stepIdx - 1); });
    nextBtn.addEventListener('click', function () { stopAuto(); goToStep(state.stepIdx + 1); });
    playBtn.addEventListener('click', function () {
      state.autoplay = !state.autoplay;
      playBtn.textContent = state.autoplay ? '⏸ Pausar recorrido' : '▶ Reproducir pasos';
    });
    if (steps.length) goToStep(0);

    var pauseBtn = fig.querySelector('.widget-pause'), resetBtn = fig.querySelector('.widget-reset');
    pauseBtn.addEventListener('click', function () {
      state.running = !state.running;
      pauseBtn.textContent = state.running ? 'Pausar giro' : 'Reanudar giro';
    });
    resetBtn.addEventListener('click', function () { stopAuto(); goToStep(0); });

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0.05 }).observe(fig);
    }

    function ease(p) { return p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; }

    var last = performance.now(), stepHoldT = 0;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (visible) {
        if (state.running) model.update(dt, now / 1000, speedInput.value / 100, state.stepIdx);
        if (model.setCutaway) model.setCutaway(cutInput.value / 100);
        if (state.autoplay) {
          stepHoldT += dt;
          if (stepHoldT > 3.4) { stepHoldT = 0; goToStep((state.stepIdx + 1) % steps.length); }
        }
        if (state.camAnim) {
          var p = Math.min(1, (now - state.camAnim.t0) / state.camAnim.dur), e = ease(p);
          var f = state.camAnim.from, t = state.camAnim.to;
          controls.setAngles(f.theta + (t.theta - f.theta) * e, f.phi + (t.phi - f.phi) * e);
          controls.setRadius(f.radius + (t.radius - f.radius) * e);
          target.x = f.x + (t.x - f.x) * e;
          if (p >= 1) state.camAnim = null;
        }
        controls.update();
        renderer.render(scene, camera);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }).catch(function (err) {
    overlay.innerHTML = '<b>No se pudo cargar el visor 3D</b>' + (err && err.message ? err.message : 'Error desconocido');
    console.error('Widget 3D:', err);
  });

  return fig;
}

var WIDGETS = {};

// ── Motor Rolls-Royce Trent 1000 (turbofán de tres ejes, Boeing 787) ────
// Datos reales del motor: bypass 10:1, relación de presión total 50:1,
// fan de 20 álabes y Ø2.85 m, IPC 8 etapas, HPC 6 etapas, HPT 1 etapa,
// IPT 1 etapa, LPT 6 etapas, longitud 4.74 m. Arquitectura de tres ejes
// concéntricos independientes (LP, IP, HP) — la seña de identidad de los
// motores Trent de Rolls-Royce frente a los diseños de dos ejes.
// Los álabes tienen perfil de ala real (no cajas) con torsión a lo largo
// del radio, hay álabes guía fijos entre etapas de rotor, y las carcasas
// siguen un perfil curvo (no conos rectos). El "metal cepillado" y el mapa
// de reflejos son generados por código (canvas + PMREM), no son imágenes
// externas — mantiene el widget liviano y sin dependencias de red extra.
// Simplificaciones que siguen en pie (por legibilidad y rendimiento en
// celulares): el número de álabes por etapa está reducido frente al real
// (el del fan sí es el real, 20) y el anidado de los tres ejes es un
// esquema ilustrativo, no la geometría exacta de fabricación.
function buildTrent1000Scene(THREE) {
  var group = new THREE.Group();
  var clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.05);
  var FAN_R = 1.0; // radio de punta del fan usado como unidad de referencia (real: 1.425 m)

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mat(color, o) {
    o = o || {};
    var params = {
      color: color,
      metalness: o.metalness != null ? o.metalness : 0.75,
      roughness: o.roughness != null ? o.roughness : 0.4,
      emissive: o.emissive != null ? o.emissive : 0x000000,
      emissiveIntensity: o.emissiveIntensity || 0,
      side: THREE.FrontSide
    };
    if (!o.noBrush) params.roughnessMap = getBrushedMetalTexture(THREE);
    // Solo las carcasas (góndola y carcasa del núcleo) llevan el plano de
    // corte — todo lo demás (álabes, discos, ejes, combustor) se ve siempre
    // completo, no importa cómo esté el slider de corte. DoubleSide en las
    // carcasas hace que, al cortarlas, se vea la cara interior de la chapa
    // en vez de quedar "huecas" (nada renderizado del lado de adentro).
    if (o.clip) { params.clippingPlanes = [clipPlane]; params.side = THREE.DoubleSide; }
    return new THREE.MeshStandardMaterial(params);
  }
  // Perfil de ala simplificado (no es una NACA real, pero da la silueta
  // cambiada característica en vez de una caja plana).
  function airfoilShape(chord, thick) {
    var s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(chord * 0.10, thick * 0.55, chord * 0.32, thick * 0.50);
    s.quadraticCurveTo(chord * 0.68, thick * 0.36, chord * 0.97, thick * 0.06);
    s.quadraticCurveTo(chord, 0, chord * 0.97, -thick * 0.05);
    s.quadraticCurveTo(chord * 0.62, -thick * 0.24, chord * 0.26, -thick * 0.20);
    s.quadraticCurveTo(chord * 0.06, -thick * 0.13, 0, 0);
    return s;
  }
  function bladeAirfoilGeometry(chord, thick, span, washout) {
    var geo = new THREE.ExtrudeGeometry(airfoilShape(chord, thick), { depth: span, bevelEnabled: false, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2); // el eje de extrusión (span) pasa a ser Y local: y=0 en el cubo (hub), y=span en la punta
    geo.translate(-chord * 0.28, 0, 0); // pivotea cerca del cuarto de cuerda en vez del borde de ataque
    if (washout) {
      var pos = geo.attributes.position;
      for (var vi = 0; vi < pos.count; vi++) {
        var y = pos.getY(vi), frac = span > 0 ? y / span : 0;
        var ang = washout * frac, ca = Math.cos(ang), sa = Math.sin(ang);
        var x = pos.getX(vi), z = pos.getZ(vi);
        pos.setXYZ(vi, x * ca - z * sa, y, x * sa + z * ca);
      }
      pos.needsUpdate = true;
    }
    geo.computeVertexNormals();
    return geo;
  }
  function lathePiece(pts, color, o) {
    var vec = pts.map(function (p) { return new THREE.Vector2(p.r, p.x); });
    var geo = new THREE.LatheGeometry(vec, 48);
    var m = new THREE.Mesh(geo, mat(color, o));
    m.rotation.z = -Math.PI / 2; // con esta rotación, p.x (posición axial) queda directo en el eje X global
    group.add(m);
    return m;
  }
  function bladeRing(count, stageX, hubR, tipR, chord, thickness, color, o) {
    o = o || {};
    var geo = bladeAirfoilGeometry(chord, thickness, tipR - hubR, o.washout != null ? o.washout : 0.4);
    var mesh = new THREE.InstancedMesh(geo, mat(color, o), count);
    var dummy = new THREE.Object3D();
    for (var i = 0; i < count; i++) {
      dummy.position.set(stageX, 0, 0);
      dummy.quaternion.set(0, 0, 0, 1);
      dummy.rotateX((i / count) * Math.PI * 2 + (o.stagger || 0));
      dummy.translateY(hubR);
      dummy.rotateY(o.twist != null ? o.twist : 0.4);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
  // Álabes guía fijos (no giran) entre etapas de rotor — sin disco de buje,
  // más opacos/duller, para distinguirlos de los rotores a simple vista.
  // Llevan la MISMA inclinación que el rotor de su sección pero de signo
  // opuesto (así el flujo que sale "torcido" del rotor se endereza antes de
  // entrar al siguiente rotor, como en un compresor/turbina real).
  function statorRing(count, stageX, hubR, tipR, chord, thickness, color, rotorTwist, rotorWashout) {
    return bladeRing(count, stageX, hubR, tipR, chord, thickness, color, { twist: -rotorTwist, washout: -(rotorWashout || 0), metalness: 0.5, roughness: 0.6 });
  }
  function addStators(xs, hubs, tips, count, chord, thick, color, rotorTwist, rotorWashout) {
    for (var idx = 0; idx < xs.length - 1; idx++) {
      var x = (xs[idx] + xs[idx + 1]) / 2, hubR = (hubs[idx] + hubs[idx + 1]) / 2, tipR = (tips[idx] + tips[idx + 1]) / 2;
      tipR = hubR + (tipR - hubR) * 1.3; // álabes guía 30% más largos hacia afuera
      group.add(statorRing(count, x, hubR, tipR, chord, thick, color, rotorTwist, rotorWashout));
    }
  }
  function hubDisk(stageX, r, width, color) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 28), mat(color, { metalness: 0.7, roughness: 0.35 }));
    m.rotation.z = Math.PI / 2; m.position.x = stageX;
    return m;
  }

  // Góndola (conducto de bypass) y carcasa del núcleo, con perfil curvo real
  // en vez de conos rectos.
  lathePiece([
    { r: 0.16, x: -0.25 }, { r: 0.62, x: -0.21 }, { r: 0.95, x: -0.10 }, { r: 1.045, x: 0.05 },
    { r: 1.05, x: 0.35 }, { r: 1.035, x: 0.85 }, { r: 1.0, x: 1.45 }, { r: 0.95, x: 1.85 }, { r: 0.90, x: 1.98 }
  ], 0xaab4c4, { roughness: 0.28, metalness: 0.55, clip: true });
  var coreCasingPts = [
    { r: 0.64, x: 0.17 }, { r: 0.60, x: 0.22 }, { r: 0.50, x: 0.55 }, { r: 0.455, x: 0.92 },
    { r: 0.44, x: 1.00 }, { r: 0.355, x: 1.32 }, { r: 0.37, x: 1.38 }, { r: 0.38, x: 1.68 },
    { r: 0.365, x: 1.73 }, { r: 0.42, x: 1.90 }, { r: 0.47, x: 2.10 }, { r: 0.60, x: 2.55 }, { r: 0.55, x: 2.62 }
  ];
  lathePiece(coreCasingPts, 0x5b6472, { roughness: 0.4, metalness: 0.5, clip: true });
  // Segunda superficie, calada hacia adentro, para darle un espesor real a
  // la carcasa del núcleo: antes era una sola chapa sin volumen y, al
  // cortarla, quedaba "flotando" sin ningún borde sólido visible.
  var CORE_CASING_THICKNESS = 0.035;
  lathePiece(coreCasingPts.map(function (p) { return { r: Math.max(0.02, p.r - CORE_CASING_THICKNESS), x: p.x }; }),
    0x4a5361, { roughness: 0.5, metalness: 0.45, clip: true });

  // El cono sigue abierto en la base (así no se ve tapado por dentro), pero
  // ahora es más largo y su base entra bien adentro del disco del fan (en
  // vez de terminar justo en el borde) para que no quede ningún hueco ni
  // reborde visible entre el cono y el disco: se funden en un solo sólido.
  var spinner = new THREE.Mesh(new THREE.ConeGeometry(FAN_R * 0.34, 0.57, 32, 1, true), mat(0xd8dee8, { metalness: 0.85, roughness: 0.2 }));
  spinner.rotation.z = Math.PI / 2; spinner.position.x = -0.135;
  group.add(spinner);

  // ── Eje LP: fan (20 álabes reales) + turbina de baja presión (6 etapas) ──
  var lpSpool = new THREE.Group();
  var fanRing = bladeRing(20, 0, FAN_R * 0.26, FAN_R, 0.224, 0.02, 0xc7d2e0, { twist: 1.9, washout: 1.5, metalness: 0.85, roughness: 0.25 });
  // Disco/adaptador más ancho y más grueso que el radio de raíz de los
  // álabes (0.26) para que la superficie de soporte quede cubierta en vez
  // de terminar justo en el borde de los álabes.
  var fanDisk = hubDisk(0, FAN_R * 0.32, 0.16, 0xc7d2e0);
  lpSpool.add(fanRing); lpSpool.add(fanDisk);
  var lptStages = [];
  var lptXs = [], lptHubs = [], lptTips = [];
  for (var i = 0; i < 6; i++) {
    var t = i / 5, x = lerp(1.98, 2.55, t);
    var tipR = lerp(FAN_R * 0.42, FAN_R * 0.57, t), hubR = lerp(FAN_R * 0.24, FAN_R * 0.30, t);
    var ring = bladeRing(22, x, hubR, tipR, 0.098, 0.014, 0xb08a5a, { twist: -0.4, washout: 0.3, metalness: 0.6, roughness: 0.5, emissive: 0x552200, emissiveIntensity: 0.05 });
    lpSpool.add(ring); lpSpool.add(hubDisk(x, hubR, 0.045, 0x8a6b45));
    lptStages.push(ring); lptXs.push(x); lptHubs.push(hubR); lptTips.push(tipR);
  }
  addStators(lptXs, lptHubs, lptTips, 20, 0.05, 0.011, 0x596273, -0.4, 0.3);
  var lpShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.75, 12), mat(0x9fb2c6, { metalness: 0.9, roughness: 0.25 }));
  lpShaft.rotation.z = Math.PI / 2; lpShaft.position.x = 1.35;
  lpSpool.add(lpShaft);
  group.add(lpSpool);

  // ── Eje IP: compresor de presión intermedia (8 etapas) + IPT (1 etapa) ──
  var ipSpool = new THREE.Group();
  var ipcStages = [];
  var ipcXs = [], ipcHubs = [], ipcTips = [];
  for (var j = 0; j < 8; j++) {
    var t2 = j / 7, x2 = lerp(0.22, 0.92, t2);
    var tipR2 = lerp(FAN_R * 0.56, FAN_R * 0.43, t2), hubR2 = lerp(FAN_R * 0.18, FAN_R * 0.30, t2);
    var ring2 = bladeRing(24, x2, hubR2, tipR2, 0.077, 0.012, 0x8fa3bd, { twist: 0.8, washout: 0.35, metalness: 0.8, roughness: 0.3 });
    ipSpool.add(ring2); ipSpool.add(hubDisk(x2, hubR2, 0.035, 0x6c7f99));
    ipcStages.push(ring2); ipcXs.push(x2); ipcHubs.push(hubR2); ipcTips.push(tipR2);
  }
  addStators(ipcXs, ipcHubs, ipcTips, 22, 0.04, 0.009, 0x596273, 0.8, 0.35);
  var iptRing = bladeRing(20, 1.9, FAN_R * 0.30, FAN_R * 0.39, 0.105, 0.015, 0xb08a5a, { twist: -0.4, washout: 0.25, metalness: 0.6, roughness: 0.5, emissive: 0x552200, emissiveIntensity: 0.08 });
  ipSpool.add(iptRing); ipSpool.add(hubDisk(1.9, FAN_R * 0.30, 0.05, 0x8a6b45));
  var ipShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.78, 12), mat(0x7d93ad, { metalness: 0.9, roughness: 0.25 }));
  ipShaft.rotation.z = Math.PI / 2; ipShaft.position.x = 1.01;
  ipSpool.add(ipShaft);
  group.add(ipSpool);

  // ── Eje HP: compresor de alta presión (6 etapas, el más rápido) + HPT (1 etapa) ──
  var hpSpool = new THREE.Group();
  var hpcStages = [];
  var hpcXs = [], hpcHubs = [], hpcTips = [];
  for (var k = 0; k < 6; k++) {
    var t3 = k / 5, x3 = lerp(0.98, 1.35, t3);
    var tipR3 = lerp(FAN_R * 0.43, FAN_R * 0.32, t3), hubR3 = lerp(FAN_R * 0.30, FAN_R * 0.24, t3);
    var ring3 = bladeRing(26, x3, hubR3, tipR3, 0.063, 0.01, 0x6f85a0, { twist: 0.8, washout: 0.3, metalness: 0.82, roughness: 0.28 });
    hpSpool.add(ring3); hpSpool.add(hubDisk(x3, hubR3, 0.028, 0x556a85));
    hpcStages.push(ring3); hpcXs.push(x3); hpcHubs.push(hubR3); hpcTips.push(tipR3);
  }
  addStators(hpcXs, hpcHubs, hpcTips, 24, 0.032, 0.007, 0x596273, 0.8, 0.3);
  var hptRing = bladeRing(18, 1.73, FAN_R * 0.26, FAN_R * 0.33, 0.084, 0.013, 0xc99a5a, { twist: -0.4, washout: 0.22, metalness: 0.55, roughness: 0.5, emissive: 0x7a2a00, emissiveIntensity: 0.12 });
  hpSpool.add(hptRing); hpSpool.add(hubDisk(1.73, FAN_R * 0.26, 0.045, 0x9a6b3a));
  var hpShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.85, 12), mat(0x5f7893, { metalness: 0.9, roughness: 0.25 }));
  hpShaft.rotation.z = Math.PI / 2; hpShaft.position.x = 1.33;
  hpSpool.add(hpShaft);
  group.add(hpSpool);

  // Streamlines del flujo del núcleo: celeste claro en la admisión, degradado
  // a celeste oscuro a medida que se comprime, salto directo a rojo justo en
  // la cámara de combustión (x=1.52, mitad del motor) y degradado a naranja
  // fuerte hasta el escape. Reemplazan a la vieja "dona" de la cámara de
  // combustión como representación visual de la temperatura del gas.
  var COMBUSTOR_X = 1.52, FLOW_START_X = -0.35, FLOW_END_X = 3.05;
  function coreFlowRadius(x) {
    var pts = [
      { x: 0.05, r: 0.60 }, { x: 0.22, r: 0.58 }, { x: 0.92, r: 0.45 }, { x: 0.98, r: 0.44 },
      { x: 1.35, r: 0.32 }, { x: COMBUSTOR_X, r: 0.30 }, { x: 1.73, r: 0.32 }, { x: 1.9, r: 0.38 },
      { x: 1.98, r: 0.41 }, { x: 2.55, r: 0.55 }, { x: FLOW_END_X, r: 0.50 }
    ];
    for (var i = 0; i < pts.length - 1; i++) {
      if (x >= pts[i].x && x <= pts[i + 1].x) return lerp(pts[i].r, pts[i + 1].r, (x - pts[i].x) / (pts[i + 1].x - pts[i].x));
    }
    return x < pts[0].x ? pts[0].r : pts[pts.length - 1].r;
  }
  var flowLightBlue = new THREE.Color(0xbfe8ff), flowDarkBlue = new THREE.Color(0x0b3d66);
  var flowRed = new THREE.Color(0xff2a1a), flowOrange = new THREE.Color(0xff8a1a);
  function flowColorAt(x) {
    var c = new THREE.Color();
    if (x < COMBUSTOR_X) c.copy(flowLightBlue).lerp(flowDarkBlue, THREE.MathUtils.clamp((x - FLOW_START_X) / (COMBUSTOR_X - FLOW_START_X), 0, 1));
    else c.copy(flowRed).lerp(flowOrange, THREE.MathUtils.clamp((x - COMBUSTOR_X) / (FLOW_END_X - COMBUSTOR_X), 0, 1));
    return c;
  }
  var flowTexture = getFlowTexture(THREE);
  var streamlineMat = new THREE.MeshBasicMaterial({ vertexColors: true, map: flowTexture, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  var streamlineMeshes = [];
  var STREAM_SEGMENTS = 28;
  // Más streamlines, cada una con ángulo y radio propios sacados al azar
  // (sin ninguna grilla ni simetría alrededor del eje) y recorriendo toda
  // la longitud del motor, de punta a punta.
  var STREAM_COUNT = 42;
  for (var streamIdx = 0; streamIdx < STREAM_COUNT; streamIdx++) {
    var angle = Math.random() * Math.PI * 2;
    var radiusScale = 0.35 + Math.random() * 0.6;
    var pts = [];
    for (var si = 0; si <= STREAM_SEGMENTS; si++) {
      var x = lerp(FLOW_START_X, FLOW_END_X, si / STREAM_SEGMENTS);
      var r = coreFlowRadius(x) * radiusScale;
      pts.push(new THREE.Vector3(x, r * Math.cos(angle), r * Math.sin(angle)));
    }
    var curve = new THREE.CatmullRomCurve3(pts);
    var geo = new THREE.TubeGeometry(curve, STREAM_SEGMENTS * 2, 0.006, 6, false);
    var posAttr = geo.attributes.position;
    var colors = new Float32Array(posAttr.count * 3);
    for (var vi = 0; vi < posAttr.count; vi++) {
      var col = flowColorAt(posAttr.getX(vi));
      colors[vi * 3] = col.r; colors[vi * 3 + 1] = col.g; colors[vi * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var streamMesh = new THREE.Mesh(geo, streamlineMat);
    group.add(streamMesh);
    streamlineMeshes.push(streamMesh);
  }

  var flameLight = new THREE.PointLight(0xff8a3a, 0, FAN_R * 1.6, 2);
  flameLight.position.set(COMBUSTOR_X, 0, 0);
  group.add(flameLight);

  // Tobera de escape del núcleo
  var nozzle = new THREE.Mesh(new THREE.ConeGeometry(FAN_R * 0.44, 0.5, 32), mat(0x4a5160, { metalness: 0.7, roughness: 0.4 }));
  nozzle.rotation.z = -Math.PI / 2; nozzle.position.x = 2.85;
  group.add(nozzle);

  var steps = [
    { label: 'Admisión de aire', caption: 'El fan (20 álabes, Ø2.85 m reales) capta el flujo. Con el bypass 10:1 del Trent 1000, unos 9 de cada 10 kg de aire se derivan al conducto frío y solo 1 entra al núcleo.', camera: { x: -0.15, theta: 0.35, phi: 1.15, radius: 2.7 }, focus: [fanRing, fanDisk] },
    { label: 'Compresor de presión intermedia (IPC · 8 etapas)', caption: 'El eje IP —independiente de los otros dos— comprime el aire del núcleo en 8 etapas progresivas antes de entrar al compresor de alta.', camera: { x: 0.55, theta: 0.9, phi: 1.0, radius: 1.85 }, focus: ipcStages },
    { label: 'Compresor de alta presión (HPC · 6 etapas)', caption: 'El eje HP gira más rápido que el IP y el LP. Entre IPC y HPC se alcanza la relación de presión total del motor: 50:1.', camera: { x: 1.16, theta: 1.35, phi: 1.0, radius: 1.55 }, focus: hpcStages },
    { label: 'Inyección de combustible', caption: 'En la cámara anular se atomiza queroseno Jet-A junto al aire ya comprimido a 50 atmósferas, listo para el encendido.', camera: { x: 1.5, theta: 1.75, phi: 1.15, radius: 1.3 }, focus: [] },
    { label: 'Combustión sostenida', caption: 'La llama se estabiliza en torno a 1800–2000 K. Ese calor es lo que expande los gases y les da la energía que después van a ceder las tres turbinas.', camera: { x: 1.55, theta: 2.05, phi: 1.2, radius: 1.15 }, focus: [] },
    { label: 'Turbina de alta presión (HPT · 1 etapa)', caption: 'Una sola etapa extrae energía suficiente para mover, por el eje HP, al compresor de alta presión.', camera: { x: 1.75, theta: 2.35, phi: 1.05, radius: 1.4 }, focus: [hptRing] },
    { label: 'Turbina de presión intermedia (IPT · 1 etapa)', caption: 'Sigue extrayendo energía del gas para mover, por el eje IP, al compresor de presión intermedia.', camera: { x: 1.9, theta: 2.65, phi: 1.05, radius: 1.5 }, focus: [iptRing] },
    { label: 'Turbina de baja presión (LPT · 6 etapas)', caption: 'Seis etapas —las más grandes de las tres turbinas— mueven el fan por el eje LP, el más largo de los tres.', camera: { x: 2.25, theta: 3.0, phi: 1.0, radius: 1.9 }, focus: lptStages },
    { label: 'Punto de retroalimentación sostenida', caption: 'Se cierra el ciclo Brayton: la energía que cada turbina le devuelve a "su" compresor (o al fan) por su propio eje ya alcanza para sostener la rotación sin aporte externo. A partir de acá el motor se autosostiene en régimen estable.', camera: { x: 1.3, theta: 0.55, phi: 0.92, radius: 3.3 }, focus: [fanRing, fanDisk].concat(ipcStages, hpcStages, lptStages) },
    { label: 'Escape', caption: 'Los gases del núcleo y el aire frío del bypass se expulsan hacia atrás; esa diferencia de cantidad de movimiento respecto del aire que entró es el empuje neto del motor.', camera: { x: 2.75, theta: 1.05, phi: 1.08, radius: 2.0 }, focus: [nozzle] }
  ];

  var highlightable = [].concat(lpSpool.children, ipSpool.children, hpSpool.children, [nozzle]);

  // Objetivo de % de velocidad de giro por paso (0 = quieto, 1 = 100%).
  // Índices de paso (0-based): 0 Admisión, 1 IPC, 2 HPC, 3 Inyección,
  // 4 Combustión, 5 HPT, 6 IPT, 7 LPT, 8 Retroalimentación, 9 Escape.
  var stepSpeedTargets = [0, 0.10, 0.40, 0.43, 0.47, 0.50, 0.67, 0.83, 1.00, 1.00];
  var smoothedStepSpeed = 0;

  return {
    group: group,
    camRadius: 3.2,
    steps: steps,
    setCutaway: function (t) { clipPlane.constant = lerp(FAN_R * 1.05, -FAN_R * 0.05, t); },
    update: function (dt, elapsed, speedFactor, stepIdx) {
      // La velocidad "real" del motor la marca el paso del recorrido (arranca
      // en 0% y llega a 100% en la retroalimentación sostenida); el slider
      // de velocidad sigue funcionando como un multiplicador de reproducción
      // encima de eso. La rampa entre pasos es suave (no salto brusco).
      var target = stepSpeedTargets[stepIdx] != null ? stepSpeedTargets[stepIdx] : 1;
      smoothedStepSpeed += (target - smoothedStepSpeed) * Math.min(1, dt * 0.9);
      var s = (speedFactor != null ? speedFactor : 0.4) * smoothedStepSpeed;
      lpSpool.rotation.x += dt * 1.0 * s;
      ipSpool.rotation.x += dt * 2.3 * s;
      hpSpool.rotation.x += dt * 3.6 * s;

      // Las streamlines ahora quedan fijas (sin animación de flujo).

      var ignited = stepIdx >= 3;
      var flicker = 0.75 + 0.18 * Math.sin(elapsed * 9) + 0.09 * Math.sin(elapsed * 17.3) + 0.05 * Math.sin(elapsed * 31);
      var flameTarget = ignited ? Math.max(0, flicker) : 0;
      flameLight.intensity += (flameTarget * 2.4 - flameLight.intensity) * Math.min(1, dt * 4);

      var focus = (steps[stepIdx] && steps[stepIdx].focus) || [];
      var pulse = 0.35 + 0.2 * Math.sin(elapsed * 4);
      highlightable.forEach(function (obj) {
        var m = obj.material;
        if (!m || m.emissive === undefined) return;
        if (m.userData.baseEmissive == null) m.userData.baseEmissive = m.emissiveIntensity;
        var isFocused = focus.indexOf(obj) !== -1;
        m.emissiveIntensity = m.userData.baseEmissive + (isFocused ? pulse : 0);
      });
    }
  };
}

WIDGETS['eng-trent1000-3d'] = function () {
  return WidgetFigure3D(
    'Rolls-Royce Trent 1000 — corte en 3D',
    'Turbofán de tres ejes (LP/IP/HP independientes) · bypass 10:1 · relación de presión 50:1 · Boeing 787. Paso a paso desde la admisión hasta el régimen autosostenido.',
    buildTrent1000Scene,
    { height: 400 }
  );
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