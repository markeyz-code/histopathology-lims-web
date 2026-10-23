# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate
WORKDIR /app

# Dependency layer: only package manifests invalidate pnpm install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @lims/api... --ignore-scripts

COPY . .
RUN pnpm --filter @lims/shared build \
  && pnpm --filter @lims/api build \
  && pnpm --filter @lims/api deploy --prod /prod/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /prod/api ./
RUN mkdir -p /app/storage && chown -R node:node /app
USER node
EXPOSE 4000 2575
CMD ["node", "dist/main.js"]
