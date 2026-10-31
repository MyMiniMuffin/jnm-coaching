# Build the Vite site, then run it with server.mjs (replaces Netlify hosting + functions).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    CONTEXT=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server.mjs ./
COPY netlify/functions ./netlify/functions
COPY scripts/migrate-production.cjs ./scripts/
COPY migrations ./migrations

USER node
EXPOSE 3000

# Netlify ran the migrations on every production build; they are idempotent.
CMD ["sh", "-c", "node scripts/migrate-production.cjs && exec node server.mjs"]
