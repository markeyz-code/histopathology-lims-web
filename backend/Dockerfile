# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate
WORKDIR /app

# Copy dependency manifests
COPY package.json ./
COPY shared/package.json ./shared/
RUN pnpm install --ignore-scripts

COPY . .
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache su-exec
ENV NODE_ENV=production
ENV STORAGE_DIR=/data/storage
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/shared ./shared
COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data/storage && chown -R node:node /data
ENTRYPOINT ["docker-entrypoint.sh"]
EXPOSE 4000 2575
CMD ["node", "dist/main.js"]
