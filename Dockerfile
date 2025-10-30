# ---- Base Stage ----
FROM oven/bun:1.0 as base
WORKDIR /usr/src/app

# ---- Dependencies Stage ----
FROM node:18-alpine as deps
WORKDIR /temp/prod_deps
COPY package.json ./
# Install all deps with npm (avoids bun frozen lockfile behavior in CI)
RUN npm install --legacy-peer-deps

# ---- Build Stage ----
FROM base as build
COPY --from=deps /temp/prod_deps/node_modules ./node_modules
COPY . .
RUN bun run build

# ---- Production Stage ----
FROM node:18-alpine
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist ./dist
COPY --from=deps /temp/prod_deps/node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/index.js"]

