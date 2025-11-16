FROM node:22-alpine AS builder
WORKDIR /build
COPY package*.json ./
COPY packages/agent-core/package*.json ./packages/agent-core/
COPY packages/webapp/package*.json ./packages/webapp/
RUN npm ci --strict-ssl=false
COPY ./ ./
RUN cd packages/agent-core && npm run build
RUN cd packages/webapp && npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# 本番環境用の軽量パッケージのみインストール
ENV NODE_ENV=production

# Next.js standalone出力をコピー
COPY --from=builder /build/packages/webapp/.next/standalone ./
COPY --from=builder /build/packages/webapp/.next/static ./packages/webapp/.next/static
COPY --from=builder /build/packages/webapp/public ./packages/webapp/public

EXPOSE 3000

# Next.js サーバーを起動
CMD ["node", "packages/webapp/server.js"]