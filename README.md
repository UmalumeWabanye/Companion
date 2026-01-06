# HER — Gentle Support

A small, calming web app: pick a mood (based on the five stages of grief), share why you feel that way, and receive a comforting, motivational message. Works offline with curated messages and can optionally use an AI backend for more tailored responses.

## Features

- Mood selection: Denial, Anger, Bargaining, Depression, Acceptance
- Optional input to share your reason for feeling that way
- Supportive messages: curated offline generator with simple heuristics
- Optional AI backend: OpenAI-powered messages via a local Node server
- Accessible, responsive design with modern, calming UI
- Auto light/dark theme via system preference
- Subtle motion with `prefers-reduced-motion` respected

## Quick start (static site)

1. Serve the site from the project directory.
2. Open in your browser at the localhost address.

### macOS (Python SimpleHTTPServer)

```sh
# From /Users/apple/Projects/HER
python3 -m http.server 5500
# Then visit http://localhost:5500
```

This uses the offline generator by default.

## Optional: AI backend
# Conversation history (SQLite)

The local API server now persists conversations in a SQLite database (`her.db`). Each conversation stores:

- userId (generated client-side and stored in localStorage)
- mood
- answers (JSON summary of question responses)
- message (generated support reflection)
- timestamp

### Endpoints

- `POST /api/conversation` — Save a conversation
	- Body: `{ userId, mood, answers, message }`
- `POST /api/conversations` — List conversations
	- Body: `{ userId, limit?, offset? }`
- `POST /api/themes` — Aggregate themes
	- Body: `{ userId }`
- `POST /api/generate` — Generate AI message
	- Body: `{ mood, reason, userId? }` — When `userId` is provided, the server also saves the conversation.

### Run

```sh
export OPENAI_API_KEY="your_key_here" # optional, for AI messages
npm install
npm run start:api
# DB file her.db will be created automatically in project root
```

### Client behavior

- On first load, the client creates a `userId` and stores it in `localStorage`.
- After generating a message (AI or offline), the client saves the conversation via the API.
- If the API is unavailable, it stores a limited history in `localStorage` as fallback.
- The client fetches aggregated themes and reorders questions to prioritize relevant prompts.

If you have an OpenAI API key and want AI-tailored messages:

```sh
# From /Users/apple/Projects/HER
export OPENAI_API_KEY="your_key_here"
npm install
npm run start:api
# Server starts at http://localhost:3001
```

With the API server running, the frontend will call `POST /api/generate`; if the call fails or times out, it falls back to the offline generator.

### Privacy note

- Your input is used only to generate your message. The frontend does not store it.
- If you enable the AI backend, your input is sent to OpenAI for the purpose of generating the message.
- This app is not a substitute for professional care. If you are in crisis, please seek local emergency support.

## Project structure

- `index.html` — App markup
- `style.css` — Visual styles
- `script.js` — Client logic; offline generator; AI fallback
- `server.js` — Optional Node Express server with OpenAI integration
- `package.json` — Dependencies and scripts for the optional backend

## Next steps

- Add additional moods or custom entries
- Provide language selection
- Add logging and analytics (opt-in)
- Host as a static site with serverless function for AI

## Design and theming

- The UI uses a minimal, modern aesthetic with a calm blue/purple accent.
- Colors, radii, blur, and shadows are defined as CSS variables in `style.css`.
- Light/dark theme is automatic using `prefers-color-scheme`.
- Motion is subtle; users with `prefers-reduced-motion` will see transitions disabled.

### Customize theme

- Edit variables in `:root` and the `@media (prefers-color-scheme: light)` block.
- Primary accent variables: `--primary`, `--accent`.
- Surfaces: `--bg`, `--surface`, `--card`.
- Accessibility: ensure contrast remains > 4.5:1 for body text.
