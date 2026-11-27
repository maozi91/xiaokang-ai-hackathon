<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Aim, Camera, CircleCheck, Loading, Refresh, VideoCamera } from '@element-plus/icons-vue'
import api from '../api'

/**
 * MediaPipe Pose 资源地址
 * 注意：Pose 通过 index.html 中的 CDN <script> 引入，不通过 npm 安装。
 * 这里只负责在运行时初始化，并在资源不可用时优雅降级为模拟检测。
 */
const MEDIAPIPE_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404'
const DETECT_DURATION = 10000 // 10 秒检测时长
const LANDMARK_CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28]
]

const videoRef = ref(null)
const canvasRef = ref(null)

const isStarting = ref(false)
const isDetecting = ref(false)
const isRequesting = ref(false)
const cameraReady = ref(false)
const cameraError = ref('')
const poseReady = ref(false)
const poseHint = ref('骨架资源待加载')
const countdown = ref(10)
const progress = ref(0)
const phase = ref('idle') // idle | detecting | analyzing | done

// 实时模拟指标：颈椎前倾角、肩部前倾角、是否跷二郎腿
const metrics = reactive({
  neck: 0,
  shoulder: 0,
  legsCrossed: false
})

const result = ref(null)

let mediaStream = null
let countdownTimer = null
let poseInstance = null
let poseInitPromise = null
let poseRaf = null
let poseFrameErrors = 0
let simulation = {
  neckTarget: 12,
  shoulderTarget: 16,
  legsCrossed: false
}

/** 根据当前指标计算百分制体态分与问题列表 */
function evaluatePosture(neck, shoulder, legsCrossed) {
  const problems = []
  let penalty = 0

  if (neck > 15) {
    problems.push('颈椎前倾')
    penalty += Math.min(22, 6 + (neck - 15) * 1.5)
  }

  if (shoulder > 20) {
    problems.push('含胸驼背')
    penalty += Math.min(22, 5 + (shoulder - 20) * 1.3)
  }

  if (legsCrossed) {
    problems.push('跷二郎腿')
    penalty += 10
  }

  const score = Math.max(55, Math.min(100, Math.round(100 - penalty)))
  const level = score >= 90 ? '优秀' : score >= 75 ? '良好' : score >= 60 ? '待改善' : '需重点关注'
  const levelType = score >= 90 ? 'success' : score >= 75 ? 'primary' : score >= 60 ? 'warning' : 'danger'

  return { score, problems, level, levelType }
}

const previewScore = computed(() => {
  if (isDetecting.value) {
    return evaluatePosture(metrics.neck, metrics.shoulder, metrics.legsCrossed).score
  }
  return result.value?.score ?? null
})

const scoreHint = computed(() => {
  if (isDetecting.value) return '实时评估中...'
  if (result.value) {
    return result.value.problems.length
      ? `${result.value.level} · ${result.value.problems.length} 项待改善`
      : `${result.value.level} · 状态良好`
  }
  return '等待检测'
})

const cameraStatusText = computed(() => {
  if (isStarting.value) return '正在请求摄像头权限'
  if (cameraReady.value) return '摄像头已连接'
  if (cameraError.value) return '摄像头异常'
  return '摄像头未开启'
})

const poseStatusText = computed(() => {
  if (poseReady.value) return '骨架识别已就绪'
  return poseHint.value || '骨架资源加载中'
})

function scoreColor(score) {
  if (score === null || score === undefined || score === 0) return '#C0C4CC'
  if (score >= 90) return '#67C23A'
  if (score >= 75) return '#409EFF'
  if (score >= 60) return '#E6A23C'
  return '#F56C6C'
}

function oneDecimal(value) {
  return Number(value || 0).toFixed(1)
}

function anglePercent(value) {
  return Math.min(100, Math.max(0, Math.round((Number(value || 0) / 40) * 100)))
}

/** 等待 index.html 中的 MediaPipe CDN 脚本加载完成 */
function waitForPoseScript(timeout = 5000) {
  return new Promise((resolve) => {
    if (window.Pose) return resolve(true)
    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (window.Pose) {
        clearInterval(timer)
        resolve(true)
      } else if (Date.now() - startedAt >= timeout) {
        clearInterval(timer)
        resolve(false)
      }
    }, 150)
  })
}

/** 初始化 MediaPipe Pose；失败时只降级骨架叠加，不影响模拟检测 */
async function initPose() {
  if (poseInstance) return true
  if (poseInitPromise) return poseInitPromise

  poseInitPromise = (async () => {
    const loaded = await waitForPoseScript(5000)
    if (!loaded) {
      poseHint.value = '骨架资源未加载，已启用模拟检测'
      return false
    }

    try {
      poseInstance = new window.Pose({
        locateFile: (file) => `${MEDIAPIPE_CDN_BASE}/${file}`
      })
      poseInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })
      poseInstance.onResults(handlePoseResults)
      poseReady.value = true
      poseHint.value = '骨架识别已就绪'
      return true
    } catch (error) {
      console.error('[posture] MediaPipe Pose 初始化失败：', error)
      poseHint.value = '骨架识别初始化失败，已启用模拟检测'
      return false
    } finally {
      poseInitPromise = null
    }
  })()

  return poseInitPromise
}

