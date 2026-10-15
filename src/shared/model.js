/* ChatSave — shared data model.
 *
 * Every platform parser produces a Conversation; every exporter consumes one.
 * Keeping this contract small is what lets one exporter serve Claude today
 * and ChatGPT/Gemini later.
 *
 * Conversation = {
 *   source: 'claude',
 *   title: string,
 *   url: string,            // chat URL (used as the stable key for re-publish)
 *   exportedAt: ISO string,
 *   messages: Message[]
 * }
 * Message = { id, role: 'user'|'assistant', blocks: Block[] }
 * Block =
 *   { type:'paragraph', inlines: Inline[] }
 * | { type:'heading', level: 1..6, inlines }
 * | { type:'list', ordered: bool, start?: number, items: Inline[][] } // flat items (nested lists flattened with indent)
 * | { type:'code', lang: string, code: string, filename?: string }
 * | { type:'table', header: Inline[][], rows: Inline[][][] }
 * | { type:'quote', inlines }
 * | { type:'image', src, alt }
 * | { type:'rule' }
 * | { type:'artifact', title: string, kind?: string, code?: string, lang?: string }
 * Inline = { t:'text', v } | { t:'strong'|'em'|'code'|'del', v } | { t:'link', v, href } | { t:'br' }
 */
(function (g) {
  const CX = (g.CX = g.CX || {});

  CX.model = {
    create(source, sourceName, title, url) {
      return { source, sourceName, title: title || 'Untitled chat', url, exportedAt: new Date().toISOString(), messages: [] };
    },
    text(v) { return { t: 'text', v }; },
    inlinesToPlain(inlines) {
      return (inlines || []).map((i) => (i.t === 'br' ? '\n' : i.v || '')).join('');
    },
    blockToPlain(b) {
      switch (b.type) {
        case 'paragraph': case 'heading': case 'quote': return CX.model.inlinesToPlain(b.inlines);
        case 'list': return b.items.map((it) => CX.model.inlinesToPlain(it.inlines || it)).join('\n');
        case 'code': return b.code;
        case 'table': return [b.header, ...b.rows].map((r) => r.map(CX.model.inlinesToPlain).join(' | ')).join('\n');
        case 'image': return b.alt || '';
        case 'artifact': return b.code || b.title || '';
        default: return '';
      }
    },
    wordCount(conv) {
      let n = 0;
      for (const m of conv.messages) for (const b of m.blocks) n += CX.model.blockToPlain(b).split(/\s+/).filter(Boolean).length;
      return n;
    },
    /* Pick a stable filename stem from the title. */
    slug(title, max = 60) {
      return (title || 'chat').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'chat';
    },
    /* First HTML code block in a message (used for "Publish code as site"). */
    firstHtmlCode(message) {
      for (const b of message.blocks) {
        if (b.type === 'code' && /^(html|htm)?$/i.test(b.lang || '') && /<html|<!doctype|<body|<div|<head/i.test(b.code)) return b;
        if (b.type === 'artifact' && b.code && /<html|<!doctype|<body/i.test(b.code)) return { type: 'code', lang: 'html', code: b.code, filename: 'index.html' };
      }
      return null;
    }
  };
})(globalThis);
