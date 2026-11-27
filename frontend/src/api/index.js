import axios from 'axios'

// 统一 API 客户端，后端服务固定运行在 http://localhost:3000
const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 统一记录接口异常；具体页面仍需各自 catch 并给出用户提示
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[api error]', {
      url: error?.config?.url,
      method: error?.config?.method,
      status: error?.response?.status,
      message: error?.message
    })
    return Promise.reject(error)
  }
)

export default api
