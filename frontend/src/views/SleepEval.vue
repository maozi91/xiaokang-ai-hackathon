<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar, Loading, MagicStick, Moon, Warning } from '@element-plus/icons-vue'
import api from '../api'

// 睡眠质量 1-5 分选项
const QUALITY_OPTIONS = [
  { value: 1, label: '很差' },
  { value: 2, label: '较差' },
  { value: 3, label: '一般' },
  { value: 4, label: '较好' },
  { value: 5, label: '很好' }
]

const formRef = ref(null)
const isSubmitting = ref(false)
const apiError = ref('')
const report = ref(null)

const form = reactive({
  wakeTime: '07:00',
  sleepTime: '23:30',
  quality: 3,
  courses: ''
})

// 基础表单校验：三个核心字段必填，课程简述限 200 字
const rules = {
  wakeTime: [{ required: true, message: '请选择起床时间', trigger: 'change' }],
  sleepTime: [{ required: true, message: '请选择入睡时间', trigger: 'change' }],
  quality: [{ required: true, message: '请选择睡眠质量', trigger: 'change' }],
  courses: [{ max: 200, message: '课程简述不能超过 200 字', trigger: 'blur' }]
}

function timeToMinutes(value) {
  if (typeof value !== 'string' || !value.includes(':')) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

// 跨午夜时自动加 24 小时，例如 23:30 入睡、07:00 起床 = 7.5 小时
const durationMinutes = computed(() => {
  const sleep = timeToMinutes(form.sleepTime)
  const wake = timeToMinutes(form.wakeTime)
  if (sleep === null || wake === null) return 0
  return wake > sleep ? wake - sleep : wake + 1440 - sleep
})

function formatDuration(minutes) {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (!hours) return `${rest} 分钟`
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

const durationText = computed(() => {
  if (!form.sleepTime || !form.wakeTime) return '--'
  return formatDuration(durationMinutes.value)
})

const durationWarning = computed(() => {
  if (!form.sleepTime || !form.wakeTime) return ''
  if (durationMinutes.value < 60) return '不足 1 小时，请检查时间'
  if (durationMinutes.value > 16 * 60) return '超过 16 小时，请检查时间'
  return ''
})

function qualityLabel(value) {
  return QUALITY_OPTIONS.find((item) => item.value === value)?.label || '未选择'
}

function hasEarlyClass(courses = '') {
  return /早八|早课|第一节|第1节|8:00|8：00/.test(courses)
}

function hasBusySchedule(courses = '') {
  return /满课|实验|社团|晚课|考试|连堂/.test(courses)
}

/** 问题分析：根据睡眠时长、入睡时间、质量和课程安排生成针对性判断 */
function buildAnalysis(snapshot, minutes) {
  const hours = minutes / 60
  const analysis = []

  if (hours < 6) {
    analysis.push(`睡眠时长约 ${formatDuration(minutes)}，明显不足，白天容易出现注意力下降和情绪波动。`)
  } else if (hours < 7) {
    analysis.push(`睡眠时长约 ${formatDuration(minutes)}，略低于建议的 7–9 小时，长期可能累积疲劳。`)
  } else if (hours <= 9) {
    analysis.push(`睡眠时长约 ${formatDuration(minutes)}，处于建议的 7–9 小时区间。`)
  } else {
    analysis.push(`睡眠时长约 ${formatDuration(minutes)}，时长充足，但过度补觉可能打乱生物钟。`)
  }

  const sleepMinutes = timeToMinutes(snapshot.sleepTime)
  if (sleepMinutes !== null) {
    if (sleepMinutes < 360) {
      analysis.push(`入睡时间 ${snapshot.sleepTime} 属于凌晨入睡，深睡眠容易被压缩。`)
    } else if (sleepMinutes < 1320) {
      analysis.push(`入睡时间 ${snapshot.sleepTime} 偏早或属于白天补觉，需确认是否符合日常节律。`)
    } else if (sleepMinutes < 1410) {
      analysis.push(`入睡时间 ${snapshot.sleepTime} 处于较理想区间，继续保持。`)
    } else {
      analysis.push(`入睡时间 ${snapshot.sleepTime} 偏晚，建议逐步提前到 23:30 前。`)
    }
  }

  if (snapshot.quality <= 2) {
    analysis.push(`睡眠质量自评 ${snapshot.quality} 分，偏低，可能存在入睡困难或夜间易醒。`)
  } else if (snapshot.quality === 3) {
    analysis.push('睡眠质量自评 3 分，一般，仍有提升空间。')
  } else {
    analysis.push(`睡眠质量自评 ${snapshot.quality} 分，较好，重点保持规律。`)
  }

  if (hasEarlyClass(snapshot.courses)) {
    analysis.push('今日有早课，固定起床时间比周末补觉更重要。')
  } else if (hasBusySchedule(snapshot.courses)) {
    analysis.push('今日课程或活动较满，建议用 20–30 分钟午休恢复精力。')
  }

  return analysis.slice(0, 4)
}

/** 调整方案：结合睡眠时长、入睡时间、质量与早课情况给出可执行步骤 */
function buildPlan(snapshot, minutes) {
  const hours = minutes / 60
  const plans = []

  if (hours < 7) {
    plans.push('今晚把上床时间提前 30 分钟，先以 7 小时睡眠为目标，不要一次提前太多。')
  } else if (hours > 9) {
    plans.push('把起床时间固定在 7:00–8:00，白天增加 20 分钟户外活动，减少长时间补觉。')
  } else {
    plans.push('保持当前起床时间，周末与工作日起床时间相差不超过 1 小时。')
  }

  const sleepMinutes = timeToMinutes(snapshot.sleepTime)
  if (sleepMinutes !== null && (sleepMinutes < 360 || sleepMinutes >= 1410)) {
    plans.push('23:30 后停止刷手机，把手机放到伸手够不到的位置，用纸质书或轻音乐过渡。')
  }

  if (snapshot.quality <= 2) {
    plans.push('睡前 1 小时调暗灯光，尝试 4-7-8 呼吸或渐进式肌肉放松。')
  }

  if (hasEarlyClass(snapshot.courses)) {
    plans.push('早八前一天 23:00 前结束学习，早餐预留 15 分钟，避免赖床压缩时间。')
  }

  plans.push('午睡控制在 20–30 分钟，且不晚于 15:00；下午 3 点后不喝咖啡和奶茶。')
  plans.push('若失眠持续两周并影响上课，预约校医院或学校心理中心。')

  return plans
}

/** 助眠技巧：低成本、宿舍可执行的睡前习惯 */
function buildTips(snapshot) {
  const tips = [
    '睡前 1 小时开启手机夜间模式，避免强光直射眼睛。',
    '卧室保持 18–24℃，床只用于睡觉，不在床上学习。',
    '尝试 4-7-8 呼吸：吸气 4 秒、屏息 7 秒、呼气 8 秒，重复 4 轮。',
    '下午 3 点后避免咖啡、浓茶和含糖饮料。'
  ]

  if (snapshot.quality <= 2) {
    tips.push('躺下 20 分钟仍睡不着时，起身到昏暗处做安静的事，困了再回床。')
  }

  return tips
}

function buildUserInput(snapshot, minutes) {
  const courseText = snapshot.courses || '无特别课程安排'
  return [
    `起床时间：${snapshot.wakeTime}`,
    `入睡时间：${snapshot.sleepTime}`,
    `睡眠时长：${formatDuration(minutes)}`,
    `睡眠质量：${snapshot.quality} 分（${qualityLabel(snapshot.quality)}）`,
    `今日课程：${courseText}`
  ].join('；') + '。请评估我的作息，并给出问题分析、调整方案和助眠技巧。'
}

function buildReport({ reply, source, snapshot, minutes }) {
  return {
    source,
    aiReply: reply,
    sleepTime: snapshot.sleepTime,
    wakeTime: snapshot.wakeTime,
    durationText: formatDuration(minutes),
    qualityText: `${snapshot.quality} 分 · ${qualityLabel(snapshot.quality)}`,
    analysis: buildAnalysis(snapshot, minutes),
    plan: buildPlan(snapshot, minutes),
    tips: buildTips(snapshot),
    createdAt: new Date().toLocaleString('zh-CN')
  }
}

function getApiErrorMessage(error) {
  if (error?.code === 'ECONNABORTED') return '请求超时，请确认后端服务已启动后重试。'
  if (error?.response) return `后端服务返回异常（${error.response.status}），以下为本地作息建议。`
  if (error?.request) return '无法连接后端服务，请确认 http://localhost:3000 已启动。'
  return error?.message || '接口请求失败，以下为本地作息建议。'
}

async function handleSubmit() {
  if (isSubmitting.value || !formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    // 字段下方已展示具体校验提示
    return
  }

  if (durationMinutes.value < 60 || durationMinutes.value > 16 * 60) {
    ElMessage.warning('睡眠时长需在 1–16 小时之间，请检查入睡与起床时间')
    return
  }

  const snapshot = {
    wakeTime: form.wakeTime,
    sleepTime: form.sleepTime,
    quality: form.quality,
    courses: form.courses.trim()
  }
  const minutes = durationMinutes.value
  const userInput = buildUserInput(snapshot, minutes)

  isSubmitting.value = true
  apiError.value = ''
  report.value = null

  try {
    const response = await api.post('/api/ai/chat', {
      moduleType: 'sleep',
      userInput
    })
    const payload = response?.data
    if (payload?.code === 0 && payload?.data?.reply) {
      report.value = buildReport({
        reply: payload.data.reply,
        source: 'ai',
        snapshot,
        minutes
      })
    } else {
      throw new Error(payload?.message || 'AI 接口返回异常')
    }
  } catch (error) {
    console.error('[sleep] 获取作息建议失败：', error)
    apiError.value = getApiErrorMessage(error)
    report.value = buildReport({
      reply: '',
      source: 'local',
      snapshot,
      minutes
    })
    ElMessage.warning('后端接口暂不可用，已展示本地作息建议')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="sleep-page">
    <!-- 顶部引导 -->
    <header class="hero">
      <div class="hero-copy">
        <div class="hero-kicker">
          <el-icon><Moon /></el-icon>
          <span>SLEEP ASSESSMENT</span>
        </div>
        <h1>睡得好，才有力气上好每一节课</h1>
        <p class="hero-desc">
          填写今天的入睡、起床与课程安排，AI 会结合大学生课表，给出问题分析、调整方案和助眠技巧。
        </p>
        <div class="hero-tags">
          <el-tag type="primary" effect="plain" round>建议睡眠 7–9 小时</el-tag>
          <el-tag type="success" effect="plain" round>固定起床时间</el-tag>
          <el-tag type="warning" effect="plain" round>午睡 20–30 分钟</el-tag>
        </div>
      </div>

      <div class="hero-visual">
        <el-icon :size="42"><Moon /></el-icon>
        <strong>7–9h</strong>
        <span>大学生建议睡眠时长</span>
      </div>
    </header>

    <!-- 作息表单 -->
    <el-card class="form-card" shadow="never">
      <template #header>
        <div class="card-title">
          <span>填写今日作息</span>
          <el-tag size="small" type="info" effect="plain">约 30 秒</el-tag>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="sleep-form"
      >
        <div class="form-grid">
          <el-form-item label="起床时间" prop="wakeTime">
            <el-time-picker
              v-model="form.wakeTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择起床时间"
              :clearable="false"
              class="full-control"
            />
          </el-form-item>

          <el-form-item label="入睡时间" prop="sleepTime">
            <el-time-picker
              v-model="form.sleepTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择入睡时间"
              :clearable="false"
              class="full-control"
            />
          </el-form-item>

          <el-form-item label="睡眠质量" prop="quality">
            <el-select v-model="form.quality" placeholder="请选择睡眠质量" class="full-control">
              <el-option
                v-for="item in QUALITY_OPTIONS"
                :key="item.value"
                :label="`${item.value} 分 · ${item.label}`"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="今日课程简述（选填）" prop="courses">
          <el-input
            v-model="form.courses"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="如：上午两节高数，下午实验课，晚上社团活动"
          />
        </el-form-item>

        <div class="duration-preview">
          <div class="duration-copy">
            <span>预计睡眠时长</span>
            <strong>{{ durationText }}</strong>
          </div>
          <el-tag
            v-if="!form.sleepTime || !form.wakeTime"
            type="info"
            effect="plain"
            round
          >
            待填写
          </el-tag>
          <el-tag v-else-if="durationWarning" type="warning" effect="plain" round>
            {{ durationWarning }}
          </el-tag>
          <el-tag v-else type="success" effect="plain" round>时间区间正常</el-tag>
        </div>

        <el-button
          type="primary"
          size="large"
          class="submit-btn"
          :loading="isSubmitting"
          @click="handleSubmit"
        >
          <el-icon v-if="!isSubmitting"><MagicStick /></el-icon>
          {{ isSubmitting ? '正在生成作息建议...' : '生成作息评估' }}
        </el-button>
        <p class="form-tip">数据仅用于生成本次建议，不会保存到服务器。</p>
      </el-form>
    </el-card>

    <!-- 结果卡片 -->
    <el-card class="result-card" shadow="never">
      <template #header>
        <div class="card-title">
          <span>作息评估报告</span>
          <el-tag
            v-if="report"
            size="small"
            :type="report.source === 'ai' ? 'primary' : 'warning'"
            effect="plain"
          >
            {{ report.source === 'ai' ? 'AI 生成' : '本地建议' }}
          </el-tag>
        </div>
      </template>

      <div v-if="isSubmitting" class="result-loading">
        <el-skeleton :rows="7" animated />
        <div class="loading-copy">
          <el-icon class="is-loading" :size="18"><Loading /></el-icon>
          <span>正在结合你的课表与睡眠数据生成建议...</span>
        </div>
      </div>

      <el-empty
        v-else-if="!report"
        description="提交作息信息后，这里会生成问题分析、调整方案和助眠技巧"
        :image-size="88"
      />

      <div v-else class="report-body">
        <el-alert
          v-if="apiError"
          class="api-alert"
          type="warning"
          :closable="false"
          show-icon
          :title="apiError"
        />

        <div class="report-summary">
          <div class="summary-item">
            <span>睡眠时长</span>
            <strong>{{ report.durationText }}</strong>
          </div>
          <div class="summary-item">
            <span>作息区间</span>
            <strong>{{ report.sleepTime }} → {{ report.wakeTime }}</strong>
          </div>
          <div class="summary-item">
            <span>睡眠质量</span>
            <strong>{{ report.qualityText }}</strong>
          </div>
        </div>

        <div class="advice-grid">
          <section class="advice-block advice-block--analysis">
            <header class="advice-head">
              <span class="advice-icon">
                <el-icon><Warning /></el-icon>
              </span>
              <div>
                <h3>问题分析</h3>
                <p>先看清影响睡眠的关键因素</p>
              </div>
            </header>
            <ul class="advice-list">
              <li v-for="item in report.analysis" :key="item">{{ item }}</li>
            </ul>
            <div v-if="report.aiReply" class="ai-assessment">
              <span>AI 综合评估</span>
              <p>{{ report.aiReply }}</p>
            </div>
          </section>

          <section class="advice-block advice-block--plan">
            <header class="advice-head">
              <span class="advice-icon">
                <el-icon><Calendar /></el-icon>
              </span>
              <div>
                <h3>调整方案</h3>
                <p>结合课表，从今晚开始执行</p>
              </div>
            </header>
            <ul class="advice-list">
              <li v-for="item in report.plan" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section class="advice-block advice-block--tips">
            <header class="advice-head">
              <span class="advice-icon">
                <el-icon><MagicStick /></el-icon>
              </span>
              <div>
                <h3>助眠技巧</h3>
                <p>低成本、宿舍可立即尝试</p>
              </div>
            </header>
            <ul class="advice-list">
              <li v-for="item in report.tips" :key="item">{{ item }}</li>
            </ul>
          </section>
        </div>

        <p class="report-time">{{ report.createdAt }} 生成 · 结果仅用于健康科普参考</p>
      </div>
    </el-card>

    <p class="page-footer">
      作息建议仅用于健康科普，不替代专业医疗或心理咨询。若长期失眠，请及时预约校医院或学校心理中心。
    </p>
  </section>
</template>

<style scoped>
.sleep-page {
  --sleep-primary: #409eff;
  --sleep-ink: #1f2d3d;
  --sleep-muted: #7a8ba3;
  width: 100%;
  color: var(--sleep-ink);
}

/* 顶部引导 */
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
  right: -70px;
  bottom: -120px;
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
  color: var(--sleep-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.hero h1 {
  margin: 14px 0 10px;
  color: var(--sleep-ink);
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

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.hero-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 180px;
  height: 180px;
  border: 1px solid #c6e2ff;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffffff, #d9ecff);
  color: #337ecc;
  box-shadow:
    inset 0 0 30px rgba(255, 255, 255, 0.8),
    0 18px 40px rgba(64, 158, 255, 0.12);
}

.hero-visual strong {
  color: var(--sleep-ink);
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
}

.hero-visual span {
  max-width: 120px;
  color: #5c6b80;
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}

/* 表单 */
.form-card,
.result-card {
  margin-top: 20px;
  border: 1px solid #e6eef8;
  border-radius: 20px;
  background: #ffffff;
}

.form-card :deep(.el-card__header),
.result-card :deep(.el-card__header) {
  padding: 18px 22px;
  border-bottom-color: #eef3fa;
}

.form-card :deep(.el-card__body) {
  padding: 24px;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--sleep-ink);
  font-size: 15px;
  font-weight: 700;
}

.sleep-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.sleep-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  color: #5c6b80;
  font-size: 12px;
  font-weight: 600;
}

.sleep-form :deep(.el-input__wrapper),
.sleep-form :deep(.el-select__wrapper),
.sleep-form :deep(.el-textarea__inner) {
  border-radius: 10px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 18px;
}

.full-control {
  width: 100%;
}

.duration-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 16px;
  margin: 2px 0 18px;
  border: 1px solid #d9ecff;
  border-radius: 12px;
  background: #f4f9ff;
}

.duration-copy {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.duration-copy span {
  color: #5c6b80;
  font-size: 12px;
}

.duration-copy strong {
  color: var(--sleep-ink);
  font-size: 22px;
  font-weight: 800;
}

.submit-btn {
  width: 100%;
  height: 46px;
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.28);
}

.form-tip {
  margin-top: 10px;
  color: #a0a9b8;
  font-size: 11px;
  text-align: center;
}

/* 结果 */
.result-card :deep(.el-card__body) {
  padding: 22px;
}

.result-loading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  min-height: 260px;
  padding: 8px 4px;
}

.loading-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--sleep-primary);
  font-size: 13px;
}

