/* ChatSave — Notion sync (background module).
 * The user pastes an internal-integration token in the popup and picks a
 * parent page the integration has been shared with. No OAuth server needed.
 * Notion limits: 100 blocks per request, 2000 chars per rich-text item,
 * 100 children per block, table rows need table_width cells.
 */
const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';

const LANGS = new Set(['abap','arduino','bash','basic','c','clojure','coffeescript','c++','c#','css','dart','diff','docker','elixir','elm','erlang','flow','fortran','f#','gherkin','glsl','go','graphql','groovy','haskell','html','java','javascript','json','julia','kotlin','latex','less','lisp','livescript','lua','makefile','markdown','markup','matlab','mermaid','nix','objective-c','ocaml','pascal','perl','php','plain text','powershell','prolog','protobuf','python','r','reason','ruby','rust','sass','scala','scheme','scss','shell','sql','swift','typescript','vb.net','verilog','vhdl','visual basic','webassembly','xml','yaml','java/c/c++/c#']);
const LANG_ALIAS = { js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript', sh: 'shell', zsh: 'shell', py: 'python', rb: 'ruby', yml: 'yaml', md: 'markdown', cpp: 'c++', cs: 'c#', htm: 'html', txt: 'plain text', text: 'plain text', '': 'plain text' };

const chunk = (s, n = 2000) => { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out.length ? out : ['']; };

function richText(inlines) {
  const out = [];
  for (const i of inlines || []) {
    if (i.t === 'br') { out.push({ type: 'text', text: { content: '\n' } }); continue; }
    const ann = { bold: i.t === 'strong', italic: i.t === 'em', strikethrough: i.t === 'del', code: i.t === 'code' };
    for (const part of chunk(i.v || '')) {
      const t = { type: 'text', text: { content: part }, annotations: ann };
      if (i.t === 'link' && /^https?:/i.test(i.href || '')) t.text.link = { url: i.href };
      out.push(t);
    }
  }
  return out.slice(0, 100);
}

function block(b) {
  switch (b.type) {
    case 'paragraph': return [{ type: 'paragraph', paragraph: { rich_text: richText(b.inlines) } }];
    case 'heading': { const k = `heading_${Math.min(3, Math.max(1, b.level))}`; return [{ type: k, [k]: { rich_text: richText(b.inlines) } }]; }
    case 'quote': return [{ type: 'quote', quote: { rich_text: richText(b.inlines) } }];
    case 'list': {
      const k = b.ordered ? 'numbered_list_item' : 'bulleted_list_item';
      return b.items.map((it) => ({ type: k, [k]: { rich_text: richText(it.inlines || it) } }));
    }
    case 'code': {
      const lang = LANGS.has(b.lang) ? b.lang : (LANG_ALIAS[b.lang] || 'plain text');
      return [{ type: 'code', code: { language: lang, rich_text: chunk(b.code).map((c) => ({ type: 'text', text: { content: c } })), caption: b.filename ? [{ type: 'text', text: { content: b.filename } }] : [] } }];
    }
    case 'table': {
      const width = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1);
      const row = (r) => ({ type: 'table_row', table_row: { cells: Array.from({ length: width }, (_, i) => richText(r[i] || [])) } });
      return [{ type: 'table', table: { table_width: width, has_column_header: true, has_row_header: false, children: [row(b.header), ...b.rows.slice(0, 99).map(row)] } }];
    }
    case 'image': return /^https?:/i.test(b.src || '') ? [{ type: 'image', image: { type: 'external', external: { url: b.src } } }] : [];
    case 'rule': return [{ type: 'divider', divider: {} }];
    case 'artifact': return b.code
      ? block({ type: 'code', lang: b.lang || '', code: b.code, filename: b.title })
      : [{ type: 'callout', callout: { icon: { type: 'emoji', emoji: '📎' }, rich_text: [{ type: 'text', text: { content: `Artifact: ${b.title}${b.kind ? ` (${b.kind})` : ''}` } }] } }];
    default: return [];
  }
}

function toBlocks(conv, { includePrompts = true } = {}) {
  const out = [];
  const date = new Date(conv.exportedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const srcName = conv.sourceName || conv.source;
  out.push({ type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: `Exported from ${srcName} · ${date}` }, annotations: { color: 'gray' } }, ...(conv.url ? [{ type: 'text', text: { content: '  ·  Original chat', link: { url: conv.url } } }] : [])] } });
  for (const m of conv.messages) {
    if (m.role === 'user' && !includePrompts) continue;
    out.push({ type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: m.role === 'user' ? 'You' : srcName } }], color: m.role === 'user' ? 'purple' : 'default' } });
    for (const b of m.blocks) out.push(...block(b));
  }
  return out;
}

async function call(token, method, path, body) {
  const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `Notion returned ${r.status}`);
  return j;
}

export const notion = {
  /* Pages the integration can see (for the parent picker). */
  async pages(token) {
    const j = await call(token, 'POST', '/search', { filter: { property: 'object', value: 'page' }, page_size: 50, sort: { direction: 'descending', timestamp: 'last_edited_time' } });
    return j.results.map((p) => {
      const title = Object.values(p.properties || {}).find((v) => v.type === 'title')?.title?.map((t) => t.plain_text).join('') || 'Untitled';
      return { id: p.id, title, url: p.url };
    });
  },
  async verify(token) {
    const j = await call(token, 'GET', '/users/me');
    return { name: j.name || j.bot?.owner?.user?.name || 'Notion integration' };
  },
  async exportConversation(token, parentId, conv, opts) {
    const blocks = toBlocks(conv, opts);
    const page = await call(token, 'POST', '/pages', {
      parent: { page_id: parentId },
      properties: { title: { title: [{ type: 'text', text: { content: conv.title.slice(0, 200) } }] } },
      children: blocks.slice(0, 100)
    });
    for (let i = 100; i < blocks.length; i += 100) {
      await call(token, 'PATCH', `/blocks/${page.id}/children`, { children: blocks.slice(i, i + 100) });
    }
    return { url: page.url, id: page.id, blocks: blocks.length };
  }
};
