const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');  // 需要获取用户目录
const http = require('http');  // 使用 Node.js 内置模块

// 单实例锁定（防止重复启动）
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('❌ 哈基虾已经在运行中，退出当前实例');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('⚠️ 检测到第二个实例启动请求');
    // 如果已经有实例在运行，聚焦到现有窗口
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

// OpenClaw Gateway 配置
const OPENCLAW_GATEWAY_URL = 'http://127.0.0.1:18789';

// 简化的 HTTP POST 请求函数（不需要额外依赖）
function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    const parsedUrl = new URL(url);
    
    // 明确使用 18789 端口
    const options = {
      hostname: '127.0.0.1',
      port: 18789,
      path: '/v1/chat/completions',  // 使用 OpenAI 兼容的 Chat Completions API
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData),
        'Authorization': `Bearer ${gatewayToken || ''}`  // 需要 Gateway Token 认证
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        if (!responseBody) {
          reject(new Error('Empty response'));
          return;
        }
        
        try {
          const parsed = JSON.parse(responseBody);
          resolve(parsed);
        } catch (e) {
          console.error('❌ JSON 解析失败:', e.message);
          console.error('❌ 原始响应:', responseBody);
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ HTTP 请求失败:', error.message);
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(jsonData);
    req.end();
    console.log('📤 请求已发送');
  });
}

function getPythonCommand() {
  const projectRoot = path.join(__dirname, '..');

  if (process.platform === 'win32') {
    const venvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
    const venvPythonw = path.join(projectRoot, '.venv', 'Scripts', 'pythonw.exe');

    // 优先使用 python.exe 以便看到输出（开发模式）
    if (fs.existsSync(venvPython)) {
      return venvPython;
    }

    if (fs.existsSync(venvPythonw)) {
      return venvPythonw;
    }

    return 'python';  // 改用 python 而不是 pythonw
  }

  const venvPython = path.join(projectRoot, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  return 'python3';
}

// 读取网关 Token（从 openclaw.json 配置文件中读取）
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
    height: 400,
    transparent: true,      // 透明背景
    frame: false,           // 无边框
    alwaysOnTop: true,      // 顶层显示
    skipTaskbar: false,     // 显示在任务栏（方便调试）
    resizable: true,        // 可缩放
    hasShadow: true,        // 有阴影（更容易看到）
    x: 100,                 // 初始 X 位置
    y: 100,                 // 初始 Y 位置
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,      // 禁用开发者工具
      acceleratorWorksWhenHidden: false,
    },
  });
  
  // 禁用开发者工具（生产模式）
  // mainWindow.webContents.openDevTools();

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  
  // 禁用开发者工具
  // mainWindow.webContents.openDevTools();

  // 窗口关闭时
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 启动 Python 后端
function startPythonServer() {
  const serverPath = path.join(__dirname, '..', 'python', 'server.py');
  const pythonCommand = getPythonCommand();

  console.log('Starting Python backend with:', pythonCommand);

  // 使用 pipe 捕获 Python 输出
  pythonProcess = spawn(pythonCommand, [serverPath], {
    cwd: path.join(__dirname, '..', 'python'),
    detached: false,  // 子进程，父进程退出时自动退出
    stdio: ['ignore', 'pipe', 'pipe']  // 捕获 stdout/stderr
  });

  let pythonClosed = false;

  pythonProcess.stdout.on('data', (data) => {
    if (!pythonClosed) {
      console.log(`[Python] ${data.toString().trim()}`);
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    if (!pythonClosed) {
      const msg = data.toString().trim();
      // 忽略无害的警告
      if (!msg.includes('Input redirection is not supported')) {
        console.error(`[Python Error] ${msg}`);
      }
    }
  });

  pythonProcess.on('close', (code) => {
    pythonClosed = true;
    if (code !== 0 && code !== null) {
      console.log(`Python process exited with code ${code}`);
    }
  });

  pythonProcess.on('error', (err) => {
    console.error('❌ 启动 Python 后端失败:', err.message);
    console.error('请确保已安装 Python 3.10+ 并运行：pip install -r python/requirements.txt');
  });
  
  console.log('✅ Python backend started');
}

// 创建系统托盘
function createTray() {
  // 使用龙虾图标
  const iconPath = path.join(__dirname, '..', 'assets', 'lobster.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setTitle('Hajixia');
  tray.setToolTip('哈基虾桌面宠物 - 点击显示/隐藏');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示哈基虾',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.setAlwaysOnTop(true);
        }
      }
    },
    {
      label: '隐藏哈基虾',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    {
      label: '重启哈基虾',
      click: () => {
        if (mainWindow) {
          mainWindow.reload();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        // 清理桌面宠物会话
        try {
          const sessionsPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
          const sessionsFile = path.join(sessionsPath, 'sessions.json');
          
          if (fs.existsSync(sessionsFile)) {
            const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
            let cleaned = false;
            
            // 查找并删除桌面宠物会话
            for (const [key, value] of Object.entries(sessions)) {
              if (key.startsWith('agent:main:openai-user:desktop-pet:')) {
                const sessionId = value.sessionId;
                const transcriptFile = path.join(sessionsPath, `${sessionId}.jsonl`);
                
                // 删除转录文件
                if (fs.existsSync(transcriptFile)) {
                  fs.unlinkSync(transcriptFile);
                  console.log(`🧹 清理转录文件：${sessionId}.jsonl`);
                }
                
                // 删除会话条目
                delete sessions[key];
                cleaned = true;
                console.log(`🧹 清理桌面宠物会话：${key}`);
              }
            }
            
            // 保存更新后的 sessions.json
            if (cleaned) {
              fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
              console.log('✅ 会话清理完成');
            }
          }
        } catch (error) {
          console.error('❌ 清理会话失败:', error);
        }
        
        // 退出应用
        console.log('🦞 收到退出请求，清理会话中...');
        
        // 1. 先关闭 Python 后端
        if (pythonProcess) {
          console.log('🛑 停止 Python 后端...');
          try {
            // Windows 下使用 taskkill 确保完全退出（包括子进程）
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
        
        // 2. 关闭托盘
        if (tray) {
          tray.destroy();
          console.log('✅ 托盘已销毁');
        }
        
        // 3. 退出应用
        console.log('👋 再见！');
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // 双击托盘图标显示/隐藏
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true);
      }
    }
  });
  
  console.log('System tray created');
}

