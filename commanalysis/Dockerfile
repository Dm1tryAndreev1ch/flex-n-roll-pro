FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Expose default express port if required
EXPOSE 3000
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /app/logs /tmp/commanalysis \
    && chown -R appuser:appgroup /app /tmp/commanalysis
USER appuser
CMD ["node", "src/server.js"]
