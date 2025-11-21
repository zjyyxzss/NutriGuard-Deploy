<script setup lang="ts">
import { ref, nextTick, onMounted, reactive } from 'vue'
import {
  ElContainer, ElAside, ElHeader, ElMain, ElFooter,
  ElInput, ElButton, ElMenu, ElMenuItem, ElIcon, ElMessage,
  ElDialog, ElForm, ElFormItem, ElInputNumber
} from 'element-plus'
import { ChatLineRound, User, Setting, Plus, Clock, Delete } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import request from './utils/axios'

const md = new MarkdownIt()
const userId = 1

// --- 核心状态 ---
const generateUUID = () => 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
const currentConversationId = ref(generateUUID())
const conversationList = ref<string[]>([])
const chatHistory = ref<any[]>([])
const userInput = ref('')
const chatMainRef = ref<HTMLDivElement | null>(null)

// --- 状态：打字机效果 ---
const isTyping = ref(false) // 是否正在打字

// --- 状态：用户档案 ---
const profileVisible = ref(false)
const userProfile = reactive({
  userId: userId,
  height: 170,
  weight: 60,
  allergies: '',
  preferences: ''
})

const initialMessage = { 
  type: 'ai', 
  content: '您好，我是您的智能营养助手 NutriGuard。有什么可以帮助您的？', 
  isMarkdown: false 
}

