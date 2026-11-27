<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const activeTab = ref(route.path)

// 路由变化时同步高亮 Tab（例如直接输入 URL 或刷新页面）
watch(
  () => route.path,
  (path) => {
    activeTab.value = path
  }
)

// 点击 Tab 时切换路由
function handleTabChange(name) {
  if (name !== route.path) {
    router.push(name)
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <div class="brand-logo">康</div>
          <div class="brand-text">
            <h1>校康AI · 校园健康助手</h1>
            <p>AI + 健康赛道</p>
          </div>
        </div>

        <el-tabs v-model="activeTab" class="nav-tabs" @tab-change="handleTabChange">
          <el-tab-pane label="体态检测" name="/posture" />
          <el-tab-pane label="作息评估" name="/sleep" />
          <el-tab-pane label="饮食建议" name="/diet" />
          <el-tab-pane label="情绪树洞" name="/emotion" />
        </el-tabs>

        <el-tag class="status-tag" type="primary" effect="plain" round>localhost:3000</el-tag>
      </div>
    </header>

    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <footer class="app-footer">校康AI · 校园健康助手 · AI + 健康赛道参赛项目</footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid #ebeef5;
  background: #ffffff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 36px;
  max-width: 1280px;
  height: 72px;
  margin: 0 auto;
  padding: 0 32px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.brand-logo {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #ffffff;
  font-size: 20px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.3);
}

.brand-text h1 {
  margin: 0;
  color: #303133;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.brand-text p {
  margin: 2px 0 0;
  color: #909399;
  font-size: 11px;
}

.nav-tabs {
  flex: 1;
  min-width: 0;
}

.nav-tabs :deep(.el-tabs__header) {
  margin: 0;
}

.nav-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.nav-tabs :deep(.el-tabs__item) {
  height: 72px;
  padding: 0 22px;
  font-size: 14px;
}

.nav-tabs :deep(.el-tabs__content) {
  display: none;
}

.status-tag {
  flex: none;
}

.app-main {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px;
}

.app-footer {
  padding: 18px 32px 26px;
  color: #a8abb2;
  font-size: 12px;
  text-align: center;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 900px) {
  .header-inner {
    flex-wrap: wrap;
    height: auto;
    gap: 8px 20px;
    padding: 12px 20px;
  }

  .nav-tabs {
    order: 3;
    flex-basis: 100%;
  }

  .nav-tabs :deep(.el-tabs__item) {
    height: 46px;
    padding: 0 14px;
  }

  .app-main {
    padding: 20px;
  }

  .status-tag {
    margin-left: auto;
  }
}
</style>
