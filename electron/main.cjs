const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const http = require('http');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('❌ 哈基虾已经在运行中，退出当前实例');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('⚠️ 检测到第二个实例启动请求');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let mainWindow;
let pythonProcess;
let tray = null;
let gatewayToken = null;

const OPENCLAW_GATEWAY_URL = 'http://127.0.0.1:18789';

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    const parsedUrl = new URL(url);
    const options = {
      hostname: '127.0.0.1',
      port: 18789,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData),
        'Authorization': `Bearer ${gatewayToken || ''}`
      }
    };
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (!responseBody) { reject(new Error('Empty response')); return; }
        try {
          const parsed = JSON.parse(responseBody);
          resolve(parsed);
        } catch (e) {
          console.error('❌ JSON 解析失败:', e.message);
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });
    req.on('error', (error) => { console.error('❌ HTTP 请求失败:', error.message); reject(error); });
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(jsonData);
    req.end();
  });
}

function getPythonCommand() {
  const projectRoot = path.join(__dirname, '..');
  if (process.platform === 'win32') {
    const venvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
    const venvPythonw = path.join(projectRoot, '.venv', 'Scripts', 'pythonw.exe');
    if (fs.existsSync(venvPython)) return venvPython;
    if (fs.existsSync(venvPythonw)) return venvPythonw;
    return 'python';
  }
  const venvPython = path.join(projectRoot, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPython)) return venvPython;
  return 'python3';
}

function loadGatewayToken() {
  try {
    const configPath = path.join(process.env.USERPROFILE, '.openclaw', 'openclaw.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      gatewayToken = config.gateway?.auth?.token;
      console.log('Gateway token loaded:', gatewayToken ? '***' + gatewayToken.slice(-4) : 'NOT FOUND');
      return gatewayToken;
    }
  } catch (error) {
    console.error('Failed to load gateway token:', error.message);
  }
  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    hasShadow: false,       // ❌ 移除阴影（阴影区域会阻挡点击穿透）
    x: 100,
    y: 100,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
      acceleratorWorksWhenHidden: false,
    },
  });

  // ⭐ 默认关闭 DevTools
  // mainWindow.webContents.openDevTools();

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('❌ Render process gone:', details);
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

process.on('message', (message) => {
  if (message && mainWindow) {
    mainWindow.webContents.send('gateway-event', message);
    console.log('[IPC] Forwarded to renderer:', message.type);
  }
});

function startPythonServer() {
  const serverPath = path.join(__dirname, '..', 'python', 'server.py');
  const pythonCommand = getPythonCommand();
  console.log('Starting Python backend with:', pythonCommand);

  pythonProcess = spawn(pythonCommand, [serverPath], {
    cwd: path.join(__dirname, '..', 'python'),
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let pythonClosed = false;
  pythonProcess.stdout.on('data', (data) => {
    if (!pythonClosed) console.log(`[Python] ${data.toString().trim()}`);
  });
  pythonProcess.stderr.on('data', (data) => {
    if (!pythonClosed) {
      const msg = data.toString().trim();
      if (!msg.includes('Input redirection is not supported')) {
        console.error(`[Python Error] ${msg}`);
      }
    }
  });
  pythonProcess.on('close', (code) => {
    pythonClosed = true;
    if (code !== 0 && code !== null) console.log(`Python process exited with code ${code}`);
  });
  pythonProcess.on('error', (err) => {
    console.error('❌ 启动 Python 后端失败:', err.message);
  });
  console.log('✅ Python backend started');
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'lobster.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setTitle('Hajixia');
  tray.setToolTip('哈基虾桌面宠物 - 点击显示/隐藏');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.setAlwaysOnTop(true); } } },
    { label: '隐藏', click: () => { if (mainWindow) mainWindow.hide(); } },
    { label: '重启', click: () => { if (mainWindow) mainWindow.reload(); } },
    { type: 'separator' },
    {
      label: '退出', click: () => {
        try {
          const sessionsPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
          const sessionsFile = path.join(sessionsPath, 'sessions.json');
          if (fs.existsSync(sessionsFile)) {
            const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
            let cleaned = false;
            for (const [key, value] of Object.entries(sessions)) {
              if (key.startsWith('agent:main:openai-user:desktop-pet:')) {
                const sessionId = value.sessionId;
                const transcriptFile = path.join(sessionsPath, `${sessionId}.jsonl`);
                if (fs.existsSync(transcriptFile)) fs.unlinkSync(transcriptFile);
                delete sessions[key];
                cleaned = true;
                console.log(`🧹 清理桌面宠物会话：${key}`);
              }
            }
            if (cleaned) {
              fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
              console.log('✅ 会话清理完成');
            }
          }
        } catch (error) {
          console.error('❌ 清理会话失败:', error);
        }
        if (pythonProcess) {
          console.log('🛑 停止 Python 后端...');
          try {
            if (process.platform === 'win32') {
              const { execSync } = require('child_process');
              execSync(`taskkill /F /PID ${pythonProcess.pid} 2>nul`, { stdio: 'ignore' });
            } else {
              pythonProcess.kill('SIGTERM');
            }
            console.log('✅ Python 后端已停止');
          } catch (err) {
            console.error('⚠️ 停止 Python 后端失败：' + err.message);
          }
          pythonProcess = null;
        }
        if (tray) { tray.destroy(); console.log('✅ 托盘已销毁'); }
        console.log('👋 再见！');
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.setAlwaysOnTop(true); }
    }
  });
  console.log('System tray created');
}