.api-alert {
  margin-bottom: 16px;
  border-radius: 12px;
}

.report-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
  border: 1px solid #e6eef8;
  border-radius: 14px;
  background: #f7fbff;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.summary-item + .summary-item {
  padding-left: 16px;
  border-left: 1px solid #e6eef8;
}

.summary-item span {
  color: var(--sleep-muted);
  font-size: 11px;
}

.summary-item strong {
  color: var(--sleep-ink);
  font-size: 15px;
}

.advice-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.advice-block {
  padding: 18px;
  border: 1px solid #e6eef8;
  border-top: 3px solid transparent;
  border-radius: 16px;
  background: #fbfdff;
}

.advice-block--analysis {
  border-top-color: #409eff;
}

.advice-block--plan {
  border-top-color: #e6a23c;
}

.advice-block--tips {
  border-top-color: #67c23a;
}

.advice-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.advice-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
}

.advice-block--analysis .advice-icon {
  background: #ecf5ff;
  color: #409eff;
}

.advice-block--plan .advice-icon {
  background: #fdf6ec;
  color: #e6a23c;
}

.advice-block--tips .advice-icon {
  background: #f0f9eb;
  color: #67c23a;
}

.advice-head h3 {
  margin: 1px 0 3px;
  color: var(--sleep-ink);
  font-size: 15px;
  font-weight: 700;
}

