# Cursor Usage Monitor

A lightweight Cursor IDE extension that shows your remaining AI requests directly in the status bar — without ever leaving the editor.

---

## What it does

Every time you use Cursor AI (chat, autocomplete, inline edits), it consumes a "fast request" from your monthly quota. Previously, the only way to check how many you had left was to open a browser, navigate to the Cursor dashboard, and log in.

![Cursor Usage Monitor](https://github.com/Sammy970/cursor-usage-extension/blob/main/media/cursor-usage-monitor.png?raw=true)

This extension puts that number right in your status bar:

```
⚡ 350 left
```

Hover over it for a full breakdown:

```
Cursor AI Usage

⚡ Fast requests used: 150 / 500
✅ Remaining: 350

Since 3/1/2026
Last updated: 2:45:00 PM

Click to refresh
```

- Turns **red** when fewer than 50 requests remain
- Auto-refreshes every **5 minutes** in the background
- Click the status bar item at any time to **manually refresh**

---

## Installation

### From VSIX (recommended for now)

1. Download `cursor-usage-1.0.0.vsix` from the releases
2. Open Cursor
3. Go to the Extensions panel (`Cmd+Shift+X`)
4. Click the `...` menu → **Install from VSIX...**
5. Select the downloaded file

The extension activates automatically on startup — no configuration needed.

---

## How it was built

### The problem with the obvious approach

The Cursor website exposes a usage API at `cursor.com/api/usage`. However, that endpoint requires the browser session cookie (`WorkosCursorSessionToken`) that is set when you log into cursor.com in a browser. A VS Code extension runs in Node.js, not a browser context, so it has no access to browser cookies.

### Finding the right API

Cursor (like VS Code) is built on Electron and stores its authentication state in a local SQLite database:

```
~/Library/Application Support/Cursor/User/globalStorage/state.vscdb  (macOS)
%APPDATA%\Cursor\User\globalStorage\state.vscdb                       (Windows)
~/.config/Cursor/User/globalStorage/state.vscdb                       (Linux)
```

The database contains an `ItemTable` with a key `cursorAuth/accessToken` — a JWT that the Cursor app uses to authenticate with its own backend.

By probing Cursor's internal API (`api2.cursor.sh`) with this token, the correct endpoint was found:

```
GET https://api2.cursor.sh/auth/usage
Authorization: Bearer <accessToken>
```

This returns:

```json
{
  "gpt-4": {
    "numRequests": 150,
    "maxRequestUsage": 500
  },
  "startOfMonth": "2026-03-01T00:00:00.000Z"
}
```

### Architecture

```
state.vscdb (SQLite)
    └── cursorAuth/accessToken
            │
            ▼
    auth.ts reads token
            │
            ▼
    api.ts calls api2.cursor.sh/auth/usage
            │
            ▼
    statusBar.ts renders "⚡ 350 left"
```

The extension is built with:

- **TypeScript** — for type safety across the entire codebase
- **sql.js** — a pure WebAssembly SQLite reader (no native compilation required, works cross-platform out of the box)
- **Node.js `https` module** — for the API call (no third-party HTTP libraries)
- **VS Code Extension API** — for the status bar item, commands, and lifecycle management

### Security design

- The access token is read from disk on each refresh and **never stored** by the extension
- The token is sent **only** to `api2.cursor.sh` over HTTPS — no third-party servers, no telemetry
- Error messages are sanitised to **never expose** the token or local filesystem paths
- The database is opened **read-only** and closed immediately after extracting the token

---

## Project structure

```
cursor-usage-extension/
├── src/
│   ├── extension.ts   — activation, refresh command, 5-min auto-refresh timer
│   ├── auth.ts        — reads accessToken from Cursor's local SQLite database
│   ├── api.ts         — calls api2.cursor.sh/auth/usage, parses response
│   └── statusBar.ts   — status bar item, tooltip, warning colour
├── icon.png
├── package.json
└── tsconfig.json
```

---

## Building from source

```bash
git clone https://github.com/samyakjain/cursor-usage-extension
cd cursor-usage-extension
npm install
npm run compile
```

To package into a `.vsix`:

```bash
npm install -g @vscode/vsce
vsce package
```

---

## License

MIT — see the LICENSE file included in this repository.
