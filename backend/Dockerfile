# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate
WORKDIR /app

# Dependency layer: only package manifests invalidate pnpm install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY backend/shared/package.json backend/shared/package.json
RUN pnpm install --frozen-lockfile --filter @lims/api... --ignore-scripts

COPY . .
RUN pnpm --filter @lims/api build \
  && pnpm --filter @lims/api deploy --prod /prod/api

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache su-exec
ENV NODE_ENV=production
ENV STORAGE_DIR=/data/storage
COPY --from=build --chown=node:node /prod/api ./
COPY --chown=root:root backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data/storage && chown -R node:node /data
ENTRYPOINT ["docker-entrypoint.sh"]
EXPOSE 4000 2575
CMD ["node", "dist/main.js"]
