// AuthPage — extraída de app.js, adaptada a navegación real (location.href)
function AuthPage() {
  var mode = 'signin', email = '', password = '', error = null, loading = false;

  function submit(e) {
    e.preventDefault();
    error = null; loading = true;
    var users = JSON.parse(localStorage.getItem('ad_users') || '[]');
    if (mode === 'signup') {
      if (users.some(function(u){return u.email === email;})) {
        error = 'Este email ya tiene cuenta.'; loading = false; refreshForm(); return;
      }
      users.push({email:email, password:password});
      localStorage.setItem('ad_users', JSON.stringify(users));
      localStorage.setItem('ad_user', JSON.stringify({email:email}));
    } else {
      var u = users.find(function(u){return u.email === email && u.password === password;});
      if (!u) { error = 'Credenciales inválidas.'; loading = false; refreshForm(); return; }
      localStorage.setItem('ad_user', JSON.stringify({email:u.email}));
    }
    location.href = 'workspace.html';
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
    if (error) box.appendChild(h('div',{className:'auth-error'},'▸ '+error));
    box.appendChild(h('button',{className:'auth-btn',disabled:loading,type:'submit'},loading?'Cargando...':(mode==='signin'?'▸ Acceder al workspace':'▸ Crear workspace')));
    box.appendChild(h('div',{className:'auth-divider'},'o'));
    box.appendChild(h('button',{className:'auth-google',type:'button',onClick:function(){localStorage.setItem('ad_user',JSON.stringify({email:'google@demo.com'}));location.href='workspace.html';}},h('span',{innerHTML:'<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.5-1.7 4.4-5.5 4.4-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.9 0 3.16.81 3.88 1.5l2.65-2.55C16.94 3.7 14.7 2.7 12 2.7 6.86 2.7 2.7 6.86 2.7 12s4.16 9.3 9.3 9.3c5.37 0 8.92-3.77 8.92-9.07 0-.61-.07-1.08-.15-1.55H12z"/></svg>'}),'Continuar con Google'));
    box.appendChild(h('button',{className:'auth-toggle',type:'button',onClick:function(){mode=mode==='signin'?'signup':'signin';error=null;refreshForm();}},mode==='signin'?'¿No tienes cuenta? Crear una nueva →':'¿Ya tienes cuenta? Iniciar sesión →'));
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
