<script setup>
import { Aim } from '@element-plus/icons-vue'
</script>

<template>
  <section class="page">
    <el-card shadow="never" class="placeholder-card">
      <div class="page-head">
        <div class="page-icon">
          <el-icon :size="28"><Aim /></el-icon>
        </div>
        <div>
          <p class="page-kicker">POSTURE DETECT</p>
          <h2 class="page-title">体态检测</h2>
          <p class="page-desc">
            页面占位已创建。后续可在此接入 MediaPipe Pose 摄像头识别，分析肩线、头部与躯干姿态，
            并生成体态评分与改善建议。
          </p>
        </div>
      </div>

      <el-divider />

      <el-empty description="体态检测模块初始化完成，功能开发中">
        <el-tag type="primary" effect="plain" round>初始化占位页</el-tag>
      </el-empty>
    </el-card>
  </section>
</template>
