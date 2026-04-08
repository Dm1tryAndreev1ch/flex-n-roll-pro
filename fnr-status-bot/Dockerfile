FROM node:20-alpine
WORKDIR /app
RUN mkdir -p /app/logs
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser
CMD ["node", "src/bot.js"]
