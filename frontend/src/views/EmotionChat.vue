<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, InfoFilled, Promotion, UserFilled } from '@element-plus/icons-vue'
import api from '../api'

const messagesRef = ref(null)
const inputText = ref('')
const isReplying = ref(false)
const isComposing = ref(false)
const messages = ref([])

let messageId = 0

const canSend = computed(() => Boolean(inputText.value.trim()) && !isReplying.value)

function formatTime() {
  return new Date().toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  })
}

function createMessage(role, content) {
  messageId += 1
  return {
    id: messageId,
    role,
    content,
    time: formatTime()
  }
}

/** 消息追加后自动滚动到底部 */
function scrollToBottom(behavior = 'smooth') {
  nextTick(() => {
    const container = messagesRef.value
    if (!container) return
    container.scrollTo({
      top: container.scrollHeight,
      behavior
    })
  })
}

function pushMessage(role, content) {
  messages.value.push(createMessage(role, content))
  scrollToBottom()
}

/** Enter 发送，Shift + Enter 换行；同时兼容中文输入法组合状态 */
function handleKeydown(event) {
  if (event.key !== 'Enter' || event.shiftKey) return
  if (event.isComposing || event.keyCode === 229 || isComposing.value) return
  event.preventDefault()
  handleSend()
}

function handleCompositionStart() {
  isComposing.value = true
}

function handleCompositionEnd() {
  isComposing.value = false
}

function buildLocalReply() {
  return '谢谢你愿意说出来。先做 3 轮深呼吸：吸气 4 秒、呼气 6 秒。你现在的感受是真实的，可以先把它写下来，今天只完成一件小事；如果愿意，找信任的同学、辅导员或学校心理中心聊一聊。'
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || isReplying.value) return

  // 先渲染用户消息，再清空输入框
  pushMessage('user', text)
  inputText.value = ''
  isReplying.value = true
  scrollToBottom()

  try {
    const response = await api.post('/api/ai/chat', {
      moduleType: 'emotion',
      userInput: text
    })
    const payload = response?.data
    if (payload?.code === 0 && payload?.data?.reply) {
      pushMessage('ai', payload.data.reply)
    } else {
      throw new Error(payload?.message || 'AI 接口返回异常')
    }
  } catch (error) {
    console.error('[emotion] 获取 AI 回复失败：', error)
    pushMessage('ai', buildLocalReply())
    ElMessage.warning('AI 回复暂不可用，先给你一段本地建议')
  } finally {
    isReplying.value = false
    scrollToBottom()
  }
}

onMounted(() => {
  messages.value.push(
    createMessage('ai', '你好呀，我是小暖。这里没有评判，你可以慢慢说。今天有什么让你心里堵得慌的事吗？')
  )
  scrollToBottom('auto')
})
</script>

<template>
  <section class="emotion-page">
    <!-- 页面顶部引导 -->
    <header class="emotion-hero">
      <div class="emotion-hero-icon">
        <el-icon :size="24"><ChatDotRound /></el-icon>
      </div>
      <div class="emotion-hero-copy">
        <span class="emotion-kicker">EMOTION SUPPORT</span>
        <h1>情绪树洞</h1>
        <p>这里没有评判，慢慢说，小暖会认真听。</p>
      </div>
    </header>

    <div class="chat-shell">
      <header class="chat-header">
        <div class="chat-identity">
          <div class="chat-avatar">
            <el-icon :size="24"><ChatDotRound /></el-icon>
          </div>
          <div class="chat-meta">
            <div class="chat-name">
              小暖
              <el-tag size="small" type="primary" effect="light" round>AI 陪伴</el-tag>
            </div>
            <p class="chat-status">
              <span class="online-dot"></span>
              情绪树洞 · 在线倾听
            </p>
          </div>
        </div>
        <el-tag class="privacy-tag" type="info" effect="plain" round>匿名倾诉</el-tag>
      </header>

      <div ref="messagesRef" class="chat-messages" role="log" aria-live="polite">
        <div class="chat-day">今天</div>

        <div
          v-for="message in messages"
          :key="message.id"
          class="message-row"
          :class="message.role === 'user' ? 'message-row--user' : 'message-row--ai'"
        >
          <div v-if="message.role === 'ai'" class="message-avatar">
            <el-icon :size="18"><ChatDotRound /></el-icon>
          </div>

          <div class="message-main">
            <div class="message-bubble">{{ message.content }}</div>
            <span class="message-time">{{ message.time }}</span>
          </div>

          <div v-if="message.role === 'user'" class="message-avatar message-avatar--user">
            <el-icon :size="18"><UserFilled /></el-icon>
          </div>
        </div>

        <!-- AI 回复加载动画 -->
        <div v-if="isReplying" class="message-row message-row--ai">
          <div class="message-avatar">
            <el-icon :size="18"><ChatDotRound /></el-icon>
          </div>
          <div class="message-main">
            <div class="message-bubble typing-bubble">
              <span class="typing-dots">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </span>
              <span class="typing-text">小暖正在认真听...</span>
            </div>
          </div>
        </div>
      </div>

      <footer class="composer">
        <div class="composer-box">
          <el-input
            v-model="inputText"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
            resize="none"
            maxlength="500"
            placeholder="说说此刻的感受..."
            class="chat-input"
            @keydown="handleKeydown"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
          />
          <el-button
            type="primary"
            class="send-btn"
            :loading="isReplying"
            :disabled="!canSend"
            @click="handleSend"
          >
            <el-icon v-if="!isReplying"><Promotion /></el-icon>
            <span>发送</span>
          </el-button>
        </div>
        <p class="composer-hint">Enter 发送 · Shift + Enter 换行 · 内容仅用于本次对话</p>
      </footer>
    </div>

    <!-- 页面底部常驻免责声明 -->
    <p class="disclaimer">
      <el-icon><InfoFilled /></el-icon>
      <span>本功能仅提供情绪舒缓建议，不替代专业心理咨询</span>
    </p>
  </section>