/** 绘制 MediaPipe 骨架，失败或不识别时不影响主流程 */
function handlePoseResults(results) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = results.image?.width || videoRef.value?.videoWidth || 640
  const height = results.image?.height || videoRef.value?.videoHeight || 480
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  ctx.clearRect(0, 0, width, height)
  const landmarks = results.poseLandmarks
  if (!landmarks) return

  // 首次识别到人体后同步状态，避免骨架恢复后状态仍显示为中断
  poseReady.value = true
  if (poseHint.value !== '骨架识别已就绪') poseHint.value = '骨架识别已就绪'

  ctx.save()
  ctx.lineWidth = Math.max(3, width / 320)
  ctx.strokeStyle = 'rgba(64, 158, 255, 0.95)'
  ctx.shadowColor = '#409EFF'
  ctx.shadowBlur = 10

  for (const [start, end] of LANDMARK_CONNECTIONS) {
    const p1 = landmarks[start]
    const p2 = landmarks[end]
    if (!p1 || !p2) continue
    if ((p1.visibility ?? 1) < 0.5 || (p2.visibility ?? 1) < 0.5) continue
    ctx.beginPath()
    ctx.moveTo(p1.x * width, p1.y * height)
    ctx.lineTo(p2.x * width, p2.y * height)
    ctx.stroke()
  }

  ctx.shadowBlur = 0
  for (const index of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const point = landmarks[index]
    if (!point || (point.visibility ?? 1) < 0.5) continue
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, Math.max(4, width / 260), 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#409EFF'
    ctx.stroke()
  }
  ctx.restore()
}

/** 摄像头帧发送循环，约 8fps，避免占用过高 */
function startPoseLoop() {
  if (!poseInstance || !videoRef.value) return
  stopPoseLoop()
  poseReady.value = true
  poseHint.value = '骨架跟踪中'
  let lastSent = 0

  const loop = async (timestamp) => {
    if (!isDetecting.value) return
    if (timestamp - lastSent >= 120) {
      lastSent = timestamp
      try {
        if (videoRef.value?.readyState >= 2) {
          await poseInstance.send({ image: videoRef.value })
        }
      } catch (error) {
        poseFrameErrors += 1
        if (poseFrameErrors >= 3) {
          stopPoseLoop()
          poseReady.value = false
          poseHint.value = '骨架跟踪中断，已使用模拟数据'
          return
        }
      }
    }
    if (isDetecting.value) poseRaf = requestAnimationFrame(loop)
  }

  poseRaf = requestAnimationFrame(loop)
}

function stopPoseLoop() {
  if (poseRaf) {
    cancelAnimationFrame(poseRaf)
    poseRaf = null
  }
}

function clearCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
}

/** 申请摄像头权限；权限拒绝、设备占用等情况均返回友好提示 */
async function ensureCamera() {
  if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    throw new Error('摄像头需要在 HTTPS 或 localhost 环境下使用，请通过 http://localhost:5173 打开页面')
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持摄像头能力，请使用最新版 Chrome 或 Edge')
  }

  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 }
      }
    })
  } catch (error) {
    // 分辨率/帧率不被支持时，降级为默认摄像头参数再试一次
    if (error?.name === 'OverconstrainedError' || error?.name === 'ConstraintNotSatisfiedError') {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
    } else {
      throw error
    }
  }

  mediaStream = stream
  cameraReady.value = true
  await nextTick()

  const video = videoRef.value
  if (!video) throw new Error('视频组件尚未就绪，请稍后重试')
  video.srcObject = stream
  video.muted = true
  await video.play()
}

function handleCameraError(error) {
  const name = error?.name || ''
  const messages = {
    NotAllowedError: '摄像头权限被拒绝。请点击浏览器地址栏的摄像头图标，选择“允许”后重试。',
    PermissionDeniedError: '摄像头权限被拒绝。请在浏览器设置中允许本站使用摄像头后重试。',
    NotFoundError: '未检测到可用摄像头，请连接摄像头或更换设备后重试。',
    DevicesNotFoundError: '未检测到可用摄像头，请检查设备连接后重试。',
    NotReadableError: '摄像头似乎被其他应用占用，请关闭视频会议、聊天软件等程序后重试。',
    TrackStartError: '摄像头启动失败，请关闭占用摄像头的程序后重试。',
    OverconstrainedError: '当前摄像头不支持所需参数，请更换设备后重试。',
    SecurityError: '当前页面不是安全环境，请通过 localhost 或 HTTPS 访问。'
  }

  cameraError.value =
    messages[name] ||
    (error?.message && error.message.includes('摄像头') ? error.message : '摄像头启动失败，请检查设备与浏览器权限后重试。')

  cameraReady.value = false
  isDetecting.value = false
  phase.value = 'idle'
  ElMessage.error(cameraError.value)
}

