# Dev image shared by the api and web services (see docker-compose.yml).
FROM node:24-alpine
WORKDIR /app

# Install dependencies first so this layer stays cached until a package.json changes.
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci

COPY . .
