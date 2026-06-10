# hae

> Self-hosted, privacy-first project management for individuals and teams. GTD-style kanban on your own infrastructure — no telemetry, no cloud lock-in.

**Version:** 1.3.2 | [hae-api](../hae-api) · [hae-mcp](../hae-mcp)

---

## Overview

**hae** is a mobile-first task management system built around the GTD (Getting Things Done) methodology. It combines a React Native app, a Bun/Hono REST API backed by SQLite, and an MCP server that lets Claude interact directly with your tasks.

Everything runs on your own server. Your data never leaves your infrastructure.

---

## 🏗 Architecture

hae is split across three repositories:

| Repo | Stack | Role |
|------|-------|------|
| `hae-app` | React Native 0.81, Expo 54, Zustand | Mobile client (iOS + Android) |
| `hae-api` | Bun, Hono 4, SQLite (WAL), ULID | REST API, auth, file storage |
| `hae-mcp` | Node.js 18+, MCP SDK, Zod | Claude MCP server |

The app communicates directly with `hae-api` over HTTPS. The MCP server also connects to `hae-api` using a bearer token or email+password credentials.

---

## ✨ Features

### Task Management (GTD/Kanban)

- **5 built-in GTD columns** per project: Inbox, Next, Urgent, Someday, Waiting — each with its own icon and semantic tooltip
- Column names are customizable per project (long-press a tab to rename)
- Custom columns can be added beyond the 5 GTD columns
- Paged horizontal layout: one column fills the screen, swipe or tap to navigate
- Quick-add card via the FAB button or inline at the top of the active column
- Card list shows: title, description preview, checklist progress bar, due date badge, running stopwatch counter, comment count bubble, and color-coded labels
- Pull-to-refresh on every column

### Card Details

Each card has a full detail sheet with:

- **Title** — tap to edit inline
- **Labels** — assign color-coded project labels; create new ones with a preset color picker
- **Due date** — custom calendar picker with today highlighted and overdue visual indicator (red)
- **Stopwatch** — start/stop time tracking; live counter displayed on the card in the column list
- **Members** — assign any project member to a card
- **Description** — full Markdown support with an inline formatting toolbar (bold, italic, inline code, H1, H2, bullet list, numbered list, blockquote); rendered with `react-native-marked`
- **Checklists** — multiple named checklists per card, per-item toggle with progress bar; AI can auto-generate items
- **Attachments** — upload any file via the document picker:
  - Images: displayed inline with a full-screen viewer and download button
  - Audio (mp3, m4a, aac, ogg, flac, wav, opus): play/pause in-app
  - Video (mp4, mov, webm, mkv, avi): downloads to cache then plays with native controls
  - Other files: download via system share sheet
- **Comments** — threaded comments with inline edit and delete; author name and timestamp shown
- Move card to any column from the top action bar
- Archive card (moves to Trash column) or permanently delete if already in Trash

### Projects

- Personal projects (owned by a user) and organisation-owned projects
- Project color
- Per-project member management with owner/member roles
- Per-project label library with hex color picker
- Per-project AI configuration (overrides org and user defaults)
- Per-project file storage: local disk or S3-compatible (endpoint, bucket, access key, secret key)
- Per-project webhook configuration
- Project settings screen accessible from the main header

### Organisations

- Create and manage organisations with name, description, and avatar
- Member roles: owner, admin, member (color-coded in the UI)
- Email invitation system with time-limited tokens
- Organisation-level AI config: all projects in the org inherit it unless overridden at project level

### 📅 Calendar

- Monthly calendar view showing all cards with a due date in the current project
- Navigate months forward and back
- Tap a day cell to see the list of cards due that day; tap a card to open the full detail sheet
- Today highlighted with a border; selected day filled

### 🔍 Search

- Full-text search across card titles in the current project
- Filter results by GTD column type
- Tap any result to open the card detail sheet

### 📦 Archives

- Dedicated archives screen listing all cards currently in the Trash column
- Restore a card to a live column or delete permanently

### 🔔 Notifications

- In-app notification feed covering: card assignment, new comments, due date reminders, and more
- Mark individual notifications or all at once as read
- Tapping a notification navigates directly to the relevant card

### 🤖 AI Features

All AI features use an OpenAI-compatible API endpoint. Configuration resolves in priority order:

1. Project-level AI config
2. Organisation-level AI config
3. User personal AI config

Supported provider presets (selectable in the UI): OpenAI, Mistral, Groq, OpenRouter, Ollama (local).

A separate STT (speech-to-text) config allows mixing providers — for example, a local Whisper instance for transcription alongside a cloud LLM for text tasks.

**Available AI actions:**

- **Voice-to-task** — record audio in the app, transcribe it via a Whisper-compatible STT API, then parse the transcript into a structured card (title, description, due date, GTD column suggestion)
- **Text-to-task parse** — submit free-form text and receive a structured card
- **AI checklist generation** — auto-generate 3-7 actionable steps for the current card title
- **Comment summary** — summarize all comments on a card in 2-3 sentences

Anti-SSRF validation is enforced on all AI endpoint URLs server-side.

### 🔐 Security and Auth

