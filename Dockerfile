# ---- Base Stage ----
FROM oven/bun:1.0 as base
WORKDIR /usr/src/app

# ---- Dependencies Stage ----
FROM base as deps
RUN mkdir -p /temp/prod_deps
COPY package.json bun.lockb /temp/prod_deps/
RUN cd /temp/prod_deps && bun install --production

# ---- Build Stage ----
FROM base as build
COPY --from=deps /temp/prod_deps/node_modules ./node_modules
COPY . .
RUN bun run build

# ---- Production Stage ----
FROM gcr.io/distroless/nodejs:18
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
COPY --from=deps /temp/prod_deps/node_modules ./node_modules

EXPOSE 3000
CMD ["dist/index.js"]

