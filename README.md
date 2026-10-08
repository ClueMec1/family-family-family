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

Open the `https://<project>.web.app` address it prints, then on Home tap ⚙ → **Install HTML Runner** (or the install banner).

Any static host works too: Netlify Drop (drag the folder onto app.netlify.com/drop), GitHub Pages or Cloudflare Pages.

## Using Firebase in your own code

1. Run in **Connected** mode (the default). Your page runs at `https://<your-host>/preview/index.html`, a real page on the same site.
2. In the Firebase console, open **Authentication → Settings → Authorized domains** and add the domain HTML Runner is hosted on. Your `*.web.app` domain is already authorized when the code uses the same Firebase project.
3. Start from **⋯ → New project → Firebase guestbook** for a working example.

## The two preview modes

- **Connected** runs your code as a normal page on this site: fetch, Firebase, logins, cookies, storage and service workers all behave normally. It shares this app's storage, so only run code you trust.
- **Isolated** runs the code in a locked sandbox with no access to the app's storage.

## Home screen and apps

HTML Runner is built for phones. The bar at the bottom switches between **Home**, **Browser**, **Code** and **AI**.

**Home** works like a phone's home screen: clock, a search bar (the **AI** button sends what you typed to the AI chat), and your apps.

- **Add a website as an app:** open it in Browser and tap **Add**. HTML Runner reads the site's app name, icon and colour when the site allows it, and you can rename it or pick a colour. It then opens full screen from Home with its own title bar, like an installed app. No Chrome needed.
- **Add your own code as an app:** Code → ⋯ → **Add to Home screen**, or tap **My code** under Suggested apps. It saves a copy; long-press the icon and choose **Update with my current code** after you change it. On a hosted copy it runs at `/apps/<id>/` on your site, so Firebase and logins work.
- **Long-press an icon** to rename it, change its colour, move it, close it, open it in Browser or Chrome, or remove it.
- Apps keep running in the background (a green dot shows which). Up to 5 stay open; the one used longest ago closes first.
- The ⚙ button changes the wallpaper and hides suggestions.

Sites that refuse to be shown inside other apps (Google, YouTube, most banks and social sites) stay blank as apps too. For those, long-press the icon → **Open in Chrome**.

## Built-in browser

Tabs, back and forward, bookmarks, and your own code preview. Many big sites (Google, YouTube, banks, social networks) refuse to be shown inside another app and will stay blank. **Open in Chrome** sends the page to Chrome:

- Android: opens Chrome directly.
- iPhone and iPad: opens Chrome if it is installed.
- Computer: opens a new tab.

**Add** puts the site on your HTML Runner Home screen (see above).

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