// 应用就绪时
app.whenReady().then(async () => {
  // 先加载网关 Token
  loadGatewayToken();
  
  createWindow();
  startPythonServer();
  createTray(); // 创建系统托盘
  
  // WebSocket 连接由前端 renderer 自行管理，主进程不需要连接
  console.log('ℹ️ Python WebSocket 将由前端 renderer 连接');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时（阻止退出，只隐藏）
app.on('window-all-closed', (event) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.hide();
  }
  // 不退出应用，保持托盘运行
});

// 应用退出前（后备清理方案，确保 Python 进程被杀死）
app.on('before-quit', (event) => {
  if (pythonProcess && pythonProcess.exitCode === null) {
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /PID ${pythonProcess.pid} 2>nul`, { stdio: 'ignore' });
      } else {
        pythonProcess.kill('SIGTERM');
      }
    } catch (err) {
    }
  }
});

// IPC 处理

// 双击打开浏览器功能已移除（暂时不使用）

// 获取系统状态（从 Python 后端）
ipcMain.handle('get-system-status', async () => {
  // 这个会通过 WebSocket 从 Python 获取
  return {};
});

// 播放声音
ipcMain.on('play-sound', (event, soundType) => {
  mainWindow.webContents.send('play-sound', soundType);
});

// 最小化/隐藏
ipcMain.on('toggle-visibility', () => {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
});

// 退出应用（清理未打开的会话）
ipcMain.on('quit-app', () => {
  // 写入日志文件（因为窗口关闭后看不到控制台输出）
  const projectRoot = path.join(__dirname, '..');
  const logFile = path.join(projectRoot, 'cleanup.log');
  
  // 确保目录存在
  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const log = (msg) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const line = `[${timestamp}] ${msg}\n`;
    try {
      fs.appendFileSync(logFile, line, 'utf8');
    } catch (e) {
      // 日志写入失败不影响退出流程
      console.error('❌ 日志写入失败:', e.message);
    }
    // 同时打印到控制台（方便调试）
    console.log(msg);
  };
  
  try {
    // 清理桌面宠物会话
    const sessionsPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
    const sessionsFile = path.join(sessionsPath, 'sessions.json');
    
    if (fs.existsSync(sessionsFile)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      let cleaned = false;
      
      for (const [key, value] of Object.entries(sessions)) {
        if (key.startsWith('agent:main:openai-user:desktop-pet:')) {
          const sessionId = value.sessionId;
          const transcriptFile = path.join(sessionsPath, `${sessionId}.jsonl`);
          
          // 删除转录文件
          if (fs.existsSync(transcriptFile)) {
            fs.unlinkSync(transcriptFile);
          }
          
          // 删除会话条目
          delete sessions[key];
          cleaned = true;
        }
      }
      
      // 保存更新后的 sessions.json
      if (cleaned) {
        fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
        log('✅ 清理桌面宠物会话完成');
      }
    }
  } catch (error) {
    log('❌ 清理会话失败：' + error.message);
  }
  
  // 1. 先关闭 Python 后端（仅在进程仍在运行时）
  if (pythonProcess && pythonProcess.exitCode === null) {
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /PID ${pythonProcess.pid} 2>nul`, { stdio: 'ignore' });
      } else {
        pythonProcess.kill('SIGTERM');
      }
    } catch (err) {
      // 忽略错误（进程可能已自然退出）
    }
    pythonProcess = null;
  }
  
  // 2. 关闭托盘
  if (tray) {
    tray.destroy();
  }
  
  // 3. 退出应用
  app.quit();
});

