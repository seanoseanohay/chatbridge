FROM node:22.22.2-bookworm

WORKDIR /app

COPY package.json ./package.json

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN pnpm install --ignore-scripts

COPY . .

ENV NODE_ENV=production
EXPOSE 8080

CMD ["pnpm", "start"]
