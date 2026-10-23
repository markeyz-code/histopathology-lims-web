# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @lims/api...
RUN pnpm --filter @lims/shared build \
  && pnpm --filter @lims/api build \
  && pnpm --filter @lims/api deploy --prod /prod/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /prod/api ./
RUN mkdir -p /app/storage && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
