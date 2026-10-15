# ChatSave

**Website:** [chatsave.app](https://chatsave.app) · **Privacy:** [chatsave.app/privacy](https://chatsave.app/privacy.html) · **License:** MIT

Free, serverless Chrome extension (Manifest V3). Exports a chat from ChatGPT, Claude, Gemini, Grok, DeepSeek, Perplexity, Kimi, Qwen or Copilot — or a single reply — to Markdown, Word (.docx), PDF, HTML, text or JSON entirely in the browser, and syncs to Notion. Optionally publishes a chat as a web page, or the HTML code in a reply as a live site, on Fylo.Host via OAuth.

No build step, no bundler, no server. Load the folder and go.

## Install (unpacked, for testing)

1. Chrome → `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → pick this folder.
3. Open any chat on `https://claude.ai`.
   - Under each Claude reply, a new **Export** icon appears beside **Copy**.
   - A floating **Export chat** pill appears bottom-right for the whole conversation.
   - The toolbar popup exports the current chat, holds settings, and connects Fylo.

Works in Edge and Brave the same way.

## What's in the box

```
manifest.json
src/shared/model.js         Conversation / Message / Block data model (platform-neutral)
src/shared/selectors.js     Every claude.ai DOM selector, in one place
src/content/parser.js       DOM → model, driven by the platform entry from selectors.js
src/content/ui.js           Injected button, menu, toasts
src/content/content.css
src/content/main.js         Wiring: observe DOM, run exports, call background
src/export/{inline,markdown,text,json,html,docx,download}.js   docx.js = OOXML + tiny ZIP writer, no library
src/bg/notion.js            Notion sync (model → Notion blocks, batched appends)
src/bg/service-worker.js    Fylo OAuth 2.1 (PKCE + dynamic registration), publish API, print tab
src/print/print.{html,js}   Renders the HTML export and opens Print → Save as PDF
src/popup/popup.{html,css,js}
icons/
```

Exporters consume the model, never the DOM, so adding ChatGPT or Gemini later means one new `parser-<platform>.js` plus a `selectors` entry and a `content_scripts` match. Nothing else changes.

## Formats

| Format | How | Notes |
|---|---|---|
| Markdown | client | GFM tables, fenced code with language, nested lists |
| Copy as Markdown | client | clipboard |
| Word | client | Real `.docx` (OOXML written in JS, store-only ZIP). Title, headings, lists with restart numbering, code with shading, tables, hyperlinks. Verified with python-docx and LibreOffice. |
| Sync to Notion | Notion API | Internal-integration token pasted in the popup; pick a parent page. Headings, lists, code (with language), quotes, tables, images (external), dividers. Batched 100 blocks per request. |
| PDF | client | Opens a print tab with print CSS; user picks "Save as PDF". No server. |
| HTML | client | Self-contained share page (same design as the Fylo publish). |
| Text / JSON | client | JSON includes the full block model. |
| Publish as web page | Fylo | Chat → `index.html` → `POST /api/v1/sites`. Re-publishing the same chat does `PUT /api/v1/sites/:id` so the URL stays. |
| Publish code as a live site | Fylo | Shown only when the reply contains an HTML code block or artifact code. |

Tool-use chips, thinking summaries, artifact cards and file cards are skipped (parsing is limited to Claude's Markdown roots), and any text Claude renders in stacked duplicate layers is collapsed. For whole-chat exports the extension first scrolls to the top until no more turns load, since Claude lazy-loads older messages. Artifact cards are captured as title + kind (the artifact's code isn't in the chat DOM; see roadmap).

## Fylo side — things to confirm before shipping

The background worker talks to Fylo exactly as an MCP client would, so most of this already exists. Check these:

1. **Dynamic registration** (`/oauth/register`) accepts a redirect URI of the form `https://<extension-id>.chromiumapp.org/` and `token_endpoint_auth_method: "none"`. The extension id is stable once published; while testing unpacked it changes per machine unless you pin a `key` in the manifest.
2. **Scope.** The flow requests `scope=sites:write`. If the server rejects unknown scopes, either add it or delete the `scope` line in `connect()`.
3. **`/api/v1/me`** — the popup reads `email` (or `user.email`) and `plan`. Adjust `fylo.status` in the worker if the field names differ.
4. **Site response shape.** `publish()` accepts `id | project_id | site_id`, `url | public_url`, `subdomain | slug`. Confirm what `POST /api/v1/sites` returns and trim the fallbacks.
5. **Replace is paid-only.** On the free plan the `PUT` returns `402 plan_limit`; the extension shows a "See plans" toast. Decide whether re-publishing a *chat page* should be allowed on free (it's the natural upgrade moment either way).
6. **Site cap.** Today each chat becomes its own site, so free users hit the site limit fast. The better long-term shape is one `chats` site per user with one folder per chat, which needs an "add/replace files without sweeping the rest" option on the API.
7. **Moderation.** Published pages go through `/api/upload`'s existing scan; nothing extra needed.
8. **`X-Fylo-Source: extension:chatsave`** is sent on every call so PostHog can split extension traffic.

## Sending me a DOM sample when something breaks

Open a chat, press F12 → Console, and paste:

```js
copy([...document.querySelectorAll('[data-testid="user-message"], .font-claude-message, .standard-markdown')].slice(-3).map(e => e.outerHTML.replace(/>[^<]{200,}</g, '>…<').slice(0, 4000)).join('\n\n=====\n\n'))
```

That copies the last three message elements (text trimmed) to the clipboard. Paste them into the chat and the selectors can be fixed precisely.

## Platform support

Claude is tested live. The other entries in `src/shared/selectors.js` are written from memory of each site's markup and are **unverified**: open the site, and if no Export buttons appear or the export is junk, run the console snippet above, paste the result, and fix that platform's entry. Nothing else changes per platform.

## When a site changes its DOM

Everything is in `src/shared/selectors.js`. Each key is a list of candidates tried in order. The three that matter most:

- `userMessage` / `assistantMessage` — how messages are found.
- `actionCopyButton` — where the Export button is inserted (as a sibling of Copy).

Open DevTools on a chat, inspect a reply, and add the new stable attribute (`data-testid`, `aria-label`) to the top of the relevant list. Prefer attributes over hashed class names; they survive restyles.

## Privacy copy for the store listing

> All exports are generated in your browser; nothing is sent anywhere. The only network call is when you choose **Publish**, which sends that page to your own Fylo account over an OAuth connection you can revoke at any time.

## Roadmap (suggested order)

1. Tune selectors against live claude.ai (first live test done 7 Oct; the fixes for tool chips, cards and lazy-loading are in v0.2.0 and need re-checking).
2. Artifact code capture: open the artifact's code view or hook its Copy button to include the real source.
3. Message selection UI (checkboxes + Shift-click range) for partial exports.
4. ChatGPT parser, then Gemini — each as its own store listing sharing this codebase.
5. Optional server-rendered PDF later if the print-dialog step proves to be friction; page numbers need that too (Chrome ignores `@page` counters).
6. Firefox build (MV3 with `browser_specific_settings`), Edge Add-ons listing.
