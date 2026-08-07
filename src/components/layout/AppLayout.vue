<template>
  <el-container class="app-layout">
    <!-- Sidebar -->
    <el-aside width="220px" class="app-sidebar">
      <div class="logo-area">
        <el-icon :size="28" color="#409eff"><Document /></el-icon>
        <span class="logo-text">众拓AI报告</span>
      </div>
      <SidebarMenu />
    </el-aside>

    <!-- Main -->
    <el-container>
      <el-header class="app-header" height="56px">
        <TopHeader />
      </el-header>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import SidebarMenu from './SidebarMenu.vue'
import TopHeader from './TopHeader.vue'
</script>

<style scoped>
.app-layout {
  height: 100vh;
}

.app-sidebar {
  background: #1d1e2c;
  overflow: hidden;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.logo-text {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.app-main {
  background: #f5f7fa;
  padding: 24px;
  overflow-y: auto;
}
</style>
