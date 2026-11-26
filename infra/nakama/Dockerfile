FROM node:22.22.3-alpine AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY types ./types
RUN npm run build

FROM heroiclabs/nakama:3.37.0
COPY --from=builder /build/build/index.js /nakama/data/modules/index.js
COPY local.yml /nakama/data/local.yml