app.whenReady().then(async () => {
  loadGatewayToken();
  createWindow();
  startPythonServer();
  createTray();
  console.log('ℹ️ Python WebSocket 将由前端 renderer 连接');
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
  if (mainWindow) mainWindow.hide();
});

app.on('before-quit', (event) => {
  if (pythonProcess && pythonProcess.exitCode === null) {
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /PID ${pythonProcess.pid} 2>nul`, { stdio: 'ignore' });
      } else {
        pythonProcess.kill('SIGTERM');
      }
    } catch (err) {}
  }
});

ipcMain.handle('get-system-status', async () => { return {}; });

ipcMain.handle('get-gateway-token', async () => {
  try {
    const configPath = path.join(process.env.USERPROFILE, '.openclaw', 'openclaw.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const token = config.gateway?.auth?.token;
      console.log('🔑 Gateway Token:', token ? '***' + token.slice(-4) : 'NOT FOUND');
      return token || null;
    }
  } catch (error) {
    console.error('❌ 读取 Gateway Token 失败:', error);
  }
  return null;
});

ipcMain.on('log-to-console', (event, message, data) => {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  if (data !== undefined) console.log(`[${timestamp}] [Renderer] ${message}:`, data);
  else console.log(`[${timestamp}] [Renderer] ${message}`);
});

ipcMain.on('play-sound', (event, soundType) => {
  mainWindow.webContents.send('play-sound', soundType);
});

ipcMain.on('toggle-visibility', () => {
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
});

ipcMain.on('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('quit-app', () => {
  const projectRoot = path.join(__dirname, '..');
  const logFile = path.join(projectRoot, 'cleanup.log');
  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const log = (msg) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const line = `[${timestamp}] ${msg}\n`;
    try { fs.appendFileSync(logFile, line, 'utf8'); } catch (e) { console.error('❌ 日志写入失败:', e.message); }
    console.log(msg);
  };
  try {
    const sessionsPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
    const sessionsFile = path.join(sessionsPath, 'sessions.json');
    if (fs.existsSync(sessionsFile)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      let cleaned = false;
      for (const [key, value] of Object.entries(sessions)) {
        if (key.startsWith('agent:main:openai-user:desktop-pet:')) {
          const sessionId = value.sessionId;
          const transcriptFile = path.join(sessionsPath, `${sessionId}.jsonl`);
          if (fs.existsSync(transcriptFile)) fs.unlinkSync(transcriptFile);
          delete sessions[key];
          cleaned = true;
        }
      }
      if (cleaned) {
        fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
        log('✅ 清理桌面宠物会话完成');
      }
    }
  } catch (error) {
    log('❌ 清理会话失败：' + error.message);
  }
  if (pythonProcess && pythonProcess.exitCode === null) {
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /PID ${pythonProcess.pid} 2>nul`, { stdio: 'ignore' });
      } else {
        pythonProcess.kill('SIGTERM');
      }
    } catch (err) {}
    pythonProcess = null;
  }
  if (tray) tray.destroy();
  app.quit();
});

ipcMain.on('show-from-tray', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.setAlwaysOnTop(true); }
});

ipcMain.on('move-window', (event, deltaX, deltaY) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  mainWindow.setPosition(bounds.x + deltaX, bounds.y + deltaY);
});

ipcMain.on('set-window-position', (event, x, y) => {
  if (!mainWindow) return;
  mainWindow.setPosition(Math.round(x), Math.round(y));
});

ipcMain.handle('get-window-position', () => {
  if (!mainWindow) return { x: 0, y: 0 };
  const bounds = mainWindow.getBounds();
  return { x: bounds.x, y: bounds.y };
});

