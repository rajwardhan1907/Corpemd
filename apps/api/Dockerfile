FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages ./packages
RUN npm ci --workspace=apps/api
COPY apps/api ./apps/api
RUN npm run build -w apps/api

FROM node:20-alpine AS production
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY apps/api/schema.sql ./
RUN npm ci --omit=dev
RUN addgroup -g 1001 -S nodejs && adduser -S corpemd -u 1001
USER corpemd
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/index.js"]
