# ── Build stage: produce the production Angular bundle ───────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies (layer-cached on package files)
COPY package*.json ./
RUN npm ci

# Build (production configuration → uses environment.prod.ts, apiBaseUrl '/api')
COPY . .
RUN npm run build

# ── Runtime stage: nginx serves the static app and proxies /api ──────────────
FROM nginx:alpine AS final
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/alon-project-frontend/browser /usr/share/nginx/html
EXPOSE 80
