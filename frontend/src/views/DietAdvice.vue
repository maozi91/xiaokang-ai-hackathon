<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Apple, Coffee, Dish, Food, Loading, MagicStick } from '@element-plus/icons-vue'
import api from '../api'

// 快捷标签：点击后自动填入菜品描述，仍可继续编辑
const QUICK_TAGS = [
  {
    label: '一荤两素',
    text: '一荤两素：青椒肉丝、炒青菜、番茄炒蛋、米饭'
  },
  {
    label: '盖饭',
    text: '盖饭：土豆牛肉盖饭'
  },
  {
    label: '麻辣烫',
    text: '麻辣烫：丸子、宽粉、青菜、豆腐'
  },
  {
    label: '面类',
    text: '面类：牛肉面'
  },
  {
    label: '减脂餐',
    text: '减脂餐：鸡胸肉、西兰花、玉米、紫薯'
  }
]

const GOAL_OPTIONS = [
  { value: '减脂', label: '减脂 · 控制热量与油脂' },
  { value: '增肌', label: '增肌 · 提高蛋白质与恢复' },
  { value: '维持健康', label: '维持健康 · 均衡搭配' }
]

// 菜品关键词识别，用于生成本地营养评价
const DISH_PATTERNS = {
  protein:
    /鸡|鸭|鱼|虾|牛|羊肉|肉|排骨|蛋|豆腐|豆皮|豆干|豆浆|牛奶|酸奶|荤/,
  vegetable:
    /菜|青菜|西兰花|菠菜|生菜|番茄|西红柿|黄瓜|白菜|萝卜|菌|菇|木耳|海带|豆角|茄子|青椒|冬瓜|南瓜|素/,
  staple: /饭|米|面|粉|馒头|包子|饺|饼|红薯|紫薯|玉米|土豆|粥|盖饭|麻辣烫/,
  highOil: /炸|油条|薯条|炸鸡|红烧|糖醋|干锅|香锅|烧烤|五花|肥肉|培根|香肠|油泼|麻辣/,
  sugary: /奶茶|可乐|雪碧|蛋糕|甜点|冰淇淋|含糖|糖果|果汁/
}

const formRef = ref(null)
const isSubmitting = ref(false)
const apiError = ref('')
const report = ref(null)

const form = reactive({
  dish: '',
  goal: '维持健康'
})

const rules = {
  dish: [
    { required: true, message: '请填写今天吃的菜品', trigger: 'blur' },
    { min: 2, message: '请至少填写 2 个字', trigger: 'blur' },
    { max: 200, message: '菜品描述不能超过 200 字', trigger: 'blur' }
  ],
  goal: [{ required: true, message: '请选择饮食目标', trigger: 'change' }]
}

function applyQuickTag(tag) {
  form.dish = tag.text
  formRef.value?.clearValidate('dish')
}

function analyzeDish(dish) {
  return {
    protein: DISH_PATTERNS.protein.test(dish),
    vegetable: DISH_PATTERNS.vegetable.test(dish),
    staple: DISH_PATTERNS.staple.test(dish),
    highOil: DISH_PATTERNS.highOil.test(dish),
    sugary: DISH_PATTERNS.sugary.test(dish)
  }
}

const GOAL_ANALYSIS = {
  减脂: '按减脂目标，这一餐优先控制油和主食份量，同时保证蛋白质和蔬菜。',
  增肌: '按增肌目标，这一餐的蛋白质可以再加一掌，训练后及时补充主食。',
  维持健康: '按维持健康目标，保持一掌蛋白、一拳主食、两拳蔬菜的比例即可。'
}

/** 营养评价：结合菜品关键词与目标生成 */
function buildNutrition(snapshot, flags) {
  const analysis = [GOAL_ANALYSIS[snapshot.goal] || GOAL_ANALYSIS['维持健康']]

  if (flags.protein) {
    analysis.push('检测到蛋白质来源，有助于饱腹、维持肌肉和稳定餐后血糖。')
  } else {
    analysis.push('蛋白质来源偏少，建议补充鸡蛋、豆腐、鸡胸、鱼或一杯牛奶。')
  }

  if (flags.vegetable) {
    analysis.push('菜品中有蔬菜，建议占到餐盘约一半，并优先选择深色蔬菜。')
  } else {
    analysis.push('蔬菜量不足，下一餐补一份青菜、西兰花或菌菇。')
  }

  if (flags.staple) {
    analysis.push('主食已包含，减脂期可点半份米饭，或用红薯、玉米替换部分精制主食。')
  } else {
    analysis.push('主食偏少，若下午有课或训练，建议补一小份杂粮饭、玉米或全麦面包。')
  }

  if (flags.highOil || flags.sugary) {
    const risks = []
    if (flags.highOil) risks.push('油炸、重油或麻辣做法')
    if (flags.sugary) risks.push('含糖饮料或甜点')
    analysis.push(`检测到${risks.join('、')}，热量或糖分可能偏高，建议控制频率和份量。`)
  } else {
    analysis.push('做法整体偏清淡，继续保持蒸、煮、炖的选餐习惯。')
  }

  return analysis
}