</template>

<style scoped>
.emotion-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  height: clamp(560px, calc(100vh - 220px), 840px);
  height: clamp(560px, calc(100dvh - 220px), 840px);
  min-height: 0;
  color: #1f2d3d;
}

/* 顶部引导 */
.emotion-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
  padding: 18px 22px;
  border: 1px solid #d9ecff;
  border-radius: var(--xk-radius-card);
  background:
    radial-gradient(circle at 92% 10%, rgba(64, 158, 255, 0.12), transparent 38%),
    linear-gradient(135deg, #f4f9ff 0%, #ffffff 72%);
}

.emotion-hero-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: #ecf5ff;
  color: var(--el-color-primary);
}

.emotion-hero-copy {
  min-width: 0;
}

.emotion-kicker {
  color: var(--el-color-primary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.emotion-hero h1 {
  margin: 4px 0 3px;
  color: var(--text-main);
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
}

.emotion-hero p {
  color: var(--text-sub);
  font-size: 12.5px;
  line-height: 1.6;
}

.chat-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border-light);
  border-radius: var(--xk-radius-card);
  background: #ffffff;
  box-shadow: 0 18px 44px rgba(64, 158, 255, 0.08);
}

/* 聊天头部 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex: none;
  padding: 15px 20px;
  border-bottom: 1px solid #eef3fa;
  background: #ffffff;
}

.chat-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.chat-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff, #79bbff);
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.28);
}

.chat-meta {
  min-width: 0;
}

.chat-name {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #1f2d3d;
  font-size: 15px;
  font-weight: 700;
}

.chat-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  color: #7a8ba3;
  font-size: 11px;
}

.online-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #67c23a;
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.14);
}

.privacy-tag {
  flex: none;
}

/* 对话区 */
.chat-messages {
  flex: 1;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background:
    radial-gradient(circle at 12% 8%, rgba(64, 158, 255, 0.08), transparent 28%),
    radial-gradient(circle at 88% 92%, rgba(121, 187, 255, 0.1), transparent 30%),
    linear-gradient(180deg, #f7fbff 0%, #f2f7ff 100%);
  -webkit-overflow-scrolling: touch;
}

.chat-messages::-webkit-scrollbar {
  width: 5px;
}

.chat-messages::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #d9ecff;
}

.chat-day {
  width: fit-content;
  margin: 0 auto 18px;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  color: #a0a9b8;
  font-size: 10px;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}

.message-row--user {
  justify-content: flex-end;
}

.message-row--ai {
  justify-content: flex-start;
}

.message-avatar {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff, #79bbff);
  color: #ffffff;
  box-shadow: 0 6px 14px rgba(64, 158, 255, 0.22);
}

.message-avatar--user {
  background: #e8f1fb;
  color: #337ecc;
  box-shadow: none;
}

.message-main {
  display: flex;
  flex-direction: column;
  max-width: min(76%, 620px);
}

.message-row--user .message-main {
  align-items: flex-end;
}

.message-bubble {
  padding: 11px 15px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.75;
  word-break: break-word;
  white-space: pre-wrap;
}

.message-row--ai .message-bubble {
  border: 1px solid #e6eef8;
  border-bottom-left-radius: 6px;
  background: #ffffff;
  color: #3a4a5f;
  box-shadow: 0 8px 20px rgba(31, 45, 61, 0.05);
}

