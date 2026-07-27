FROM node:24-alpine AS builder
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN npm install -g pnpm@11

WORKDIR /app

COPY package.json pnpm-lock.yaml* tsconfig.json pnpm-workspace.yaml ./
RUN CI=true pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# Production build target
FROM node:24-alpine AS runner
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN npm install -g pnpm@11

WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN CI=true pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]