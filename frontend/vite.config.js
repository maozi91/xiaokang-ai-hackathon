import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 校康AI 前端构建配置
// 开发时由 Vite 提供 5173 端口，接口统一请求 http://localhost:3000
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
