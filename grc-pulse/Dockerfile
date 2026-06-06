# GRC Pulse - on-prem / Docker image (Node + PostgreSQL + AI adapter)
# Multi-stage: build the Hono app bundle, then run on a slim Node image.
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install server deps (esbuild, hono, pg, node-server)
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install

# Copy application source + server tooling
COPY src ./src
COPY public ./public
COPY tsconfig.json ./tsconfig.json
COPY server ./server

# Peer URL for cross-system sync (Pentest Pulse). Rewritten into the bundle at
# build time; defaults to the production URL when unset.
ARG PENTEST_PULSE_URL=https://pentest-pulse.pages.dev
ENV PENTEST_PULSE_URL=${PENTEST_PULSE_URL}

# Bundle src/index.tsx -> server/dist-server/app.mjs
RUN cd server && node build.mjs

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/server ./server
COPY --from=build /app/public ./public

WORKDIR /app/server
EXPOSE 3000
CMD ["node", "server.mjs"]
