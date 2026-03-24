FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx tsc --skipLibCheck --noEmitOnError false || true

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 5000
# Cap Node.js V8 heap to 300 MB — prevents OOM on 1 GB server
CMD ["node", "--max-old-space-size=300", "dist/server.js"]