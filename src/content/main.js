/* ChatSave — content script entry (any supported chat site). */
(function (g) {
  const CX = (g.CX = g.CX || {});
  const S = CX.selectors, SEL = S.current();
  if (!SEL) return;

  const settings = { includePrompts: true, theme: 'light', filenamePattern: '{title} - {date}', author: '' };
  chrome.storage.sync.get(settings).then((v) => Object.assign(settings, v));
  chrome.storage.onChanged.addListener((ch, area) => { if (area === 'sync') for (const k in ch) if (k in settings) settings[k] = ch[k].newValue; });

  /* ---------- injection ---------- */
  function injectMessageButtons() {
    for (const copyBtn of S.qa(SEL.actionCopyButton)) {
      if (copyBtn.dataset.cxDone || copyBtn.closest('pre, .cx-btn, [class*="code-block" i], [class*="codeblock" i]')) continue; // code-block Copy, not the reply's
      copyBtn.dataset.cxDone = '1';
      /* Some sites wrap the Copy button in single-child wrappers (Gemini's
         <copy-button>); insert beside the outermost one so we land in the row. */
      let sib = copyBtn;
      while (sib.parentElement && sib.parentElement.childElementCount === 1 && sib.parentElement !== document.body) sib = sib.parentElement;
      const row = sib.parentElement;
      if (!row || row.querySelector(':scope > .cx-btn')) continue;
      const btn = CX.ui.iconButton('Export this reply', 'message');
      btn.addEventListener('click', (e) => { e.stopPropagation(); openFor(btn, 'message'); });
      row.insertBefore(btn, sib);
    }
  }
  /* Artifact / canvas panels (Claude artifacts, ChatGPT canvas) keep their code
     outside the reply, behind a header "Copy" button. Like Tiiny Host: add a
     button beside it, click Copy, read the clipboard, publish if it's HTML. */
  function injectPanelButtons() {
    for (const copyBtn of document.querySelectorAll('button')) {
      if (copyBtn.dataset.cxPanel) continue;
      const isCopy = copyBtn.textContent.trim() === 'Copy' || copyBtn.getAttribute('aria-label') === 'Copy';
      if (!isCopy || copyBtn.closest('pre, .cx-btn') || copyBtn.closest(SEL.assistantMessage.join(','))) continue;
      copyBtn.dataset.cxPanel = '1';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'cx-btn cx-pub'; btn.title = 'Publish this code as a live site on Fylo';
      btn.innerHTML = `${CX.ui.ICON.rocket}<span>Publish</span>`;
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        copyBtn.click();
        await new Promise((r) => setTimeout(r, 400));
        let code = '';
        try { code = await navigator.clipboard.readText(); } catch (_) {}
        if (!/<html|<!doctype|<body|<head/i.test(code)) return CX.ui.toast('Open an HTML artifact first — this one isn\'t a web page.', 'error');
        publish({ url: location.href, title: document.title }, { kind: 'code', files: [{ path: 'index.html', content: code }] });
      });
      copyBtn.after(btn);
    }
  }
  let chatBtn = null;
  function injectChatButton() {
    const hasChat = CX.parser.messageElements().length > 0;
    if (hasChat && !chatBtn) {
      chatBtn = CX.ui.chatButton();
      chatBtn.addEventListener('click', (e) => { e.stopPropagation(); openFor(chatBtn, 'chat'); });
      document.body.appendChild(chatBtn);
    } else if (!hasChat && chatBtn) { chatBtn.remove(); chatBtn = null; }
  }
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; injectMessageButtons(); injectPanelButtons(); injectChatButton(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  injectMessageButtons(); injectPanelButtons(); injectChatButton();

  /* ---------- menu + actions ---------- */
  function convFor(btn, scope) {
    if (scope === 'chat') return CX.parser.conversation();
    /* The button sits in the action row under the reply; find the reply element above it. */
    let node = btn.parentElement, msg = btn.closest(SEL.assistantMessage.join(','));
    for (let i = 0; i < 8 && node && !msg; i++, node = node.parentElement) {
      msg = S.q(SEL.assistantMessage, node);
      if (msg) break;
    }
    return msg ? CX.parser.single(msg) : CX.parser.conversation();
  }

  function openFor(btn, scope) {
    const conv = convFor(btn, scope);
    const last = conv.messages[conv.messages.length - 1];
    const hasCode = !!(last && CX.model.firstHtmlCode(last));
    CX.ui.menu(btn, { scope, hasCode, site: SEL.name, includePrompts: settings.includePrompts }, async (id, o) => {
      let full = conv;
      if (scope === 'chat') { await CX.parser.loadAll(); full = CX.parser.conversation(); }
      run(id, full, { ...settings, ...o });
    });
  }

  async function run(id, conv, o) {
    if (!conv.messages.length) return CX.ui.toast('Nothing to export yet — the chat looks empty.', 'error');
    const name = (ext) => CX.filename(conv, ext, o.filenamePattern);
    try {
      switch (id) {
        case 'md': await CX.download(name('md'), CX.exportMarkdown(conv, o)); return CX.ui.toast('Saved as Markdown', 'success');
        case 'copy-md': await navigator.clipboard.writeText(CX.exportMarkdown(conv, o)); return CX.ui.toast('Markdown copied', 'success');
        case 'txt': await CX.download(name('txt'), CX.exportText(conv, o)); return CX.ui.toast('Saved as text', 'success');
        case 'json': await CX.download(name('json'), CX.exportJson(conv, o)); return CX.ui.toast('Saved as JSON', 'success');
        case 'docx': await CX.download(name('docx'), CX.exportDocx(conv, o)); return CX.ui.toast('Saved as Word', 'success');
        case 'notion': {
          CX.ui.toast('Sending to Notion…');
          const r = await chrome.runtime.sendMessage({ type: 'notion.export', conv, opts: { includePrompts: o.includePrompts } });
          if (!r?.ok) return CX.ui.toast(r?.error || 'Notion sync failed', 'error');
          return CX.ui.toast(`Saved to Notion (${r.blocks} blocks)`, 'success', { href: r.url, label: 'Open' });
        }
        case 'html': await CX.download(name('html'), CX.exportHtml(conv, { ...o, noindex: false })); return CX.ui.toast('Saved as web page', 'success');
        case 'pdf': {
          const html = CX.exportHtml(conv, { ...o, theme: 'light', chrome: false });
          const r = await chrome.runtime.sendMessage({ type: 'print', html, title: conv.title });
          if (!r?.ok) throw new Error(r?.error || 'Could not open print view');
          return CX.ui.toast('Choose "Save as PDF" in the print dialog');
        }
        case 'publish-page': return publish(conv, { kind: 'page', files: [{ path: 'index.html', content: CX.exportHtml(conv, { ...o, author: o.author, badge: null }) }] });
        case 'publish-code': {
          const last = conv.messages[conv.messages.length - 1];
          const code = CX.model.firstHtmlCode(last);
          return publish(conv, { kind: 'code', files: [{ path: 'index.html', content: code.code }] });
        }
      }
    } catch (e) {
      CX.ui.toast(e.message || 'Export failed', 'error');
    }
  }

  async function publish(conv, { kind, files }) {
    const status = await chrome.runtime.sendMessage({ type: 'fylo.status' });
    if (!status?.connected) {
      CX.ui.toast('Connect your Fylo account first (extension icon → Connect Fylo).', 'error');
      const r = await chrome.runtime.sendMessage({ type: 'fylo.connect' });
      if (!r?.ok) return;
      CX.ui.toast(`Connected as ${r.email || 'Fylo user'}`, 'success');
    }
    CX.ui.toast(kind === 'code' ? 'Publishing site…' : 'Publishing page…');
    const key = `${conv.url}#${kind}`;
    const r = await chrome.runtime.sendMessage({ type: 'fylo.publish', key, title: conv.title, files });
    if (!r?.ok) {
      if (r?.code === 'plan_limit') return CX.ui.toast(r.error || 'Your Fylo plan limit was reached.', 'error', { href: 'https://fylo.host/#pricing', label: 'See plans' });
      return CX.ui.toast(r?.error || 'Publish failed', 'error');
    }
    try { await navigator.clipboard.writeText(r.url); } catch (_) {}
    CX.ui.toast(`${r.updated ? 'Updated' : 'Published'} · link copied`, 'success', { href: r.url, label: 'Open' });
  }

  /* Selector report for tuning a platform entry: match counts, and the ancestor
     chain of the first reply Copy button and of the first Markdown-looking block. */
  function diag() {
    const desc = (el) => el.tagName.toLowerCase() + [...el.attributes].filter((a) => /^(id|class|data-|aria-|role)/.test(a.name)).map((a) => ` ${a.name}="${a.value.slice(0, 60)}"`).join('');
    const chain = (el) => { const out = []; for (let n = el, i = 0; n && n !== document.body && i < 10; n = n.parentElement, i++) out.push('  '.repeat(i) + desc(n)); return out.join('\n'); };
    const lines = [`${SEL.name} ${location.pathname}`, ''];
    for (const k of ['userMessage', 'assistantMessage', 'actionCopyButton', 'contentRoot']) for (const sel of SEL[k]) { let n = -1; try { n = document.querySelectorAll(sel).length; } catch (_) {} lines.push(`${k}  ${sel}  → ${n}`); }
    lines.push('', 'generic: article=' + document.querySelectorAll('article').length + ' [data-turn]=' + document.querySelectorAll('[data-turn]').length + ' [data-message-author-role]=' + document.querySelectorAll('[data-message-author-role]').length + ' .markdown=' + document.querySelectorAll('.markdown').length + ' .prose=' + document.querySelectorAll('.prose').length);
    const cp = S.q(SEL.actionCopyButton); if (cp) lines.push('', 'ancestors of Copy button:', chain(cp));
    const md = document.querySelector('main .markdown, main .prose, main [class*="markdown"]'); if (md) lines.push('', 'ancestors of first markdown block:', chain(md));
    return lines.join('\n');
  }

  /* Popup asks the page to export the whole chat. */
  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg?.type === 'export') { CX.parser.loadAll().then(() => run(msg.id, CX.parser.conversation(), { ...settings, ...(msg.opts || {}) })).then(() => reply({ ok: true })); return true; }
    if (msg?.type === 'ping') { reply({ ok: true, messages: CX.parser.messageElements().length }); }
    if (msg?.type === 'diag') { reply({ ok: true, text: diag() }); }
  });
})(globalThis);
