/**
 * 校康AI - 校园健康助手 后端入口
 * 技术栈：Node.js + Express + cors
 * 不使用 dotenv，不依赖任何 .env 文件
 */
const express = require('express')
const cors = require('cors')

const aiRouter = require('./routes/ai')

const app = express()
const PORT = 3000

// 跨域配置：显式允许前端开发服务器的 JSON 请求与预检请求
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    optionsSuccessStatus: 204
  })
)

// 解析 JSON 请求体，限制请求体大小，避免异常大请求拖垮服务
app.use(express.json({ limit: '100kb' }))

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

// 模拟 AI 聊天接口（原型演示，不调用外部大模型、无密钥）
app.use('/api/ai', aiRouter)

// 404 处理：统一返回 JSON，避免前端拿到 HTML 错误页
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: `接口不存在：${req.method} ${req.originalUrl}`,
    data: null
  })
})

// 统一错误处理：区分 JSON 解析失败、请求体过大与服务器内部错误
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    console.warn('[client error] 请求体不是合法的 JSON')
    return res.status(400).json({
      code: 400,
      message: '请求体不是合法的 JSON',
      data: null
    })
  }

  if (err?.type === 'entity.too.large') {
    console.warn('[client error] 请求体过大')
    return res.status(413).json({
      code: 413,
      message: '请求体过大',
      data: null
    })
  }

  console.error('[server error]', err)
  return res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    data: null
  })
})

// 固定监听 3000 端口
const server = app.listen(PORT, () => {
  console.log('后端服务已启动，端口3000')
})

// 端口占用等启动异常给出明确提示，避免无输出退出
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`启动失败：端口 ${PORT} 已被占用，请先停止占用该端口的进程后重试`)
  } else {
    console.error('[server start error]', error)
  }
  process.exit(1)
})
