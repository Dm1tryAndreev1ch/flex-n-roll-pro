FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Marking Server runs on 3000 typically too, will be resolved in compose
EXPOSE 3000
CMD ["node", "src/server.js"]
