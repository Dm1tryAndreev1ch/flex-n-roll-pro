FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies only (layer cached separately)
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 webhook

# Copy installed modules and app code
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pre-create runtime directories and set ownership
RUN mkdir -p logs data && chown -R webhook:nodejs logs data

USER webhook

EXPOSE 3000

CMD ["node", "src/server.js"]