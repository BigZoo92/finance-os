# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.15.0
ARG BUN_VERSION=1.2.22
ARG PNPM_VERSION=10.15.0
ARG GIT_SHA=unknown
ARG GIT_TAG=unknown
ARG BUILD_TIME=unknown

FROM node:${NODE_VERSION}-alpine AS pnpm-base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM pnpm-base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/powens/package.json packages/powens/package.json
COPY packages/prelude/package.json packages/prelude/package.json
COPY packages/redis/package.json packages/redis/package.json
COPY packages/ui/package.json packages/ui/package.json

FROM manifests AS deps
RUN pnpm install --frozen-lockfile

FROM deps AS build-web
COPY . .
ARG VITE_APP_TITLE=finance-os
ARG VITE_API_BASE_URL=/api
ARG API_INTERNAL_URL=http://finance-os-api:3001
ENV NODE_ENV=production
ENV VITE_APP_TITLE=${VITE_APP_TITLE}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
RUN pnpm --filter @finance-os/web build

FROM manifests AS deps-api
RUN pnpm install --frozen-lockfile --prod --filter @finance-os/api...

FROM deps-api AS bundle-api
COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/env packages/env
COPY packages/powens packages/powens
COPY packages/prelude packages/prelude
COPY packages/redis packages/redis
COPY infra/docker infra/docker

FROM oven/bun:${BUN_VERSION}-alpine AS api
ARG GIT_SHA
ARG GIT_TAG
ARG BUILD_TIME
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3001 \
    RUN_DB_MIGRATIONS=true \
    DRIZZLE_MIGRATIONS_FOLDER=packages/db/drizzle \
    HEALTHCHECK_URL=http://127.0.0.1:3001/health \
    GIT_SHA=${GIT_SHA} \
    GIT_TAG=${GIT_TAG} \
    BUILD_TIME=${BUILD_TIME}
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=bundle-api --chown=app:app /app/node_modules ./node_modules
COPY --from=bundle-api --chown=app:app /app/apps/api ./apps/api
COPY --from=bundle-api --chown=app:app /app/packages/db ./packages/db
COPY --from=bundle-api --chown=app:app /app/packages/env ./packages/env
COPY --from=bundle-api --chown=app:app /app/packages/powens ./packages/powens
COPY --from=bundle-api --chown=app:app /app/packages/prelude ./packages/prelude
COPY --from=bundle-api --chown=app:app /app/packages/redis ./packages/redis
COPY --from=bundle-api --chown=app:app /app/infra/docker ./infra/docker
RUN chmod +x ./infra/docker/entrypoints/api-entrypoint.sh
USER app
EXPOSE 3001
ENTRYPOINT ["./infra/docker/entrypoints/api-entrypoint.sh"]

FROM manifests AS deps-worker
RUN pnpm install --frozen-lockfile --prod --filter @finance-os/worker...

FROM deps-worker AS bundle-worker
COPY apps/worker apps/worker
COPY packages/db packages/db
COPY packages/env packages/env
COPY packages/powens packages/powens
COPY packages/prelude packages/prelude
COPY packages/redis packages/redis
COPY infra/docker infra/docker

FROM oven/bun:${BUN_VERSION}-alpine AS worker
ARG GIT_SHA
ARG GIT_TAG
ARG BUILD_TIME
ENV NODE_ENV=production \
    WORKER_HEALTHCHECK_FILE=/tmp/worker-heartbeat \
    WORKER_HEALTHCHECK_MAX_AGE_MS=120000 \
    GIT_SHA=${GIT_SHA} \
    GIT_TAG=${GIT_TAG} \
    BUILD_TIME=${BUILD_TIME}
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
RUN mkdir -p /var/run/finance-os \
    && touch /var/run/finance-os/.keep \
    && chown -R app:app /var/run/finance-os
COPY --from=bundle-worker --chown=app:app /app/node_modules ./node_modules
COPY --from=bundle-worker --chown=app:app /app/apps/worker ./apps/worker
COPY --from=bundle-worker --chown=app:app /app/packages/db ./packages/db
COPY --from=bundle-worker --chown=app:app /app/packages/env ./packages/env
COPY --from=bundle-worker --chown=app:app /app/packages/powens ./packages/powens
COPY --from=bundle-worker --chown=app:app /app/packages/prelude ./packages/prelude
COPY --from=bundle-worker --chown=app:app /app/packages/redis ./packages/redis
COPY --from=bundle-worker --chown=app:app /app/infra/docker ./infra/docker
RUN chmod +x ./infra/docker/entrypoints/worker-entrypoint.sh
USER app
ENTRYPOINT ["./infra/docker/entrypoints/worker-entrypoint.sh"]

FROM node:${NODE_VERSION}-alpine AS web
ARG GIT_SHA
ARG GIT_TAG
ARG BUILD_TIME
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    PORT=3000 \
    HEALTHCHECK_URL=http://127.0.0.1:3000 \
    GIT_SHA=${GIT_SHA} \
    GIT_TAG=${GIT_TAG} \
    BUILD_TIME=${BUILD_TIME}
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build-web --chown=app:app /app/apps/web/.output ./apps/web/.output
COPY --from=build-web --chown=app:app /app/infra/docker ./infra/docker
RUN chmod +x ./infra/docker/entrypoints/web-entrypoint.sh
USER app
EXPOSE 3000
ENTRYPOINT ["./infra/docker/entrypoints/web-entrypoint.sh"]