ipcMain.handle('send-to-openclaw', async (event, message, sessionKey) => {
  try {
    console.log('📝 话题生成请求:', sessionKey);
    const data = await httpPost(`${OPENCLAW_GATEWAY_URL}/v1/chat/completions`, {
      model: 'openclaw:main',
      messages: [
        { role: 'system', content: '你是一个温暖、有趣、有点小调皮的 AI 助手。请用 1-2 句话回复，50 字以内，口语化，带 1-2 个 emoji。' },
        { role: 'user', content: message }
      ],
      user: sessionKey
    });
    if (data.error) return { success: false, error: data.error.message || 'Unknown error' };
    const reply = data.choices?.[0]?.message?.content || '(no response)';
    console.log('✅ OpenClaw reply:', reply);
    return { success: true, reply: reply, sessionKey: sessionKey };
  } catch (error) {
    console.error('❌ OpenClaw API error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-chat-history', async () => { return []; });

ipcMain.handle('get-memory-files', async () => {
  try {
    const os = require('os');
    const workspaceDir = path.join(os.homedir(), '.openclaw', 'workspace');
    const memoryDir = path.join(os.homedir(), '.openclaw', 'workspace', 'memory');
    const today = new Date().toISOString().split('T')[0];
    const todayPath = path.join(memoryDir, `${today}.md`);
    let soul = '', memory = '', todayNote = '', user = '', identity = '';
    const soulPath = path.join(workspaceDir, 'SOUL.md');
    if (fs.existsSync(soulPath)) soul = fs.readFileSync(soulPath, 'utf8');
    const memoryMdPath = path.join(workspaceDir, 'MEMORY.md');
    if (fs.existsSync(memoryMdPath)) memory = fs.readFileSync(memoryMdPath, 'utf8');
    if (fs.existsSync(todayPath)) todayNote = fs.readFileSync(todayPath, 'utf8').substring(0, 200);
    const userPath = path.join(workspaceDir, 'USER.md');
    if (fs.existsSync(userPath)) user = fs.readFileSync(userPath, 'utf8');
    const identityPath = path.join(workspaceDir, 'IDENTITY.md');
    if (fs.existsSync(identityPath)) identity = fs.readFileSync(identityPath, 'utf8');
    return { soul, memory, today: todayNote, user, identity };
  } catch (error) {
    console.error('❌ 读取记忆文件失败:', error);
    return { soul: '', memory: '', today: '', user: '', identity: '' };
  }
});

ipcMain.on('set-emotion', (event, emotion, intensity) => {
  console.log('🎭 Emotion updated:', emotion, intensity);
});

ipcMain.handle('delete-pending-topic', async (event, sessionKey) => {
  try {
    console.log(`🗑️ 删除待处理话题：${sessionKey}`);
    const sessionsPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
    const sessionsFile = path.join(sessionsPath, 'sessions.json');
    if (fs.existsSync(sessionsFile)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      console.log('📂 当前会话数:', Object.keys(sessions).length);
      let actualKey = sessionKey;
      if (!sessions[sessionKey] && sessionKey.startsWith('desktop-pet:')) {
        actualKey = `agent:main:openai-user:${sessionKey}`;
        console.log(`🔍 尝试匹配完整格式：${actualKey}`);
      }
      if (sessions[actualKey]) {
        const sessionId = sessions[actualKey].sessionId;
        const transcriptFile = path.join(sessionsPath, `${sessionId}.jsonl`);
        if (fs.existsSync(transcriptFile)) fs.unlinkSync(transcriptFile);
        const deletedFiles = fs.readdirSync(sessionsPath).filter(f => f.startsWith(sessionId + '.jsonl.deleted.'));
        deletedFiles.forEach(f => { fs.unlinkSync(path.join(sessionsPath, f)); console.log(`🗑️ 已删除备份：${f}`); });
        delete sessions[actualKey];
        fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
        console.log(`✅ 已彻底删除会话：${actualKey}`);
        return { success: true };
      }
    }
    console.log(`ℹ️ 会话不存在（无需删除）: ${sessionKey}`);
    return { success: true };
  } catch (error) {
    console.error('❌ 删除会话失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-desktop-pet-session', async (event, sessionKey) => {
  try {
    let actualKey = sessionKey;
    if (sessionKey.startsWith('desktop-pet:') && !sessionKey.startsWith('agent:main:openai-user:')) {
      actualKey = `agent:main:openai-user:${sessionKey}`;
      console.log(`🔑 会话 Key 转换：${sessionKey} → ${actualKey}`);
    }
    const url = `http://127.0.0.1:18789/?session=${encodeURIComponent(actualKey)}`;
    shell.openExternal(url);
    console.log('🚀 打开桌面宠物会话:', url);
    return { success: true };
  } catch (error) {
    console.error('❌ 打开会话失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('has-tavily-api-key', async () => {
  try {
    const envPath = path.join(os.homedir(), '.openclaw', '.env');
    let hasKey = false;
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      hasKey = /^TAVILY_API_KEY=.+$/m.test(envContent);
      console.log('📄 .env 文件存在，TAVILY_API_KEY:', hasKey ? '✅ 有' : '❌ 无');
    } else {
      console.log('⚠️ .env 文件不存在:', envPath);
    }
    if (!hasKey && process.env.TAVILY_API_KEY) hasKey = true;
    return hasKey;
  } catch (error) {
    console.error('❌ 检查 Tavily API Key 失败:', error);
    return false;
  }
});

// ⭐ 动态控制鼠标穿透：根据 raycasting 结果决定是否忽略鼠标事件
ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});
