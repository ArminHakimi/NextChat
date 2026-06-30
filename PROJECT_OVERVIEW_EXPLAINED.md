# NextChat Project Overview

This document explains the core parts of NextChat so you can learn how the project works without reading every file in order.

## What This Project Is

NextChat is a small Next.js application with a custom Node.js server and Socket.IO for realtime chat.

It combines three ideas in one project:

- Next.js App Router for pages and API routes
- React client components for interactive UI
- WebSocket-style realtime messaging through Socket.IO

## High-Level Architecture

The app has two main halves:

1. The Next.js application that renders the UI and handles HTTP routes
2. The custom Node.js server that adds Socket.IO and keeps chat messages in memory

The request and message flow looks like this:

```text
Browser
  -> Next.js page request (/)
  -> Root layout renders shared shell
  -> Home page renders chat UI
  -> Client connects to Socket.IO
  -> Custom server sends chat history
  -> User sends message
  -> Server broadcasts message to all connected clients
```

## Core Files

### `package.json`

This file defines the project dependencies and the main scripts.

Important scripts:

- `npm run dev`: starts the custom server in development mode
- `npm run build`: builds the Next.js app for production
- `npm start`: starts the custom server in production mode

Important dependencies:

- `next`: framework for pages, layouts, and API routes
- `react` and `react-dom`: UI rendering
- `socket.io`: realtime server layer
- `socket.io-client`: browser-side realtime client

The important learning point is that this app does not use the default `next dev` or `next start` entry directly. It runs through a custom server so WebSocket support can live beside Next.js.

### `server.mjs`

This is the runtime center of the project.

What it does:

- creates a Node HTTP server
- attaches Next.js request handling to that server
- attaches a Socket.IO server to the same HTTP server
- stores a small in-memory `chatHistory` array
- listens for chat events like join, message, and disconnect

Key sections to understand:

#### 1. Next.js setup

```js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
```

This creates the Next.js app instance and gives the server a function that can handle normal page and API requests.

#### 2. HTTP server setup

```js
const httpServer = createServer((req, res) => handle(req, res));
```

This means every normal browser request still goes through Next.js.

#### 3. Socket.IO setup

```js
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});
```

This mounts Socket.IO on the same server, so the app can serve pages and maintain realtime connections from one process.

#### 4. Event handling

The server listens for:

- `chat:join`
- `chat:message`
- `disconnect`

When a user connects, the server immediately sends `chat:history` so the client can render existing messages.

When a user sends a message:

- the server trims and validates the text
- creates a message object with `id`, `user`, `text`, and `timestamp`
- adds it to `chatHistory`
- broadcasts it to all connected clients with `io.emit`

Learning point: this is a simple in-memory chat server. It is useful for learning because the data flow is easy to follow, but it does not persist messages after restart.

### `src/app/layout.tsx`

This is the root layout for the Next.js App Router.

What it does:

- defines page metadata
- renders the top navigation bar
- wraps every page in the shared layout shell
- renders the footer

Learning point: in the App Router, layouts are how you share structure across pages without repeating markup.

### `src/app/page.tsx`

This is the main chat page and the most important UI file in the project.

It is marked with `"use client"` because it needs:

- React state
- browser-side socket connection
- form handlers
- live UI updates

Main responsibilities of this component:

- store the current display name
- store the current draft message
- store the list of received chat messages
- open the Socket.IO connection
- subscribe to incoming realtime events
- render the chat interface

Important pieces inside the component:

#### 1. State

The page uses state for:

- `displayName`
- `draftName`
- `message`
- `messages`
- `isConnected`

This is the minimum state needed to support a basic chat room.

#### 2. Socket connection

Inside `useEffect`, the component connects with:

```ts
socket = io({
  transports: ["websocket"],
});
```

It then registers listeners for:

- `connect`
- `disconnect`
- `chat:history`
- `chat:message`

Learning point: `useEffect` is where side effects such as network subscriptions belong in a client component.

#### 3. Sending a message

When the message form is submitted, the page emits:

```ts
socket.emit("chat:message", {
  user: displayName,
  text: trimmedMessage,
});
```

