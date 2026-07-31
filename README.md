# Personal AI Assistant

DeepSeek-powered chat assistant with long-term memory (Postgres full-text search) and Tavily web search. Single-user, password-gated, Vercel-ready.

## Stack

- Next.js 15 (App Router) + TypeScript strict
- Tailwind CSS 4
- Postgres via Neon (@neondatabase/serverless + Drizzle ORM)
- DeepSeek via the openai npm package (DeepSeek is OpenAI-compatible)
- Tavily for web search
- Hand-rolled SSE streaming (token-by-token)

## Setup

### Prerequisites

- Node.js 20+
- npm
- A Neon account (free tier is fine)
- A DeepSeek API key (platform.deepseek.com)
- A Tavily API key (tavily.com)

### Install

```
npm install
```

### Configure environment

Copy `.env.example` to `.env.local` and fill in the values:

```
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
TAVILY_API_KEY=tvly-...
APP_PASSWORD=choose-a-strong-password
```

`APP_PASSWORD` is the single-user password gate. If it is empty, the app runs without auth (dev convenience) - set it before deploying.

### Create the Neon database

In the Neon console, create a new database (default `neondb` works). Use the connection string from the Neon dashboard in `DATABASE_URL`.

### Generate and apply migrations

```
npm run db:generate
npm run db:migrate
```

The first migration creates `conversations`, `messages`, and `memories` tables plus the full-text search index (tsv columns with GIN indexes) and the `pg_trgm` extension used for memory deduplication.

### Run

```
npm run dev
```

Open http://localhost:3000. If you set `APP_PASSWORD`, you will see a login page - enter the password and you are in.

## Features

- Streaming answers from DeepSeek, token-by-token via SSE
- Long-term memory - remembers facts, preferences, entities, and tasks across all conversations, extracted after each reply in a non-blocking background call
- Cross-conversation recall - relevant excerpts from past chats injected into the context window via Postgres full-text search
- Web search - DeepSeek decides when to call the web_search tool (max 2 rounds per turn); answers carry numbered sources
- Conversation summaries - regenerated every 10th message
- Global search - sidebar search box queries all messages and memories
- Memories page (/memories) - review and prune what the assistant knows
- Password gate - single-user auth, enforced by middleware

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, Import Project and select the repo.
3. Add the environment variables (Settings -> Environment Variables): DATABASE_URL, DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, TAVILY_API_KEY, APP_PASSWORD.
4. Deploy. The build runs next build automatically; the Neon serverless driver works at the edge and on Node without extra config.

## PowerShell quick reference

```
# install
npm install

# set up env
Copy-Item .env.example .env.local

# migrations
npm run db:generate
npm run db:migrate

# run locally
npm run dev
```

## Architecture notes

- All DeepSeek and Tavily calls live in src/lib/ modules (deepseek.ts, tavily.ts) with typed inputs and outputs.
- The context window is assembled in src/lib/context.ts in a fixed order: system prompt, memories (top 15 by ts_rank), cross-conversation recall (top 6), conversation summary (if thread > 10 messages), recent 12 turns. Hard-capped at ~8000 tokens; section 3 drops first, then 2, never 5.
- Memory extraction (src/lib/memory.ts) runs after each reply in the background and dedupes with similarity(content, existing) > 0.8 (pg_trgm).
- Rate limits / 5xx from DeepSeek get one retry with exponential backoff.