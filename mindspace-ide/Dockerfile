FROM node:22-bookworm AS build
WORKDIR /app
RUN corepack enable && corepack prepare yarn@stable --activate

# Copy yarn config first (nodeLinker: node-modules)
COPY .yarnrc.yml ./

# Copy workspace config
COPY package.json yarn.lock* ./
COPY browser-app/package.json browser-app/
COPY extensions/@mindspace/theia-a2a/package.json extensions/@mindspace/theia-a2a/
COPY extensions/@mindspace/theia-branding/package.json extensions/@mindspace/theia-branding/
COPY extensions/@mindspace/theia-layouts/package.json extensions/@mindspace/theia-layouts/

# Install dependencies
RUN yarn install --immutable || yarn install

# Copy source (preserve node_modules from install)
COPY browser-app/ browser-app/
COPY extensions/ extensions/

# Build extensions then browser app
RUN yarn workspace @mindspace/theia-a2a build || true
RUN yarn workspace @mindspace/theia-branding build || true
RUN yarn workspace @mindspace/theia-layouts build || true
RUN yarn workspace mindspace-ide-browser build

# Runtime
FROM node:22-bookworm-slim
WORKDIR /app

# Install git for workspace clone operations
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

EXPOSE 4200
ENV SHELL=/bin/bash
CMD ["yarn", "start"]
