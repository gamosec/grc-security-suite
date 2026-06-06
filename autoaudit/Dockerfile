# AutoAudit - on-prem / Docker image (Vite SPA + Node API server)
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Build the React SPA with Vite
COPY package.json package-lock.json* ./
RUN npm install
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# Install server runtime deps
COPY server ./server
RUN cd server && npm install --omit=dev

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

WORKDIR /app/server
EXPOSE 3000
CMD ["node", "server.mjs"]
