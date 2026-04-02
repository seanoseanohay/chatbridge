FROM node:22.22.2-bookworm AS build

WORKDIR /app

ARG PLUGIN_BACKEND_URL=https://backend-production-8727.up.railway.app
ENV PLUGIN_BACKEND_URL=${PLUGIN_BACKEND_URL}
ENV CHATBOX_BUILD_PLATFORM=web

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
COPY server/package.json ./server/package.json
COPY release/app/package.json ./release/app/package.json

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile --prefer-offline
RUN pnpm build:web

FROM caddy:2.8.4-alpine

COPY deploy/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/release/app/dist/renderer /srv

EXPOSE 80