/** 下一餐选餐建议：根据目标与当前菜品缺口给出 */
function buildNextMeal(snapshot, flags) {
  const nextMeal = []

  if (snapshot.goal === '减脂') {
    nextMeal.push('下一餐选清蒸鱼、鸡胸、虾或豆腐，搭配两份绿叶菜和半份杂粮饭。')
    nextMeal.push('避开麻辣烫汤底、干锅、糖醋和油炸窗口，主食优先红薯、玉米或糙米。')
  } else if (snapshot.goal === '增肌') {
    nextMeal.push('下一餐选牛肉、去皮鸡腿、鱼或鸡蛋，搭配一份米饭/面和两份蔬菜。')
    nextMeal.push('训练后 30–60 分钟内补充蛋白质和碳水，例如牛奶 + 玉米或鸡蛋 + 米饭。')
  } else {
    nextMeal.push('下一餐按一荤两素搭配：一份瘦肉/鱼/豆腐，两份蔬菜，一拳主食。')
    nextMeal.push('优先蒸、煮、炖窗口，菜品颜色尽量覆盖三种以上。')
  }

  if (flags.highOil) {
    nextMeal.push('如果这一餐重油，下一餐尽量清淡，不喝菜汤和浮油。')
  }
  if (!flags.vegetable) {
    nextMeal.push('下一餐务必补一份深色蔬菜，如西兰花、菠菜或油麦菜。')
  }
  if (!flags.protein) {
    nextMeal.push('下一餐优先补蛋白质，避免只吃面、粉或盖饭。')
  }

  return nextMeal.slice(0, 4)
}

/** 饮食小提醒：食堂场景下可直接执行 */
function buildTips(snapshot, flags) {
  const tips = [
    '食堂选餐顺序：先选蔬菜和蛋白质，再选主食，最后决定是否加汤。',
    '主食可以点半份，或用红薯、玉米、紫薯替换部分白米饭。',
    '少选油炸、糖醋、干锅和浓汤，含糖饮料换成白水、无糖茶或豆浆。'
  ]

  if (snapshot.goal === '减脂') {
    tips.push('减脂期不必跳过正餐，保证蛋白质和蔬菜，避免晚上报复性进食。')
  } else if (snapshot.goal === '增肌') {
    tips.push('增肌期每餐都安排蛋白质，训练日主食不要过度减少。')
  } else {
    tips.push('维持健康不需要极端忌口，重点是长期稳定的一荤两素搭配。')
  }

  if (flags.highOil) {
    tips.push('重油餐后可以散步 10–15 分钟，下一餐回到清淡搭配即可。')
  } else if (flags.sugary) {
    tips.push('含糖饮料或甜点尽量放在正餐后，避免空腹摄入。')
  }

  return tips.slice(0, 5)
}

function buildReport({ reply, source, snapshot }) {
  const flags = analyzeDish(snapshot.dish)
  return {
    source,
    aiReply: reply,
    dish: snapshot.dish,
    goal: snapshot.goal,
    flags,
    analysis: buildNutrition(snapshot, flags),
    nextMeal: buildNextMeal(snapshot, flags),
    tips: buildTips(snapshot, flags),
    createdAt: new Date().toLocaleString('zh-CN')
  }
}

function getApiErrorMessage(error) {
  if (error?.code === 'ECONNABORTED') return '请求超时，请确认后端服务已启动后重试。'
  if (error?.response) return `后端服务返回异常（${error.response.status}），以下为本地饮食建议。`
  if (error?.request) return '无法连接后端服务，请确认 http://localhost:3000 已启动。'
  return error?.message || '接口请求失败，以下为本地饮食建议。'
}

