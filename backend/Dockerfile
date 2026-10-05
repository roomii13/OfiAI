# ============================================
# OfiAI Backend - construir desde la raiz del repositorio
# ============================================

# Etapa 1: Construcción
FROM node:22-alpine AS builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY shared/*.d.ts /app/shared/
RUN npm run build

# Etapa 2: Producción
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/backend/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
