# ============================================
# Stage 1: Dependencies Installation Stage
# ============================================

# IMPORTANT: Node.js Version Maintenance
# This Dockerfile uses Node.js 24-trixie-slim, which provides glibc 2.41, which is required by the http3 loader.
ARG NODE_VERSION=24-trixie-slim

FROM node:${NODE_VERSION} AS dependencies

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

RUN --mount=type=cache,target=/root/.npm \
  --mount=type=cache,target=/usr/local/share/.cache/yarn \
  --mount=type=cache,target=/root/.local/share/pnpm/store \
  if [ -f package-lock.json ]; then \
  npm ci --no-audit --no-fund; \
  elif [ -f yarn.lock ]; then \
  corepack enable yarn && yarn install --frozen-lockfile --production=false; \
  elif [ -f pnpm-lock.yaml ]; then \
  corepack enable pnpm && pnpm install --frozen-lockfile; \
  else \
  echo "No lockfile found." && exit 1; \
  fi



# ============================================
# Stage 2: Build Stage
# ============================================

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN if [ -f package-lock.json ]; then \
    npm run build; \
  elif [ -f yarn.lock ]; then \
    corepack enable yarn && yarn build; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm build; \
  else \
    echo "No lockfile found." >&2 && exit 1; \
  fi



# ============================================
# Stage 3: Run Stage
# ============================================

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 5000/udp

CMD ["node", "dist/server.js"]