async function handleSubmit() {
  if (isSubmitting.value || !formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    // 字段下方已展示具体校验提示
    return
  }

  const dish = form.dish.trim()
  if (!dish) {
    ElMessage.warning('请填写今天吃的菜品')
    return
  }

  const snapshot = {
    dish,
    goal: form.goal
  }
  const userInput = `我的菜品：${snapshot.dish}；饮食目标：${snapshot.goal}。请给出营养评价、下一餐选餐建议和饮食小提醒。`

  isSubmitting.value = true
  apiError.value = ''
  report.value = null

  try {
    const response = await api.post('/api/ai/chat', {
      moduleType: 'diet',
      userInput
    })
    const payload = response?.data
    if (payload?.code === 0 && payload?.data?.reply) {
      report.value = buildReport({
        reply: payload.data.reply,
        source: 'ai',
        snapshot
      })
    } else {
      throw new Error(payload?.message || 'AI 接口返回异常')
    }
  } catch (error) {
    console.error('[diet] 获取饮食建议失败：', error)
    apiError.value = getApiErrorMessage(error)
    report.value = buildReport({
      reply: '',
      source: 'local',
      snapshot
    })
    ElMessage.warning('后端接口暂不可用，已展示本地饮食建议')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="diet-page">
    <!-- 顶部引导 -->
    <header class="hero">
      <div class="hero-copy">
        <div class="hero-kicker">
          <el-icon><Food /></el-icon>
          <span>DIET ADVICE</span>
        </div>
        <h1>会吃，比少吃更重要</h1>
        <p class="hero-desc">
          输入今天在食堂吃的菜品，选择你的目标，AI 会给出营养评价、下一餐选餐建议和饮食小提醒。
        </p>
        <div class="hero-tags">
          <el-tag type="primary" effect="plain" round>一荤两素</el-tag>
          <el-tag type="success" effect="plain" round>蛋白质优先</el-tag>
          <el-tag type="warning" effect="plain" round>少油少盐</el-tag>
        </div>
      </div>

      <div class="hero-visual">
        <el-icon :size="38"><Food /></el-icon>
        <strong>1 : 1 : 2</strong>
        <span>蛋白 : 主食 : 蔬菜</span>
      </div>
    </header>

    <!-- 输入区域 -->
    <el-card class="form-card" shadow="never">
      <template #header>
        <div class="card-title">
          <span>今天在食堂吃了什么</span>
          <el-tag size="small" type="info" effect="plain">支持多个菜品</el-tag>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="diet-form"
      >
        <el-form-item label="菜品输入" prop="dish">
          <el-input
            v-model="form.dish"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="如：青椒肉丝、炒青菜、番茄炒蛋、米饭"
          />
          <div class="quick-tags">
            <span class="quick-label">快捷填入</span>
            <el-button
              v-for="tag in QUICK_TAGS"
              :key="tag.label"
              size="default"
              round
              plain
              :type="form.dish === tag.text ? 'primary' : 'info'"
              class="quick-tag"
              @click="applyQuickTag(tag)"
            >
              {{ tag.label }}
            </el-button>
          </div>
          <p class="field-tip">点击标签自动填入，可继续修改菜品内容。</p>
        </el-form-item>

        <el-form-item label="饮食目标" prop="goal">
          <el-select v-model="form.goal" placeholder="请选择饮食目标" class="full-control">
            <el-option
              v-for="item in GOAL_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <div class="plate-formula">
          <span class="plate-icon"><el-icon><Dish /></el-icon></span>
          <div>
            <span>食堂餐盘公式</span>
            <strong>1 掌蛋白 + 1 拳主食 + 2 拳蔬菜</strong>
          </div>
        </div>

        <el-button
          type="primary"
          size="large"
          class="submit-btn"
          :loading="isSubmitting"
          @click="handleSubmit"
        >
          <el-icon v-if="!isSubmitting"><MagicStick /></el-icon>
          {{ isSubmitting ? '正在分析这一餐...' : '生成饮食建议' }}
        </el-button>
        <p class="form-tip">建议仅用于校园饮食科普，不替代专业营养或医疗建议。</p>
      </el-form>
    </el-card>

    <!-- 结果卡片 -->
    <el-card class="result-card" shadow="never">
      <template #header>
        <div class="card-title">
          <span>饮食分析报告</span>
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
          <span>正在分析这餐的营养结构并生成下一餐建议...</span>
        </div>
      </div>

      <el-empty
        v-else-if="!report"
        description="提交菜品与目标后，这里会生成营养评价、下一餐建议和饮食提醒"
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
          <div class="summary-item summary-item--dish">
            <span>本次菜品</span>
            <strong>{{ report.dish }}</strong>
          </div>
          <div class="summary-item">
            <span>饮食目标</span>
            <strong>{{ report.goal }}</strong>
          </div>
        </div>

        <div class="nutrition-chips">
          <el-tag :type="report.flags.protein ? 'success' : 'warning'" effect="plain" round>
            {{ report.flags.protein ? '蛋白质充足' : '蛋白质偏少' }}
          </el-tag>
          <el-tag :type="report.flags.vegetable ? 'success' : 'warning'" effect="plain" round>
            {{ report.flags.vegetable ? '蔬菜充足' : '蔬菜偏少' }}
          </el-tag>
          <el-tag :type="report.flags.staple ? 'success' : 'warning'" effect="plain" round>
            {{ report.flags.staple ? '主食已含' : '主食偏少' }}
          </el-tag>
          <el-tag :type="report.flags.highOil ? 'danger' : 'success'" effect="plain" round>
            {{ report.flags.highOil ? '油脂偏高' : '做法清淡' }}
          </el-tag>
          <el-tag v-if="report.flags.sugary" type="danger" effect="plain" round>
            含糖饮品/甜点
          </el-tag>
        </div>

        <div class="advice-grid">
          <section class="advice-block advice-block--analysis">
            <header class="advice-head">
              <span class="advice-icon">
                <el-icon><Apple /></el-icon>
              </span>
              <div>
                <h3>营养评价</h3>
                <p>看看这一餐的结构是否均衡</p>
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

          <section class="advice-block advice-block--next">
            <header class="advice-head">
              <span class="advice-icon">
                <el-icon><Dish /></el-icon>
              </span>
              <div>
                <h3>下一餐选餐建议</h3>
                <p>按目标补足这一餐的缺口</p>
              </div>
            </header>
            <ul class="advice-list">
              <li v-for="item in report.nextMeal" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section class="advice-block advice-block--tips">
            <header class="advice-head">
              <span class="advice-icon">
                <el-icon><Coffee /></el-icon>
              </span>
              <div>
                <h3>饮食小提醒</h3>
                <p>食堂场景下可直接执行</p>
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
      饮食建议仅用于健康科普，不构成个体化营养处方。如有过敏、慢性病或特殊饮食需求，请咨询专业营养师或医生。
    </p>
  </section>
</template>

<style scoped>
.diet-page {
  --diet-primary: #409eff;
  --diet-ink: #1f2d3d;
  --diet-muted: #7a8ba3;
  width: 100%;
  color: var(--diet-ink);
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
  color: var(--diet-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.hero h1 {
  margin: 14px 0 10px;
  color: var(--diet-ink);
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
  border: 10px solid #ffffff;
  border-radius: 50%;
  outline: 1px solid #d9ecff;
  background: radial-gradient(circle at 35% 30%, #ffffff, #d9ecff);
  color: #337ecc;
  box-shadow:
    inset 0 0 30px rgba(255, 255, 255, 0.8),
    0 18px 40px rgba(64, 158, 255, 0.14);
}

.hero-visual strong {
  color: var(--diet-ink);
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
}

.hero-visual span {
  color: #5c6b80;
  font-size: 11px;
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
  color: var(--diet-ink);
  font-size: 15px;
  font-weight: 700;
}

.diet-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.diet-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  color: #5c6b80;
  font-size: 12px;
  font-weight: 600;
}

.diet-form :deep(.el-form-item__error) {
  position: static;
  padding-top: 6px;
}

.diet-form :deep(.el-textarea__inner),
.diet-form :deep(.el-select__wrapper) {
  border-radius: 10px;
}

.full-control {
  width: 100%;
}

.quick-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.quick-label {
  color: #a0a9b8;
  font-size: 11px;
}

.quick-tags .el-button {
  margin-left: 0;
}

.quick-tags .el-button + .el-button {
  margin-left: 0;
}

.quick-tag {
  font-size: 12px;
}

.field-tip {
  margin-top: 8px;
  color: #a0a9b8;
  font-size: 11px;
  line-height: 1.5;
}

.plate-formula {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin: 2px 0 18px;
  border: 1px solid #d9ecff;
  border-radius: 12px;
  background: #f4f9ff;
}

.plate-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: #ffffff;
  color: var(--diet-primary);
}

.plate-formula div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.plate-formula span {
  color: var(--diet-muted);
  font-size: 11px;
}

.plate-formula strong {
  color: var(--diet-ink);
  font-size: 14px;
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
  color: var(--diet-primary);
  font-size: 13px;
}

.api-alert {
  margin-bottom: 16px;
  border-radius: 12px;
}

.report-summary {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(160px, 0.8fr);
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
  color: var(--diet-muted);
  font-size: 11px;
}

.summary-item strong {
  color: var(--diet-ink);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.nutrition-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
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

.advice-block--next {
  border-top-color: #67c23a;
}

.advice-block--tips {
  border-top-color: #e6a23c;
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

.advice-block--next .advice-icon {
  background: #f0f9eb;
  color: #67c23a;
}

.advice-block--tips .advice-icon {
  background: #fdf6ec;
  color: #e6a23c;
}

.advice-head h3 {
  margin: 1px 0 3px;
  color: var(--diet-ink);
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

.advice-block--next .advice-list li::before {
  background: #b3e19d;
}

.advice-block--tips .advice-list li::before {
  background: #f3d19e;
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
  color: var(--diet-primary);
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

  .form-card :deep(.el-card__body) {
    padding: 16px;
  }

  .result-card :deep(.el-card__body) {
    padding: 16px;
  }

  .advice-block {
    padding: 16px;
  }

  .quick-tags {
    gap: 6px;
  }

  .quick-tag {
    font-size: 11px;
  }

  .report-time {
    text-align: left;
  }
}
</style>
