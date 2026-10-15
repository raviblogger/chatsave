/* ChatSave — parser (DOM → Conversation), driven by CX.selectors.current(). */
(function (g) {
  const CX = (g.CX = g.CX || {});
  const S = CX.selectors;
  const SEL = S.current();
  if (!SEL) return;

  const SKIP_TAGS = new Set(['BUTTON', 'SVG', 'STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE']);
  const clean = (s) => s.replace(/\u00a0/g, ' ');

  /* ---------- inline ---------- */
  function inlines(node, out = [], ctx = {}) {
    for (const n of node.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        const v = clean(n.nodeValue);
        if (!v) continue;
        if (ctx.code) out.push({ t: 'code', v });
        else if (ctx.strong) out.push({ t: 'strong', v });
        else if (ctx.em) out.push({ t: 'em', v });
        else if (ctx.del) out.push({ t: 'del', v });
        else if (ctx.href) out.push({ t: 'link', v, href: ctx.href });
        else out.push({ t: 'text', v });
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(n.tagName)) continue;
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') continue;
      switch (n.tagName) {
        case 'BR': out.push({ t: 'br' }); break;
        case 'STRONG': case 'B': inlines(n, out, { ...ctx, strong: true }); break;
        case 'EM': case 'I': inlines(n, out, { ...ctx, em: true }); break;
        case 'DEL': case 'S': inlines(n, out, { ...ctx, del: true }); break;
        case 'CODE': out.push({ t: 'code', v: clean(n.textContent) }); break;
        case 'A': inlines(n, out, { ...ctx, href: n.getAttribute('href') || '' }); break;
        case 'IMG': out.push({ t: 'text', v: n.alt ? `[${n.alt}]` : '' }); break;
        default: inlines(n, out, ctx);
      }
    }
    /* merge adjacent plain text runs */
    return out.reduce((acc, i) => {
      const p = acc[acc.length - 1];
      if (p && p.t === 'text' && i.t === 'text') p.v += i.v; else acc.push(i);
      return acc;
    }, []);
  }

  /* ---------- blocks ---------- */
  function codeBlock(pre) {
    const code = pre.querySelector('code') || pre;
    let lang = '';
    const cls = (code.className || '') + ' ' + (pre.className || '');
    const m = cls.match(/language-([\w+#-]+)/i);
    if (m) lang = m[1].toLowerCase();
    if (!lang) {
      /* Claude renders a small label above the code; it's a sibling/ancestor of <pre> */
      const wrap = pre.closest('div');
      const label = wrap && S.q(SEL.codeLangLabel, wrap);
      if (label && label.textContent.trim().length < 20) lang = label.textContent.trim().toLowerCase();
    }
    return { type: 'code', lang, code: code.textContent.replace(/\n$/, '') };
  }

  function listBlock(listEl, depth = 0, acc = null) {
    const block = acc || { type: 'list', ordered: listEl.tagName === 'OL', start: Number(listEl.getAttribute('start')) || 1, items: [] };
    for (const li of listEl.children) {
      if (li.tagName !== 'LI') continue;
      const own = li.cloneNode(true);
      own.querySelectorAll('ul,ol').forEach((x) => x.remove());
      block.items.push({ depth, inlines: inlines(own) });
      li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => listBlock(sub, depth + 1, block));
    }
    return block;
  }

  function tableBlock(tbl) {
    const rows = Array.from(tbl.querySelectorAll('tr'));
    if (!rows.length) return null;
    const cells = (tr) => Array.from(tr.children).filter((c) => /^T[HD]$/.test(c.tagName)).map((c) => inlines(c));
    const hasThead = !!tbl.querySelector('thead tr');
    const header = cells(rows[0]);
    const body = rows.slice(1).map(cells);
    return { type: 'table', header: hasThead || rows[0].querySelector('th') ? header : header.map(() => []), rows: hasThead || rows[0].querySelector('th') ? body : [header, ...body] };
  }

  function artifactBlock(el) {
    const raw = el.innerText != null ? el.innerText : Array.from(el.querySelectorAll('*')).filter((x) => !x.children.length).map((x) => x.textContent).join('\n');
    const text = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    return { type: 'artifact', title: text[0] || 'Artifact', kind: text[1] || '' };
  }

  function blocks(root, out = []) {
    for (const n of root.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        const v = clean(n.nodeValue).trim();
        if (v) out.push({ type: 'paragraph', inlines: [{ t: 'text', v }] });
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(n.tagName)) continue;
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') continue;
      if (S.matches(n, SEL.skip)) continue;
      if (S.matches(n, SEL.codeLangLabel) && n.parentElement && n.parentElement.querySelector('pre') && !n.querySelector('pre')) continue; // language label above a code block
      if (SEL.artifactCard.length && S.matches(n, SEL.artifactCard)) { out.push(artifactBlock(n)); continue; }
      const tag = n.tagName;
      if (/^H[1-6]$/.test(tag)) out.push({ type: 'heading', level: Number(tag[1]), inlines: inlines(n) });
      else if (tag === 'P') { const il = inlines(n); if (il.length) out.push({ type: 'paragraph', inlines: il }); }
      else if (tag === 'PRE') out.push(codeBlock(n));
      else if (tag === 'UL' || tag === 'OL') out.push(listBlock(n));
      else if (tag === 'TABLE') { const t = tableBlock(n); if (t) out.push(t); }
      else if (tag === 'BLOCKQUOTE') out.push({ type: 'quote', inlines: inlines(n) });
      else if (tag === 'IMG') out.push({ type: 'image', src: n.currentSrc || n.src, alt: n.alt || '' });
      else if (tag === 'HR') out.push({ type: 'rule' });
      else if (n.querySelector('pre,table,ul,ol,h1,h2,h3,h4,h5,h6,p,blockquote,img')) blocks(n, out); // wrapper div
      else { const il = inlines(n); if (il.length && il.some((i) => (i.v || '').trim())) out.push({ type: 'paragraph', inlines: il }); }
    }
    return out;
  }

  /* Claude renders some chips as the same text stacked several times
     ("Used 5 toolsUsed 5 toolsUsed 5 tools"). Collapse "sss" → "s" and drop
     consecutive duplicate paragraphs. Belt-and-braces behind the skip rules. */
  function collapseRepeat(t) {
    const m = t.match(/^(.{3,}?)\1{1,}$/s);
    return m ? m[1] : t;
  }
  function tidy(blocksIn) {
    const out = [];
    for (const b of blocksIn) {
      if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote') {
        const plain = CX.model.inlinesToPlain(b.inlines);
        const c = collapseRepeat(plain);
        if (c !== plain) b.inlines = [{ t: 'text', v: c }];
        if (!c.trim()) continue;
        const prev = out[out.length - 1];
        if (prev && prev.type === b.type && CX.model.inlinesToPlain(prev.inlines) === c) continue;
      }
      out.push(b);
    }
    return out;
  }

  /* ---------- messages ---------- */
  function messageElements() {
    const users = S.qa(SEL.userMessage).map((el) => ({ el, role: 'user' }));
    const bots = S.qa(SEL.assistantMessage).map((el) => ({ el, role: 'assistant' }));
    /* Scope assistant matches to the conversation column: the project-name chip
       and sidebar items can match loose "font-claude" selectors. */
    const main = users[0]?.el.closest('main');
    const scoped = bots.filter((b) =>
      (!main || main.contains(b.el)) &&
      !b.el.closest('aside, nav, header, [role="navigation"], [role="complementary"]') &&
      (S.q(SEL.contentRoot, b.el) || (b.el.textContent || '').trim().length >= 20));
    /* dedupe nested matches: keep outermost; drop empty */
    const all = [...users, ...scoped]
      .filter((a, _, arr) => !arr.some((b) => b !== a && b.el !== a.el && b.el.contains(a.el)))
      .filter((a) => (a.el.textContent || '').trim().length > 0);
    return all.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }

  function parseMessage(el, role, idx) {
    let roots = [];
    if (role === 'assistant') {
      const skipSel = SEL.skip.join(',');
      roots = S.qa(SEL.contentRoot, el)
        .filter((r) => { const k = r.closest(skipSel); return !(k && el.contains(k)); }) // not inside a tool/thinking chip
        .filter((r, _, arr) => !arr.some((o) => o !== r && o.contains(r)));            // outermost only
    }
    const out = [];
    if (roots.length) for (const r of roots) blocks(r, out); else blocks(el, out);
    return { id: `m${idx + 1}`, role, blocks: tidy(out) };
  }

  function title() {
    const el = S.q(SEL.title);
    const t = (el && el.textContent.trim()) || document.title.replace(new RegExp(`\\s*[-–|·]\\s*${SEL.name}.*$`, 'i'), '').trim();
    return t || `${SEL.name} chat`;
  }

  function scrollParent(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 10) return n;
    }
    return document.scrollingElement || document.documentElement;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  CX.parser = {
    /* Claude lazy-loads older turns. Scroll to the top until the count stops
       growing, then restore the scroll position. onProgress(count) is optional. */
    async loadAll(onProgress) {
      const els = messageElements();
      const first = els[0];
      if (!first) return 0;
      const sc = scrollParent(first.el);
      /* Anchor on the message the user is looking at, so we can put it back
         exactly where it was even after older turns are inserted above. */
      const anchor = els.find((m) => m.el.getBoundingClientRect().bottom > 80) || first;
      const anchorTop = anchor.el.getBoundingClientRect().top;
      /* Hide the jumping behind a quiet overlay. */
      const veil = document.createElement('div');
      veil.className = 'cx-veil';
      veil.innerHTML = '<div class="cx-veil-box">Loading full chat…</div>';
      document.body.appendChild(veil);
      try {
        let last = els.length, stable = 0, n = last;
        for (let i = 0; i < 80 && stable < 3; i++) {
          sc.scrollTop = 0;
          sc.dispatchEvent(new Event('scroll', { bubbles: true }));
          await sleep(650);
          n = messageElements().length;
          if (onProgress) onProgress(n);
          veil.firstChild.textContent = `Loading full chat… ${n} messages`;
          stable = n === last ? stable + 1 : 0;
          last = n;
        }
        /* Put the anchor back where it was. */
        sc.scrollTop += anchor.el.getBoundingClientRect().top - anchorTop;
        await sleep(50);
        sc.scrollTop += anchor.el.getBoundingClientRect().top - anchorTop;
        return n;
      } finally {
        veil.remove();
      }
    },
    conversation() {
      const conv = CX.model.create(SEL.key, SEL.name, title(), location.origin + location.pathname);
      messageElements().forEach(({ el, role }, i) => conv.messages.push(parseMessage(el, role, i)));
      return conv;
    },
    /* The assistant message that owns a given action-row button, with the prompt before it. */
    single(messageEl) {
      const els = messageElements();
      const i = els.findIndex((x) => x.el === messageEl || x.el.contains(messageEl) || messageEl.contains(x.el));
      const conv = CX.model.create(SEL.key, SEL.name, title(), location.origin + location.pathname);
      if (i < 0) return conv;
      const pick = [];
      if (i > 0 && els[i - 1].role === 'user') pick.push(els[i - 1]);
      pick.push(els[i]);
      pick.forEach((x, k) => conv.messages.push(parseMessage(x.el, x.role, k)));
      return conv;
    },
    messageElements
  };
})(globalThis);
