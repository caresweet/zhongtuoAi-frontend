import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/styles/theme.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { installLogger } from '@/utils/logger'

// 🔴 尽早安装：前端错误/警告会上报到后端 logs/frontend.log
//    （原先只进浏览器控制台，用户报错时我们什么都拿不到）。
//    它只写控制台与文件，**不渲染到页面上** —— 业主口径：不给用户看运行日志。
installLogger()

const app = createApp(App)

// Register all Element Plus icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')
