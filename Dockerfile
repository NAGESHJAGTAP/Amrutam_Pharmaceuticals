# Multi-stage production Dockerfile for Amrutam Telemedicine Backend
# Stage 1: Build & Prune
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies including OpenSSL for Prisma
RUN apk add --no-cache python3 make g++ openssl libc6-compat

# Copy package manifests
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src/

# Compile TypeScript to dist/
RUN npm run build

# Remove development dependencies to keep production image small
RUN npm prune --production

# Stage 2: Minimal Production Image
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=4000

# Install OpenSSL runtime dependency for Prisma in Alpine
RUN apk add --no-cache openssl libc6-compat

# Create unprivileged user for security compliance (OWASP non-root)
RUN addgroup -S nodejs -g 1001 && adduser -S nodejs -u 1001

# Copy compiled code and node_modules from builder
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Set correct ownership
USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:4000/healthz || exit 1

CMD ["node", "dist/server.js"]
