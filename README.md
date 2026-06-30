# NextChat

NextChat is a simple Next.js chat app with live WebSocket messaging powered by Socket.IO.

## What It Includes

- A custom Next.js server in `server.mjs` that hosts Socket.IO
- A single-room chat UI at `/`
- Live message broadcast for all connected clients
- Editable display name and lightweight room presence events

## Project Structure

```text
NextChat/
├── server.mjs                    # Custom Next.js + Socket.IO server
├── src/
│   ├── app/
│   │   ├── layout.tsx            # App shell and NextChat branding
│   │   ├── layout.css            # Global shell styling
│   │   ├── page.tsx              # Chat client page
│   │   └── page.css              # Chat UI styling
├── package.json
└── README.md
```

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

To verify realtime behavior, open the app in two browser tabs and send messages from one tab to the other.

## Production Build

```bash
npm run build
npm start
```

## WebSocket Events

- `chat:history`: sends the recent room history to a newly connected client
- `chat:join`: stores the current display name and emits a system join message
- `chat:message`: broadcasts a new chat message to every connected client

## Notes

- Message history is kept in memory, so it resets when the server restarts.
- The existing example routes like `/about`, `/users`, and `/api/*` still remain in the project, but the main app experience is now NextChat.
