FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# VITE_API_URL must be passed at build time so Vite bakes the backend URL

# into the bundle. On Render/separate services the nginx proxy to

# mangaverse-backend:5000 does not work — the Docker internal hostname only

# exists inside Docker Compose, not across Render isolated containers.

# Build command: docker build --build-arg VITE_API_URL=https://mangaproject.onrender.com .

# On Render dashboard: set VITE_API_URL in the build environment variables.

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npx vite build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