That event is picked up by `server.mjs`, which then broadcasts the normalized message back to every connected client.

#### 4. Rendering messages

The page maps over the `messages` array and renders each message bubble.

It also distinguishes between:

- your own messages
- system messages
- other users' messages

This is a useful React pattern: derive visual style from data instead of hardcoding separate components too early.

### `src/app/layout.css`

This file contains the global shell styling.

What it controls:

- color variables
- page background
- navbar
- footer
- shared card and button styles
- global input styling

Learning point: shared layout styles belong in a global stylesheet because multiple parts of the app depend on them.

### `src/app/page.css`

This file styles the chat page itself.

What it controls:

- hero section
- status cards
- sidebar layout
- transcript panel
- message bubbles
- composer form
- responsive layout rules

Learning point: splitting page-specific styles from layout-wide styles makes the project easier to reason about.

### `src/app/api/greeting/route.ts`

This is an example App Router API route.

It returns a time-based greeting as JSON.

Why it matters for learning:

- it shows how backend endpoints work in Next.js
- it is separate from the chat socket flow
- it helps compare regular HTTP endpoints with realtime events

### `src/app/api/users/route.ts`

This is another example API route.

It returns mock users after a small artificial delay.

Why it matters for learning:

- it demonstrates async server logic
- it shows JSON response structure
- it remains useful as a contrast to WebSocket-based communication

## How Data Moves Through the Chat Feature

Here is the full message lifecycle:

1. The browser loads `/`.
2. Next.js renders `layout.tsx` and `page.tsx`.
3. The client component connects to the Socket.IO server.
4. The server sends existing `chatHistory` through `chat:history`.
5. The client stores that history in React state.
6. The user types a message and submits the form.
7. The client emits `chat:message`.
8. The server validates and normalizes the message.
9. The server broadcasts the message to all connected clients.
10. Each client receives the message and updates its `messages` state.
11. React re-renders the message list.

This is the most important learning loop in the project.

## Why a Custom Server Is Used

A standard Next.js app can handle HTTP routes out of the box, but it does not automatically give you a place to attach a long-lived Socket.IO server in the way this project needs.

By using `server.mjs`, the project can:

- keep Next.js page rendering
- keep Next.js API routes
- add Socket.IO on the same server

This makes the project a good learning example for combining regular web requests with realtime communication.

## Key Concepts to Learn From This Project

### 1. App Router structure

You can see how `layout.tsx`, `page.tsx`, and `route.ts` files work together in Next.js.

### 2. Client vs server responsibilities

- the browser handles local state, forms, and rendering
- the server handles broadcasting and shared room state

### 3. Realtime event-driven design

Instead of sending a normal HTTP request for each new message, the client keeps an open connection and exchanges named events.

### 4. Minimal shared state

The server stores only a small room history and the current socket user name. This keeps the example simple enough to study.

### 5. Separation of concerns

- `server.mjs` handles transport and broadcast logic
- `page.tsx` handles UI and user interaction
- CSS files handle presentation
- API routes show regular server endpoints

## Limitations of the Current Implementation

These limitations are useful learning opportunities:

- chat history is not saved to a database
- there is only one room
- there is no authentication
- users are identified only by display name
- the server state resets on restart

These are natural next steps if you want to evolve the project.

## Suggested Learning Path

If you want to study the project in a sensible order, read files in this sequence:

1. `package.json`
2. `server.mjs`
3. `src/app/layout.tsx`
4. `src/app/page.tsx`
5. `src/app/layout.css`
6. `src/app/page.css`
7. `src/app/api/greeting/route.ts`
8. `src/app/api/users/route.ts`

That order goes from application startup, to server behavior, to UI structure, to styling, to example API routes.

## Summary

NextChat is a good learning project because it stays small while still showing how several important concepts fit together:

- Next.js App Router
- client components
- custom Node server setup
- Socket.IO realtime events
- React state-driven UI
- simple API routes alongside realtime messaging

If you understand how `server.mjs` and `src/app/page.tsx` work together, you understand the core of the whole project.