import axios from 'axios'

// 统一 API 客户端，后端服务固定运行在 http://localhost:3000
const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export default api
