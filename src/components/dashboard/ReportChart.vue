<template>
  <el-skeleton :loading="loading" animated :rows="6">
    <v-chart :option="chartOption" style="height: 320px" autoresize />
  </el-skeleton>
</template>

<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps({
  data: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const chartOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['生成总数', '完成数'] },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: {
    type: 'category',
    data: props.data.map(d => d.date.slice(5)),
    axisLabel: { rotate: 45 },
  },
  yAxis: { type: 'value', minInterval: 1 },
  series: [
    {
      name: '生成总数',
      type: 'bar',
      data: props.data.map(d => d.count),
      itemStyle: { color: '#409eff', borderRadius: [4, 4, 0, 0] },
    },
    {
      name: '完成数',
      type: 'line',
      data: props.data.map(d => d.completed),
      itemStyle: { color: '#67c23a' },
      smooth: true,
    },
  ],
}))
</script>
