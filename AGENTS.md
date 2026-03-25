# AnkiICU - Neurocritical Care Anki Card Generator

An AI-powered web application for generating high-quality Anki flashcards from Neurocritical Care Board Review textbooks. Built with Next.js, TypeScript, Tailwind CSS, and integrated with Z.ai (GLM-5) for intelligent card generation.

## Project Overview

This application allows users to:
- Upload textbook content (PDF as extracted text, Markdown, or plain text)
- Automatically detect chapters and question structures
- Generate Anki flashcards in Cloze deletion or Basic Q&A formats using AI
- Export cards as JSON or CSV for import into Anki
- Track generation progress across multiple chapters

### Core Technologies

| Category | Technology |
|----------|------------|
| Framework | Next.js 16.1.1 (App Router) |
| Language | TypeScript 5.x |
| UI Library | React 19.x |
| Styling | Tailwind CSS 4.x |
| Components | shadcn/ui (New York style) |
| Database | PostgreSQL 15 |
| ORM | Prisma 6.11.1 |
| AI SDK | z-ai-web-dev-sdk (GLM-5 model) |
| Package Manager | Bun |
| Runtime | Node.js / Bun |

## Project Structure

```
AnkiICU/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── cards/         # GET/POST/DELETE cards
│   │   │   ├── export/        # Export cards (JSON/CSV)
│   │   │   ├── generate/      # AI card generation
│   │   │   ├── progress/      # Generation progress management
│   │   │   ├── upload/        # File upload handling
│   │   │   └── route.ts       # Health check endpoint
│   │   ├── globals.css        # Global styles + Tailwind v4 theme
│   │   ├── layout.tsx         # Root layout with fonts
│   │   └── page.tsx           # Main application UI (single-page app)
│   ├── components/
│   │   └── ui/                # shadcn/ui components (50+ components)
│   ├── hooks/
│   │   ├── use-mobile.ts      # Mobile breakpoint detection
│   │   └── use-toast.ts       # Toast notification system
│   └── lib/
│       ├── db.ts              # Prisma client singleton
│       └── utils.ts           # Utility functions (cn helper)
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── migrations/            # Database migrations
├── .zscripts/                 # Build and deployment scripts
│   ├── dev.sh                 # Development server startup
│   ├── build.sh               # Production build
│   └── start.sh               # Production server startup
├── scripts/
│   └── dev-local.mjs          # Embedded PostgreSQL dev script
├── components.json            # shadcn/ui configuration
├── next.config.ts             # Next.js configuration (standalone output)
├── tailwind.config.ts         # Tailwind CSS v3 configuration
├── postcss.config.mjs         # PostCSS configuration (Tailwind v4)
└── Caddyfile                  # Caddy reverse proxy config
```

## Database Schema

### Models

1. **User** - Basic user accounts (email-based)
2. **SourceFile** - Uploaded textbook files with chapter detection
   - Stores raw content, detected chapters (JSON), file metadata
3. **AnkiCard** - Generated flashcards
   - Supports both Cloze and Basic formats
   - Fields: clozeText, front/back, explanation, mnemonic, clinicalPearl, references, pitfalls
   - Indexed by chapter, chapterId, difficulty, ankiType
4. **GenerationProgress** - Singleton progress tracker (id: "main")
   - Tracks current chapter, question number, total cards generated
   - Stores generation settings (batchSize, cardType, extras)
   - Status: idle, running, paused, completed
5. **GenerationJob** - Batch job tracking for future extensibility

## Development Setup

### Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- Node.js 18+ (for some tooling)

### Environment Variables

Create `.env` file (see `.env.example`). Prisma expects **both** `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (same value for non-pooled local Postgres; Neon on Vercel sets both automatically).

```bash
# Docker Compose (npm run db:up) — port 5432
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/ankiicu"
DATABASE_URL_UNPOOLED="postgresql://postgres:postgres@127.0.0.1:5432/ankiicu"

# Embedded Postgres (npm run dev:local) — port 5433
# DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/ankiicu"
# DATABASE_URL_UNPOOLED="postgresql://postgres:postgres@127.0.0.1:5433/ankiicu"
```

**Vercel (Neon Postgres marketplace):** Install [Neon](https://vercel.com/marketplace/neon), connect the project, and confirm `DATABASE_URL` + `DATABASE_URL_UNPOOLED` are present. Production builds run `prisma migrate deploy`, which applies all migrations (tables required for upload, `GenerationProgress`, and `AnkiCard` generation).

### Development Commands

```bash
# Install dependencies
bun install

# Option A: Docker-based PostgreSQL
docker compose up -d        # Start PostgreSQL
bun run db:push            # Push schema
bun run dev                # Start dev server on port 3000

# Option B: Embedded PostgreSQL (no Docker required)
bun run dev:local          # Starts embedded Postgres + Next.js

# Database management
bun run db:migrate         # Run migrations
bun run db:reset           # Reset database
bun run db:generate        # Generate Prisma client
```

### Development Scripts

The `.zscripts/dev.sh` script automates the startup process:
1. Runs `bun install`
2. Pushes database schema
3. Starts Next.js dev server
4. Waits for health check
5. Optionally starts mini-services (if any exist in `mini-services/`)

## Build and Deployment

### Production Build

```bash
# Standard build
bun run build