// --- 1. 核心功能：打字机效果 ---
const typeWriter = async (fullText: string, index: number) => {
  isTyping.value = true
  let currentText = ''
  // 速度：每 30ms 一个字
  for (let i = 0; i < fullText.length; i++) {
    currentText += fullText[i]
    // 更新当前这条消息的内容
    chatHistory.value[index].content = currentText
    // 实时滚动
    scrollToBottom() 
    // 简单的延时
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  isTyping.value = false
}

// --- 2. 核心功能：用户档案 ---
const openProfile = async () => {
  try {
    const res = await request.get('/user/profile', { params: { userId } })
    if (res) Object.assign(userProfile, res)
    profileVisible.value = true
  } catch (e) { ElMessage.error('加载档案失败') }
}

const saveProfile = async () => {
  try {
    await request.post('/user/profile', userProfile)
    ElMessage.success('档案保存成功，AI 已记住您的偏好！')
    profileVisible.value = false
  } catch (e) { ElMessage.error('保存失败') }
}

// --- 3. 核心功能：删除会话 ---
const deleteConversation = async (convId: string) => {
  try {
    await request.delete('/diet/conversation', { params: { userId, conversationId: convId } })
    ElMessage.success('删除成功')
    // 从列表中移除
    conversationList.value = conversationList.value.filter(id => id !== convId)
    // 如果删除的是当前会话，重置为新会话
    if (currentConversationId.value === convId) {
      startNewChat()
    }
  } catch (e) { ElMessage.error('删除失败') }
}

// --- 原有逻辑适配 ---
const scrollToBottom = () => {
  nextTick(() => {
    if (chatMainRef.value) chatMainRef.value.scrollTop = chatMainRef.value.scrollHeight
  })
}

const loadConversationList = async () => {
  try {
    const res = await request.get('/diet/conversations', { params: { userId } })
    if (Array.isArray(res)) {
      conversationList.value = res
      if (currentConversationId.value && !conversationList.value.includes(currentConversationId.value)) {
         conversationList.value.unshift(currentConversationId.value)
      }
    }
  } catch (e) {}
}

const loadHistory = async (convId: string) => {
  const historyList: string[] = await request.get('/diet/history', { params: { userId, conversationId: convId } })
  const newHistory: any[] = []
  if (!historyList || historyList.length === 0) {
     newHistory.push({ ...initialMessage })
  } else {
    historyList.forEach(jsonStr => {
      const msgObj = JSON.parse(jsonStr)
      newHistory.push({
        type: msgObj.role === 'user' ? 'user' : 'ai',
        content: msgObj.content,
        isMarkdown: msgObj.role === 'assistant'
      })
    })
  }
  chatHistory.value = newHistory
  scrollToBottom()
}

const switchConversation = (convId: string) => {
  if (currentConversationId.value === convId) return
  currentConversationId.value = convId
  loadHistory(convId)
}

const startNewChat = () => {
  const newId = generateUUID()
  currentConversationId.value = newId
  chatHistory.value = [ { ...initialMessage } ]
  conversationList.value.unshift(newId)
}

const sendMessage = async () => {
  if (!userInput.value.trim() || isTyping.value) return // 打字时禁止发送
  const text = userInput.value
  userInput.value = ''

  chatHistory.value.push({ type: 'user', content: text, isMarkdown: false })
  scrollToBottom()

  // 占位消息：内容为空，等待打字机填充
  const aiMsgIndex = chatHistory.value.length
  chatHistory.value.push({ type: 'ai', content: 'AI 思考中...', isMarkdown: true, isThinking: true })
  scrollToBottom()

  try {
    const conversationId = currentConversationId.value
    await request.post('/diet/analyze', null, { params: { userId, text, conversationId } })
    
    setTimeout(() => loadConversationList(), 500)

    let attempts = 0
    const pollInterval = setInterval(async () => {
        attempts++
        try {
            const list: string[] = await request.get('/diet/history', { params: { userId, conversationId } })
            if (list && list.length > 0) {
                // 加了 ! 号，告诉 TS 这里的数组元素一定存在
const lastMsg = JSON.parse(list[list.length - 1]!)
const secondLast = list.length >= 2 ? JSON.parse(list[list.length - 2]!) : null
                
                if (lastMsg.role === 'assistant' && secondLast && secondLast.content === text) {
                    clearInterval(pollInterval)
                    // --- 触发打字机 ---
                    chatHistory.value[aiMsgIndex].isThinking = false // 停止思考状态
                    chatHistory.value[aiMsgIndex].content = '' // 清空"思考中"
                    await typeWriter(lastMsg.content, aiMsgIndex)
                }
            }
            if (attempts >= 30) {
                clearInterval(pollInterval)
                chatHistory.value[aiMsgIndex].content = '响应超时'
            }
        } catch (e) {}
    }, 1000)
  } catch (e) { 
    chatHistory.value[aiMsgIndex].content = '错误' 
  }
}

const formatConvId = (id: string) => {
  const parts = id.split('_')
  if (parts.length >= 2) {
    const ts = parseInt(parts[1]!)
    if (!isNaN(ts)) {
      const d = new Date(ts)
      return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`
    }
  }
  return '新会话'
}

onMounted(() => { 
  chatHistory.value = [{...initialMessage}]
  loadConversationList() 
})
</script>

<template>
  <el-container class="common-layout">
    <el-aside width="240px" class="aside-menu">
      <div class="logo-area">NutriGuard</div>
      <div class="new-chat-container">
        <el-button type="primary" class="new-chat-btn" :icon="Plus" @click="startNewChat" round>新建会话</el-button>
      </div>
      
      <el-menu class="history-menu">
        <div class="menu-label">功能</div>
        <el-menu-item index="1" @click="openProfile">
          <el-icon><User /></el-icon><span>我的档案</span>
        </el-menu-item>

        <div class="menu-label" style="margin-top: 15px;">历史会话</div>
        <div class="history-list">
          <div v-for="id in conversationList" :key="id" 
               class="history-item" :class="{ active: currentConversationId === id }"
               @click="switchConversation(id)">
            <div class="history-content">
              <el-icon><Clock /></el-icon>
              <span class="history-text">{{ formatConvId(id) }}</span>
            </div>
            <el-icon class="delete-btn" @click.stop="deleteConversation(id)"><Delete /></el-icon>
          </div>
        </div>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="main-header">
        <div class="header-title">NutriGuard AI</div>
        <el-button v-if="currentConversationId" size="small" text bg>ID: {{ formatConvId(currentConversationId) }}</el-button>
      </el-header>

      <el-main class="chat-main" ref="chatMainRef">
        <div v-for="(msg, index) in chatHistory" :key="index" :class="['chat-bubble', msg.type]">
          <div v-if="msg.isThinking" class="thinking-dots">AI 思考中<span>.</span><span>.</span><span>.</span></div>
          <div v-else-if="msg.isMarkdown" class="content" v-html="md.render(msg.content)"></div>
          <div v-else class="content">{{ msg.content }}</div>
        </div>
      </el-main>

      <el-footer class="chat-footer">
        <el-input v-model="userInput" :disabled="isTyping" placeholder="输入问题..." @keyup.enter="sendMessage">
          <template #append>
            <el-button type="primary" @click="sendMessage" :loading="isTyping">发送</el-button>
          </template>
        </el-input>
      </el-footer>
    </el-container>

    <el-dialog v-model="profileVisible" title="完善个人健康档案" width="400px">
      <el-form :model="userProfile" label-width="80px">
        <el-form-item label="身高(cm)">
          <el-input-number v-model="userProfile.height" :min="50" :max="250" />
        </el-form-item>
        <el-form-item label="体重(kg)">
          <el-input-number v-model="userProfile.weight" :min="20" :max="200" :precision="1" />
        </el-form-item>
        <el-form-item label="过敏原">
          <el-input v-model="userProfile.allergies" placeholder="如：花生、海鲜（无则留空）" />
        </el-form-item>
        <el-form-item label="偏好">
          <el-input v-model="userProfile.preferences" placeholder="如：低糖、素食" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="profileVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProfile">保存设置</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<style scoped>
/* 样式复用 + 新增 */
.common-layout { height: 100vh; width: 100vw; overflow: hidden; }
.aside-menu { background-color: #f4f5f7; display: flex; flex-direction: column; border-right: 1px solid #eee; }
.logo-area { padding: 20px; font-size: 20px; font-weight: bold; text-align: center; }
.new-chat-container { padding: 0 20px 20px; border-bottom: 1px solid #eee; }
.new-chat-btn { width: 100%; background: linear-gradient(45deg, #409eff, #36cfc9); border: none; }
.history-menu { border: none; background: transparent; flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
.history-list { flex-grow: 1; overflow-y: auto; padding: 0 10px; }
.menu-label { font-size: 12px; color: #999; padding: 10px 20px; }

/* 自定义历史列表项 */
.history-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 15px; margin-bottom: 5px; border-radius: 8px; cursor: pointer;
  color: #606266; font-size: 14px; transition: background 0.2s;
}
.history-item:hover { background-color: #ecf5ff; }
.history-item.active { background-color: #e6f1fc; color: #409eff; font-weight: bold; }
.history-content { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.history-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.delete-btn { display: none; color: #f56c6c; padding: 4px; border-radius: 4px; }
.delete-btn:hover { background-color: #fef0f0; }
.history-item:hover .delete-btn { display: block; } /* 鼠标悬停显示删除按钮 */

/* 聊天区域 */
.main-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; }
.chat-main { background-color: #f0f2f5; padding: 20px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; }
.chat-bubble { max-width: 75%; padding: 12px 16px; border-radius: 12px; word-wrap: break-word; box-shadow: 0 2px 6px rgba(0,0,0,0.05); }
.chat-bubble.user { align-self: flex-end; background: #409eff; color: #fff; border-bottom-right-radius: 2px; }
.chat-bubble.ai { align-self: flex-start; background: #fff; border-bottom-left-radius: 2px; }
.chat-footer { padding: 15px 20px; background: #fff; border-top: 1px solid #eee; }

/* Markdown 样式 */
.chat-bubble .content :deep(p) { margin: 5px 0; line-height: 1.6; }
.chat-bubble .content :deep(strong) { color: #e6a23c; } /* 重点文字高亮 */
.thinking-dots span { animation: blink 1.4s infinite both; }
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }
</style>