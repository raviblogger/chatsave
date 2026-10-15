/* ChatSave — self-contained HTML page.
 * Used three ways: "Save as HTML", the print source for PDF, and the file
 * published to Fylo. One CSS file, no scripts, no external requests except
 * the images the chat already contained.
 */
(function (g) {
  const CX = (g.CX = g.CX || {});
  const { esc, toHtml: h } = CX.inline;

  const CSS = `
:root{--bg:#F7F7F8;--surface:#fff;--tint:#EFEFF4;--fg:#1A1A1E;--muted:#5C5C66;--border:#E3E3E8;--accent:#4F46E5;--code-bg:#1E1E24;--code-head:#2A2A32;--code-fg:#E6E6EA;--code-muted:#A0A0AA}
:root[data-theme="dark"]{--bg:#141416;--surface:#1C1C1F;--tint:#232327;--fg:#ECECEE;--muted:#A3A3AB;--border:#2C2C31;--code-bg:#0F0F11;--code-head:#17171A}
@media (prefers-color-scheme:dark){:root[data-theme="auto"]{--bg:#141416;--surface:#1C1C1F;--tint:#232327;--fg:#ECECEE;--muted:#A3A3AB;--border:#2C2C31;--code-bg:#0F0F11;--code-head:#17171A}}
*{box-sizing:border-box}html{scroll-padding-top:16px}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
header.top{border-bottom:1px solid var(--border);background:var(--surface)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:56px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none;font-weight:500;font-size:14px}
.brand .dot{width:28px;height:28px;border-radius:8px;background:var(--accent);display:inline-flex;align-items:center;justify-content:center}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--fg);font:500 14px inherit;display:inline-flex;align-items:center;gap:8px;cursor:pointer;text-decoration:none}
.btn:hover{background:var(--tint)}
.head{padding:44px 0 20px}
.meta{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:13px;color:var(--muted);margin-bottom:14px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--fg)}
h1.title{margin:0 0 8px;font-size:clamp(26px,4vw,36px);line-height:1.2;font-weight:600;letter-spacing:-.01em}
.body{display:flex;flex-wrap:wrap;gap:48px;align-items:flex-start;padding:8px 0 48px}
aside{flex:1 1 200px;max-width:240px;font-size:14px}
aside h2{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
aside ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
aside a{display:block;padding:8px 10px;border-radius:6px;text-decoration:none;color:var(--muted)}
aside a:hover{background:var(--tint);color:var(--fg)}
aside .stats{margin-top:24px;padding-top:16px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px;color:var(--muted);font-size:13px}
aside .stats div{display:flex;justify-content:space-between}aside .stats b{font-weight:500;color:var(--fg)}
main{flex:999 1 560px;min-width:0;max-width:760px;display:flex;flex-direction:column;gap:36px}
.turn{display:flex;gap:16px}
.avatar{flex:none;width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:600}
.turn.user .avatar{background:var(--accent);color:#fff}
.printfoot{display:none}
.turn.assistant .avatar{background:var(--surface);border:1px solid var(--border);color:var(--fg)}
.turn>.content{flex:1;min-width:0}
.turn.user>.content{padding:16px 20px;border-radius:12px;background:var(--tint);border:1px solid var(--border)}
.role{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.content p{margin:0 0 14px}.content p:last-child{margin-bottom:0}
.content h2,.content h3,.content h4{margin:22px 0 10px;line-height:1.3}.content h2{font-size:22px}.content h3{font-size:18px}.content h4{font-size:16px}
.content ul,.content ol{margin:0 0 14px;padding-left:22px}.content li{margin:4px 0}
.content blockquote{margin:0 0 14px;padding:10px 16px;border-left:3px solid var(--accent);background:var(--tint);border-radius:0 8px 8px 0}
.content code{font:.92em/1.5 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--tint);padding:1px 5px;border-radius:4px}
.codeblock{border-radius:10px;overflow:hidden;border:1px solid var(--border);margin:0 0 14px}
.codeblock .bar{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;background:var(--code-head);color:var(--code-muted);font:12px "JetBrains Mono",ui-monospace,monospace}
.codeblock pre{margin:0;padding:16px;overflow-x:auto;background:var(--code-bg);color:var(--code-fg);font:13.5px/1.6 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.codeblock pre code{background:none;padding:0;font:inherit;color:inherit}
.tablewrap{overflow-x:auto;border:1px solid var(--border);border-radius:10px;margin:0 0 14px}
table{border-collapse:collapse;width:100%;font-size:15px}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--border);vertical-align:top}
thead tr{background:var(--tint)}tbody tr:last-child td{border-bottom:0}
.content img{max-width:100%;height:auto;border-radius:8px;display:block;margin:0 0 14px}
hr{border:0;border-top:1px solid var(--border);margin:18px 0}
.artifact{display:flex;gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);margin:0 0 14px;font-size:15px}
.artifact small{display:block;color:var(--muted);font-size:12px}
footer{border-top:1px solid var(--border);background:var(--surface);margin-top:auto}
footer .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:18px 24px;font-size:13px;color:var(--muted)}
.badge{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:999px;border:1px solid var(--border);background:var(--bg);color:var(--fg);text-decoration:none;font-weight:500}
.badge .dot{width:20px;height:20px;border-radius:6px;background:var(--accent);display:inline-flex;align-items:center;justify-content:center}
@media print{
  :root{--bg:#fff;--surface:#fff;--tint:#F3F3F6;--border:#DDD;--code-bg:#F6F6F8;--code-head:#ECECF0;--code-fg:#1A1A1E;--code-muted:#55555F}
  @page{margin:18mm 16mm}
  header.top,.actions,aside,footer .badge{display:none!important}
  body{font-size:12pt}.head{padding:0 0 12pt}
  /* Long turns must flow across pages; only small units avoid breaks. */
  .body,main{display:block}
  .turn{display:block;break-inside:auto;margin:0 0 18pt}
  .turn.user>.content{padding:10pt 12pt}
  .avatar{display:none}
  .role{break-after:avoid}
  .codeblock,.tablewrap,blockquote,tr,.artifact{break-inside:avoid}
  .codeblock .bar{break-after:avoid}
  h2,h3,h4{break-after:avoid}
  .head{break-after:avoid}
  .codeblock pre{white-space:pre-wrap;word-break:break-word}
  a{color:inherit;text-decoration:none}
  .printfoot{display:block;position:fixed;bottom:0;left:0;right:0;font-size:9pt;color:#777;border-top:1px solid #ddd;padding-top:4pt}
  body{padding-bottom:28pt}
}`;

  const ICON_SPARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>';
  const ICON_USER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const ICON_LINK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  const ICON_ARROW = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function block(b) {
    switch (b.type) {
      case 'heading': { const l = Math.min(4, Math.max(2, b.level + 1)); return `<h${l}>${h(b.inlines)}</h${l}>`; }
      case 'paragraph': return `<p>${h(b.inlines)}</p>`;
      case 'quote': return `<blockquote>${h(b.inlines)}</blockquote>`;
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        const start = b.ordered && b.start > 1 ? ` start="${b.start}"` : '';
        return `<${tag}${start}>${b.items.map((it) => `<li${it.depth ? ` style="margin-left:${it.depth * 18}px"` : ''}>${h(it.inlines || it)}</li>`).join('')}</${tag}>`;
      }
      case 'code':
        return `<div class="codeblock"><div class="bar"><span>${esc(b.filename || b.lang || 'code')}</span></div><pre><code>${esc(b.code.replace(/\n$/, ''))}</code></pre></div>`;
      case 'table':
        return `<div class="tablewrap"><table><thead><tr>${b.header.map((c) => `<th>${h(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'image': return `<img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy">`;
      case 'rule': return '<hr>';
      case 'artifact':
        return b.code
          ? `<div class="codeblock"><div class="bar"><span>${esc(b.title || 'Artifact')}</span><span>${esc(b.lang || '')}</span></div><pre><code>${esc(b.code)}</code></pre></div>`
          : `<div class="artifact">${ICON_SPARK}<div>${esc(b.title || 'Artifact')}<small>${esc(b.kind || 'Artifact from the original chat')}</small></div></div>`;
      default: return '';
    }
  }

  function summary(conv) {
    const first = conv.messages.find((m) => m.role === 'assistant');
    if (!first) return '';
    const p = first.blocks.find((b) => b.type === 'paragraph');
    const t = p ? CX.model.inlinesToPlain(p.inlines) : '';
    return t.length > 220 ? t.slice(0, 217).replace(/\s+\S*$/, '') + '…' : t;
  }

  /* opts: includePrompts, theme ('light'|'dark'|'auto'), noindex, author, publicUrl, badge ({href,label}) */
  CX.exportHtml = function (conv, opts = {}) {
    const { includePrompts = true, theme = 'light', noindex = true, author = '', publicUrl = '', badge = null, chrome = true } = opts;
    const msgs = conv.messages.filter((m) => includePrompts || m.role !== 'user');
    const prompts = conv.messages.filter((m) => m.role === 'user');
    const date = new Date(conv.exportedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const words = CX.model.wordCount(conv);
    const srcName = conv.sourceName || conv.source;

    const toc = prompts.length
      ? `<aside aria-label="On this page"><h2>On this page</h2><ol>${prompts.map((m, i) => `<li><a href="#${m.id}">${i + 1}. ${esc(CX.model.blockToPlain(m.blocks[0] || { type: 'paragraph', inlines: [] }).slice(0, 60))}</a></li>`).join('')}</ol>
<div class="stats"><div><span>Reading time</span><b>${Math.max(1, Math.round(words / 220))} min</b></div><div><span>Words</span><b>${words.toLocaleString()}</b></div><div><span>Messages</span><b>${conv.messages.length}</b></div></div></aside>`
      : '';

    const turns = msgs.map((m) => {
      const user = m.role === 'user';
      return `<section class="turn ${m.role}" id="${m.id}"><span class="avatar" aria-hidden="true">${user ? (author ? esc(author.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()) : ICON_USER) : ICON_SPARK}</span><div class="content"><div class="role">${user ? 'You' : srcName}</div>${m.blocks.map(block).join('\n')}</div></section>`;
    }).join('\n');

    const badgeHtml = badge ? `<a class="badge" href="${esc(badge.href)}" rel="noopener"><span class="dot">${ICON_ARROW}</span>${esc(badge.label)}</a>` : '';
    const host = publicUrl ? new URL(publicUrl).host : '';

    return `<!doctype html>
<html lang="en" data-theme="${esc(theme)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}
<title>${esc(conv.title)}</title>
<meta name="description" content="${esc(summary(conv))}">
<meta property="og:title" content="${esc(conv.title)}">
<meta property="og:description" content="${esc(summary(conv))}">
<style>${CSS}</style>
</head>
<body>
${chrome ? `<header class="top"><div class="wrap">
  <a class="brand" href="#top"><span class="dot"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span><span>${esc(host || 'Shared chat')}</span></a>
  <nav class="actions" aria-label="Share actions">
    <button type="button" class="btn" data-action="copy-link">${ICON_LINK} Copy link</button>
    <button type="button" class="btn" data-action="print">PDF</button>
    ${conv.url ? `<a class="btn" href="${esc(conv.url)}" target="_blank" rel="noopener">Open in ${esc(srcName)}</a>` : ''}
  </nav>
</div></header>` : ''}
<div class="wrap head" id="top">
  <div class="meta"><span class="pill">${ICON_SPARK} Exported from ${esc(srcName)}</span><span>${conv.messages.length} messages</span><span>·</span><span>${esc(date)}</span></div>
  <h1 class="title">${esc(conv.title)}</h1>
  <p style="margin:0;color:var(--muted);max-width:720px">${esc(summary(conv))}</p>
</div>
<div class="wrap body">${toc}<main>${turns}</main></div>
<div class="printfoot">${esc(conv.title)}${conv.url ? ` · ${esc(conv.url)}` : ''} · exported ${esc(date)}</div>
<footer><div class="wrap"><span>${author ? `Shared by ${esc(author)}` : 'Shared chat'}${noindex ? ' · Not indexed by search engines' : ''}</span>${badgeHtml}</div></footer>
<script>
(function(){
  var p=document.querySelector('[data-action="print"]');if(p)p.addEventListener('click',function(){window.print();});
  var c=document.querySelector('[data-action="copy-link"]');if(c)c.addEventListener('click',function(){
    var u=location.href.split('#')[0];var done=function(){c.textContent='Copied';setTimeout(function(){c.innerHTML=${JSON.stringify(ICON_LINK + ' Copy link')};},1500);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(done,function(){prompt('Copy this link',u);});}else{prompt('Copy this link',u);}
  });
})();
</script>
</body>
</html>`;
  };
})(globalThis);
