FROM node:22.22.2-bookworm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
COPY server/package.json ./server/package.json

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN pnpm install --filter chatbridge-server... --frozen-lockfile --prefer-offline --ignore-scripts

COPY server ./server

WORKDIR /app/server

ENV NODE_ENV=production
EXPOSE 8080

CMD ["pnpm", "start"]
