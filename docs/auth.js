// AuthPage — autenticación real vía Supabase (base de datos + hash de contraseñas +
// emails de recuperación + OAuth de Google, todo manejado por Supabase).
function AuthPage() {
  var mode = 'signin', email = '', password = '', error = null, info = null, loading = false;
  var sb = getSupabaseClient();

  function mirrorSession(user) {
    // El resto del sitio (workspace, editores, etc.) sigue leyendo la sesión
    // desde acá — así no hace falta tocar ninguna otra página.
    localStorage.setItem('ad_user', JSON.stringify({email: user.email}));
  }

  // Si volvemos de un login con Google, Supabase ya dejó la sesión activa.
  if (sb) {
    sb.auth.getSession().then(function(res){
      var session = res.data && res.data.session;
      if (session && session.user) { mirrorSession(session.user); location.href = 'workspace.html'; }
    });
  }

  function submit(e) {
    e.preventDefault();
    if (!sb) { error = 'No se pudo conectar con el servidor de autenticación (revisá SUPABASE_URL / SUPABASE_ANON_KEY en shared.js).'; refreshForm(); return; }
    error = null; info = null; loading = true; refreshForm();

    if (mode === 'signup') {
      sb.auth.signUp({ email: email, password: password }).then(function(res){
        loading = false;
        if (res.error) { error = res.error.message; refreshForm(); return; }
        var user = res.data && res.data.user;
        if (user && user.identities && user.identities.length === 0) {
          // Supabase crea un usuario "fantasma" cuando el email ya existe, para no
          // filtrar qué emails están registrados — así detectamos el duplicado.
          error = 'Ya existe una cuenta con este email. Iniciá sesión o usá "¿Olvidaste tu contraseña?".';
          refreshForm(); return;
        }
        if (res.data.session) {
          mirrorSession(user); location.href = 'workspace.html';
        } else {
          info = 'Te enviamos un email para confirmar tu cuenta — revisá tu bandeja de entrada (y spam).';
          mode = 'signin'; refreshForm();
        }
      });
    } else {
      sb.auth.signInWithPassword({ email: email, password: password }).then(function(res){
        loading = false;
        if (res.error) {
          error = res.error.message === 'Invalid login credentials' ? 'Credenciales inválidas.' : res.error.message;
          refreshForm(); return;
        }
        mirrorSession(res.data.user); location.href = 'workspace.html';
      });
    }
  }

  function forgotPassword() {
    error = null; info = null;
    if (!email) { error = 'Escribí tu email arriba y después tocá "¿Olvidaste tu contraseña?".'; refreshForm(); return; }
    if (!sb) { error = 'No se pudo conectar con el servidor de autenticación.'; refreshForm(); return; }
    loading = true; refreshForm();
    var resetUrl = location.href.replace(/auth\.html.*$/, 'reset-password.html');
    sb.auth.resetPasswordForEmail(email, { redirectTo: resetUrl }).then(function(res){
      loading = false;
      if (res.error) { error = res.error.message; refreshForm(); return; }
      info = 'Si ese email tiene una cuenta, te enviamos instrucciones para restablecer la contraseña.';
      refreshForm();
    });
  }

  function googleLogin() {
    error = null;
    if (!sb) { error = 'No se pudo conectar con el servidor de autenticación.'; refreshForm(); return; }
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('?')[0].split('#')[0] } });
  }

  function refreshForm() {
    var box = document.getElementById('auth-box-body');
    if (!box) return;
    box.innerHTML = '';
    var emailInput = h('input',{type:'email',value:email,onInput:function(e){email=e.target.value;},placeholder:'tu@email.com',required:true});
    var pwInput = h('input',{type:'password',value:password,onInput:function(e){password=e.target.value;},placeholder:'••••••',required:true,minLength:'6'});
    box.appendChild(h('label',{},'Correo electrónico'));
    box.appendChild(emailInput);
    box.appendChild(h('label',{},'Contraseña'));
    box.appendChild(pwInput);
    if (mode === 'signin') box.appendChild(h('button',{className:'auth-toggle',type:'button',onClick:forgotPassword,style:{marginTop:'-8px',marginBottom:'8px',textAlign:'left',padding:'0'}},'¿Olvidaste tu contraseña?'));
    if (info) box.appendChild(h('div',{className:'auth-info'},'▸ '+info));
    if (error) box.appendChild(h('div',{className:'auth-error'},'▸ '+error));
    box.appendChild(h('button',{className:'auth-btn',disabled:loading,type:'submit'},loading?'Cargando...':(mode==='signin'?'▸ Acceder al workspace':'▸ Crear workspace')));
    box.appendChild(h('div',{className:'auth-divider'},'o'));
    box.appendChild(h('button',{className:'auth-google',type:'button',onClick:googleLogin},h('span',{innerHTML:'<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.5-1.7 4.4-5.5 4.4-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.9 0 3.16.81 3.88 1.5l2.65-2.55C16.94 3.7 14.7 2.7 12 2.7 6.86 2.7 2.7 6.86 2.7 12s4.16 9.3 9.3 9.3c5.37 0 8.92-3.77 8.92-9.07 0-.61-.07-1.08-.15-1.55H12z"/></svg>'}),'Continuar con Google'));
    box.appendChild(h('button',{className:'auth-toggle',type:'button',onClick:function(){mode=mode==='signin'?'signup':'signin';error=null;info=null;refreshForm();}},mode==='signin'?'¿No tienes cuenta? Crear una nueva →':'¿Ya tienes cuenta? Iniciar sesión →'));
  }

  var page = h('div',{className:'auth-page'},
    h('div',{className:'auth-card'},
      h('div',{className:'auth-brand'},h('div',{className:'brand-name'},'ATLASDELTA',h('span',{},'·REVAMPED')),h('div',{style:{fontSize:'12px',color:'#8a8fa8',marginTop:'4px'}},'workspace · acceso')),
      h('div',{className:'auth-box'},
        h('div',{className:'auth-box-header'},h('h1',{},mode==='signin'?'Iniciar sesión':'Crear cuenta'),h('span',{style:{fontSize:'10px',letterSpacing:'0.1em',color:'#8a8fa8'}},'SECURE · TLS')),
        h('form',{id:'auth-box-body',className:'auth-box-body',onSubmit:submit})
      ),
      h('div',{style:{textAlign:'center',marginTop:'24px'}},h('a',{className:'btn btn-ghost',href:'index.html'},'← Volver al overview'))
    )
  );
  setTimeout(refreshForm, 0);
  return page;
}

bootBarePage(AuthPage);