/** 等待 video 元数据就绪，最多等待 2 秒，避免卡死 */
function waitForVideoReady(video) {
  return new Promise((resolve) => {
    if (!video || (video.readyState >= 2 && video.videoWidth > 0)) return resolve()
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      video.removeEventListener('loadedmetadata', finish)
      video.removeEventListener('canplay', finish)
      resolve()
    }
    video.addEventListener('loadedmetadata', finish)
    video.addEventListener('canplay', finish)
    setTimeout(finish, 2000)
  })
}

function prepareSimulation() {
  // 让演示更有区分度：约 7 成概率出现颈椎前倾、6.5 成概率出现含胸驼背
  const neckIssue = Math.random() < 0.72
  const shoulderIssue = Math.random() < 0.65
  let legsIssue = Math.random() < 0.45

  simulation = {
    neckTarget: neckIssue ? 17 + Math.random() * 10 : 8 + Math.random() * 6,
    shoulderTarget: shoulderIssue ? 22 + Math.random() * 10 : 10 + Math.random() * 8,
    legsCrossed: legsIssue
  }

  // 保证每次检测至少给出一项可改善的问题，便于演示完整流程
  if (!neckIssue && !shoulderIssue && !legsIssue) {
    simulation.legsCrossed = true
  }
}

/** 根据时间推进模拟指标，加入轻微波动让画面更真实 */
function updateSimulation(elapsed) {
  const seconds = elapsed / 1000
  const ease = Math.min(1, seconds / 3)
  const wobble = (phaseOffset) =>
    Math.sin(seconds * 2.1 + phaseOffset) * 1.6 + (Math.random() - 0.5) * 0.8

  metrics.neck = Math.max(0, Number((simulation.neckTarget * ease + wobble(0)).toFixed(1)))
  metrics.shoulder = Math.max(0, Number((simulation.shoulderTarget * ease + wobble(1.4)).toFixed(1)))
  metrics.legsCrossed = seconds > 2.5 ? simulation.legsCrossed : false
}

function startCountdown() {
  clearInterval(countdownTimer)
  const startedAt = Date.now()

  countdownTimer = setInterval(() => {
    const elapsed = Date.now() - startedAt
    const remain = Math.max(0, Math.ceil((DETECT_DURATION - elapsed) / 1000))
    countdown.value = Math.min(10, remain)
    progress.value = Math.min(100, Math.round((elapsed / DETECT_DURATION) * 100))
    updateSimulation(elapsed)

    if (elapsed >= DETECT_DURATION) {
      clearInterval(countdownTimer)
      countdownTimer = null
      finishDetection()
    }
  }, 200)
}

function resetState() {
  clearInterval(countdownTimer)
  countdownTimer = null
  stopPoseLoop()
  cameraError.value = ''
  result.value = null
  phase.value = 'idle'
  countdown.value = 10
  progress.value = 0
  metrics.neck = 0
  metrics.shoulder = 0
  metrics.legsCrossed = false
  poseHint.value = poseInstance ? '骨架识别已就绪' : '骨架资源加载中'
  clearCanvas()
}

async function startDetection() {
  if (isDetecting.value || isStarting.value) return

  isStarting.value = true
  resetState()
  poseFrameErrors = 0

  try {
    await ensureCamera()
    await nextTick()
    await waitForVideoReady(videoRef.value)

    prepareSimulation()
    isDetecting.value = true
    phase.value = 'detecting'
    countdown.value = 10
    progress.value = 0

    // 骨架叠加与倒计时并行：CDN 不可用时倒计时和评分仍然继续
    initPose()
      .then((ready) => {
        if (ready && isDetecting.value) startPoseLoop()
      })
      .catch((error) => {
        // 兜底捕获骨架初始化异常，保证检测流程不中断
        console.error('[posture] 骨架初始化异常：', error)
        poseReady.value = false
        poseHint.value = '骨架识别不可用，已使用模拟检测'
      })

    startCountdown()
  } catch (error) {
    console.error('[posture] 摄像头启动失败：', error)
    stopCamera()
    handleCameraError(error)
  } finally {
    isStarting.value = false
  }
}

