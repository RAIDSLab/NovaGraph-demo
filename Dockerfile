FROM node:22-slim AS base-deps
WORKDIR /src
COPY package.json package-lock.json ./

FROM base-deps AS development-deps
RUN npm ci

FROM base-deps AS production-deps
RUN npm ci --omit=dev

FROM development-deps AS build
# Build arguments for Kuzu configuration (can be passed during docker build)
ARG KUZU_TYPE=persistent
ARG KUZU_MODE=async
ARG KUZU_DB_PATH=
# Set as environment variables for Vite build process
ENV VITE_KUZU_TYPE=${KUZU_TYPE}
ENV VITE_KUZU_MODE=${KUZU_MODE}
ENV VITE_KUZU_DB_PATH=${KUZU_DB_PATH}
COPY . .
RUN npm run build

FROM development-deps AS development
ENV NODE_ENV=development
# Kuzu configuration environment variables (can be overridden at runtime):
# - KUZU_TYPE / VITE_KUZU_TYPE: "inmemory" or "persistent" (default: "persistent")
# - KUZU_MODE / VITE_KUZU_MODE: "sync" or "async" (default: "async")
# - KUZU_DB_PATH / VITE_KUZU_DB_PATH: optional database path for persistent mode
# Note: VITE_ prefixed variables are for client-side access in Vite
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM production-deps AS production
ENV NODE_ENV=production
# Kuzu configuration environment variables (can be overridden at runtime):
# - KUZU_TYPE / VITE_KUZU_TYPE: "inmemory" or "persistent" (default: "persistent")
# - KUZU_MODE / VITE_KUZU_MODE: "sync" or "async" (default: "async")
# - KUZU_DB_PATH / VITE_KUZU_DB_PATH: optional database path for persistent mode
# Note: VITE_ prefixed variables are for client-side access in Vite
COPY --from=build /src/build ./build
EXPOSE 3000
CMD ["npm", "run", "start"]
