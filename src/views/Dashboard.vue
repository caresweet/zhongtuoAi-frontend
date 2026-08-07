<template>
  <div class="dashboard">
    <h2 class="page-title">数据展示</h2>

    <!-- Stats Cards -->
    <StatsCards :stats="stats" :loading="loading" />

    <el-row :gutter="20" style="margin-top: 20px">
      <!-- Chart -->
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <span>近30天报告趋势</span>
          </template>
          <ReportChart :data="trends" :loading="loadingTrends" />
        </el-card>
      </el-col>

      <!-- Recent Activity -->
      <el-col :span="8">
        <el-card shadow="never" class="recent-card">
          <template #header>
            <span>最近活动</span>
          </template>
          <RecentActivity :reports="recentReports" :loading="loadingRecent" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getDashboardStats, getRecentReports, getTrends } from '@/api/history'
import StatsCards from '@/components/dashboard/StatsCards.vue'
import ReportChart from '@/components/dashboard/ReportChart.vue'
import RecentActivity from '@/components/dashboard/RecentActivity.vue'

const stats = ref({})
const loading = ref(false)
const trends = ref([])
const loadingTrends = ref(false)
const recentReports = ref([])
const loadingRecent = ref(false)

onMounted(async () => {
  loading.value = true
  loadingTrends.value = true
  loadingRecent.value = true

  try {
    const [statsRes, trendsRes, recentRes] = await Promise.all([
      getDashboardStats(),
      getTrends(30),
      getRecentReports(10),
    ])
    stats.value = statsRes.data
    trends.value = trendsRes.data || []
    recentReports.value = recentRes.data || []
  } catch (e) {
    // Error handled by interceptor
  } finally {
    loading.value = false
    loadingTrends.value = false
    loadingRecent.value = false
  }
})
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 20px;
  color: #303133;
}

.recent-card {
  height: 100%;
}
</style>
