package middleware

import (
	"io/fs"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// DistMiddleware 提供内嵌前端 SPA 静态托管并支持 Fallback 到 index.html
func DistMiddleware(distFS fs.FS) gin.HandlerFunc {
	return func(c *gin.Context) {
		reqPath := c.Request.URL.Path

		// API 路由直接放行
		if strings.HasPrefix(reqPath, "/api/") {
			c.Next()
			return
		}

		cleanPath := strings.TrimPrefix(filepath.Clean(reqPath), "/")
		if cleanPath == "." || cleanPath == "" {
			cleanPath = "index.html"
		}

		// 尝试读取该文件
		f, err := distFS.Open(cleanPath)
		if err == nil {
			stat, err := f.Stat()
			if err == nil && !stat.IsDir() {
				_ = f.Close()
				ext := filepath.Ext(cleanPath)
				if mimeType := mime.TypeByExtension(ext); mimeType != "" {
					c.Header("Content-Type", mimeType)
				}
				http.FileServer(http.FS(distFS)).ServeHTTP(c.Writer, c.Request)
				c.Abort()
				return
			}
			_ = f.Close()
		}

		// SPA Fallback：未命中静态资源时返回 index.html
		indexFile, err := distFS.Open("index.html")
		if err == nil {
			stat, err := indexFile.Stat()
			if err == nil {
				c.Header("Content-Type", "text/html; charset=utf-8")
				http.ServeContent(c.Writer, c.Request, "index.html", stat.ModTime(), indexFile.(interface {
					ReadSeeker
				}))
				_ = indexFile.Close()
				c.Abort()
				return
			}
			_ = indexFile.Close()
		}

		c.Next()
	}
}

type ReadSeeker interface {
	fs.File
	Seek(offset int64, whence int) (int64, error)
}
