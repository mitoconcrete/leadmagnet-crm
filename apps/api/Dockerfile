FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api
COPY apps/api apps/api
RUN pnpm --filter api build
EXPOSE 3001
CMD ["sh", "apps/api/docker-entrypoint.sh"]
