(async () => {
  const id = new URLSearchParams(location.search).get('id');
  const data = id && (await chrome.storage.session.get(id))[id];
  const f = document.getElementById('f');
  if (!data) { document.body.textContent = 'Nothing to print — go back to the chat and try again.'; return; }
  document.title = data.title || 'Chat export';
  f.srcdoc = data.html;
  const doPrint = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) { window.print(); } };
  document.getElementById('print').addEventListener('click', doPrint);
  f.addEventListener('load', () => setTimeout(doPrint, 400), { once: true });
  chrome.storage.session.remove(id);
})();
