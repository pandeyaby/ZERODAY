FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV ZERODAY_DATA_DIR=/data
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 zeroday

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/data ./data
# Optional: only our vendor README ships; clone Plinius at deploy time if needed
COPY --from=builder /app/vendor/plinius/README.md ./vendor/plinius/README.md

RUN chown -R zeroday:nodejs /app /data

USER zeroday
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]
