const $ = (s) => document.querySelector(s);
const DEFAULTS = { includePrompts: true, theme: 'light', filenamePattern: '{title} - {date}', author: '' };

function toast(text) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2500);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  /* settings */
  const s = await chrome.storage.sync.get(DEFAULTS);
  $('#includePrompts').checked = s.includePrompts;
  $('#theme').value = s.theme;
  $('#filenamePattern').value = s.filenamePattern;
  $('#author').value = s.author;
  for (const id of ['includePrompts', 'theme', 'filenamePattern', 'author']) {
    $(`#${id}`).addEventListener('change', (e) => chrome.storage.sync.set({ [id]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  }

  /* page state */
  const tab = await activeTab();
  /* Supported = whatever the manifest injects into; one source of truth. */
  const patterns = chrome.runtime.getManifest().content_scripts[0].matches.map((m) => new RegExp('^' + m.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')));
  const onClaude = patterns.some((re) => re.test(tab?.url || ''));
  let ping = null;
  if (onClaude) { try { ping = await chrome.tabs.sendMessage(tab.id, { type: 'ping' }); } catch (_) {} }
  const state = $('#state');
  if (!onClaude) { state.textContent = 'Open a chat on ChatGPT, Claude, Gemini…'; state.className = 'state off'; }
  else if (!ping) { state.textContent = 'Reload the chat tab'; state.className = 'state off'; }
  else if (!ping.messages) { state.textContent = 'No messages yet'; state.className = 'state off'; }
  else { state.textContent = `${ping.messages} messages found`; state.className = 'state ok'; }
  const canExport = !!(ping && ping.messages);
  const dg = $('#diag'); dg.hidden = !(onClaude && ping);
  dg.addEventListener('click', async () => { const r = await chrome.tabs.sendMessage(tab.id, { type: 'diag' }); await navigator.clipboard.writeText(r?.text || ''); toast('Diagnostic copied — paste it to Claude'); });
  document.querySelectorAll('#export .grid button').forEach((b) => {
    b.disabled = !canExport;
    b.addEventListener('click', async () => {
      b.disabled = true;
      await chrome.tabs.sendMessage(tab.id, { type: 'export', id: b.dataset.id, opts: { includePrompts: $('#includePrompts').checked } });
      b.disabled = false;
      if (b.dataset.id !== 'pdf') window.close();
    });
  });

  /* Supported sites grid (icons are the sites' own favicons) */
  const SITES = [['ChatGPT','chatgpt.com'],['Claude','claude.ai'],['Gemini','gemini.google.com'],['Grok','grok.com'],['DeepSeek','chat.deepseek.com'],['Perplexity','perplexity.ai'],['Copilot','copilot.microsoft.com'],['M365 Copilot','m365.cloud.microsoft'],['GitHub Copilot','github.com'],['NotebookLM','notebooklm.google.com'],['AI Studio','aistudio.google.com'],['Kimi','kimi.com'],['Qwen','chat.qwen.ai'],['Doubao','doubao.com'],['Yuanbao','yuanbao.tencent.com']];
  $('#sitesGrid').innerHTML = SITES.map(([n, h]) => `<a href="https://${h}" target="_blank" rel="noopener" title="${n}"><img src="https://www.google.com/s2/favicons?domain=${h}&sz=64" alt="" width="20" height="20"><span>${n}</span></a>`).join('');

  /* Notion */
  await refreshNotion();
  $('#notionConnect').addEventListener('click', async () => {
    const token = $('#notionToken').value.trim();
    if (!token) return toast('Paste your Notion integration token');
    $('#notionConnect').disabled = true;
    const r = await chrome.runtime.sendMessage({ type: 'notion.connect', token });
    $('#notionConnect').disabled = false;
    if (!r?.ok) return toast(r?.error || 'Notion rejected the token');
    if (!r.pages.length) toast('Connected, but no pages are shared with the integration yet');
    await refreshNotion();
  });
  $('#notionDisconnect').addEventListener('click', async () => { await chrome.runtime.sendMessage({ type: 'notion.disconnect' }); await refreshNotion(); });
  $('#notionParent').addEventListener('change', async (e) => {
    const o = e.target.selectedOptions[0];
    await chrome.runtime.sendMessage({ type: 'notion.parent', parent: o.value ? { id: o.value, title: o.textContent } : null });
  });

  /* Fylo */
  await refreshFylo();
  $('#fyloBtn').addEventListener('click', async () => {
    const st = await chrome.runtime.sendMessage({ type: 'fylo.status' });
    $('#fyloBtn').disabled = true;
    const r = await chrome.runtime.sendMessage({ type: st.connected ? 'fylo.disconnect' : 'fylo.connect' });
    $('#fyloBtn').disabled = false;
    if (!r?.ok) toast(r?.error || 'Something went wrong');
    await refreshFylo();
  });
}

async function refreshNotion() {
  const st = await chrome.runtime.sendMessage({ type: 'notion.status' });
  $('#notionOff').hidden = !!st?.connected;
  $('#notionOn').hidden = !st?.connected;
  if (!st?.connected) return;
  $('#notionWho').textContent = `Connected · ${st.name || 'integration'}`;
  const sel = $('#notionParent');
  sel.innerHTML = '<option value="">Loading pages…</option>';
  const r = await chrome.runtime.sendMessage({ type: 'notion.pages' });
  const pages = r?.pages || [];
  sel.innerHTML = '<option value="">Choose a page…</option>' + pages.map((p) => `<option value="${p.id}">${p.title.replace(/</g, '&lt;')}</option>`).join('');
  if (st.parent?.id) sel.value = st.parent.id;
  if (!pages.length) sel.innerHTML = '<option value="">No pages shared with the integration</option>';
}

async function refreshFylo() {
  const st = await chrome.runtime.sendMessage({ type: 'fylo.status' });
  const btn = $('#fyloBtn'), who = $('#fyloWho'), hint = $('#fyloHint');
  if (st?.connected) {
    btn.textContent = 'Disconnect'; btn.className = '';
    who.textContent = st.email ? `Connected · ${st.email}` : 'Connected';
    hint.textContent = 'Use "Publish as web page" or "Publish code as a live site" from any Export menu in the chat.';
    const r = await chrome.runtime.sendMessage({ type: 'fylo.sites' });
    const list = Object.values(r?.sites || {}).sort((a, b) => b.at - a.at).slice(0, 5);
    $('#sites').innerHTML = list.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener" title="${s.title}">${s.url.replace(/^https?:\/\//, '')}</a><time>${new Date(s.at).toLocaleDateString()}</time></li>`).join('');
  } else {
    btn.textContent = 'Connect Fylo'; btn.className = 'primary';
    who.textContent = 'Not connected';
    hint.textContent = 'Turn a chat, or the code in a reply, into a live page on Fylo. Free account, one click.';
    $('#sites').innerHTML = '';
  }
}

init();
