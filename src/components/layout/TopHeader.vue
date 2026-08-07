<template>
  <div class="top-header">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="header-right">
      <el-tag type="info" size="small">众拓AI智能报告 v1.0</el-tag>

      <!-- User dropdown -->
      <el-dropdown trigger="click" v-if="authStore.isLoggedIn">
        <span class="user-info">
          <el-icon><UserFilled /></el-icon>
          <span class="user-name">{{ authStore.displayName }}</span>
          <el-icon class="arrow-icon"><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>
              <span class="dropdown-label">用户: {{ authStore.user?.username }}</span>
            </el-dropdown-item>
            <el-dropdown-item disabled v-if="authStore.isAdmin">
              <el-tag type="danger" size="small">管理员</el-tag>
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>
              退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const currentTitle = computed(() => route.meta?.title || '')

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.top-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #606266;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.user-info:hover {
  background: #f0f2f5;
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow-icon {
  font-size: 12px;
  color: #909399;
}

.dropdown-label {
  color: #909399;
  font-size: 12px;
}
</style>
