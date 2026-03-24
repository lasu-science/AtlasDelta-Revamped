/**
 * chatbot-widget.js
 * Asistente de chat con Groq (Llama 3.3) via proxy Cloudflare Worker.
 *
 * CONFIGURACIÓN:
 *   1. Desplegá cloudflare-worker.js en Cloudflare
 *   2. Reemplazá proxyUrl con la URL de tu Worker
 *   3. Editá systemPrompt para personalizar el asistente
 */

(function () {
  const CONFIG = {
    proxyUrl:     "https://gemini-proxy.ezesouto2.workers.dev", // ← tu Worker
    systemPrompt: "Eres un asistente amigable y conciso para este sitio web. Respondés en el mismo idioma que el usuario. Tus respuestas son breves y útiles.",
    welcomeMessage: "¡Hola! 👋 ¿En qué te puedo ayudar hoy?",
    botName: "Asistente",
  };

  // ─── Estilos ───────────────────────────────────────────────────────────────
  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

    #cw-root * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'DM Sans', sans-serif; }

    #cw-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 9998;
      width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      box-shadow: 0 4px 24px rgba(15,52,96,.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s ease, box-shadow .2s ease;
    }
    #cw-fab:hover { transform: scale(1.08); box-shadow: 0 8px 32px rgba(15,52,96,.6); }
    #cw-fab svg { transition: transform .25s ease; }
    #cw-fab.open svg { transform: rotate(45deg); }
    #cw-badge {
      position: absolute; top: -3px; right: -3px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #e94560; border: 2px solid #fff; display: none;
    }
    #cw-badge.visible { display: block; }

    #cw-panel {
      position: fixed; bottom: 96px; right: 28px; z-index: 9997;
      width: 360px; max-height: 520px; background: #fff; border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.08);
      display: flex; flex-direction: column; overflow: hidden;
      transform: scale(.92) translateY(16px); opacity: 0; pointer-events: none;
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s ease;
    }
    #cw-panel.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }

    #cw-header {
      background: linear-gradient(135deg, #1a1a2e, #0f3460);
      padding: 16px 18px; display: flex; align-items: center; gap: 12px;
    }
    #cw-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(255,255,255,.15);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
    }
    #cw-bot-name { color: #fff; font-size: 15px; font-weight: 600; }
    #cw-status { color: rgba(255,255,255,.6); font-size: 12px; display: flex; align-items: center; gap: 5px; }
    #cw-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; display: inline-block; }

    #cw-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px; background: #f9fafb;
      scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent;
    }

    .cw-msg { display: flex; gap: 8px; max-width: 88%; }
    .cw-msg.bot  { align-self: flex-start; }
    .cw-msg.user { align-self: flex-end; flex-direction: row-reverse; }

    .cw-bubble { padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; word-break: break-word; }
    .cw-msg.bot  .cw-bubble { background: #fff; color: #1e293b; border-bottom-left-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.07); }
    .cw-msg.user .cw-bubble { background: linear-gradient(135deg, #1a1a2e, #0f3460); color: #fff; border-bottom-right-radius: 4px; }

    .cw-typing { display: flex; gap: 4px; align-items: center; padding: 12px 14px; }
    .cw-typing span { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; animation: cw-bounce .9s infinite ease-in-out; }
    .cw-typing span:nth-child(2) { animation-delay: .15s; }
    .cw-typing span:nth-child(3) { animation-delay: .3s; }
    @keyframes cw-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

    #cw-input-row { display: flex; gap: 8px; padding: 12px 14px; border-top: 1px solid #f1f5f9; background: #fff; }
    #cw-input {
      flex: 1; border: 1.5px solid #e2e8f0; border-radius: 12px;
      padding: 10px 14px; font-size: 14px; color: #1e293b; outline: none;
      resize: none; min-height: 40px; max-height: 100px;
      transition: border-color .2s; font-family: 'DM Sans', sans-serif;
    }
    #cw-input:focus { border-color: #0f3460; }
    #cw-send {
      width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #1a1a2e, #0f3460);
      transition: opacity .2s, transform .15s;
    }
    #cw-send:hover { opacity: .9; transform: scale(1.05); }
    #cw-send:disabled { opacity: .4; cursor: not-allowed; transform: none; }
    #cw-footer { text-align: center; font-size: 10px; color: #94a3b8; padding: 0 0 8px; }

    @media (max-width: 420px) {
      #cw-panel { width: calc(100vw - 24px); right: 12px; bottom: 84px; }
      #cw-fab   { right: 16px; bottom: 16px; }
    }
  `;

  // ─── HTML ──────────────────────────────────────────────────────────────────
  const HTML = `
    <style>${STYLES}</style>
    <div id="cw-panel" role="dialog" aria-label="Chat de soporte">
      <div id="cw-header">
        <div id="cw-avatar">🦙</div>
        <div>
          <div id="cw-bot-name">${CONFIG.botName}</div>
          <div id="cw-status"><span id="cw-dot"></span> En línea</div>
        </div>
      </div>
      <div id="cw-messages" aria-live="polite"></div>
      <div id="cw-input-row">
        <textarea id="cw-input" placeholder="Escribí tu mensaje…" rows="1" aria-label="Mensaje"></textarea>
        <button id="cw-send" aria-label="Enviar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
      <div id="cw-footer">Powered by Groq · Llama 3.3</div>
    </div>

    <button id="cw-fab" aria-label="Abrir chat">
      <div id="cw-badge"></div>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>
  `;

  // ─── Inicializar DOM ───────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.id = "cw-root";
  root.innerHTML = HTML;
  document.body.appendChild(root);

  const panel   = document.getElementById("cw-panel");
  const fab     = document.getElementById("cw-fab");
  const msgs    = document.getElementById("cw-messages");
  const input   = document.getElementById("cw-input");
  const sendBtn = document.getElementById("cw-send");
  const badge   = document.getElementById("cw-badge");

  // Historial en formato OpenAI: [{role, content}]
  let history = [{ role: "system", content: CONFIG.systemPrompt }];
  let isOpen  = false;
  let hasSeen = false;

  // ─── Abrir / cerrar ────────────────────────────────────────────────────────
  fab.addEventListener("click", () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    fab.classList.toggle("open", isOpen);
    if (isOpen) { badge.classList.remove("visible"); hasSeen = true; input.focus(); }
  });

  // ─── Helpers DOM ───────────────────────────────────────────────────────────
  function addMessage(text, role) {
    const wrap   = document.createElement("div");
    wrap.className = `cw-msg ${role}`;
    const bubble = document.createElement("div");
    bubble.className = "cw-bubble";
    bubble.textContent = text;
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const wrap = document.createElement("div");
    wrap.className = "cw-msg bot";
    wrap.id = "cw-typing-indicator";
    wrap.innerHTML = `<div class="cw-bubble cw-typing"><span></span><span></span><span></span></div>`;
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping() {
    const el = document.getElementById("cw-typing-indicator");
    if (el) el.remove();
  }

  // ─── Llamada al proxy (formato OpenAI) ────────────────────────────────────
  async function sendToAPI(userText) {
    history.push({ role: "user", content: userText });
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(CONFIG.proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      const data  = await res.json();
      const reply = data.choices?.[0]?.message?.content || "Sin respuesta.";

      history.push({ role: "assistant", content: reply });
      hideTyping();
      addMessage(reply, "bot");
      if (!isOpen) badge.classList.add("visible");

    } catch (e) {
      hideTyping();
      addMessage(`⚠️ Error: ${e.message}`, "bot");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // ─── Enviar ────────────────────────────────────────────────────────────────
  function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    addMessage(text, "user");
    input.value = "";
    input.style.height = "auto";
    sendToAPI(text);
  }

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 100) + "px";
  });

  // ─── Bienvenida ────────────────────────────────────────────────────────────
  setTimeout(() => {
    addMessage(CONFIG.welcomeMessage, "bot");
    if (!hasSeen) badge.classList.add("visible");
  }, 800);

})();