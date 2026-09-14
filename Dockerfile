# syntax=docker/dockerfile:1
# Fixi – Image für Docker/Portainer. Gebaut von .github/workflows/docker.yml
# (linux/amd64 + linux/arm64) und abgelegt unter ghcr.io/chrschick/fixi-fixkosten.

# ---- Build: Frontend (vite) + Server-Bundle (esbuild) ----
# Läuft auf der Plattform des Build-Rechners, das Ergebnis ist plattformunabhängig.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY . .
RUN yarn build

# ---- Laufzeit-Abhängigkeiten für die Zielplattform ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile --non-interactive \
  && yarn cache clean

# ---- Runtime ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5174
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
USER node
EXPOSE 5174
# start-period deckt das Warten auf die Datenbank ab (bis zu 2 Minuten)
HEALTHCHECK --interval=30s --timeout=5s --start-period=150s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5174)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/index.mjs"]
