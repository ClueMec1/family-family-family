# HTML Runner

Write HTML, CSS and JavaScript with VS Code-style suggestions, run it live, browse the web, and get help from many free AI providers. Installs as an app and opens offline.

## Put it online (needed for Firebase sign-in and installing)

HTML Runner has to be served from a website. Opening `index.html` straight from your files works only in a basic mode.

**Firebase Hosting** (this folder already has `firebase.json`):

```
npm install -g firebase-tools
firebase login
firebase init hosting     # pick your project, public directory ".", say NO to overwriting index.html
firebase deploy
```

Open the `https://<project>.web.app` address it prints, then press **Install app** at the top.

Any static host works too: Netlify Drop (drag the folder onto app.netlify.com/drop), GitHub Pages or Cloudflare Pages.

## Using Firebase in your own code

1. Run in **Connected** mode (the default). Your page runs at `https://<your-host>/preview/index.html`, a real page on the same site.
2. In the Firebase console, open **Authentication → Settings → Authorized domains** and add the domain HTML Runner is hosted on. Your `*.web.app` domain is already authorized when the code uses the same Firebase project.
3. Start from **⋯ → New project → Firebase guestbook** for a working example.

## The two preview modes

- **Connected** runs your code as a normal page on this site: fetch, Firebase, logins, cookies, storage and service workers all behave normally. It shares this app's storage, so only run code you trust.
- **Isolated** runs the code in a locked sandbox with no access to the app's storage.

## Built-in browser

Tabs, back and forward, bookmarks, and your own code preview. Many big sites (Google, YouTube, banks, social networks) refuse to be shown inside another app and will stay blank. **Open in Chrome** sends the page to Chrome:

- Android: opens Chrome directly.
- iPhone and iPad: opens Chrome if it is installed.
- Computer: opens a new tab.

**Install** explains how to install the site from Chrome.

## AI providers

| Provider | Key |
|---|---|
| Puter | None. Sign in to a free Puter account on first use |
| OpenRouter | Free key. Models marked FREE cost nothing |
| Google Gemini | Free key from AI Studio |
| Groq, Cerebras, Mistral, Hugging Face, NVIDIA, Cohere | Free keys or tiers |
| GitHub Models | GitHub token with Models: read |
| DeepSeek | Trial credit |
| Custom | Any OpenAI-compatible URL, including Ollama or LM Studio |

Each provider's model list is loaded live. With **switch when a provider runs out** turned on, a rate-limit or quota error moves the chat to the next provider you've set up. Keys are stored only in your browser.

**AI autocomplete** (⋯ menu) shows grey suggestions while you type. Press Tab to accept. It uses the model selected in the AI section and counts against that provider's limits.

## Shortcuts

- Ctrl/⌘ + Enter: run
- Ctrl/⌘ + S: save project
- Ctrl/⌘ + Shift + A: ask AI about the selected code
- Emmet: type `ul>li*3` in index.html and press Tab
