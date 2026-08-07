<template>
  <div>
    <div class="tree-node" :style="{ paddingLeft: (depth * 16) + 'px' }">
      <span v-if="node.type === 'folder'" class="node-icon">📁</span>
      <span class="node-name">{{ node.name }}</span>
      <span v-if="node.type === 'folder'" class="node-count">({{ node.totalFiles }})</span>
    </div>
    <!-- Child folders -->
    <FolderTreeNode
      v-for="(child, key) in node.children"
      :key="key"
      :node="child"
      :depth="depth + 1"
    />
    <!-- Files -->
    <div
      v-for="(file, idx) in node.files"
      :key="'f' + idx"
      class="tree-node tree-file"
      :style="{ paddingLeft: ((depth + 1) * 16) + 'px' }"
    >
      <span class="node-icon">{{ fileIcon(file.type) }}</span>
      <span class="node-name">{{ file.name }}</span>
      <span class="node-size">{{ formatSize(file.size) }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
})

function fileIcon(type) {
  if (type === 'pdf') return '📄'
  if (type === 'image') return '🖼️'
  return '📎'
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}
</script>

<style scoped>
.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 0;
}
.tree-file {
  color: #606266;
}
.node-icon {
  flex-shrink: 0;
  font-size: 12px;
}
.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-count {
  color: #909399;
  font-size: 11px;
}
.node-size {
  color: #c0c4cc;
  font-size: 11px;
  margin-left: auto;
  flex-shrink: 0;
}
</style>
