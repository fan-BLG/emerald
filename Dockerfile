# Build stage
FROM node:20-alpine AS builder

# Install openssl for Prisma
RUN apk add --no-cache openssl openssl-dev

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy all source files (needed for postinstall prisma generate)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install dependencies (postinstall will run prisma generate)
RUN pnpm install --frozen-lockfile

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm run build 2>/dev/null || true

# Build API
WORKDIR /app/apps/api
RUN pnpm run build

# Production stage
FROM node:20-alpine AS runner

# Install openssl for Prisma runtime
RUN apk add --no-cache openssl

# Install pnpm for db:push
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

WORKDIR /app/apps/api

# Run db:push to sync schema, then start server
CMD ["sh", "-c", "pnpm run db:push && node dist/index.js"]
