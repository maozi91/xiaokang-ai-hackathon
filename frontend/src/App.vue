<script setup>
import { onErrorCaptured, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const activeTab = ref(route.path)
const pageError = ref(false)

// 路由变化时同步高亮 Tab，并重置页面异常状态
watch(
  () => route.path,
  (path) => {
    activeTab.value = path
    pageError.value = false
  }
)

// 点击 Tab 时切换路由，捕获懒加载或导航异常
async function handleTabChange(name) {
  if (name === route.path) return

  try {
    await router.push(name)
  } catch (error) {
    console.error('[tab navigation]', error)
    activeTab.value = route.path
  }
}

// 页面级错误边界：单个页面渲染异常时展示兜底内容，避免整页白屏
onErrorCaptured((error) => {
  console.error('[page error]', error)
  pageError.value = true
  return false
})

function reloadPage() {
  window.location.reload()
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
      <div v-if="pageError" class="page-fallback">
        <el-result
          icon="error"
          title="页面加载异常"
          sub-title="请刷新页面，或切换到其他模块后重试"
        >
          <template #extra>
            <el-button type="primary" @click="reloadPage">重新加载</el-button>
          </template>
        </el-result>
      </div>

      <router-view v-else v-slot="{ Component }">
        <component :is="Component" />
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
  gap: 32px;
  max-width: 1280px;
  height: 72px;
  margin: 0 auto;
  padding: 0 36px;
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

.brand-text {
  min-width: 0;
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
  padding: 36px 36px 44px;
}

.page-fallback {
  display: grid;
  place-items: center;
  min-height: 360px;
  border: 1px solid var(--border-light);
  border-radius: var(--xk-radius-card);
  background: #ffffff;
  box-shadow: var(--xk-shadow-card);
}

.app-footer {
  padding: 18px 32px 28px;
  color: #a8abb2;
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
}

@media (max-width: 900px) {
  .header-inner {
    flex-wrap: wrap;
    height: auto;
    gap: 8px 20px;
    padding: 12px 24px;
  }

  .nav-tabs {
    order: 3;
    flex-basis: 100%;
  }

  .nav-tabs :deep(.el-tabs__item) {
    height: 46px;
    padding: 0 16px;
  }

  .app-main {
    padding: 24px 24px 32px;
  }

  .status-tag {
    margin-left: auto;
  }
}

@media (max-width: 560px) {
  .header-inner {
    gap: 8px 12px;
    padding: 10px 16px;
  }

  .brand {
    gap: 8px;
    min-width: 0;
  }

  .brand-logo {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 18px;
  }

  .brand-text h1 {
    max-width: 210px;
    overflow: hidden;
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .brand-text p {
    display: none;
  }

  .status-tag {
    display: none;
  }

  .nav-tabs :deep(.el-tabs__item) {
    height: 42px;
    padding: 0 10px;
    font-size: 13px;
  }

  .app-main {
    padding: 16px 14px 28px;
  }

  .app-footer {
    padding: 16px 14px 24px;
    font-size: 11px;
  }

  .page-fallback {
    min-height: 300px;
  }
}
</style>
