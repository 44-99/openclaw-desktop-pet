const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemStatus: () => ipcRenderer.invoke('get-system-status'),
  playSound: (soundType) => ipcRenderer.send('play-sound', soundType),
  toggleVisibility: () => ipcRenderer.send('toggle-visibility'),
  quitApp: () => ipcRenderer.send('quit-app'),
  moveWindow: (screenX, screenY, deltaX, deltaY) => {
    ipcRenderer.send('move-window', deltaX, deltaY);
  },
  setWindowPosition: (x, y) => {
    ipcRenderer.send('set-window-position', x, y);
  },
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  
  // ========== OpenClaw 集成 ==========
  // 发送到 OpenClaw Gateway
  sendToOpenClaw: (message, sessionKey) => ipcRenderer.invoke('send-to-openclaw', message, sessionKey),
  
  // 获取对话历史
  getChatHistory: () => ipcRenderer.invoke('get-chat-history'),
  
  // 设置情绪（前端通知后端更新情绪状态）
  setEmotion: (emotion, intensity) => ipcRenderer.send('set-emotion', emotion, intensity),
  
  // 获取记忆文件（包括 SOUL、MEMORY、今日笔记、USER、IDENTITY）
  getMemoryFiles: () => ipcRenderer.invoke('get-memory-files'),
  
  // 删除待处理的话题（使用完整 sessionKey）
  deletePendingTopic: (sessionKey) => ipcRenderer.invoke('delete-pending-topic', sessionKey),
  
  // 打开桌面宠物会话（使用完整 sessionKey）
  openDesktopPetSession: (sessionKey) => ipcRenderer.invoke('open-desktop-pet-session', sessionKey),
  
  // 检查是否有 Tavily API Key
  hasTavilyAPIKey: () => ipcRenderer.invoke('has-tavily-api-key'),
});
