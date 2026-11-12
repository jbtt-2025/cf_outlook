# 阶段 1: 编译前端静态产物
FROM node:20-alpine AS frontend-builder
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# 阶段 2: 编译 Go 纯静态单一二进制文件 (参考 new-api 极简模式)
FROM golang:1.23-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /web/dist ./dist
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o cf_outlook .

# 阶段 3: 超轻量极简运行镜像 (~20MB)
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=backend-builder /app/cf_outlook /app/cf_outlook

ENV PORT=8080
ENV GIN_MODE=release
ENV DB_DRIVER=sqlite
ENV DB_DSN=/data/outlook.db

VOLUME ["/data"]
EXPOSE 8080

ENTRYPOINT ["/app/cf_outlook"]
