/* ChatSave — plain text. */
(function (g) {
  const CX = (g.CX = g.CX || {});
  const plain = CX.model.inlinesToPlain;

  function block(b) {
    switch (b.type) {
      case 'heading': return `${plain(b.inlines).toUpperCase()}\n`;
      case 'paragraph': case 'quote': return `${plain(b.inlines)}\n`;
      case 'list': return b.items.map((it, i) => `${'  '.repeat(it.depth || 0)}${b.ordered && !it.depth ? `${(b.start || 1) + b.items.slice(0, i).filter((x) => !x.depth).length}.` : '•'} ${plain(it.inlines || it)}`).join('\n') + '\n';
      case 'code': return `${b.code.replace(/\n$/, '')}\n`;
      case 'table': return [b.header, ...b.rows].map((r) => r.map(plain).join('\t')).join('\n') + '\n';
      case 'image': return `[image${b.alt ? `: ${b.alt}` : ''}]\n`;
      case 'rule': return '----------\n';
      case 'artifact': return b.code ? `[Artifact: ${b.title}]\n${b.code}\n` : `[Artifact: ${b.title}]\n`;
      default: return '';
    }
  }

  CX.exportText = function (conv, opts = {}) {
    const { includePrompts = true } = opts;
    const out = [conv.title, '='.repeat(Math.min(conv.title.length, 72)), ''];
    for (const m of conv.messages) {
      if (m.role === 'user' && !includePrompts) continue;
      out.push(m.role === 'user' ? 'YOU' : (conv.sourceName || conv.source).toUpperCase(), '');
      out.push(m.blocks.map(block).join('\n'));
      out.push('');
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  };
})(globalThis);