async function finishDetection() {
  if (!isDetecting.value) return

  isDetecting.value = false
  phase.value = 'analyzing'
  stopPoseLoop()

  // 使用模拟目标值生成最终结果，保证评分与展示的问题一致
  metrics.neck = Number(simulation.neckTarget.toFixed(1))
  metrics.shoulder = Number(simulation.shoulderTarget.toFixed(1))
  metrics.legsCrossed = simulation.legsCrossed

  const evaluation = evaluatePosture(metrics.neck, metrics.shoulder, metrics.legsCrossed)
  result.value = {
    ...evaluation,
    metrics: {
      neck: metrics.neck,
      shoulder: metrics.shoulder,
      legsCrossed: metrics.legsCrossed
    },
    reply: '',
    source: 'pending',
    createdAt: new Date().toLocaleString('zh-CN')
  }

  stopCamera()
  await fetchAdvice(evaluation)
  phase.value = 'done'
}

/** 检测结束后自动请求后端模拟 AI 接口，userInput 携带分数与问题 */
async function fetchAdvice(evaluation) {
  isRequesting.value = true
  const problemText = evaluation.problems.length
    ? evaluation.problems.join('、')
    : '暂未发现明显体态问题'
  const userInput = `体态检测得分 ${evaluation.score} 分（${evaluation.level}），检测到：${problemText}。请结合大学生教室与宿舍场景给出改善建议。`

  try {
    const response = await api.post('/api/ai/chat', {
      moduleType: 'posture',
      userInput
    })
    const payload = response?.data
    if (payload?.code === 0 && payload?.data?.reply) {
      result.value.reply = payload.data.reply
      result.value.source = 'ai'
    } else {
      throw new Error(payload?.message || 'AI 接口返回异常')
    }
  } catch (error) {
    console.error('[posture] 获取 AI 建议失败：', error)
    result.value.reply = buildLocalAdvice(evaluation.problems)
    result.value.source = 'local'
    ElMessage.warning('AI 建议获取失败，已切换为本地备用建议')
  } finally {
    isRequesting.value = false
  }
}

function buildLocalAdvice(problems) {
  const advice = [
    '每节课后做 3 分钟教室拉伸：颈部侧屈 15 秒×2、双手背后夹紧肩胛 15 秒×3、双手扶桌展背 20 秒。'
  ]

  if (problems.includes('颈椎前倾')) {
    advice.push('看手机时把屏幕抬到胸前以上，避免长时间低头；电脑屏幕顶部与视线齐平。')
  }
  if (problems.includes('含胸驼背')) {
    advice.push('坐姿保持双脚踩地、胸口离桌沿一拳，每 30 分钟起身活动一次。')
  }
  if (problems.includes('跷二郎腿')) {
    advice.push('双腿平放、膝盖与髋同高，避免单侧骨盆长期受力。')
  }

  advice.push('书包尽量双肩背，若出现持续疼痛或手麻，请及时到校医院就诊。')
  return advice.join('\n')
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
  cameraReady.value = false
  clearCanvas()
}

onBeforeUnmount(() => {
  clearInterval(countdownTimer)
  countdownTimer = null
  isDetecting.value = false
  stopPoseLoop()
  stopCamera()
  if (poseInstance) {
    try {
      Promise.resolve(poseInstance.close()).catch(() => {})
    } catch {
      // 忽略关闭异常
    }
    poseInstance = null
  }
})
</script>

