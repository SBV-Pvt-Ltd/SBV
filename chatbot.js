/**
 * Saharsh Bhadani Venture website chat widget — drop-in, no dependencies.
 *
 * Host this file at the root of your GitHub Pages repo, then add to every page
 * just before </body>:
 *
 *   <script src="/chatbot.js" data-cfasync="false" defer></script>
 *
 * (data-cfasync="false" stops Cloudflare Rocket Loader from rewriting/delaying it.)
 */
(function () {
  'use strict';
  if (window.__sbvChatLoaded) return;
  window.__sbvChatLoaded = true;

  // >>> EDIT THIS to your deployed Worker URL (keep the /chat at the end) <<<
  var ENDPOINT = 'https://signal-desk-proxy.saharshbhadaniventure.workers.dev/chat';

  var TITLE = 'Ask us anything';
  var GREETING = "Hi! I can answer questions about Saharsh Bhadani Venture Private Limited and our services. What would you like to know?";
  var PLACEHOLDER = 'Type your question…';
  var ACCENT = '#2563eb';
  var MAX_HISTORY = 6;       // must be <= server MAX_HISTORY
  var MAX_INPUT = 500;       // must be <= server MAX_MSG_CHARS
  var TIMEOUT_MS = 25000;
  var STORE_KEY = 'sbv_chat_v1';

  var history = [];          // [{role, content}]
  var busy = false;

  /* ---------- storage (safe) ---------- */
  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (raw) { var a = JSON.parse(raw); if (Array.isArray(a)) history = a.slice(-40); }
    } catch (e) {}
  }
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-40))); } catch (e) {}
  }

  /* ---------- tiny DOM helper ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // textContent => no XSS from model output
    return n;
  }

  /* ---------- styles ---------- */
  var css = [
    '.sbvc-root,.sbvc-root *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}',
    '.sbvc-root{--a:' + ACCENT + ';--bg:#fff;--fg:#111827;--mut:#6b7280;--bd:#e5e7eb;--bot:#f3f4f6;position:fixed;right:16px;bottom:16px;z-index:2147483000;color:var(--fg)}',
    '@media (prefers-color-scheme:dark){.sbvc-root{--bg:#111827;--fg:#f3f4f6;--mut:#9ca3af;--bd:#374151;--bot:#1f2937}}',
    '.sbvc-fab{width:56px;height:56px;border-radius:50%;border:0;background:var(--a);color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:26px}',
    '.sbvc-fab:focus-visible,.sbvc-send:focus-visible,.sbvc-x:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}',
    '.sbvc-panel{display:none;flex-direction:column;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 100px);background:var(--bg);border:1px solid var(--bd);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);overflow:hidden;margin-bottom:12px}',
    '.sbvc-open .sbvc-panel{display:flex}',
    '.sbvc-head{background:var(--a);color:#fff;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;font-weight:600;font-size:15px}',
    '.sbvc-x{background:transparent;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px}',
    '.sbvc-log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}',
    '.sbvc-msg{max-width:85%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}',
    '.sbvc-bot{align-self:flex-start;background:var(--bot);border-bottom-left-radius:4px}',
    '.sbvc-user{align-self:flex-end;background:var(--a);color:#fff;border-bottom-right-radius:4px}',
    '.sbvc-typing{color:var(--mut);font-style:italic}',
    '.sbvc-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--bd);background:var(--bg)}',
    '.sbvc-in{flex:1;border:1px solid var(--bd);border-radius:10px;padding:9px 11px;font-size:14px;background:var(--bg);color:var(--fg);min-width:0}',
    '.sbvc-in:focus{outline:2px solid var(--a);outline-offset:0}',
    '.sbvc-send{border:0;background:var(--a);color:#fff;border-radius:10px;padding:0 14px;font-size:14px;font-weight:600;cursor:pointer}',
    '.sbvc-send:disabled{opacity:.55;cursor:not-allowed}',
    '.sbvc-note{font-size:11px;color:var(--mut);text-align:center;padding:0 10px 8px;background:var(--bg)}',
    '@media (max-width:480px){.sbvc-root{right:8px;bottom:8px}.sbvc-panel{width:calc(100vw - 16px);height:calc(100vh - 90px)}}'
  ].join('\n');

  function init() {
    load();

    var style = el('style');
    style.textContent = css;
    document.head.appendChild(style);

    var root = el('div', 'sbvc-root');

    var panel = el('div', 'sbvc-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', TITLE);

    var head = el('div', 'sbvc-head');
    head.appendChild(el('span', null, TITLE));
    var closeBtn = el('button', 'sbvc-x', '\u00d7');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close chat');
    head.appendChild(closeBtn);

    var log = el('div', 'sbvc-log');
    log.setAttribute('aria-live', 'polite');

    var form = el('form', 'sbvc-form');
    var input = el('input', 'sbvc-in');
    input.type = 'text';
    input.placeholder = PLACEHOLDER;
    input.maxLength = MAX_INPUT;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Your question');
    var sendBtn = el('button', 'sbvc-send', 'Send');
    sendBtn.type = 'submit';
    form.appendChild(input);
    form.appendChild(sendBtn);

    var note = el('div', 'sbvc-note', 'AI assistant \u2014 answers may be inaccurate.');

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(form);
    panel.appendChild(note);

    var fab = el('button', 'sbvc-fab', '\uD83D\uDCAC');
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Open chat');

    root.appendChild(panel);
    root.appendChild(fab);
    document.body.appendChild(root);

    function addMsg(role, text) {
      var m = el('div', 'sbvc-msg ' + (role === 'user' ? 'sbvc-user' : 'sbvc-bot'), text);
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
      return m;
    }

    function render() {
      log.textContent = '';
      addMsg('assistant', GREETING);
      history.forEach(function (m) { addMsg(m.role, m.content); });
    }

    function setOpen(open) {
      root.classList.toggle('sbvc-open', open);
      fab.style.display = open ? 'none' : 'flex';
      if (open) { log.scrollTop = log.scrollHeight; setTimeout(function () { input.focus(); }, 30); }
      else { fab.focus(); }
    }

    fab.addEventListener('click', function () { setOpen(true); });
    closeBtn.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('sbvc-open')) setOpen(false);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var text = input.value.trim();
      if (!text) return;

      input.value = '';
      history.push({ role: 'user', content: text });
      addMsg('user', text);
      save();

      busy = true;
      sendBtn.disabled = true;
      var typing = addMsg('assistant', 'Thinking\u2026');
      typing.classList.add('sbvc-typing');

      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
        signal: ctrl.signal
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
        })
        .then(function (res) {
          var reply = res.data && res.data.reply;
          if (!reply) {
            reply = res.status === 429
              ? 'Too many messages \u2014 please wait a few minutes and try again.'
              : 'Sorry, something went wrong. Please try again in a moment.';
          }
          typing.remove();
          addMsg('assistant', reply);
          if (res.ok) { history.push({ role: 'assistant', content: reply }); save(); }
          else { history.pop(); save(); }   // drop the unanswered question so history stays alternating
        })
        .catch(function () {
          typing.remove();
          addMsg('assistant', 'Connection problem. Please check your internet and try again.');
          history.pop(); save();
        })
        .finally(function () {
          clearTimeout(timer);
          busy = false;
          sendBtn.disabled = false;
          input.focus();
        });
    });

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