- JWT access tokens with short expiry, plus rotating refresh tokens
- Tokens stored in `expo-secure-store` (iOS Keychain / Android Keystore)
- Automatic silent token refresh on 401; in-flight requests are queued and retried
- Toast error system with user-visible retry action
- **Biometric lock** — FaceID / TouchID gate when returning to the foreground (shown only on devices with compatible hardware)
- Password change from the settings screen

### 🌐 Internationalisation

Full i18n via `i18next` and `react-i18next`. Supported languages:

- English (`en`)
- French (`fr`)
- Korean (`ko`)

Language selection persists in user preferences stored on the server.

### Profile and Settings

- Edit display name inline
- Upload a square avatar from the photo library (1:1 crop, 80% quality)
- Change password with current password verification
- Language selector
- Biometric lock toggle
- AI config sections for the personal account, each organisation, and each project — all accessible from the settings tab

---

## 📱 App Setup

### Prerequisites

- Node.js 18+
- `npx expo` available (no global install required)
- iOS Simulator, Android Emulator, or a physical device with Expo Go

### Install

```bash
cd hae-app
npm install
```

The `postinstall` script automatically applies a compatibility patch for `react-native-gesture-handler`.

### Configure server URL

On first launch the app displays a server URL field before the login screen. Enter the base URL of your `hae-api` instance (e.g. `https://hae.example.com`). The URL is stored securely and can be changed from the login screen.

### Start

```bash
npx expo start --clear     # Expo dev tools
npx expo start --android   # Android emulator direct
npx expo start --ios       # iOS simulator direct
npx expo start --web       # Web (limited)
```

Always pass `--clear` to avoid stale Metro cache issues.

---

## 🖥 API Setup (hae-api)

See [hae-api/README.md](../hae-api/README.md) for the full reference.

### Quick start

```bash
cd hae-api
bun install
bun run index.ts
```

The API listens on port `8150` by default.

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HAE_PORT` | No | `8150` | Listening port |
| `HAE_JWT_SECRET` | **Yes** | — | JWT access token signing secret (min 32 chars) |
| `HAE_REFRESH_SECRET` | **Yes** | — | Refresh token signing secret |
| `HAE_DB_PATH` | No | `./hae.db` | SQLite database file path |
| `HAE_UPLOADS_DIR` | No | `./uploads` | Directory for attachment uploads |
| `HAE_CORS_ORIGINS` | **Yes in prod** | — | Comma-separated allowed CORS origins |
| `HAE_ADMIN_EMAIL` | No | — | Bootstrap admin email |
| `HAE_ADMIN_PASSWORD` | No | — | Bootstrap admin password |

### Docker example

```yaml
services:
  hae-api:
    image: oven/bun:1
    working_dir: /app
    volumes:
      - ./hae-api:/app
      - hae-data:/app/data
    command: bun run index.ts
    environment:
      HAE_PORT: "8150"
      HAE_JWT_SECRET: "change-to-a-long-random-string"
      HAE_REFRESH_SECRET: "change-to-another-long-random-string"
      HAE_DB_PATH: "/app/data/hae.db"
      HAE_UPLOADS_DIR: "/app/data/uploads"
      HAE_CORS_ORIGINS: "https://your-app-origin"
    ports:
      - "8150:8150"
    restart: unless-stopped

volumes:
  hae-data:
```

---

## 🤖 MCP Setup (hae-mcp)

The MCP server exposes your hae instance as tools for Claude (Claude Desktop, Claude Code, or any MCP-compatible client). It provides complete API coverage across 57 tools.

See [hae-mcp/README.md](../hae-mcp/README.md) for the full tool reference.

### Install

```bash
npm install -g @breizhzion/hae-mcp
```

Or run without a global install:

```bash
npx -y @breizhzion/hae-mcp
```

### Claude Desktop configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hae": {
      "command": "npx",
      "args": ["-y", "@breizhzion/hae-mcp"],
      "env": {
        "HAE_URL": "https://hae.example.com",
        "HAE_EMAIL": "you@example.com",
        "HAE_PASSWORD": "your-password"
      }
    }
  }
}
```

Alternatively, use a long-lived JWT token:

```json
"env": {
  "HAE_URL": "https://hae.example.com",
  "HAE_TOKEN": "your-jwt-token"
}
```

### Available tool categories

| Category | Tools |
|----------|-------|
| Projects | list, get, create, update, delete, assign org, manage members |
| Columns | create, rename, delete |
| Cards | list, get, create, update, duplicate, delete, activity log |
| Stopwatch | start, stop |
| Card members | add, remove |
| Card labels | add, remove |
| Card subscriptions | subscribe, unsubscribe |
| Comments | list, add, edit, delete |
| Checklists | add, rename, delete; items: add, toggle, delete |
| Labels | list, create, update, delete |
| Organisations | list, get, create, update, delete, manage members |
| Notifications | list, mark read, mark all read |
| Users | get me, update profile, change password, search by email |
| Admin | list users, update role/status, delete user |
| Preferences | get, set |
| AI | parse text to structured card, generate checklist, summarize card |

---

## 📸 Screenshots

_Coming soon._

---

## License

MIT
