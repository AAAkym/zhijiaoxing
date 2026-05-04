import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development'
  
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: "/",
    server: {
      port: 5173,
      host: true,
      // 修复：增加HTTP服务器超时配置
      hmr: {
        overlay: true,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: (proxy, options) => {
            proxy.on('error', (err, req, res) => {
              console.log('[Proxy Error]', err.message, req.url)
            })
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('X-Accel-Buffering', 'no')
              // 所有API请求都保持长连接
              proxyReq.setHeader('Connection', 'keep-alive')
              if (req.url && req.url.includes('/stream')) {
                proxyReq.setHeader('Accept', 'text/event-stream')
                proxyReq.setHeader('Cache-Control', 'no-cache')
                // 禁用SSE请求的socket超时
                proxyReq.socket && proxyReq.socket.setTimeout(0)
                proxyReq.socket && proxyReq.socket.setNoDelay(true)
              }
            })
            proxy.on('proxyRes', (proxyRes, req, res) => {
              const contentType = proxyRes.headers['content-type'] || ''
              if (contentType.includes('text/event-stream')) {
                proxyRes.headers['cache-control'] = 'no-cache'
                proxyRes.headers['x-accel-buffering'] = 'no'
                proxyRes.headers['connection'] = 'keep-alive'
                // 禁用SSE响应的socket超时
                res.setTimeout(0)
                res.flushHeaders()
              }
            })
          },
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: isDevelopment,
      minify: !isDevelopment,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['lucide-react', 'recharts'],
          },
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
  }
})
