# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_BITRIX_WEBHOOK_URL
ENV VITE_BITRIX_WEBHOOK_URL=$VITE_BITRIX_WEBHOOK_URL
RUN npm run build

# Production stage — serve static files with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
