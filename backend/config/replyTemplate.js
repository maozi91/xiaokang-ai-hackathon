/**
 * 模拟 AI 回复模板（原型演示版本）
 *
 * 说明：
 * 1. 本文件仅提供预设文本，不调用任何外部大模型 API，也不需要任何密钥。
 * 2. 后续接入 DeepSeek 等真实大模型时，可保留本文件作为兜底模板，
 *    只需将 routes/ai.js 中的 mock 回复逻辑替换为真实 API 请求即可无缝切换。
 * 3. moduleType 与前端四个健康模块一一对应：posture / sleep / diet / emotion。
 */

const replyTemplates = {
  posture: {
    label: '体态检测',
    reply:
      '【原型演示回复】从你的描述来看，长时间伏案可能让肩颈处于紧张状态。建议先做一次正面体态自查：自然站立，观察双肩是否等高、头部是否明显偏向一侧。日常每伏案 40 分钟起身活动 3 分钟，做肩颈绕环和扩胸伸展；背包尽量双肩背，避免长期单侧受力。如果出现持续疼痛、手麻或头晕，请及时到校医院或康复科就诊。'
  },
  sleep: {
    label: '作息评估',
    reply:
      '【原型演示回复】作息紊乱通常与固定起床时间缺失、睡前强光刺激和咖啡因摄入有关。建议先把起床时间固定下来，即使前一晚睡得晚也不赖床超过 30 分钟；起床后接触自然光 10 分钟，帮助生物钟回正。睡前 1 小时放下手机，把明天要担心的事写在纸上，再做 4-7-8 呼吸放松。如果失眠持续两周以上并影响白天学习，建议预约学校心理中心或睡眠门诊。'
  },
  diet: {
    label: '饮食建议',
    reply:
      '【原型演示回复】校园饮食可以先从餐盘结构入手：每餐一拳主食、一掌优质蛋白、两拳蔬菜。早餐不要只吃碳水，搭配鸡蛋、豆浆或牛奶；食堂优先选择蒸、煮、炖窗口，主食可点半份；外卖备注少油少盐，避免油炸和含糖饮料。减脂期不要跳过主食，把精制米面换成杂粮；增肌期训练后 1 小时内补充蛋白质与碳水。如有过敏史，请主动避开过敏原并向食堂窗口确认配料。'
  },
  emotion: {
    label: '情绪树洞',
    reply:
      '【原型演示回复】谢谢你愿意把感受说出来。压力、焦虑和低落都不是你的错，它们更像是在提醒你：当前的负荷需要被看见。可以先试着把担心的事情写下来，区分哪些是现在能行动的、哪些暂时无法控制，只处理可控部分。如果情绪持续低落、影响睡眠和上课超过两周，建议预约学校心理中心；若出现伤害自己的念头，请立即联系身边可信任的人，并拨打全国心理援助热线 12356。'
  },
  default: {
    label: '通用健康建议',
    reply:
      '【原型演示回复】我已收到你的描述。当前是原型演示模式，尚未接入真实大模型，因此只能返回预设建议。你可以从规律作息、均衡饮食、每天 30 分钟运动和每伏案 40 分钟起身活动开始改善。如症状持续或加重，请及时咨询校医院或专业医生。'
  }
}

// moduleType 别名，兼容大小写、中文名称和前端页面名
const moduleAliases = {
  posture: 'posture',
  posturedetect: 'posture',
  '体态': 'posture',
  '体态检测': 'posture',
  sleep: 'sleep',
  sleepeval: 'sleep',
  '作息': 'sleep',
  '作息评估': 'sleep',
  diet: 'diet',
  dietadvice: 'diet',
  '饮食': 'diet',
  '饮食建议': 'diet',
  emotion: 'emotion',
  emotionchat: 'emotion',
  '情绪': 'emotion',
  '情绪树洞': 'emotion'
}

const supportedModules = ['posture', 'sleep', 'diet', 'emotion']

/**
 * 根据 moduleType 获取对应模板
 * 未匹配到时回退到 default，保证接口始终有可用文本返回
 */
function getReplyTemplate(moduleType) {
  const normalized = String(moduleType || '')
    .trim()
    .toLowerCase()
  const key = moduleAliases[normalized] || 'default'
  return {
    key,
    ...replyTemplates[key]
  }
}

module.exports = {
  replyTemplates,
  moduleAliases,
  supportedModules,
  getReplyTemplate
}