<template>
  <section class="posture-page">
    <!-- 顶部引导文案 -->
    <header class="hero">
      <div class="hero-copy">
        <div class="hero-kicker">
          <el-icon><Aim /></el-icon>
          <span>AI POSTURE SCAN</span>
        </div>
        <h1>10 秒体态自检，找回挺拔坐姿</h1>
        <p class="hero-desc">
          正对摄像头坐好，系统会模拟识别颈椎前倾、含胸驼背和跷二郎腿，生成百分制体态评分与针对大学生校园场景的改善建议。
        </p>
        <div class="hero-steps">
          <div class="hero-step"><span>01</span>允许摄像头</div>
          <div class="hero-step"><span>02</span>坐正并保持 10 秒</div>
          <div class="hero-step"><span>03</span>查看评分与建议</div>
        </div>
      </div>

      <div class="hero-badge">
        <el-progress
          type="dashboard"
          :percentage="previewScore || 0"
          :color="scoreColor(previewScore)"
          :width="148"
          :stroke-width="10"
        >
          <template #default>
            <div class="hero-score-value">{{ previewScore === null ? '--' : previewScore }}</div>
            <div class="hero-score-label">体态分</div>
          </template>
        </el-progress>
        <p>{{ scoreHint }}</p>
      </div>
    </header>

    <el-alert class="privacy-alert" type="info" :closable="false" show-icon>
      <template #title>隐私说明</template>
      视频画面仅在本机浏览器内处理，不会上传；仅将检测分数与问题描述发送给后端生成建议。
    </el-alert>

    <div class="content-grid">
      <!-- 摄像头与检测主区域 -->
      <el-card class="camera-card" shadow="never">
        <div class="stage" :class="{ 'stage-active': cameraReady || isDetecting }">
          <video ref="videoRef" class="camera-video" autoplay muted playsinline></video>
          <canvas ref="canvasRef" class="pose-canvas"></canvas>
          <div class="stage-grid"></div>

          <div class="frame-corners">
            <span></span><span></span><span></span><span></span>
          </div>

          <div v-if="isDetecting" class="scan-line"></div>

          <!-- 未开启摄像头 / 权限异常 -->
          <div
            v-if="!cameraReady && !isDetecting && phase !== 'analyzing' && phase !== 'done'"
            class="stage-mask"
          >
            <el-icon v-if="isStarting" class="is-loading" :size="42"><Loading /></el-icon>
            <el-icon v-else :size="42"><VideoCamera /></el-icon>
            <p>{{ isStarting ? '正在请求摄像头权限...' : cameraError || '摄像头未开启' }}</p>
            <el-tag v-if="cameraError" type="danger" effect="plain" round>请点击下方按钮重试</el-tag>
            <el-tag v-else type="info" effect="plain" round>建议正对光源，保持上半身入镜</el-tag>
          </div>

          <!-- 10 秒倒计时 -->
          <div v-if="isDetecting" class="countdown-panel">
            <el-progress
              type="circle"
              :percentage="progress"
              :width="68"
              :stroke-width="5"
              color="#409EFF"
            >
              <template #default>
                <span class="countdown-number">{{ countdown }}</span>
              </template>
            </el-progress>
            <div class="countdown-copy">
              <strong>正在检测</strong>
              <span>保持坐姿，约 {{ countdown }} 秒</span>
            </div>
          </div>

          <!-- AI 建议生成中 -->
          <div v-if="phase === 'analyzing'" class="stage-mask stage-mask--solid">
            <el-icon class="is-loading" :size="36"><Loading /></el-icon>
            <p>AI 正在生成改善建议...</p>
          </div>

          <!-- 检测完成 -->
          <div v-else-if="phase === 'done' && !isRequesting" class="stage-mask stage-mask--solid stage-mask--done">
            <el-icon :size="40"><CircleCheck /></el-icon>
            <p>检测完成，报告已生成</p>
            <span>体态分 {{ result?.score }} · {{ result?.level }}</span>
          </div>
        </div>

        <el-alert
          v-if="cameraError"
          class="camera-alert"
          type="error"
          :closable="false"
          show-icon
          :title="cameraError"
        />

        <div class="camera-status">
          <div class="status-item">
            <span class="status-dot" :class="{ 'is-on': cameraReady, 'is-error': cameraError }"></span>
            {{ cameraStatusText }}
          </div>
          <div class="status-item">
            <span class="status-dot" :class="{ 'is-on': poseReady }"></span>
            {{ poseStatusText }}
          </div>
        </div>

        <div class="action-row">
          <el-button
            type="primary"
            size="large"
            :loading="isStarting"
            :disabled="isDetecting"
            @click="startDetection"
          >
            <el-icon v-if="!isStarting"><Camera /></el-icon>
            {{ isDetecting ? `检测中 ${countdown}s` : result ? '重新检测' : '开始检测' }}
          </el-button>
          <el-button
            v-if="result"
            size="large"
            :icon="Refresh"
            :disabled="isDetecting || isRequesting"
            @click="startDetection"
          >
            再测一次
          </el-button>
        </div>
        <p class="camera-tip">点击后请允许摄像头权限；检测过程约 10 秒，请尽量保持上半身稳定。</p>
      </el-card>

      <!-- 实时指标侧栏 -->
      <el-card class="metrics-card" shadow="never">
        <template #header>
          <div class="card-title">
            <span>实时体态指标</span>
            <el-tag size="small" :type="isDetecting ? 'success' : 'info'" effect="plain">
              {{ isDetecting ? '采集中' : '待检测' }}
            </el-tag>
          </div>
        </template>

        <div class="metric">
          <div class="metric-head">
            <span>颈椎前倾角度</span>
            <strong :class="{ 'is-risk': metrics.neck > 15 }">{{ oneDecimal(metrics.neck) }}°</strong>
          </div>
          <el-progress
            :percentage="anglePercent(metrics.neck)"
            :status="metrics.neck > 15 ? 'exception' : 'success'"
            :stroke-width="10"
            :show-text="false"
          />
          <p class="metric-tip">超过 15° 提示颈椎前倾</p>
        </div>

        <div class="metric">
          <div class="metric-head">
            <span>肩部前倾角度</span>
            <strong :class="{ 'is-risk': metrics.shoulder > 20 }">{{ oneDecimal(metrics.shoulder) }}°</strong>
          </div>
          <el-progress
            :percentage="anglePercent(metrics.shoulder)"
            :status="metrics.shoulder > 20 ? 'exception' : 'success'"
            :stroke-width="10"
            :show-text="false"
          />
          <p class="metric-tip">超过 20° 提示含胸驼背</p>
        </div>

        <div class="metric">
          <div class="metric-head">
            <span>跷二郎腿</span>
            <el-tag :type="metrics.legsCrossed ? 'danger' : 'success'" effect="plain" size="small">
              {{ metrics.legsCrossed ? '已识别' : '未识别' }}
            </el-tag>
          </div>
          <p class="metric-tip">检测到该动作将直接扣分</p>
        </div>

        <el-divider />

        <div class="metric-summary">
          <span>实时体态分</span>
          <strong :style="{ color: scoreColor(previewScore) }">
            {{ previewScore === null ? '--' : previewScore }}
          </strong>
        </div>

        <ul class="rule-list">
          <li>10 秒模拟采样，覆盖 3 项体态特征</li>
          <li>颈椎前倾阈值 15°，肩部前倾阈值 20°</li>
          <li>检测结果仅用于健康科普参考</li>
        </ul>
      </el-card>
    </div>

    <!-- 结果卡片 -->
    <el-card class="report-card" shadow="never">
      <template #header>
        <div class="card-title">
          <span>体态检测报告</span>
          <el-tag
            v-if="result"
            size="small"
            :type="result.source === 'ai' ? 'primary' : result.source === 'local' ? 'warning' : 'info'"
            effect="plain"
          >
            {{ result.source === 'ai' ? 'AI 生成建议' : result.source === 'local' ? '本地备用建议' : '生成中' }}
          </el-tag>
        </div>
      </template>

      <div v-if="!result" class="report-empty">
        <el-empty description="完成一次 10 秒检测后，这里会生成体态评分与改善建议" :image-size="88" />
      </div>

      <div v-else class="report-body">
        <div class="report-score">
          <el-progress
            type="dashboard"
            :percentage="result.score"
            :color="scoreColor(result.score)"
            :width="160"
            :stroke-width="12"
          >
            <template #default>
              <div class="report-score-value">{{ result.score }}</div>
              <div class="report-score-label">/ 100 分</div>
            </template>
          </el-progress>
          <el-tag :type="result.levelType" effect="light" round size="large">{{ result.level }}</el-tag>
          <p class="report-time">{{ result.createdAt }}</p>
        </div>

        <div class="report-detail">
          <div class="report-block">
            <h3>检测到的问题</h3>
            <div class="problem-tags">
              <el-tag
                v-for="problem in result.problems"
                :key="problem"
                type="danger"
                effect="plain"
                round
              >
                {{ problem }}
              </el-tag>
              <el-tag v-if="!result.problems.length" type="success" effect="plain" round>
                暂未发现明显体态问题
              </el-tag>
            </div>
            <div class="report-metrics">
              <span>颈椎 {{ oneDecimal(result.metrics.neck) }}°</span>
              <span>肩部 {{ oneDecimal(result.metrics.shoulder) }}°</span>
              <span>{{ result.metrics.legsCrossed ? '跷二郎腿' : '双腿平放' }}</span>
            </div>
          </div>

          <div class="report-block">
            <h3>改善建议</h3>
            <div v-if="isRequesting" class="advice-loading">
              <el-icon class="is-loading" :size="20"><Loading /></el-icon>
              <span>AI 正在生成个性化建议...</span>
            </div>
            <el-skeleton v-else-if="!result.reply" :rows="3" animated />
            <p v-else class="advice-text">{{ result.reply }}</p>
          </div>
        </div>
      </div>
    </el-card>

    <p class="page-footer">
      本功能为原型演示，检测结果仅用于健康科普，不构成医疗诊断。如有持续疼痛或不适，请及时就医。
    </p>
  </section>
