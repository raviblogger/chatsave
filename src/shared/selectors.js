/* ChatSave — per-platform DOM selectors.
 *
 * Everything that depends on a chat site's markup lives here. When a site ships
 * a redesign, this is the only file that should need changing. One entry per
 * platform; `current()` picks it by hostname. Each entry is a
 * list of candidates tried in order; prefer stable attributes (data-testid,
 * aria-label, role) over hashed class names.
 */
(function (g) {
  const CX = (g.CX = g.CX || {});

  /* Keys every platform entry may carry (lists of CSS selectors, tried in order):
     userMessage, assistantMessage (required), actionCopyButton, contentRoot,
     skip, artifactCard, codeLangLabel, title. */
  const COMMON_SKIP = ['button', '[role="button"]', '[aria-expanded]', 'details', 'summary', 'nav', '[class*="thinking" i]', '[class*="reasoning" i]', '[data-testid*="thinking" i]'];

  CX.selectors = {
    claude: {
      name: 'Claude', hosts: ['claude.ai'],
      /* One conversation turn (user or assistant). */
      turn: [
        '[data-test-render-count]',
        'div[data-testid^="conversation-turn"]',
        'div.group.relative'
      ],
      /* The user's prompt text inside a turn. */
      userMessage: [
        '[data-testid="user-message"]',
        'div.font-user-message'
      ],
      /* The assistant's rendered Markdown inside a turn. */
      assistantMessage: [
        'div.font-claude-message',
        'div.font-claude-response',
        '[data-is-streaming]',
        'div[class*="font-claude"]'
      ],
      /* The row of small icon buttons under an assistant reply (Copy, Retry…).
         We insert our Export button as a sibling of the Copy button. */
      actionCopyButton: [
        '[data-cds="MessageActions"] button[aria-label*="Copy" i]',
        'button[aria-label="Copy"]',
        'button[data-testid="action-bar-copy"]',
        'button[aria-label*="Copy" i]'
      ],
      /* Where the actual Markdown-rendered reply lives inside an assistant turn.
         Tool-use chips, thinking summaries, artifact cards and file cards sit
         OUTSIDE these roots, so parsing only roots skips them. */
      contentRoot: [
        '.standard-markdown',
        '[class*="standard-markdown"]',
        '.font-claude-message > div',
        '.font-claude-response > div'
      ],
      /* Containers whose text must never be exported: collapsible tool/thinking
         summaries, buttons, file and artifact cards. Applied inside roots too. */
      skip: [
        'button',
        '[role="button"]',
        '[aria-expanded]',
        'details',
        'summary',
        '[data-testid*="thinking" i]',
        '[data-testid*="tool" i]',
        '[data-testid*="file" i]',
        '[data-testid*="attachment" i]',
        'div[class*="thinking" i]'
      ],
      thinking: ['[data-testid*="thinking" i]', 'details', 'div[class*="thinking" i]'],
      /* Artifact cards embedded in a reply. */
      artifactCard: [
        '[data-testid*="artifact" i]',
        'button[aria-label*="artifact" i]',
        'div[class*="artifact" i]'
      ],
      /* Code block wrapper: <pre> whose header may hold the language label. */
      codeLangLabel: [
        'div.text-text-500',
        'div[class*="language"]',
        'span[class*="language"]'
      ],
      /* The composer area; the "Export chat" button is anchored near it. */
      composer: [
        'fieldset',
        'div[data-testid="composer"]',
        'div[contenteditable="true"]'
      ],
      /* Chat title: tab title minus " - Claude", or a header element. */
      title: [
        'button[data-testid="chat-title-button"]',
        'header h1',
        'h1'
      ]
    },

    /* Selectors below are current as of Sep 2026 for the action row and message
       containers; user/assistant split on some Chinese sites is inferred from
       naming and unverified. */
    chatgpt: {
      name: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'],
      userMessage: ['[data-turn-key] [class*="user-message"]', '[data-message-author-role="user"]', 'article[data-turn="user"]'],
      assistantMessage: ['[data-turn-key]:has([data-content-search-unit-key*="assistant"])', '[data-content-search-unit-key*="assistant"]', '[data-message-author-role="assistant"]', 'article[data-turn="assistant"]'],
      actionCopyButton: ['.turn-action-controls button[data-testid*="copy"]', '[data-testid*="copy-turn-action-button"]', '.turn-action-controls button[aria-label*="Copy" i]'],
      contentRoot: ['.markdown', '[class*="markdown"]'],
      skip: [...COMMON_SKIP, '.turn-action-controls', '.sr-only'], artifactCard: [], codeLangLabel: [], title: ['h1']
    },
    gemini: {
      name: 'Gemini', hosts: ['gemini.google.com'],
      userMessage: ['user-query'],
      assistantMessage: ['model-response'],
      actionCopyButton: ['message-actions button[data-test-id="copy-button"]', 'message-actions copy-button button', 'message-actions button[aria-label*="Copy" i]'],
      contentRoot: ['message-content .markdown', '.markdown'],
      skip: [...COMMON_SKIP, 'message-actions', 'sources-list'], artifactCard: [], codeLangLabel: ['.code-block-decoration span', '.code-block-decoration'], title: ['.conversation-title', 'h1']
    },
    aistudio: {
      name: 'Google AI Studio', hosts: ['aistudio.google.com'],
      userMessage: ['ms-chat-turn:has([data-turn-role="User"])', '[data-turn-role="User"]'],
      assistantMessage: ['ms-chat-turn:has([data-turn-role="Model"])', '[data-turn-role="Model"]'],
      actionCopyButton: ['ms-chat-turn button[aria-label*="Copy" i]', 'ms-chat-turn button[mattooltip*="Copy" i]'],
      contentRoot: ['ms-prompt-chunk', 'ms-cmark-node'],
      skip: COMMON_SKIP, artifactCard: [], codeLangLabel: [], title: ['h1']
    },
    notebooklm: {
      name: 'NotebookLM', hosts: ['notebooklm.google.com', 'notebook.google.com'],
      userMessage: ['chat-message:has(.from-user-container)', 'chat-message[class*="user"]'],
      assistantMessage: ['chat-message:has(.to-user-container)', 'chat-message:not([class*="user"])'],
      actionCopyButton: ['chat-panel mat-card-actions chat-actions button[aria-label*="Copy" i]', 'chat-actions button'],
      contentRoot: ['.message-text-content', '.to-user-container'],
      skip: [...COMMON_SKIP, 'chat-actions', 'mat-card-actions'], artifactCard: [], codeLangLabel: [], title: ['h1', '.notebook-title']
    },
    grok: {
      name: 'Grok', hosts: ['grok.com', 'x.com'],
      userMessage: ['.message-bubble'],
      assistantMessage: ['[id^="response"]:has([data-testid="assistant-message"])', '[data-testid="assistant-message"]'],
      actionCopyButton: ['[id^="response"] .action-buttons button[aria-label*="Copy" i]', '[id^="response"] .action-buttons button'],
      contentRoot: ['.response-content-markdown', '.prose', '.markdown'],
      skip: [...COMMON_SKIP, '.action-buttons'], artifactCard: [], codeLangLabel: ['[class*="language"]'], title: ['h1']
    },
    deepseek: {
      name: 'DeepSeek', hosts: ['chat.deepseek.com'],
      userMessage: ['.ds-message:not(:has(> .ds-markdown))'],
      assistantMessage: ['.ds-message:has(> .ds-markdown)'],
      actionCopyButton: ['.ds-message ~ div .ds-icon-button:first-child', '.ds-icon-button[aria-label*="Copy" i]', 'div[role="button"][aria-label*="Copy" i]'],
      contentRoot: ['.ds-markdown'],
      skip: COMMON_SKIP, artifactCard: [], codeLangLabel: ['.md-code-block-banner span', '[class*="code-block-banner"]'], title: ['h1']
    },
    perplexity: {
      name: 'Perplexity', hosts: ['perplexity.ai', 'www.perplexity.ai'],
      userMessage: ['h1[class*="query" i]', '[class*="query" i] h1', 'div[class*="font-display"]'],
      assistantMessage: ['[data-renderer="lm"]', '.prose'],
      actionCopyButton: ['button[aria-label="Copy"]', 'button[aria-label*="Copy" i]'],
      contentRoot: [],
      skip: COMMON_SKIP, artifactCard: [], codeLangLabel: ['[class*="language"]'], title: ['h1']
    },
    copilot: {
      name: 'Copilot', hosts: ['copilot.microsoft.com'],
      userMessage: ['[data-testid="user-message"]', '[data-content="user-message"]'],
      assistantMessage: ['[data-testid="ai-message"]', '[data-content="ai-message"]'],
      actionCopyButton: ['button[aria-label="Copy"]', 'button[title="Copy"]'],
      contentRoot: [],
      skip: COMMON_SKIP, artifactCard: [], codeLangLabel: ['[class*="language"]'], title: ['h1']
    },
    m365: {
      name: 'M365 Copilot', hosts: ['m365.cloud.microsoft'],
      userMessage: ['[id*="chatMessageRequest-"]', '[data-testid="user-message"]'],
      assistantMessage: ['[id*="chatMessageResponse-"]'],
      actionCopyButton: ['[id*="chatMessageResponse-"] button[data-testid="CopyButtonTestId"]'],
      contentRoot: ['[data-testid="markdown-reply"]'],
      skip: COMMON_SKIP, artifactCard: [], codeLangLabel: [], title: ['h1']
    },
    githubcopilot: {
      name: 'GitHub Copilot', hosts: ['github.com'],
      userMessage: ['[class*="UserMessage-module__"]', '[class*="ChatMessage-module__container"]:not(:has([class*="MarkdownRenderer-module__container"]))'],
      assistantMessage: ['[class*="ChatMessage-module__container"]:has([class*="MarkdownRenderer-module__container"])', '[class*="ChatMessage-module__content"]'],
      actionCopyButton: ['[class*="ChatMessage-module__actions"][data-testid="nonshared-toolbar"] button[aria-label*="Copy" i]', '[class*="ChatMessage-module__actions"][data-testid="nonshared-toolbar"] button'],
      contentRoot: ['[class*="MarkdownRenderer-module__container"]'],
      skip: [...COMMON_SKIP, '[data-testid="nonshared-toolbar"]'], artifactCard: [], codeLangLabel: [], title: ['h1']
    },
    kimi: {
      name: 'Kimi', hosts: ['kimi.com', 'www.kimi.com', 'kimi.ai', 'www.kimi.ai', 'kimi.moonshot.cn'],
      userMessage: ['.segment-user', '[class*="segment-user"]'],
      assistantMessage: ['.segment-assistant', '[class*="segment-assistant"]:not([class*="actions"])'],
      actionCopyButton: ['.segment-assistant-actions-content button[aria-label*="Copy" i]', '.segment-assistant-actions-content button', '.segment-assistant-actions-content [class*="copy" i]'],
      contentRoot: ['.markdown-container'],
      skip: [...COMMON_SKIP, '.thinking-container', '.segment-assistant-actions-content'], artifactCard: [], codeLangLabel: ['[class*="language"]'], title: ['h1']
    },
    qwen: {
      name: 'Qwen', hosts: ['chat.qwen.ai', 'chat.qwenlm.ai', 'www.qianwen.com', 'tongyi.aliyun.com'],
      userMessage: ['.user-message', '[class*="user-message"]', '[class*="questionItem"]'],
      assistantMessage: ['.response-message', '[class*="response-message"]:not([class*="footer"])', '[class*="answerItem"]'],
      actionCopyButton: ['.response-message-footer .qwen-chat-package-comp-new-action-control-icons button', '.response-message-footer button[aria-label*="Copy" i]', '.response-message-footer [class*="copy" i]'],
      contentRoot: ['.markdown', '[class*="markdown"]'],
      skip: [...COMMON_SKIP, '.response-message-footer'], artifactCard: [], codeLangLabel: ['[class*="language"]'], title: ['h1']
    },
    doubao: {
      name: 'Doubao', hosts: ['www.doubao.com', 'doubao.com'],
      userMessage: ['[data-testid="send_message"]', '[class*="send-message"]'],
      assistantMessage: ['[data-testid="receive_message"]', '[class*="receive-message"]:not([data-foundation-type])'],
      actionCopyButton: ['[data-foundation-type="receive-message-action-bar"] .message-action-button-main button', '[data-foundation-type="receive-message-action-bar"] button'],
      contentRoot: ['[class*="markdown"]'],
      skip: [...COMMON_SKIP, '[data-foundation-type="receive-message-action-bar"]'], artifactCard: [], codeLangLabel: [], title: ['h1']
    },
    yuanbao: {
      name: 'Yuanbao', hosts: ['yuanbao.tencent.com'],
      userMessage: ['.agent-chat__bubble--human'],
      assistantMessage: ['.agent-chat__bubble--ai'],
      actionCopyButton: ['.agent-chat__toolbar button[aria-label*="Copy" i]', '.agent-chat__toolbar button', '[class*="toolbar"] [class*="copy" i]'],
      contentRoot: ['.hyc-common-markdown', '[class*="markdown"]'],
      skip: [...COMMON_SKIP, '[class*="toolbar"]'], artifactCard: [], codeLangLabel: ['.hyc-common-markdown__code__hd span', '.hyc-common-markdown__code__hd'], title: ['h1']
    },

    /* The platform entry for the page we are on. */
    current() {
      const h = location.hostname;
      for (const k in CX.selectors) {
        const e = CX.selectors[k];
        if (e && e.hosts && e.hosts.some((x) => h === x || h.endsWith('.' + x))) return { key: k, ...e };
      }
      return null;
    },

    /* First matching element (within root) across a candidate list. */
    q(list, root = document) {
      for (const s of list) { try { const el = root.querySelector(s); if (el) return el; } catch (_) {} }
      return null;
    },
    /* All matches for the first candidate that yields any. */
    qa(list, root = document) {
      for (const s of list) { try { const els = root.querySelectorAll(s); if (els.length) return Array.from(els); } catch (_) {} }
      return [];
    },
    matches(el, list) {
      return list.some((s) => { try { return el.matches(s); } catch (_) { return false; } });
    }
  };
})(globalThis);
