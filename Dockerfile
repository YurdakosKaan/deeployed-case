# ---- Base Stage ----
FROM oven/bun:1.0 as base
WORKDIR /usr/src/app

# ---- Dependencies Stage ----
FROM base as deps
WORKDIR /usr/src/app
COPY package.json bun.lock ./
# Install dependencies with Bun (use --frozen-lockfile=false in CI to allow updates if needed)
RUN bun install --frozen-lockfile

# ---- Build Stage ----
FROM base as build
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN bun run build

# ---- Production Stage ----
FROM node:18-alpine
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY package.json ./

EXPOSE 8080
CMD ["node", "dist/index.js"]

