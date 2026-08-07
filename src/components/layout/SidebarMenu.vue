<template>
  <el-menu
    :default-active="activeMenu"
    :router="true"
    background-color="#1d1e2c"
    text-color="#a6a7b3"
    active-text-color="#409eff"
    class="sidebar-menu"
  >
    <el-menu-item index="/dashboard">
      <el-icon><DataAnalysis /></el-icon>
      <span>数据展示</span>
    </el-menu-item>
    <el-menu-item index="/knowledge">
      <el-icon><Document /></el-icon>
      <span>知识库</span>
    </el-menu-item>
    <el-menu-item index="/knowledge-chat">
      <el-icon><ChatDotSquare /></el-icon>
      <span>知识问答</span>
    </el-menu-item>
    <el-menu-item index="/assistant">
      <el-icon><ChatDotRound /></el-icon>
      <span>智能助手</span>
    </el-menu-item>
    <el-menu-item index="/history">
      <el-icon><Clock /></el-icon>
      <span>历史报告</span>
    </el-menu-item>
    <el-menu-item index="/cleaning-workbench">
      <el-icon><Brush /></el-icon>
      <span>清洗工作台</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => {
  if (route.path.startsWith('/knowledge-chat')) return '/knowledge-chat'
  if (route.path.startsWith('/assistant')) return '/assistant'
  if (route.path.startsWith('/new-report')) return '/assistant'
  if (route.path.startsWith('/step-wizard')) return '/assistant'
  if (route.path.startsWith('/cleaning-workbench')) return '/cleaning-workbench'
  return route.path
})
</script>

<style scoped>
.sidebar-menu {
  border-right: none;
  margin-top: 8px;
}

.sidebar-menu .el-menu-item {
  margin: 2px 8px;
  border-radius: 8px;
  height: 44px;
  line-height: 44px;
}

.sidebar-menu .el-menu-item.is-active {
  background: rgba(64, 158, 255, 0.12) !important;
}
</style>
