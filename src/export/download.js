/* ChatSave — save a string as a file, entirely in the browser. */
(function (g) {
  const CX = (g.CX = g.CX || {});

  const MIME = {
    md: 'text/markdown;charset=utf-8',
    txt: 'text/plain;charset=utf-8',
    json: 'application/json;charset=utf-8',
    html: 'text/html;charset=utf-8',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  CX.download = async function (filename, content) {
    const ext = filename.split('.').pop().toLowerCase();
    const blob = content instanceof Blob ? content : new Blob([content], { type: MIME[ext] || 'application/octet-stream' });
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return true;
    } catch (e) {
      /* Some pages block anchor downloads; hand it to the background worker. */
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
      const r = await chrome.runtime.sendMessage({ type: 'download', filename, dataUrl });
      if (!r?.ok) throw new Error(r?.error || 'Download failed');
      return true;
    }
  };

  /* Filename pattern: {title} {date} {time} {source} */
  CX.filename = function (conv, ext, pattern = '{title} - {date}') {
    const d = new Date(conv.exportedAt);
    const pad = (n) => String(n).padStart(2, '0');
    const map = {
      title: CX.model.slug(conv.title),
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}${pad(d.getMinutes())}`,
      source: conv.source
    };
    return pattern.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? '').replace(/[\\/:*?"<>|]+/g, '').trim() + '.' + ext;
  };
})(globalThis);
