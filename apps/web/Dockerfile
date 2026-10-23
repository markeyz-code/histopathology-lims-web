# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @lims/web...
RUN pnpm --filter @lims/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.output ./
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
