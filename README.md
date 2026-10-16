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

## Fresh address (when Chrome insists it's already installed)

Chrome can keep a record of an old install that covers your whole address, and then it never offers to install again. Putting HTML Runner on a new address gets around it every time:

```
firebase hosting:sites:create html-runner-app      # pick any free name
firebase deploy --only hosting --site html-runner-app
```

Open `https://html-runner-app.web.app`, tap the page, wait about 30 seconds, then tap **Install HTML Runner** on Home. Add the new address to Firebase Authentication → Authorized domains if your code uses Firebase sign-in.

## Using Firebase in your own code

1. Run in **Connected** mode (the default). Your page runs at `https://<your-host>/preview/index.html`, a real page on the same site.
2. In the Firebase console, open **Authentication → Settings → Authorized domains** and add the domain HTML Runner is hosted on. Your `*.web.app` domain is already authorized when the code uses the same Firebase project.
3. Start from **⋯ → New project → Firebase guestbook** for a working example.

## The two preview modes

- **Connected** runs your code as a normal page on this site: fetch, Firebase, logins, cookies, storage and service workers all behave normally. It shares this app's storage, so only run code you trust.
- **Isolated** runs the code in a locked sandbox with no access to the app's storage.

## The phone

HTML Runner works like an Android phone.

- **Home screen:** a clock, your apps on swipeable pages, a dock with **Browser**, **Code**, **AI** and **Settings**, and a search bar (the ✦ button sends what you typed to the AI).
- **All apps:** swipe up on the Home screen. Type to find an app, or press Enter to search the web.
- **Navigation bar:** ◁ Back, ○ Home, ▢ Recent apps. Prefer a gesture bar? Settings → System → Navigation. With the gesture bar: tap = Home, swipe up = recent apps, swipe sideways = previous app.
- **Recent apps:** every open app as a live card. Tap one to switch, swipe it up (or tap ✕) to close it, or **Clear all**.
- **Your phone's own Back button** works everywhere: it steps back in the browser, closes menus and dialogs, and returns to Home.
- **Status bar** (time, Wi-Fi, battery): shown automatically when your phone's own status bar is hidden, for example in a full-screen APK. Change it in Settings → System.

### Apps on the Home screen

- **Add a website:** open it in Browser, tap ⋮ → **Add to Home screen**. HTML Runner reads the site's app name, icon and colour when the site allows it.
- **Add your own code:** Code → ⋯ → **Add to Home screen**.
- Apps open full screen with a splash screen and their own colour in the status bar, like installed apps. Up to 5 stay open in the background.
- **Long-press an icon** to edit it (name, colour, position), open it in Browser or Chrome, update a code app, close it, or remove it.

### Settings

Wallpaper (8 to choose from), icon shape, apps per row, app names on or off, the browser's search engine and home page, clearing history, bookmarks, the page server, navigation style, status bar and installing.

## Browser

Works like Chrome on Android:

- **Address bar:** shows the site you're on. Type an address (`example.com` gets `https://` added), or anything else to search DuckDuckGo.
- **⋮ menu:** Forward, Bookmark ★, Refresh, Open in Chrome, New tab, Bookmarks, History, Add to Home screen, Open full screen, Use as home page, Page server, and Browser settings.
- **Tabs:** the square with a number shows your tabs as cards.
- **Bookmarks and History** are kept on your phone. History is grouped by day, and you can remove single pages or clear it all.
- **New tab page:** a search box, your bookmarks as shortcuts, your code preview and recently visited sites.
- **Back** follows links you tapped inside pages too, then the pages you typed, then returns to Home.
- A blue bar under the address shows when a page is loading.

Many big sites (Google, YouTube, banks, social networks) refuse to be shown inside another app; see below.

## YouTube and sites that say "blocked by response"

Some sites (YouTube, Google, Instagram, TikTok, X, banks…) tell browsers not to show their pages inside other apps. Chrome and Android then show **"blocked by response"**. It isn't about your IP address.

