# Build stage
FROM node:20-alpine AS builder

# Install openssl for Prisma
RUN apk add --no-cache openssl libc6-compat

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies (no postinstall now)
RUN pnpm install --frozen-lockfile

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm run build 2>/dev/null || true

# Generate Prisma and build API
WORKDIR /app/apps/api
RUN pnpm run db:generate
RUN pnpm run build

# Production stage
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

WORKDIR /app/apps/api
CMD ["sh", "-c", "pnpm run db:push && node dist/index.js"]
