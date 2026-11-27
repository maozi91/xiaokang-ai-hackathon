import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import { ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import './styles/global.css'

const app = createApp(App)

// 兜底处理组件渲染异常，避免页面直接白屏且没有任何提示
app.config.errorHandler = (error, instance, info) => {
  console.error('[vue error]', error, info)
  ElMessage.error('页面出现异常，请刷新后重试')
}

app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
