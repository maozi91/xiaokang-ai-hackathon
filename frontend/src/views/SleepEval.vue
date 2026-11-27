<script setup>
import { Moon } from '@element-plus/icons-vue'
</script>

<template>
  <section class="page">
    <el-card shadow="never" class="placeholder-card">
      <div class="page-head">
        <div class="page-icon">
          <el-icon :size="28"><Moon /></el-icon>
        </div>
        <div>
          <p class="page-kicker">SLEEP EVALUATION</p>
          <h2 class="page-title">作息评估</h2>
          <p class="page-desc">
            页面占位已创建。后续可在此填写就寝、起床、入睡耗时与主观睡眠质量，
            生成睡眠评分与个性化作息改善方案。
          </p>
        </div>
      </div>

      <el-divider />

      <el-empty description="作息评估模块初始化完成，功能开发中">
        <el-tag type="primary" effect="plain" round>初始化占位页</el-tag>
      </el-empty>
    </el-card>
  </section>
</template>
