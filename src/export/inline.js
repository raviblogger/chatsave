/* ChatSave — inline rendering helpers (Markdown + HTML). */
(function (g) {
  const CX = (g.CX = g.CX || {});

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const escMd = (s) => String(s).replace(/([*_`[\]\\])/g, '\\$1');

  CX.inline = {
    esc,
    toMarkdown(inlines) {
      return (inlines || []).map((i) => {
        switch (i.t) {
          case 'strong': return `**${escMd(i.v)}**`;
          case 'em': return `*${escMd(i.v)}*`;
          case 'del': return `~~${escMd(i.v)}~~`;
          case 'code': return '`' + String(i.v).replace(/`/g, '\\`') + '`';
          case 'link': return `[${escMd(i.v)}](${i.href})`;
          case 'br': return '  \n';
          default: return escMd(i.v || '');
        }
      }).join('');
    },
    toHtml(inlines) {
      return (inlines || []).map((i) => {
        switch (i.t) {
          case 'strong': return `<strong>${esc(i.v)}</strong>`;
          case 'em': return `<em>${esc(i.v)}</em>`;
          case 'del': return `<del>${esc(i.v)}</del>`;
          case 'code': return `<code>${esc(i.v)}</code>`;
          case 'link': return `<a href="${esc(i.href)}" target="_blank" rel="noopener">${esc(i.v)}</a>`;
          case 'br': return '<br>';
          default: return esc(i.v || '');
        }
      }).join('');
    }
  };
})(globalThis);
