/* ChatSave — Word (.docx), generated in the browser with no library.
 * A .docx is a ZIP of XML parts. We write a store-only ZIP (no compression) and
 * the five parts Word needs: content types, package rels, document, styles,
 * numbering, plus document rels for hyperlinks.
 */
(function (g) {
  const CX = (g.CX = g.CX || {});

  /* ---------- tiny ZIP (store only) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) { // [{name, data:string}]
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    const d = new Date(), dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    const u16 = (n) => [n & 0xFF, (n >> 8) & 0xFF], u32 = (n) => [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >>> 24) & 0xFF];
    for (const f of files) {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const local = new Uint8Array([0x50, 0x4B, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name]);
      parts.push(local, data);
      central.push(new Uint8Array([0x50, 0x4B, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
      offset += local.length + data.length;
    }
    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const eocd = new Uint8Array([0x50, 0x4B, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
    return new Blob([...parts, ...central, eocd], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* ---------- OOXML ---------- */
  const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const T = (s) => `<w:t xml:space="preserve">${x(s)}</w:t>`;

  function build(conv, opts) {
    const rels = []; // hyperlinks
    const nums = []; // numbered-list instances (restart numbering per list)
    const relId = (url) => { rels.push(url); return `rId${rels.length + 10}`; };

    function run(i, extra = '') {
      const pr = [];
      if (i.t === 'strong') pr.push('<w:b/>');
      if (i.t === 'em') pr.push('<w:i/>');
      if (i.t === 'del') pr.push('<w:strike/>');
      if (i.t === 'code') pr.push('<w:rStyle w:val="CodeChar"/>');
      if (i.t === 'br') return '<w:r><w:br/></w:r>';
      const r = `<w:r>${pr.length || extra ? `<w:rPr>${extra}${pr.join('')}</w:rPr>` : ''}${T(i.v || '')}</w:r>`;
      if (i.t === 'link' && i.href && /^https?:/i.test(i.href)) return `<w:hyperlink r:id="${relId(i.href)}"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr>${T(i.v)}</w:r></w:hyperlink>`;
      return r;
    }
    const runs = (inl) => (inl || []).map((i) => run(i)).join('');
    const para = (inl, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${runs(inl)}</w:p>`;
    const styled = (style, inl) => para(inl, `<w:pStyle w:val="${style}"/>`);

    function block(b) {
      switch (b.type) {
        case 'heading': return styled(`Heading${Math.min(4, Math.max(2, b.level + 1))}`, b.inlines);
        case 'paragraph': return para(b.inlines);
        case 'quote': return styled('Quote', b.inlines);
        case 'list': {
          let numId = 1;
          if (b.ordered) { nums.push(b.start || 1); numId = nums.length + 1; }
          return b.items.map((it) => para(it.inlines || it, `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${Math.min(8, it.depth || 0)}"/><w:numId w:val="${numId}"/></w:numPr>`)).join('');
        }
        case 'code': {
          const lines = b.code.replace(/\n$/, '').split('\n');
          const head = b.filename || b.lang ? `<w:p><w:pPr><w:pStyle w:val="CodeHead"/></w:pPr><w:r>${T(b.filename || b.lang)}</w:r></w:p>` : '';
          return head + lines.map((l) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr><w:r>${T(l)}</w:r></w:p>`).join('');
        }
        case 'table': {
          const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1);
          const cell = (c, hdr) => `<w:tc><w:tcPr>${hdr ? '<w:shd w:val="clear" w:color="auto" w:fill="EFEFF4"/>' : ''}</w:tcPr><w:p>${(c || []).map((i) => run(i, hdr ? '<w:b/>' : '')).join('') || '<w:r><w:t/></w:r>'}</w:p></w:tc>`;
          const row = (r, hdr) => `<w:tr>${hdr ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${Array.from({ length: cols }, (_, i) => cell(r[i], hdr)).join('')}</w:tr>`;
          return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tblGrid>${'<w:gridCol/>'.repeat(cols)}</w:tblGrid>${row(b.header, true)}${b.rows.map((r) => row(r, false)).join('')}</w:tbl><w:p/>`;
        }
        case 'image': return b.src && /^https?:/i.test(b.src)
          ? `<w:p><w:hyperlink r:id="${relId(b.src)}"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr>${T(`[image${b.alt ? `: ${b.alt}` : ''}]`)}</w:r></w:hyperlink></w:p>`
          : `<w:p><w:r><w:rPr><w:i/></w:rPr>${T(`[image${b.alt ? `: ${b.alt}` : ''}]`)}</w:r></w:p>`;
        case 'rule': return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="DDDDDD"/></w:pBdr></w:pPr></w:p>';
        case 'artifact': return b.code
          ? block({ type: 'code', filename: `Artifact: ${b.title}`, lang: b.lang, code: b.code })
          : `<w:p><w:r><w:rPr><w:i/></w:rPr>${T(`Artifact: ${b.title}${b.kind ? ` (${b.kind})` : ''}`)}</w:r></w:p>`;
        default: return '';
      }
    }

    const date = new Date(conv.exportedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const srcName = conv.sourceName || conv.source;
    let body = `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r>${T(conv.title)}</w:r></w:p>`;
    body += `<w:p><w:pPr><w:pStyle w:val="Meta"/></w:pPr><w:r>${T(`Exported from ${srcName} · ${date}`)}</w:r>${conv.url ? `<w:r>${T('  ·  ')}</w:r><w:hyperlink r:id="${relId(conv.url)}"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr>${T('Original chat')}</w:r></w:hyperlink>` : ''}</w:p>`;
    for (const m of conv.messages) {
      if (m.role === 'user' && !opts.includePrompts) continue;
      body += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r>${T(m.role === 'user' ? 'You' : srcName)}</w:r></w:p>`;
      body += m.blocks.map(block).join('');
    }

    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

    const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
${rels.map((u, i) => `<Relationship Id="rId${i + 11}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${x(u)}" TargetMode="External"/>`).join('\n')}
</Relationships>`;

    const lvl = (ilvl, fmt, text) => `<w:lvl w:ilvl="${ilvl}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + ilvl * 360}" w:hanging="360"/></w:pPr>${fmt === 'bullet' ? '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>' : ''}</w:lvl>`;
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => lvl(i, 'bullet', i % 2 ? 'o' : '')).join('')}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => lvl(i, i % 3 === 0 ? 'decimal' : i % 3 === 1 ? 'lowerLetter' : 'lowerRoman', `%${i + 1}.`)).join('')}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
${nums.map((start, i) => `<w:num w:numId="${i + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="${start}"/></w:lvlOverride></w:num>`).join('\n')}
</w:numbering>`;

    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="1A1A1E"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="320"/></w:pPr><w:rPr><w:sz w:val="19"/><w:color w:val="5C5C66"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:spacing w:val="10"/><w:sz w:val="18"/><w:color w:val="4F46E5"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="4F46E5"/></w:pBdr><w:ind w:left="360"/></w:pPr><w:rPr><w:color w:val="444444"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CodeHead"><w:name w:val="Code Head"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="16"/><w:color w:val="5C5C66"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:keepLines/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:shd w:val="clear" w:color="auto" w:fill="F3F3F6"/><w:ind w:left="120" w:right="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/><w:shd w:val="clear" w:color="auto" w:fill="F3F3F6"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="4338CA"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="DDDDDD"/><w:left w:val="single" w:sz="4" w:color="DDDDDD"/><w:bottom w:val="single" w:sz="4" w:color="DDDDDD"/><w:right w:val="single" w:sz="4" w:color="DDDDDD"/><w:insideH w:val="single" w:sz="4" w:color="DDDDDD"/><w:insideV w:val="single" w:sz="4" w:color="DDDDDD"/></w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;
    const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;
    const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(conv.title)}</dc:title><dc:creator>ChatSave</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${conv.exportedAt}</dcterms:created></cp:coreProperties>`;

    return zip([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: pkgRels },
      { name: 'docProps/core.xml', data: core },
      { name: 'word/document.xml', data: document },
      { name: 'word/_rels/document.xml.rels', data: docRels },
      { name: 'word/styles.xml', data: styles },
      { name: 'word/numbering.xml', data: numbering }
    ]);
  }

  /* Returns a Blob. */
  CX.exportDocx = function (conv, opts = {}) { return build(conv, { includePrompts: true, ...opts }); };
})(globalThis);
