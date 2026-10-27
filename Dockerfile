# Build stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (opus, sodium)
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/bots/ops-bot/package.json ./apps/bots/ops-bot/
COPY apps/bots/media-bot/package.json ./apps/bots/media-bot/
COPY apps/bots/dev-bot/package.json ./apps/bots/dev-bot/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN HUSKY=0 pnpm install --frozen-lockfile

# Copy full source code
COPY . .

# Build all workspaces
RUN pnpm build

# Production stage
FROM node:20-bookworm-slim

WORKDIR /app

# Install ffmpeg for media streaming
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy from builder
COPY --from=builder /app ./

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Which bot to run? (ops-bot, media-bot, dev-bot)
ENV APP_NAME=ops-bot

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Start the specific bot
CMD ["sh", "-c", "if [ -f apps/bots/${APP_NAME}/dist/index.js ]; then node apps/bots/${APP_NAME}/dist/index.js; else node apps/${APP_NAME}/dist/index.js; fi"]
