FROM node:20-alpine
WORKDIR /app
RUN mkdir -p /app/logs
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/bot.js"]