# Standalone build (for deployment)
bun run build:standalone
```

The build process (`.zscripts/build.sh`):
1. Runs `bun install`
2. Generates Prisma client
3. Builds Next.js with `output: "standalone"`
4. Copies static files to standalone directory
5. Packages everything into a tarball

### Production Deployment

```bash
# Using the start script
cd /path/to/build
sh start.sh
```

The start script:
1. Initializes database if present
2. Starts Next.js server (port 3000)
3. Starts mini-services if configured
4. Runs Caddy as the main reverse proxy process

### Caddy Configuration

Caddy listens on port 81 and proxies to:
- `localhost:3000` - Next.js application
- Dynamic ports via `XTransformPort` query parameter (for mini-services)

## Code Style Guidelines

### TypeScript Configuration

- Target: ES2017
- Strict mode enabled (but `noImplicitAny: false` for flexibility)
- Path alias: `@/*` maps to `./src/*`
- Module resolution: bundler

### ESLint Configuration

The project uses a very permissive ESLint config (`eslint.config.mjs`):
- Most strict rules are disabled for rapid development
- Key disabled rules: `@typescript-eslint/no-explicit-any`, `no-unused-vars`, `react-hooks/exhaustive-deps`
- Ignores: `node_modules`, `.next`, `out`, `build`, `examples`, `skills`

### Component Patterns

1. **shadcn/ui Components**: Located in `src/components/ui/`, use `cn()` utility for class merging
2. **Client Components**: Marked with `"use client"` directive
3. **Server Components**: Default for all files in `app/`
4. **API Routes**: Use `NextRequest`/`NextResponse` from `next/server`

### Tailwind CSS v4 Setup

The project uses Tailwind CSS v4 with the new PostCSS-based configuration:
- Main CSS file: `src/app/globals.css` uses `@import "tailwindcss"`
- Theme variables defined in `:root` and `.dark` selectors using OKLCH colors
- Safelist includes cloze card highlight colors (green/blue variants)

## Key Implementation Details

### File Upload Processing

- Supported formats: `.md`, `.txt`, `.pdf` (as extracted text)
- Chapter detection: Regex pattern `/^(\d{1,2})[.\s]+([A-Z][A-Za-z\s]{3,40})$/`
- Question counting: Pattern `/^\d+\.\s+[A-Z]/`
- Stores full content in database for processing

### AI Card Generation

- Uses Z.ai (GLM-5 model) via `z-ai-web-dev-sdk`
- Prompt engineering in `src/app/api/generate/route.ts`
- Supports three card types: `cloze`, `basic`, `both`
- Optional extra fields: explanation, mnemonic, clinical_pearl, references, pitfalls
- Batch size configurable (default: 5 cards per request)

### Cloze Format Specification

The AI generates cloze deletions with this format:
```
Full vignette + all answer choices visible

The correct answer is {{c1::LETTER}} — {{c2::answer text}}.
```

- `{{c1::}}` - Primary cloze (answer letter)
- `{{c2::}}` - Secondary cloze (answer text)
- All answer choices remain visible (no cloze in choices)

### Progress Tracking

Sequential generation workflow:
1. User uploads file → chapters detected, progress initialized
2. User starts generation → status becomes "running"
3. Batch generation loops through chapters
4. Progress updates after each batch: chapterId, questionNumber, totalCardsGenerated
5. Auto-advances to next chapter when current complete
6. Status becomes "completed" when all chapters done

## Testing

No formal test suite is configured. Testing is done manually via:
- Dev server at `http://localhost:3000`
- API endpoints at `/api/*`
- Health check at root endpoint

## Security Considerations

1. **Database**: Uses parameterized queries via Prisma (SQL injection safe)
2. **File Uploads**: Only text content is processed, no binary file storage
3. **AI API**: Server-side only, API keys not exposed to client
4. **CORS**: Not explicitly configured (defaults to same-origin)
5. **Authentication**: Not implemented (single-user/local use assumed)

## Troubleshooting

### Common Issues

1. **Database connection errors**: Verify `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (see `.env.example`) and that PostgreSQL is running
2. **Prisma client errors**: Run `bun run db:generate` after schema changes
3. **Embedded Postgres issues**: Delete `.embedded-postgres/` directory to reset
4. **Build failures**: Ensure `bun` is installed and in PATH

### Logs

- Development: Console output and `dev.log` (if using scripts)
- Production: `server.log` in project root

## Mini-Services Architecture

The project supports a microservices pattern via the `mini-services/` directory:
- Each subdirectory can contain an independent service with its own `package.json`
- Services are started in background during development
- Build scripts package services alongside the main application
- Currently no services are implemented (directory contains only `.gitkeep`)

## AI Development Notes

When modifying this codebase:

1. **Database changes**: Always update `prisma/schema.prisma` and run `bun run db:push`
2. **New API routes**: Create in `src/app/api/[route]/route.ts` following existing patterns
3. **UI components**: Use shadcn/ui CLI (`npx shadcn add [component]`) or copy from `src/components/ui/`
4. **Styling**: Use Tailwind utility classes; theme colors are CSS variables in `globals.css`
5. **Icons**: Use `lucide-react` (configured as icon library in `components.json`)
