/* ChatSave — JSON (the raw model, plus a flat text per message). */
(function (g) {
  const CX = (g.CX = g.CX || {});
  CX.exportJson = function (conv, opts = {}) {
    const { includePrompts = true } = opts;
    const messages = conv.messages
      .filter((m) => includePrompts || m.role !== 'user')
      .map((m) => ({ id: m.id, role: m.role, text: m.blocks.map(CX.model.blockToPlain).join('\n\n'), blocks: m.blocks }));
    return JSON.stringify({ ...conv, messages }, null, 2);
  };
})(globalThis);