.message-row--user .message-bubble {
  border-bottom-right-radius: 6px;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #ffffff;
  box-shadow: 0 10px 20px rgba(64, 158, 255, 0.22);
}

.message-time {
  margin-top: 4px;
  padding: 0 3px;
  color: #a0a9b8;
  font-size: 10px;
}

/* AI 输入中动画 */
.typing-bubble {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 16px;
}

.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #79bbff;
  animation: typing-bounce 1.2s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

.typing-text {
  color: #a0a9b8;
  font-size: 11px;
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.55;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* 输入区 */
.composer {
  flex: none;
  padding: 12px 16px 14px;
  border-top: 1px solid #eef3fa;
  background: #ffffff;
}

.composer-box {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 5px;
  border: 1px solid #d9ecff;
  border-radius: 18px;
  background: #f7fbff;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.composer-box:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
}

.chat-input {
  flex: 1;
  min-width: 0;
}

.chat-input :deep(.el-textarea__inner) {
  padding: 8px 10px;
  border: 0;
  border-radius: 13px;
  background: transparent;
  box-shadow: none;
  color: #303133;
  font-size: 14px;
  line-height: 1.6;
  scrollbar-width: none;
}

.chat-input :deep(.el-textarea__inner)::-webkit-scrollbar {
  display: none;
}

.chat-input :deep(.el-textarea__inner::placeholder) {
  color: #a0a9b8;
}

.send-btn {
  flex: none;
  height: 38px;
  padding: 0 16px;
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.24);
}

.composer-hint {
  margin-top: 6px;
  color: #a0a9b8;
  font-size: 10px;
  text-align: center;
}

/* 页面底部常驻提示 */
.disclaimer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: none;
  padding: 2px 4px 4px;
  color: #a0a9b8;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

/* 移动端适配 */
@media (max-width: 900px) {
  .emotion-page {
    height: clamp(540px, calc(100vh - 240px), 700px);
    height: clamp(540px, calc(100dvh - 240px), 700px);
  }

  .chat-shell {
    border-radius: var(--xk-radius-card);
  }

  .chat-messages {
    padding: 16px 14px;
  }

  .message-main {
    max-width: 82%;
  }
}

@media (max-width: 560px) {
  .emotion-page {
    gap: 14px;
    height: clamp(520px, calc(100vh - 240px), 680px);
    height: clamp(520px, calc(100dvh - 240px), 680px);
  }

  .emotion-hero {
    gap: 10px;
    padding: 14px 16px;
  }

  .emotion-hero-icon {
    width: 38px;
    height: 38px;
    border-radius: 11px;
  }

  .emotion-hero h1 {
    font-size: 22px;
  }

  .emotion-hero p {
    font-size: 12px;
  }

  .chat-header {
    padding: 12px 14px;
  }

  .chat-avatar {
    width: 40px;
    height: 40px;
  }

  .privacy-tag {
    display: none;
  }

  .chat-messages {
    padding: 14px 10px;
  }

  .message-avatar {
    width: 30px;
    height: 30px;
  }

  .message-main {
    max-width: 84%;
  }

  .message-bubble {
    padding: 10px 13px;
    font-size: 14px;
  }

  .composer {
    padding: 10px 10px 12px;
  }

  .composer-box {
    gap: 7px;
    border-radius: 16px;
  }

  /* 16px 可避免 iOS 聚焦输入框时自动放大页面 */
  .chat-input :deep(.el-textarea__inner) {
    font-size: 16px;
  }

  .send-btn {
    height: 40px;
    min-width: 64px;
    padding: 0 12px;
    border-radius: 11px;
    font-size: 13px;
  }

  .composer-hint {
    display: none;
  }

  .typing-text {
    display: none;
  }

  .disclaimer {
    padding-top: 0;
    font-size: 11px;
  }
}

@media (max-width: 400px) {
  .emotion-page {
    gap: 12px;
    height: clamp(500px, calc(100dvh - 230px), 640px);
  }

  .emotion-hero {
    padding: 12px 14px;
  }

  .emotion-hero-icon {
    width: 34px;
    height: 34px;
  }

  .emotion-hero h1 {
    font-size: 20px;
  }

  .emotion-hero p {
    font-size: 11.5px;
  }

  .chat-header {
    padding: 10px 12px;
  }

  .chat-name {
    font-size: 14px;
  }

  .chat-status {
    font-size: 10px;
  }

  .composer {
    padding: 8px 8px 10px;
  }

  .send-btn {
    min-width: 58px;
    padding: 0 10px;
  }

  .disclaimer {
    font-size: 10.5px;
    line-height: 1.55;
  }
}
</style>