</template>

<style scoped>
.posture-page {
  --posture-primary: #409eff;
  --posture-primary-dark: #337ecc;
  --posture-ink: #1f2d3d;
  --posture-muted: #7a8ba3;
  width: 100%;
  color: var(--posture-ink);
}

/* 顶部引导区 */
.hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 28px;
  align-items: center;
  padding: 34px 36px;
  overflow: hidden;
  border: 1px solid #d9ecff;
  border-radius: 24px;
  background:
    radial-gradient(circle at 88% 12%, rgba(64, 158, 255, 0.18), transparent 42%),
    linear-gradient(135deg, #f4f9ff 0%, #ffffff 58%, #eef6ff 100%);
}

.hero::after {
  content: '';
  position: absolute;
  right: -80px;
  bottom: -110px;
  width: 260px;
  height: 260px;
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 50%;
}

.hero > * {
  position: relative;
  z-index: 1;
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 999px;
  background: #ecf5ff;
  color: var(--posture-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.hero h1 {
  margin: 14px 0 10px;
  color: var(--posture-ink);
  font-size: 32px;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.hero-desc {
  max-width: 680px;
  color: #5c6b80;
  font-size: 14px;
  line-height: 1.8;
}

.hero-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 18px;
}

.hero-step {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5c6b80;
  font-size: 12px;
}

.hero-step span {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ecf5ff;
  color: var(--posture-primary);
  font-size: 10px;
  font-weight: 700;
}

.hero-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 170px;
  text-align: center;
}

.hero-badge :deep(.el-progress__text) {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-score-value {
  color: var(--posture-ink);
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
}

.hero-score-label {
  margin-top: 4px;
  color: #a0a9b8;
  font-size: 11px;
}

.hero-badge p {
  color: var(--posture-muted);
  font-size: 12px;
}

.privacy-alert {
  margin-top: 18px;
  border-radius: 14px;
}

/* 主内容布局 */
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.9fr);
  gap: 20px;
  margin-top: 20px;
}

