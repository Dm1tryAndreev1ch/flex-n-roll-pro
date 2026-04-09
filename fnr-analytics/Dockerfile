FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# VITE_BITRIX_WEBHOOK_URL can be empty — users configure via Settings page
ARG VITE_BITRIX_WEBHOOK_URL=""
ENV VITE_BITRIX_WEBHOOK_URL=$VITE_BITRIX_WEBHOOK_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
