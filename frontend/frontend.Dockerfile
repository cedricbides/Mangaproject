FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } location /api { proxy_pass http://mangaverse-backend:5000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; } location /auth { proxy_pass http://mangaverse-backend:5000; proxy_set_header Host $host; } location /uploads { proxy_pass http://mangaverse-backend:5000; proxy_set_header Host $host; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]