.camera-card,
.metrics-card,
.report-card {
  border: 1px solid var(--border-light);
  border-radius: var(--xk-radius-card);
  background: #ffffff;
}

.camera-card :deep(.el-card__body) {
  padding: 18px;
}

.metrics-card :deep(.el-card__header),
.report-card :deep(.el-card__header) {
  padding: 18px 22px;
  border-bottom-color: #eef3fa;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--posture-ink);
  font-size: 15px;
  font-weight: 700;
}

/* 摄像头画面 */
.stage {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  background: radial-gradient(circle at 50% 30%, #1b3352, #0b1524 70%);
}

.camera-video,
.pose-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.camera-video {
  object-fit: cover;
  background: #0b1524;
  transform: scaleX(-1);
}

.pose-canvas {
  pointer-events: none;
  transform: scaleX(-1);
}

.stage-grid {
  position: absolute;
  inset: 0;
  opacity: 0;
  background-image:
    linear-gradient(rgba(64, 158, 255, 0.14) 1px, transparent 1px),
    linear-gradient(90deg, rgba(64, 158, 255, 0.14) 1px, transparent 1px);
  background-size: 44px 44px;
  transition: opacity 0.3s ease;
}

.stage-active .stage-grid {
  opacity: 0.4;
}

.frame-corners {
  position: absolute;
  inset: 16px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.stage-active .frame-corners {
  opacity: 1;
}

.frame-corners span {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 0 solid rgba(64, 158, 255, 0.9);
}

.frame-corners span:nth-child(1) {
  top: 0;
  left: 0;
  border-top-width: 2px;
  border-left-width: 2px;
  border-top-left-radius: 6px;
}

.frame-corners span:nth-child(2) {
  top: 0;
  right: 0;
  border-top-width: 2px;
  border-right-width: 2px;
  border-top-right-radius: 6px;
}

.frame-corners span:nth-child(3) {
  bottom: 0;
  left: 0;
  border-bottom-width: 2px;
  border-left-width: 2px;
  border-bottom-left-radius: 6px;
}

.frame-corners span:nth-child(4) {
  right: 0;
  bottom: 0;
  border-right-width: 2px;
  border-bottom-width: 2px;
  border-bottom-right-radius: 6px;
}

.scan-line {
  position: absolute;
  right: 0;
  left: 0;
  z-index: 2;
  height: 2px;
  background: linear-gradient(90deg, transparent, #409eff, transparent);
  box-shadow: 0 0 14px rgba(64, 158, 255, 0.95);
  animation: posture-scan 2.4s linear infinite;
}

@keyframes posture-scan {
  0% {
    top: 10%;
  }
  100% {
    top: 90%;
  }
}

/* 画面遮罩 */
.stage-mask {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: #ffffff;
  text-align: center;
  background: rgba(8, 18, 33, 0.72);
  backdrop-filter: blur(3px);
}

.stage-mask .el-icon {
  color: #79bbff;
}

.stage-mask p {
  max-width: 440px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  line-height: 1.7;
}

.stage-mask--solid {
  background: rgba(8, 18, 33, 0.84);
}

.stage-mask--done .el-icon {
  color: #67c23a;
}

.stage-mask--done span {
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
}

/* 倒计时浮层 */
.countdown-panel {
  position: absolute;
  top: 16px;
  left: 50%;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 18px 7px 7px;
  border: 1px solid rgba(121, 187, 255, 0.45);
  border-radius: 999px;
  background: rgba(10, 27, 48, 0.78);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  transform: translateX(-50%);
}

.countdown-panel :deep(.el-progress__text) {
  color: #ffffff;
}

.countdown-number {
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
}

.countdown-copy {
  display: flex;
  flex-direction: column;
  color: #ffffff;
  text-align: left;
}

.countdown-copy strong {
  font-size: 13px;
}

.countdown-copy span {
  color: rgba(255, 255, 255, 0.65);
  font-size: 11px;
}

.camera-alert {
  margin-top: 12px;
  border-radius: 12px;
}

.camera-status {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: 14px 2px 0;
  color: var(--posture-muted);
  font-size: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 7px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c0c4cc;
}

.status-dot.is-on {
  background: #67c23a;
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.15);
}

.status-dot.is-error {
  background: #f56c6c;
  box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.15);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.action-row .el-button {
  min-width: 150px;
  margin-left: 0;
  border-radius: 10px;
}

.action-row .el-button--primary {
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.28);
}

.camera-tip {
  margin-top: 10px;
  color: #a0a9b8;
  font-size: 12px;
  line-height: 1.6;
}

/* 指标侧栏 */
.metric + .metric {
  margin-top: 20px;
}

.metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: #5c6b80;
  font-size: 13px;
}