.advice-head p {
  color: #a0a9b8;
  font-size: 11px;
  line-height: 1.5;
}

.advice-list {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.advice-list li {
  position: relative;
  padding-left: 16px;
  color: #5c6b80;
  font-size: 13px;
  line-height: 1.75;
}

.advice-list li + li {
  margin-top: 8px;
}

.advice-list li::before {
  content: '';
  position: absolute;
  top: 9px;
  left: 2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #c6e2ff;
}

.advice-block--plan .advice-list li::before {
  background: #f3d19e;
}

.advice-block--tips .advice-list li::before {
  background: #b3e19d;
}

.ai-assessment {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px dashed #c6e2ff;
  border-radius: 10px;
  background: #ffffff;
}

.ai-assessment span {
  display: inline-block;
  margin-bottom: 6px;
  color: var(--sleep-primary);
  font-size: 11px;
  font-weight: 700;
}

.ai-assessment p {
  color: #5c6b80;
  font-size: 12.5px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.report-time {
  margin-top: 16px;
  color: #a0a9b8;
  font-size: 11px;
  text-align: right;
}

.page-footer {
  margin: 18px 4px 0;
  color: #a0a9b8;
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
}

/* 响应式 */
@media (max-width: 1100px) {
  .advice-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 26px;
  }

  .hero h1 {
    font-size: 27px;
  }

  .hero-visual {
    width: 140px;
    height: 140px;
    justify-self: start;
  }

  .report-summary {
    grid-template-columns: 1fr;
  }

  .summary-item + .summary-item {
    padding-top: 10px;
    padding-left: 0;
    border-top: 1px solid #e6eef8;
    border-left: 0;
  }
}

@media (max-width: 760px) {
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

  .hero-visual {
    display: none;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-card :deep(.el-card__body) {
    padding: 16px;
  }

  .result-card :deep(.el-card__body) {
    padding: 16px;
  }

  .advice-block {
    padding: 16px;
  }

  .duration-preview {
    align-items: flex-start;
  }

  .report-time {
    text-align: left;
  }
}
</style>