// 从托盘显示
ipcMain.on('show-from-tray', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true);
  }
});

// 窗口拖拽 - 手动实现（delta 移动）
ipcMain.on('move-window', (event, deltaX, deltaY) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  mainWindow.setPosition(bounds.x + deltaX, bounds.y + deltaY);
});

// 窗口拖拽 - 直接设置位置（用于鼠标拖动，更精准）
ipcMain.on('set-window-position', (event, x, y) => {
  if (!mainWindow) return;
  mainWindow.setPosition(Math.round(x), Math.round(y));
});

// 获取窗口位置（用于拖动计算）
ipcMain.handle('get-window-position', () => {
  if (!mainWindow) return { x: 0, y: 0 };
  const bounds = mainWindow.getBounds();
  return { x: bounds.x, y: bounds.y };
});

// ========== OpenClaw 集成 ==========

// 发送到 OpenClaw（使用 OpenAI Chat Completions API）
ipcMain.handle('send-to-openclaw', async (event, message, sessionKey) => {
  try {
    console.log('📝 话题生成请求:', sessionKey);
    
    const data = await httpPost(`${OPENCLAW_GATEWAY_URL}/v1/chat/completions`, {
      model: 'openclaw:main',
      messages: [
        {
          role: 'system',
          content: '你是一个温暖、有趣、有点小调皮的 AI 助手。请用 1-2 句话回复，50 字以内，口语化，带 1-2 个 emoji。'
        },
        {
          role: 'user',
          content: message
        }
      ],
      user: sessionKey
    });
    
    if (data.error) {
      return {
        success: false,
        error: data.error.message || 'Unknown error'
      };
    }
    
    const reply = data.choices?.[0]?.message?.content || '(no response)';
    console.log('✅ OpenClaw reply:', reply);
    
    return {
      success: true,
      reply: reply,
      sessionKey: sessionKey
    };
  } catch (error) {
    console.error('❌ OpenClaw API error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// 获取对话历史（暂未实现，返回空数组）
ipcMain.handle('get-chat-history', async () => {
  // TODO: 实现从 OpenClaw Gateway 获取历史
  return [];
});

// 获取记忆文件（包括 SOUL、MEMORY、今日笔记、USER、IDENTITY）
ipcMain.handle('get-memory-files', async () => {
  try {
    const os = require('os');
    const workspaceDir = path.join(os.homedir(), '.openclaw', 'workspace');
    const memoryDir = path.join(os.homedir(), '.openclaw', 'workspace', 'memory');
    
    // 读取今日笔记
    const today = new Date().toISOString().split('T')[0];
    const todayPath = path.join(memoryDir, `${today}.md`);
    
    let soul = '';
    let memory = '';
    let todayNote = '';
    let user = '';
    let identity = '';
    
    // 读取 SOUL.md
    const soulPath = path.join(workspaceDir, 'SOUL.md');
    if (fs.existsSync(soulPath)) {
      soul = fs.readFileSync(soulPath, 'utf8');
    }
    
    // 读取 MEMORY.md
    const memoryMdPath = path.join(workspaceDir, 'MEMORY.md');
    if (fs.existsSync(memoryMdPath)) {
      memory = fs.readFileSync(memoryMdPath, 'utf8');
    }
    
    // 读取今日笔记
    if (fs.existsSync(todayPath)) {
      todayNote = fs.readFileSync(todayPath, 'utf8').substring(0, 200);
    }
    
    // 读取 USER.md
    const userPath = path.join(workspaceDir, 'USER.md');
    if (fs.existsSync(userPath)) {
      user = fs.readFileSync(userPath, 'utf8');
    }
    
    // 读取 IDENTITY.md
    const identityPath = path.join(workspaceDir, 'IDENTITY.md');
    if (fs.existsSync(identityPath)) {
      identity = fs.readFileSync(identityPath, 'utf8');
    }
    
    return { soul, memory, today: todayNote, user, identity };
  } catch (error) {
    console.error('❌ 读取记忆文件失败:', error);
    return { soul: '', memory: '', today: '', user: '', identity: '' };
  }
});

// 设置情绪（前端通知后端更新情绪状态）
ipcMain.on('set-emotion', (event, emotion, intensity) => {
  console.log('🎭 Emotion updated:', emotion, intensity);
  // TODO: 将情绪状态传递给 Python 后端或存储在本地
  // 目前只是日志记录，后续会实现情绪状态同步
});

// 删除待处理的话题（单对话模式）
ipcMain.handle('delete-pending-topic', async (event, sessionKey) => {
  try {
    // 传入的 sessionKey 格式：desktop-pet:xxx
    // Gateway 存储的格式：agent:main:openai-user:desktop-pet:xxx
    // 需要自动添加前缀来匹配
    console.log(`🗑️ 删除待处理话题：${sessionKey}`);
    const sessionsPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
    const sessionsFile = path.join(sessionsPath, 'sessions.json');
    
    if (fs.existsSync(sessionsFile)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      console.log('📂 当前会话数:', Object.keys(sessions).length);
      
      // 尝试两种格式匹配（兼容旧格式和新格式）
      let actualKey = sessionKey;
      if (!sessions[sessionKey] && sessionKey.startsWith('desktop-pet:')) {
        // 自动添加 Gateway 添加的前缀
        actualKey = `agent:main:openai-user:${sessionKey}`;
        console.log(`🔍 尝试匹配完整格式：${actualKey}`);
      }
      
      // 找到桌面宠物会话
      if (sessions[actualKey]) {
        const sessionId = sessions[actualKey].sessionId;
        const transcriptFile = path.join(sessionsPath, `${sessionId}.jsonl`);
        
        // 1. 删除转录文件
        if (fs.existsSync(transcriptFile)) {
          fs.unlinkSync(transcriptFile);
          console.log(`📄 已删除转录文件：${sessionId}.jsonl`);
        }
        
        // 2. 删除所有 .deleted 备份文件
        const deletedFiles = fs.readdirSync(sessionsPath)
          .filter(f => f.startsWith(sessionId + '.jsonl.deleted.'));
        deletedFiles.forEach(f => {
          fs.unlinkSync(path.join(sessionsPath, f));
          console.log(`🗑️ 已删除备份：${f}`);
        });
        
        // 3. 从 sessions.json 中删除该会话条目
        delete sessions[actualKey];
        fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
        console.log(`✅ 已彻底删除会话：${actualKey}`);
        
        return { success: true };
      }
    }
    
    console.log(`ℹ️ 会话不存在（无需删除）: ${sessionKey}`);
    return { success: true };  // 不存在也视为成功（已经是空的）
  } catch (error) {
    console.error('❌ 删除会话失败:', error);
    return { success: false, error: error.message };
  }
});

// 打开桌面宠物会话
ipcMain.handle('open-desktop-pet-session', async (event, sessionKey) => {
  try {
    // 传入的 sessionKey 格式：desktop-pet:xxx
    // Gateway Web UI 需要完整格式：agent:main:openai-user:desktop-pet:xxx
    // 自动添加前缀以匹配 Gateway 的会话管理
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

// 检查是否有 Tavily API Key
ipcMain.handle('has-tavily-api-key', async () => {
  try {
    // OpenClaw 项目级 .env 文件路径
    const envPath = path.join(os.homedir(), '.openclaw', '.env');
    let hasKey = false;
    
    // 检查 .env 文件是否存在
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      hasKey = /^TAVILY_API_KEY=.+$/m.test(envContent);
      console.log('📄 .env 文件存在，TAVILY_API_KEY:', hasKey ? '✅ 有' : '❌ 无');
    } else {
      console.log('⚠️ .env 文件不存在:', envPath);
    }
    
    // 也检查环境变量
    if (!hasKey && process.env.TAVILY_API_KEY) {
      hasKey = true;
    }
    return hasKey;
  } catch (error) {
    console.error('❌ 检查 Tavily API Key 失败:', error);
    return false;
  }
});
