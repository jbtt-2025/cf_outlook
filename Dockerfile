# 阶段 1: 在构建宿主机架构编译前端静态产物 (避免 ARM64 QEMU 模拟耗时)
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-builder
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# 阶段 2: 在构建宿主机架构交叉编译 Go 纯静态单一二进制文件 (参考 new-api 极简模式)
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS backend-builder
ARG TARGETOS
ARG TARGETARCH
ARG APP_VERSION=1.0.0
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /web/dist ./dist
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-$(go env GOARCH)} \
    go build -ldflags="-s -w -X cf_outlook/common.Version=${APP_VERSION}" -o cf_outlook .

# 阶段 3: 目标架构超轻量极简运行镜像 (~20MB)
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
