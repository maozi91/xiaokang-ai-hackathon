<script setup>
import { ChatDotRound } from '@element-plus/icons-vue'
</script>

<template>
  <section class="page">
    <el-card shadow="never" class="placeholder-card">
      <div class="page-head">
        <div class="page-icon">
          <el-icon :size="28"><ChatDotRound /></el-icon>
        </div>
        <div>
          <p class="page-kicker">EMOTION CHAT</p>
          <h2 class="page-title">情绪树洞</h2>
          <p class="page-desc">
            页面占位已创建。后续可在此实现匿名聊天、情绪识别与心理支持建议，
            并提供专业心理援助热线信息。
          </p>
        </div>
      </div>

      <el-divider />

      <el-empty description="情绪树洞模块初始化完成，功能开发中">
        <el-tag type="primary" effect="plain" round>初始化占位页</el-tag>
      </el-empty>
    </el-card>
  </section>
</template>
