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
              proxyReq.setHeader('Connection', 'keep-alive')
              if (req.url && req.url.includes('/stream')) {
                proxyReq.setHeader('Accept', 'text/event-stream')
                proxyReq.setHeader('Cache-Control', 'no-cache')
              }
            })
            proxy.on('proxyRes', (proxyRes, req, res) => {
              const contentType = proxyRes.headers['content-type'] || ''
              if (contentType.includes('text/event-stream')) {
                proxyRes.headers['cache-control'] = 'no-cache'
                proxyRes.headers['x-accel-buffering'] = 'no'
                proxyRes.headers['connection'] = 'keep-alive'
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
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.url && req.url.includes('/videos/')) {
                proxyReq.setHeader('Connection', 'keep-alive')
              }
            })
            proxy.on('proxyRes', (proxyRes, req, res) => {
              const contentType = proxyRes.headers['content-type'] || ''
              if (contentType.startsWith('video/') || contentType.startsWith('application/octet-stream')) {
                proxyRes.headers['cache-control'] = 'public, max-age=3600'
                delete proxyRes.headers['x-accel-buffering']
                res.setTimeout(0)
              }
            })
          },
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
