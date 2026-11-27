/**
 * 模拟 AI 聊天转发接口
 *
 * POST /api/ai/chat
 *
 * 重要说明：
 * 当前为【原型演示版本】，回复内容来自 config/replyTemplate.js 的预设文案，
 * 不调用任何外部大模型 API，也不需要密钥。
 * 后续可无缝替换为 DeepSeek 真实大模型接口：保留请求校验与返回结构，
 * 仅将 mockNetworkDelay + 文案读取部分替换为真实 API 请求即可。
 */
const express = require('express')
const replyTemplate = require('../config/replyTemplate')

const router = express.Router()

const supportedModules = ['posture', 'sleep', 'diet', 'emotion']

const moduleLabels = {
  posture: '体态检测',
  sleep: '作息评估',
  diet: '饮食建议',
  emotion: '情绪树洞'
}

// 兼容前端页面名与中文模块名
const moduleAliases = {
  posture: 'posture',
  posturedetect: 'posture',
  体态: 'posture',
  体态检测: 'posture',
  sleep: 'sleep',
  sleepeval: 'sleep',
  作息: 'sleep',
  作息评估: 'sleep',
  diet: 'diet',
  dietadvice: 'diet',
  饮食: 'diet',
  饮食建议: 'diet',
  emotion: 'emotion',
  emotionchat: 'emotion',
  情绪: 'emotion',
  情绪树洞: 'emotion'
}

// 模拟 AI 网络等待时间（500ms）
function mockNetworkDelay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveModuleKey(moduleType) {
  const normalized = String(moduleType || '')
    .trim()
    .toLowerCase()
  return moduleAliases[normalized] || null
}

router.post('/chat', async (req, res) => {
  try {
    const body = req.body || {}
    const { moduleType, userInput } = body

    // 参数校验：moduleType 必填且必须为非空字符串
    if (typeof moduleType !== 'string' || !moduleType.trim()) {
      return res.status(400).json({
        code: 400,
        message: '参数缺失：moduleType 不能为空',
        data: null
      })
    }

    // 参数校验：userInput 必填且必须为非空字符串
    if (typeof userInput !== 'string' || !userInput.trim()) {
      return res.status(400).json({
        code: 400,
        message: '参数缺失：userInput 不能为空',
        data: null
      })
    }

    // 校验 moduleType 是否有对应文案
    const moduleKey = resolveModuleKey(moduleType)
    if (!moduleKey) {
      return res.status(400).json({
        code: 400,
        message: `不支持的 moduleType：${moduleType}，可选值：${supportedModules.join('、')}`,
        data: null
      })
    }

    // 模拟 AI 网络等待
    await mockNetworkDelay(500)

    return res.json({
      code: 0,
      message: 'success',
      data: {
        moduleType: moduleKey,
        moduleLabel: moduleLabels[moduleKey],
        userInput: userInput.trim(),
        reply: replyTemplate[moduleKey],
        mock: true,
        supportedModules,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[AI mock chat error]', error)
    return res.status(500).json({
      code: 500,
      message: 'AI 服务处理失败，请稍后重试',
      data: null
    })
  }
})

module.exports = router
