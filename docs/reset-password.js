// ResetPasswordPage — a esta página redirige el link del email de recuperación
// que envía Firebase. Firebase manda un código de un solo uso (oobCode) como
// parámetro en la URL; lo validamos y, si es válido, dejamos definir la contraseña nueva.
function ResetPasswordPage() {
  var password = '', password2 = '', error = null, done = false, loading = false, ready = false;
  var auth = getFirebaseAuth();
  var oobCode = new URLSearchParams(location.search).get('oobCode');

  function checkCode() {
    if (!auth) { error = 'No se pudo conectar con el servidor de autenticación (revisá FIREBASE_CONFIG en shared.js).'; ready = true; render(); return; }
    if (!oobCode) { error = 'Este link no es válido — le falta el código de verificación. Pedí uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de acceso.'; ready = true; render(); return; }
    auth.verifyPasswordResetCode(oobCode).then(function(){
      ready = true; render();
    }).catch(function(){
      error = 'Este link ya expiró o ya se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de acceso.';
      ready = true; render();
    });
  }

  function submit(e) {
    e.preventDefault();
    error = null;
    if (password.length < 6) { error = 'La contraseña debe tener al menos 6 caracteres.'; render(); return; }
    if (password !== password2) { error = 'Las contraseñas no coinciden.'; render(); return; }
    loading = true; render();
    auth.confirmPasswordReset(oobCode, password).then(function(){
      loading = false; done = true; render();
    }).catch(function(err){
      loading = false;
      error = err.code === 'auth/weak-password' ? 'La contraseña debe tener al menos 6 caracteres.' : (err.message || 'No se pudo actualizar la contraseña.');
      render();
    });
  }

  var root = h('div',{});

  function render() {
    root.innerHTML = '';
    var body;
    if (!ready) {
      body = h('p',{style:{color:'#8a8fa8',fontSize:'13px'}},'Verificando el link…');
    } else if (done) {
      body = h('div',{},
        h('div',{className:'auth-info'},'▸ Contraseña actualizada. Ya podés iniciar sesión con la nueva.'),
        h('a',{className:'btn btn-primary',href:'auth.html',style:{display:'inline-block',marginTop:'12px'}},'Ir a iniciar sesión →')
      );
    } else if (error && !auth) {
      body = h('div',{className:'auth-error'},'▸ '+error);
    } else if (error) {
      body = h('div',{},
        h('div',{className:'auth-error'},'▸ '+error),
        h('a',{className:'btn btn-ghost',href:'auth.html',style:{display:'inline-block',marginTop:'12px'}},'← Volver a acceder')
      );
    } else {
      body = h('form',{onSubmit:submit},
        h('label',{},'Contraseña nueva'),
        h('input',{type:'password',value:password,onInput:function(e){password=e.target.value;},placeholder:'••••••',required:true,minLength:'6'}),
        h('label',{},'Repetí la contraseña nueva'),
        h('input',{type:'password',value:password2,onInput:function(e){password2=e.target.value;},placeholder:'••••••',required:true,minLength:'6'}),
        error ? h('div',{className:'auth-error'},'▸ '+error) : null,
        h('button',{className:'auth-btn',type:'submit',disabled:loading},loading?'Guardando...':'▸ Guardar contraseña nueva')
      );
    }
    root.appendChild(
      h('div',{className:'auth-page'},
        h('div',{className:'auth-card'},
          h('div',{className:'auth-brand'},h('div',{className:'brand-name'},'ATLASDELTA',h('span',{},'·REVAMPED')),h('div',{style:{fontSize:'12px',color:'#8a8fa8',marginTop:'4px'}},'restablecer contraseña')),
          h('div',{className:'auth-box'},
            h('div',{className:'auth-box-header'},h('h1',{},'Nueva contraseña')),
            h('div',{className:'auth-box-body'}, body)
          ),
          h('div',{style:{textAlign:'center',marginTop:'24px'}},h('a',{className:'btn btn-ghost',href:'index.html'},'← Volver al overview'))
        )
      )
    );
  }

  render();
  checkCode();
  return root;
}

bootBarePage(ResetPasswordPage);
