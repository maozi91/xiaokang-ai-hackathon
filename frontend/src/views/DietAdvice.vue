<script setup>
import { Apple } from '@element-plus/icons-vue'
</script>

<template>
  <section class="page">
    <el-card shadow="never" class="placeholder-card">
      <div class="page-head">
        <div class="page-icon">
          <el-icon :size="28"><Apple /></el-icon>
        </div>
        <div>
          <p class="page-kicker">DIET ADVICE</p>
          <h2 class="page-title">饮食建议</h2>
          <p class="page-desc">
            页面占位已创建。后续可在此录入身高、体重、活动水平与饮食偏好，
            计算每日热量需求，并生成校园食堂友好的一日三餐搭配。
          </p>
        </div>
      </div>

      <el-divider />

      <el-empty description="饮食建议模块初始化完成，功能开发中">
        <el-tag type="primary" effect="plain" round>初始化占位页</el-tag>
      </el-empty>
    </el-card>
  </section>
</template>
