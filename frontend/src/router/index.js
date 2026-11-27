import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/posture'
  },
  {
    path: '/posture',
    name: 'PostureDetect',
    component: () => import('../views/PostureDetect.vue'),
    meta: { title: '体态检测' }
  },
  {
    path: '/sleep',
    name: 'SleepEval',
    component: () => import('../views/SleepEval.vue'),
    meta: { title: '作息评估' }
  },
  {
    path: '/diet',
    name: 'DietAdvice',
    component: () => import('../views/DietAdvice.vue'),
    meta: { title: '饮食建议' }
  },
  {
    path: '/emotion',
    name: 'EmotionChat',
    component: () => import('../views/EmotionChat.vue'),
    meta: { title: '情绪树洞' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/posture'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.afterEach((to) => {
  const title = (to.meta && to.meta.title) || '校园健康助手'
  document.title = `${title} · 校康AI`
})

export default router