.metric-head strong {
  color: #303133;
  font-size: 17px;
}

.metric-head strong.is-risk {
  color: #f56c6c;
}

.metric-tip {
  margin-top: 6px;
  color: #a0a9b8;
  font-size: 11px;
}

.metric-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 12px;
  background: #f4f9ff;
}

.metric-summary span {
  color: #5c6b80;
  font-size: 13px;
}

.metric-summary strong {
  font-size: 26px;
  font-weight: 800;
}

.rule-list {
  margin: 16px 0 0;
  padding-left: 18px;
  color: var(--posture-muted);
  font-size: 12px;
  line-height: 1.9;
}

/* 报告卡片 */
.report-card {
  margin-top: 20px;
}

.report-empty :deep(.el-empty) {
  padding: 24px 0 10px;
}

.report-body {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

.report-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.report-score :deep(.el-progress__text) {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.report-score-value {
  color: #303133;
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
}

.report-score-label {
  margin-top: 4px;
  color: #a0a9b8;
  font-size: 11px;
}

.report-time {
  color: #a0a9b8;
  font-size: 11px;
}

.report-detail {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.report-block h3 {
  margin: 0 0 10px;
  color: #303133;
  font-size: 15px;
  font-weight: 700;
}

.problem-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.report-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.report-metrics span {
  padding: 5px 10px;
  border-radius: 8px;
  background: #f5f7fa;
  color: #606266;
  font-size: 12px;
}

.advice-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 12px;
  background: #f4f9ff;
  color: var(--posture-primary);
  font-size: 13px;
}

.advice-text {
  margin: 0;
  padding: 16px 18px;
  border-left: 4px solid var(--posture-primary);
  border-radius: 0 12px 12px 0;
  background: #f4f9ff;
  color: #4a5a70;
  font-size: 13px;
  line-height: 1.9;
  white-space: pre-wrap;
}

.page-footer {
  margin: 18px 4px 0;
  color: #a0a9b8;
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
}

/* 响应式适配 */
@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 24px;
  }

  .hero h1 {
    font-size: 27px;
  }

  .hero-badge {
    flex-direction: row;
    align-items: center;
    justify-self: start;
    text-align: left;
  }

  .report-body {
    grid-template-columns: 1fr;
  }

  .report-score {
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .hero {
    padding: 20px;
    border-radius: 18px;
  }

  .hero h1 {
    font-size: 24px;
  }

  .hero-desc {
    font-size: 13px;
  }

  .hero-steps {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .camera-card :deep(.el-card__body) {
    padding: 12px;
  }

  .stage {
    aspect-ratio: 4 / 3;
  }

  .countdown-panel {
    top: 10px;
    gap: 8px;
    padding: 6px 14px 6px 6px;
  }

  .countdown-copy span {
    display: none;
  }

  .action-row .el-button {
    width: 100%;
    min-height: 46px;
  }

  .report-card :deep(.el-card__body) {
    padding: 16px;
  }

  .report-score {
    align-items: center;
  }

  .content-grid {
    gap: 16px;
    margin-top: 16px;
  }

  .report-card {
    margin-top: 16px;
  }

  .card-title {
    flex-wrap: wrap;
    font-size: 14px;
  }

  .report-time {
    text-align: left;
  }

  .page-footer {
    margin-top: 16px;
    font-size: 11px;
  }
}

@media (max-width: 400px) {
  .hero {
    padding: 18px;
  }

  .hero h1 {
    margin-top: 12px;
    font-size: 22px;
  }

  .hero-desc {
    font-size: 13px;
    line-height: 1.75;
  }

  .hero-badge {
    width: 100%;
    min-width: 0;
  }

  .privacy-alert {
    margin-top: 14px;
  }

  .report-block h3 {
    font-size: 14px;
  }

  .report-body {
    gap: 20px;
  }

  .advice-text {
    padding: 14px;
    font-size: 12.5px;
  }
}
</style>
