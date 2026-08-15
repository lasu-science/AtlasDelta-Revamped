// AuthPage — autenticación real vía Firebase (base de datos + hash de contraseñas +
// emails de recuperación + login con Google, todo manejado por Firebase Auth).
function AuthPage() {
  var mode = 'signin', email = '', password = '', error = null, info = null, loading = false;
  var auth = getFirebaseAuth();

  function mirrorSession(user) {
    // El resto del sitio (workspace, editores, etc.) sigue leyendo la sesión
    // desde acá — así no hace falta tocar ninguna otra página.
    localStorage.setItem('ad_user', JSON.stringify({email: user.email}));
  }

  function firebaseErrorMessage(err) {
    switch (err.code) {
      case 'auth/email-already-in-use': return 'Ya existe una cuenta con este email. Iniciá sesión o usá "¿Olvidaste tu contraseña?".';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found': return 'Credenciales inválidas.';
      case 'auth/weak-password': return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/invalid-email': return 'El email no es válido.';
      case 'auth/popup-closed-by-user': return 'Cerraste la ventana de Google antes de terminar.';
      case 'auth/too-many-requests': return 'Demasiados intentos. Probá de nuevo en unos minutos.';
      default: return err.message || 'Algo salió mal.';
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!auth) { error = 'No se pudo conectar con el servidor de autenticación (revisá FIREBASE_CONFIG en shared.js).'; refreshForm(); return; }
    error = null; info = null; loading = true; refreshForm();

    if (mode === 'signup') {
      auth.createUserWithEmailAndPassword(email, password).then(function(cred){
        loading = false;
        mirrorSession(cred.user);
        location.href = 'workspace.html';
      }).catch(function(err){
        loading = false; error = firebaseErrorMessage(err); refreshForm();
      });
    } else {
      auth.signInWithEmailAndPassword(email, password).then(function(cred){
        loading = false;
        mirrorSession(cred.user);
        location.href = 'workspace.html';
      }).catch(function(err){
        loading = false; error = firebaseErrorMessage(err); refreshForm();
      });
    }
  }

  function forgotPassword() {
    error = null; info = null;
    if (!email) { error = 'Escribí tu email arriba y después tocá "¿Olvidaste tu contraseña?".'; refreshForm(); return; }
    if (!auth) { error = 'No se pudo conectar con el servidor de autenticación.'; refreshForm(); return; }
    loading = true; refreshForm();
    auth.sendPasswordResetEmail(email).then(function(){
      loading = false;
      info = 'Si ese email tiene una cuenta, te enviamos instrucciones para restablecer la contraseña.';
      refreshForm();
    }).catch(function(err){
      loading = false;
      // No revelamos si el email existe o no (protección contra enumeración) salvo formato inválido.
      if (err.code === 'auth/invalid-email') { error = firebaseErrorMessage(err); }
      else { info = 'Si ese email tiene una cuenta, te enviamos instrucciones para restablecer la contraseña.'; }
      refreshForm();
    });
  }

  function googleLogin() {
    error = null;
    if (!auth) { error = 'No se pudo conectar con el servidor de autenticación.'; refreshForm(); return; }
    // Popup en vez de redirect: evita tener que configurar redirect URLs a mano.
    var provider = new firebase.auth.GoogleAuthProvider();
    loading = true; refreshForm();
    auth.signInWithPopup(provider).then(function(cred){
      loading = false;
      mirrorSession(cred.user);
      location.href = 'workspace.html';
    }).catch(function(err){
      loading = false;
      if (err.code !== 'auth/popup-closed-by-user') error = firebaseErrorMessage(err);
      refreshForm();
    });
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
    box.appendChild(h('button',{className:'auth-google',type:'button',disabled:loading,onClick:googleLogin},h('span',{innerHTML:'<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.5-1.7 4.4-5.5 4.4-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.9 0 3.16.81 3.88 1.5l2.65-2.55C16.94 3.7 14.7 2.7 12 2.7 6.86 2.7 2.7 6.86 2.7 12s4.16 9.3 9.3 9.3c5.37 0 8.92-3.77 8.92-9.07 0-.61-.07-1.08-.15-1.55H12z"/></svg>'}),'Continuar con Google'));
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
