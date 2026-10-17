/* ChatSave — injected UI. */
(function (g) {
  const CX = (g.CX = g.CX || {});

  const ICON = {
    export: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    md: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15V9l2.5 3L12 9v6M16 9v6m0 0l-2-2m2 2l2-2"/></svg>',
    txt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    doc: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13l1.5 5 2-4 2 4 1.5-5"/></svg>',
    html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    pdf: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    json: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></svg>',
    notion: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8v8M8 8l8 8M16 8v8" stroke-linecap="round"/></svg>',
    rocket: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4M14 4l6 6-8 8-6-6z"/><path d="M4.5 19.5c1.5-1.5 3-1.5 3-1.5s0 1.5-1.5 3L3 22z"/></svg>'
  };

  const ITEMS = [
    { id: 'md', label: 'Save as Markdown', icon: ICON.md },
    { id: 'copy-md', label: 'Copy as Markdown', icon: ICON.copy },
    { id: 'docx', label: 'Save as Word (.docx)', icon: ICON.doc },
    { id: 'pdf', label: 'Save as PDF', icon: ICON.pdf },
    { id: 'html', label: 'Save as web page (HTML)', icon: ICON.html },
    { id: 'txt', label: 'Save as text', icon: ICON.txt },
    { id: 'json', label: 'Save as JSON', icon: ICON.json },
    { sep: true },
    { id: 'notion', label: 'Sync to Notion', icon: ICON.notion },
    { id: 'publish-page', label: 'Publish as web page', icon: ICON.globe, hint: 'Fylo' },
    { id: 'publish-code', label: 'Publish code as a live site', icon: ICON.rocket, hint: 'Fylo', when: 'hasCode' }
  ];

  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
  document.addEventListener('click', (e) => { if (openMenu && !openMenu.contains(e.target) && !e.target.closest('.cx-btn')) closeMenu(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  CX.ui = {
    ICON,
    /* Small icon button that matches Claude's action row. */
    iconButton(label, scope) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cx-btn'; b.dataset.cxScope = scope;
      b.setAttribute('aria-label', label); b.title = label; b.innerHTML = ICON.export;
      return b;
    },
    menu(anchor, ctx, onPick) {
      closeMenu();
      const m = document.createElement('div');
      m.className = 'cx-menu'; m.setAttribute('role', 'menu');
      m.innerHTML = `<div class="cx-menu-head">${ctx.scope === 'chat' ? 'Export whole chat' : 'Export this reply'}${ctx.site ? ` · ${ctx.site}` : ''}</div>` +
        ITEMS.filter((it) => !it.when || ctx[it.when]).map((it) => it.sep
          ? '<div class="cx-sep"></div>'
          : `<button type="button" role="menuitem" class="cx-item" data-id="${it.id}">${it.icon}<span>${it.label}</span>${it.hint ? `<em>${it.hint}</em>` : ''}</button>`).join('') +
        `<div class="cx-menu-foot"><label><input type="checkbox" data-opt="includePrompts" ${ctx.includePrompts ? 'checked' : ''}> Include my prompts</label></div>`;
      m.addEventListener('click', (e) => {
        const it = e.target.closest('.cx-item');
        if (!it) return;
        const includePrompts = m.querySelector('[data-opt="includePrompts"]').checked;
        closeMenu();
        onPick(it.dataset.id, { includePrompts });
      });
      document.body.appendChild(m);
      const r = anchor.getBoundingClientRect();
      const mw = 280, mh = m.offsetHeight || 380;
      let left = Math.min(r.left, window.innerWidth - mw - 12);
      let top = r.bottom + 6;
      if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
      m.style.left = `${Math.max(8, left + window.scrollX)}px`;
      m.style.top = `${top + window.scrollY}px`;
      openMenu = m;
      m.querySelector('.cx-item')?.focus();
    },
    toast(text, kind = 'info', action) {
      if (typeof text !== 'string') text = (text && (text.message || text.error)) || 'Something went wrong';
      let host = document.querySelector('.cx-toasts');
      if (!host) { host = document.createElement('div'); host.className = 'cx-toasts'; document.body.appendChild(host); }
      const t = document.createElement('div');
      t.className = `cx-toast cx-${kind}`;
      t.innerHTML = `<span>${text}</span>${action ? `<a href="${action.href}" target="_blank" rel="noopener">${action.label}</a>` : ''}`;
      host.appendChild(t);
      setTimeout(() => { t.classList.add('cx-out'); setTimeout(() => t.remove(), 300); }, action ? 9000 : 3500);
    }
  };
})(globalThis);
