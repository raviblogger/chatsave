/* ChatSave — Markdown (GFM). */
(function (g) {
  const CX = (g.CX = g.CX || {});
  const md = CX.inline.toMarkdown;

  function block(b) {
    switch (b.type) {
      case 'heading': return `${'#'.repeat(Math.min(6, b.level + 1))} ${md(b.inlines)}\n`;
      case 'paragraph': return `${md(b.inlines)}\n`;
      case 'quote': return md(b.inlines).split('\n').map((l) => `> ${l}`).join('\n') + '\n';
      case 'list': {
        const start = b.start || 1;
        return b.items.map((it, i) => {
          const indent = '  '.repeat(it.depth || 0);
          const marker = b.ordered && !it.depth ? `${start + b.items.slice(0, i).filter((x) => !x.depth).length}.` : '-';
          return `${indent}${marker} ${md(it.inlines || it)}`;
        }).join('\n') + '\n';
      }
      case 'code': {
        const fence = b.code.includes('```') ? '````' : '```';
        return `${fence}${b.lang || ''}\n${b.code.replace(/\n$/, '')}\n${fence}\n`;
      }
      case 'table': {
        const row = (r) => `| ${r.map((c) => md(c).replace(/\|/g, '\\|')).join(' | ')} |`;
        const sep = `| ${b.header.map(() => '---').join(' | ')} |`;
        return [row(b.header), sep, ...b.rows.map(row)].join('\n') + '\n';
      }
      case 'image': return `![${b.alt || ''}](${b.src})\n`;
      case 'rule': return '---\n';
      case 'artifact':
        return b.code
          ? `**Artifact: ${b.title}**\n\n\`\`\`${b.lang || ''}\n${b.code}\n\`\`\`\n`
          : `> **Artifact:** ${b.title}${b.kind ? ` (${b.kind})` : ''}\n`;
      default: return '';
    }
  }

  CX.exportMarkdown = function (conv, opts = {}) {
    const { includePrompts = true, includeMeta = true } = opts;
    const out = [`# ${conv.title}\n`];
    if (includeMeta) {
      const d = new Date(conv.exportedAt);
      out.push(`> Exported from ${conv.sourceName || conv.source} on ${d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}${conv.url ? ` · [Original chat](${conv.url})` : ''}\n`);
    }
    for (const m of conv.messages) {
      if (m.role === 'user' && !includePrompts) continue;
      out.push(`\n## ${m.role === 'user' ? 'You' : (conv.sourceName || conv.source)}\n`);
      out.push(m.blocks.map(block).join('\n'));
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };
})(globalThis);
