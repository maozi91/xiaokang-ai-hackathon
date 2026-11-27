/**
 * 校康AI - 校园健康助手 后端入口
 * 技术栈：Node.js + Express + cors
 * 不使用 dotenv，不依赖任何 .env 文件
 */
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = 3000

// 跨域配置：允许所有来源访问
app.use(cors())

// 解析 JSON 请求体
app.use(express.json())

// 服务根路径
app.get('/', (req, res) => {
  res.json({
    name: '校康AI-校园健康助手',
    version: '1.0.0',
    status: 'running',
    port: PORT
  })
})

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    time: new Date().toISOString()
  })
})

// 404 处理
app.use((req, res) => {
  res.status(404).json({ message: `接口不存在：${req.method} ${req.originalUrl}` })
})

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[server error]', err)
  res.status(500).json({ message: '服务器内部错误' })
})

// 固定监听 3000 端口
app.listen(PORT, () => {
  console.log('后端服务已启动，端口3000')
})
