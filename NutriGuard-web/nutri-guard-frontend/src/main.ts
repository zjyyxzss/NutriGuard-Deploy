// src/main.ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus' // 导入 Element Plus
import 'element-plus/dist/index.css'   // 导入 Element Plus 样式 (非常重要！)
import App from './App.vue'



const app = createApp(App)

app.use(ElementPlus) // 将 Element Plus 注册为 Vue 插件
app.mount('#app') // 将应用挂载到 DOM