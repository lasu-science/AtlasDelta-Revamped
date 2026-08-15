// SettingsPage — configuración del copiloto: elegí proveedor (Anthropic o Groq) y pegá tu clave. Todo queda en localStorage, sin backend.
function SettingsPage() {
  var provider = getApiProvider();
  var key = getApiKey(provider);
  var model = getApiModel(provider);

  function save(e) {
    if (e) e.preventDefault();
    setApiProvider(provider);
    setApiKey(key, provider);
    setApiModel(model, provider);
    var status = document.getElementById('settings-status');
    if (status) { status.textContent = '✓ Guardado en este navegador'; setTimeout(function(){ if(status) status.textContent=''; }, 2500); }
  }

  function testConnection() {
    setApiProvider(provider); setApiKey(key, provider); setApiModel(model, provider);
    refreshTestMsg('Probando…', null);
    callClaude('Respondé solo con la palabra "ok".', 'ok?').then(function(text){
      refreshTestMsg('✓ Conexión exitosa. Respuesta: "'+text.trim()+'"', 'ok');
    }).catch(function(err){
      var msg = err && err.message === 'MISSING_KEY' ? 'Pegá una clave primero.' : (err.message || 'Error desconocido.');
      refreshTestMsg('⚠ '+msg, 'error');
    });
  }

  function refreshTestMsg(text, kind) {
    var el = document.getElementById('settings-test-msg');
    if (!el) return;
    el.textContent = text;
    el.style.color = kind==='error' ? '#ef4444' : kind==='ok' ? '#34d399' : '#8a8fa8';
  }

  function switchProvider(p) {
    provider = p; key = getApiKey(p); model = getApiModel(p);
    render();
  }

  var root = h('div',{});

  function render() {
    root.innerHTML = '';
    root.appendChild(
      h('div',{className:'ws-content', style:{maxWidth:'680px'}},
        h('div',{className:'ws-section-header', style:{position:'static'}},
          h('div',{},h('div',{className:'ws-index'},'// CONFIGURACIÓN'),h('h1',{},'Copiloto científico'),h('p',{style:{fontSize:'14px',color:'#8a8fa8',marginTop:'4px'}},'Elegí un proveedor de IA y conectá tu propia clave para activar el análisis en los editores.'))
        ),
        h('div',{style:{display:'flex',gap:'10px',margin:'24px 0'}},
          Object.keys(AI_PROVIDERS).map(function(p){
            return h('button',{className:'btn '+(provider===p?'btn-primary':'btn-outline'),onClick:function(){switchProvider(p);}},AI_PROVIDERS[p].label);
          })
        ),
        (function(){
          var hints = {
            anthropic: {bg:'rgba(167,139,250,.08)', border:'rgba(167,139,250,.3)', color:'#c4b5fd', strong:'Anthropic (Claude): ', text:'el copiloto más capaz para leer diagramas, LaTeX y gráficas. Se paga por token, pero las cuentas nuevas reciben un crédito de prueba gratis (usualmente unos pocos dólares, sin necesitar tarjeta) para probarlo antes de gastar nada. El modelo más económico (Haiku) cuesta centavos de dólar por miles de análisis. ', link:'https://console.anthropic.com', linkText:'Crear cuenta y generar una clave en console.anthropic.com →'},
            groq: {bg:'rgba(52,211,153,.08)', border:'rgba(52,211,153,.3)', color:'#6ee7b7', strong:'Groq: ', text:'nivel gratuito real, sin tarjeta de crédito. Corre modelos de código abierto (Llama, Qwen) en vez de Claude — el análisis es más limitado, pero no cuesta nada y alcanza para uso personal ocasional. ', link:'https://console.groq.com', linkText:'Crear cuenta gratis y generar una clave en console.groq.com →'},
            gemini: {bg:'rgba(96,165,250,.08)', border:'rgba(96,165,250,.3)', color:'#93c5fd', strong:'Gemini (Google): ', text:'también gratis y sin tarjeta, vía Google AI Studio. Modelos "Flash" rápidos y livianos — buena alternativa a Groq si ya tenés cuenta de Google o querés comparar resultados entre los dos gratuitos. ', link:'https://aistudio.google.com/apikey', linkText:'Crear clave gratis en Google AI Studio →'}
          };
          var hh = hints[provider];
          return h('div',{className:'companion-hint', style:{background:hh.bg,border:'1px solid '+hh.border,padding:'12px 14px',borderRadius:'2px',color:hh.color,fontSize:'12px',lineHeight:'1.7',marginBottom:'20px'}},
            h('strong',{},hh.strong), hh.text,
            h('a',{href:hh.link,target:'_blank',style:{color:hh.color,textDecoration:'underline'}},hh.linkText)
          );
        })(),
        h('form',{onSubmit:save, style:{display:'flex',flexDirection:'column',gap:'20px'}},
          h('label',{},
            h('div',{style:{fontSize:'12px',marginBottom:'6px',color:'#8a8fa8'}},'Clave de API de '+(provider==='anthropic'?'Anthropic':'Groq')),
            h('input',{type:'password',value:key,placeholder:AI_PROVIDERS[provider].keyPlaceholder,onInput:function(e){key=e.target.value;},style:{width:'100%',background:'#0f172a',border:'1px solid rgba(55,65,81,.8)',padding:'8px 10px',color:'#e2e8f0',fontFamily:'var(--font-mono)',fontSize:'13px'}})
          ),
          h('label',{},
            h('div',{style:{fontSize:'12px',marginBottom:'6px',color:'#8a8fa8'}},'Modelo'),
            h('input',{type:'text',value:model,placeholder:AI_PROVIDERS[provider].defaultModel,onInput:function(e){model=e.target.value;},style:{width:'100%',background:'#0f172a',border:'1px solid rgba(55,65,81,.8)',padding:'8px 10px',color:'#e2e8f0',fontFamily:'var(--font-mono)',fontSize:'13px'}}),
            h('div',{style:{fontSize:'11px',color:'#8a8fa8',marginTop:'4px'}},
              provider==='anthropic' ? 'Ej: claude-haiku-4-5-20251001 (económico), claude-sonnet-5 (equilibrado), claude-opus-4-8 (el más capaz)' : provider==='gemini' ? 'Ej: gemini-3.6-flash (estable), gemini-3.7-flash (más nuevo, precio introductorio), gemini-3.5-flash-lite (el más económico)' : 'Ej: openai/gpt-oss-120b (más capaz), openai/gpt-oss-20b (más liviano/rápido)'
            )
          ),
          h('div',{style:{display:'flex',gap:'12px',alignItems:'center',flexWrap:'wrap'}},
            h('button',{className:'btn btn-primary',type:'submit'},'Guardar'),
            h('button',{className:'btn btn-outline',type:'button',onClick:testConnection},'Probar conexión'),
            h('span',{id:'settings-status',style:{fontSize:'12px',color:'#34d399'}})
          ),
          h('div',{id:'settings-test-msg',style:{fontSize:'12px',minHeight:'18px'}})
        ),
        h('div',{className:'companion-hint', style:{marginTop:'24px',fontSize:'11px',color:'#8a8fa8',lineHeight:'1.6'}},
          '⚠ Esta clave se guarda solo en tu navegador (localStorage) y se usa para llamar directo a la API elegida. Nunca se envía a ningún servidor propio — pero tampoco queda oculta: cualquiera con acceso a este navegador o a las herramientas de desarrollador puede verla. Usala solo en un equipo de confianza.'
        ),
        h('div',{style:{marginTop:'24px'}},h('a',{className:'btn btn-ghost',href:'workspace.html'},'← Volver al workspace'))
      )
    );
  }

  render();
  return root;
}

bootWorkspacePage(SettingsPage);