- **YouTube videos play in HTML Runner.** Open or paste any video link (youtube.com/watch…, youtu.be/…, Shorts, live) and it plays in YouTube's official player, which is made for showing inside apps. This works in the APK too, as long as the APK loads HTML Runner from its web address.
- **Other pages on those sites** show a screen with **Open full screen**, which loads the site in the whole HTML Runner window. Use the phone's Back button to come back. **Open in Chrome** sends it to Chrome.
- YouTube never goes through the page server. YouTube does check internet addresses, and it treats server addresses as bots ("Sign in to confirm you're not a bot").

## Page server (load pages through your own server)

`server/server.js` is a small server that fetches web pages for HTML Runner. With it on, the built-in browser and your Home screen website apps get every page, picture, script and request from **one address: your server**, instead of straight from each site.

What that changes:

- **Chrome extensions such as ad blockers** mostly block by site address (for example anything from `ads.example.com`). Through the page server, every request goes to your server and the site's name is encoded in the address, so those rules no longer match.
- **Sites that refuse to be shown inside other apps** (the ones that stay blank) load, because the server removes the "don't show me inside other apps" instruction.
- Each site's cookies are kept separately on your server, so logins on simple sites work.

### Run it on your computer

Needs [Node.js](https://nodejs.org) 18 or newer. Nothing to install.

```
node server/server.js
```

It starts two things:

- the page server at `http://localhost:8787`
- HTML Runner itself at `http://localhost:8080`, already set up to use the page server. Open that address and it just works.

To use it from your phone on the same Wi-Fi, open `http://<your computer's IP>:8080` on the phone.

### Put it online

Any host that runs Node works (Render, Railway, Fly.io, a VPS). The start command is `node server/server.js` and the host sets `PORT` itself. Then:

1. **Set `PROXY_KEY`** to a password of your choosing. Without it anyone who finds the address can use your server. With it, the address becomes `https://your-server.example.com/k/<your key>`.
2. The server must be on **https** when HTML Runner is (Firebase is always https). Chrome won't show http pages inside an https app. Hosts like Render give you https automatically.
3. In HTML Runner: **Home → ⚙ → Page server**, tick **Load web pages through my page server**, paste the address with the key, **Test**, then **Save**. The Browser's bottom bar shows when it's on.

Settings (environment variables, all optional):

| Setting | What it does |
|---|---|
| `PORT` | Port for the page server (default 8787) |
| `PROXY_KEY` | Password. Addresses then start with `/k/<key>` |
| `APP_PORT` | Port for serving HTML Runner itself (default 8080, `0` turns it off) |
| `ALLOW_LOCAL` | `1` lets it open addresses on your own network (192.168.x.x, localhost). Off by default so an online server can't be pointed at private machines |

### Limits worth knowing

- Ad blockers also hide parts of pages by what they look like (not by address). That still works inside Chrome, so some boxes may stay hidden.
- Sites see your server's internet address, not yours. Google, YouTube, banks and big social sites often notice this and show a check page or refuse to sign in. For those, **Open in Chrome** is still the way.
- Pages are rewritten on the way through. Most sites work; very script-heavy ones can have parts that don't.
- Service workers (offline modes of other sites) are off inside the page server.

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

## Smart suggestions (no AI, works offline)

Suggestions run entirely on your phone, so they never hit a limit and work without internet. They are on by default (Code → ⋯ → Smart suggestions).

- Knows HTML tags and attributes, CSS properties and values, and JavaScript keywords, browser APIs and methods.
- Reads your own files: ids, classes, CSS variables and the names in your script come up where they fit, for example `getElementById('` lists your ids and `class="` lists your classes.
- Typing `but` in HTML offers a full `<button></button>`; snippets like `log`, `ael`, `fn`, `qs`, `fetchjson` and CSS `center` expand into code.
- Fixes typos: `buton` → button, `docuemnt` → document.
- Learns what you pick and ranks it higher next time.
- The list stays open while you type and comes back when you delete a letter.

**AI autocomplete** (⋯ menu, off by default) shows grey suggestions while you type. Press Tab to accept. It uses the model selected in the AI section and counts against that provider's limits.

## Shortcuts

- Ctrl/⌘ + Enter: run
- Ctrl/⌘ + S: save project
- Ctrl/⌘ + Shift + A: ask AI about the selected code
- Emmet: type `ul>li*3` in index.html and press Tab
