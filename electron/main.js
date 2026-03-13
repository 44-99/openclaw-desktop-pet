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

// 进程锁文件路径（防止重复启动）
const LOCK_FILE = path.join(os.tmpdir(), 'hajixia-python.lock');

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
  const projectRoot = __dirname;

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
  console.log('🪟 创建窗口，配置：devTools=false, frame=false');
  
  mainWindow = new BrowserWindow({
    width: 300,
    height: 400,
    transparent: true,      // 透明背景
    frame: false,           // 无边框
    alwaysOnTop: true,      // 顶层显示
    skipTaskbar: false,     // 显示在任务栏（方便调试）
    resizable: true,        // 可缩放
    hasShadow: false,       // 无边框窗口不需要阴影
    x: 100,                 // 初始 X 位置
    y: 100,                 // 初始 Y 位置
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,      // 禁用开发者工具
      // 禁用所有快捷键（包括开发者工具快捷键）
      acceleratorWorksWhenHidden: false,
    },
  });
  
  console.log('✅ 窗口创建完成，检查开发者工具状态...');
  
  // 立即检查（不等待）
  if (mainWindow.webContents.isDevToolsOpened()) {
    console.error('❌ 窗口刚创建就检测到开发者工具已打开，强制关闭！');
    mainWindow.webContents.closeDevTools();
  } else {
    console.log('✅ 开发者工具未打开');
  }
  
  // 强制禁用所有开发者工具快捷键
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const keyCombo = `${input.control ? 'Ctrl+' : ''}${input.shift ? 'Shift+' : ''}${input.alt ? 'Alt+' : ''}${input.meta ? 'Cmd+' : ''}${input.key}`;
    
    // 拦截所有开发者工具相关快捷键
    if (input.key === 'F12' || keyCombo.includes('DevTools') || keyCombo.includes('Toggle')) {
      console.log('⛔ 拦截开发者工具快捷键:', keyCombo);
      event.preventDefault();
      return false;
    }
  });

  mainWindow.loadFile('renderer/index.html');
  
  // 窗口加载完成后立即关闭开发者工具（强制）
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow.webContents.isDevToolsOpened()) {
      console.log('⚠️ 检测到开发者工具已打开，强制关闭...');
      mainWindow.webContents.closeDevTools();
    }
  });
  
  // 持续监控：每 500ms 检查一次开发者工具状态
  const devToolsCheckInterval = setInterval(() => {
    if (mainWindow && mainWindow.webContents.isDevToolsOpened()) {
      console.log('⚠️ 开发者工具被重新打开，强制关闭...');
      mainWindow.webContents.closeDevTools();
    }
  }, 500);
  
  // 窗口关闭时清理定时器
  mainWindow.on('closed', () => {
    clearInterval(devToolsCheckInterval);
    mainWindow = null;
  });

  // 窗口关闭时
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 启动 Python 后端
function startPythonServer() {
  // 检查锁文件（防止重复启动）
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
      const pid = lockData.pid;
      
      // 检查进程是否还在运行
      try {
        process.kill(pid, 0); // 检查进程是否存在
        console.log(`✅ Python 进程已在运行 (PID: ${pid})，跳过启动`);
        return;
      } catch (e) {
        // 进程不存在，删除锁文件
        console.log('🗑️ 检测到残留锁文件，清理中...');
        fs.unlinkSync(LOCK_FILE);
      }
    } catch (e) {
      console.log('⚠️ 锁文件解析失败，清理中...');
      try { fs.unlinkSync(LOCK_FILE); } catch (e2) {}
    }
  }
  
  // 检查是否已有进程
  if (pythonProcess) {
    console.log('⚠️ Python 进程已存在，跳过启动');
    return;
  }
  
  const serverPath = path.join(__dirname, 'python', 'server.py');
  const pythonCommand = getPythonCommand();

  console.log('🐍 Starting Python backend with:', pythonCommand);

  // 使用 pipe 捕获 Python 输出
  pythonProcess = spawn(pythonCommand, [serverPath], {
    cwd: path.join(__dirname, 'python'),
    detached: false,  // 子进程，父进程退出时自动退出
    stdio: ['ignore', 'pipe', 'pipe']  // 捕获 stdout/stderr
  });
  
  // 创建锁文件
  fs.writeFileSync(LOCK_FILE, JSON.stringify({
    pid: pythonProcess.pid,
    startTime: Date.now()
  }));
  
  console.log(`✅ Python backend started (PID: ${pythonProcess.pid})`);

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
    console.log(`Python process exited with code ${code}`);
    
    // 清理锁文件
    try {
      if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
        console.log('🗑️ 锁文件已清理');
      }
    } catch (e) {
      console.error('清理锁文件失败:', e.message);
    }
    
    pythonProcess = null;
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
  const iconPath = path.join(__dirname, 'assets', 'lobster.png');
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
  console.log('🚀 App ready, creating window...');
  
  // 强制禁用开发者工具（应用级别）
  app.commandLine.appendSwitch('disable-dev-tools');
  console.log('✅ 已设置 disable-dev-tools 启动参数');
  
  // 先加载网关 Token
  loadGatewayToken();
  
  createWindow();
  startPythonServer();
  createTray(); // 创建系统托盘
  
  // WebSocket 连接由前端 renderer 自行管理，主进程不需要连接
  console.log('ℹ️ Python WebSocket 将由前端 renderer 连接');
  console.log('✅ App initialization complete');

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
  console.log('🦞 应用退出，清理资源...');
  
  if (pythonProcess) {
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /PID ${pythonProcess.pid} 2>nul`, { stdio: 'ignore' });
      } else {
        pythonProcess.kill('SIGTERM');
      }
      console.log('✅ Python 后端已强制关闭');
    } catch (err) {
      console.error('⚠️ 强制关闭 Python 失败：' + err.message);
    }
  }
  
  // 清理锁文件
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
      console.log('🗑️ 锁文件已清理');
    }
  } catch (e) {
    console.error('清理锁文件失败:', e.message);
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
  const logFile = path.join(os.homedir(), '.openclaw', 'workspace', 'projects', 'openclaw-desktop-pet', 'cleanup.log');
  const log = (msg) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const line = `[${timestamp}] ${msg}\n`;
    fs.appendFileSync(logFile, line, 'utf8');
  };
  
  log('🦞 收到退出请求，清理会话中...');
  
  try {
    // 清理可能存在的未打开会话（同步操作，确保完成）
    const sessionsPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
    const sessionsFile = path.join(sessionsPath, 'sessions.json');
    
    log(`📂 sessionsPath: ${sessionsPath}`);
    log(`📄 sessionsFile: ${sessionsFile}`);
    log(`📄 sessionsFile exists: ${fs.existsSync(sessionsFile)}`);
    
    if (fs.existsSync(sessionsFile)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
      let cleaned = false;
      let filesDeleted = 0;
      
      log(`📋 总会话数：${Object.keys(sessions).length}`);
      
      // 查找所有桌面宠物会话
      for (const [key, value] of Object.entries(sessions)) {
        if (key.startsWith('agent:main:openai-user:desktop-pet:')) {
          const sessionId = value.sessionId;
          const transcriptFile = path.join(sessionsPath, `${sessionId}.jsonl`);
          
          log(`🔍 找到桌面宠物会话：${key}`);
          log(`   sessionId: ${sessionId}`);
          log(`   transcriptFile: ${transcriptFile}`);
          log(`   transcriptFile exists: ${fs.existsSync(transcriptFile)}`);
          
          // 删除转录文件
          if (fs.existsSync(transcriptFile)) {
            try {
              fs.unlinkSync(transcriptFile);
              filesDeleted++;
              log(`✅ 已删除转录文件：${sessionId}.jsonl`);
            } catch (err) {
              log(`❌ 删除转录文件失败：${err.message}`);
            }
          } else {
            log(`⚠️ 转录文件不存在：${transcriptFile}`);
          }
          
          // 删除会话条目
          delete sessions[key];
          cleaned = true;
          log(`✅ 已从 sessions.json 删除：${key}`);
        }
      }
      
      // 保存更新后的 sessions.json
      if (cleaned) {
        fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
        log(`✅ 会话清理完成 (删除 ${filesDeleted} 个文件，${Object.keys(sessions).length} 个剩余会话)`);
      } else {
        log('ℹ️ 没有找到桌面宠物会话');
      }
    }
  } catch (error) {
    log('❌ 清理会话失败：' + error.message);
    log('   Stack: ' + error.stack);
  }
  
  log('🦞 退出应用...');
  
  // 1. 先关闭 Python 后端
  if (pythonProcess) {
    log('🛑 停止 Python 后端...');
    try {
      // Windows 下使用 taskkill 确保完全退出（包括子进程）
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /PID ${pythonProcess.pid} 2>nul`, { stdio: 'ignore' });
      } else {
        pythonProcess.kill('SIGTERM');
      }
      log('✅ Python 后端已停止');
    } catch (err) {
      log('⚠️ 停止 Python 后端失败：' + err.message);
    }
    pythonProcess = null;
  }
  
  // 2. 关闭托盘
  if (tray) {
    tray.destroy();
    log('✅ 托盘已销毁');
  }
  
  // 3. 退出应用
  log('👋 再见！');
  app.quit();
});

// 从托盘显示
ipcMain.on('show-from-tray', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true);
  }
});

// 窗口拖拽 - 手动实现（通过 delta 移动）
ipcMain.on('move-window', (event, deltaX, deltaY) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  mainWindow.setPosition(bounds.x + deltaX, bounds.y + deltaY);
});

// 窗口拖拽 - 直接设置位置（用于鼠标拖动）
ipcMain.on('set-window-position', (event, x, y) => {
  if (!mainWindow) {
    console.error('❌ set-window-position: mainWindow 不存在');
    return;
  }
  console.log('🚀 set-window-position:', x, y, '-> 当前窗口位置:', mainWindow.getBounds());
  mainWindow.setPosition(Math.round(x), Math.round(y));
  console.log('✅ 设置后窗口位置:', mainWindow.getBounds());
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
    const memoryDir = path.join(os.homedir(), '.openclaw', 'memory');
    
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
      soul = fs.readFileSync(soulPath, 'utf8').substring(0, 500);
    }
    
    // 读取 MEMORY.md
    const memoryMdPath = path.join(memoryDir, '..', 'MEMORY.md');
    if (fs.existsSync(memoryMdPath)) {
      memory = fs.readFileSync(memoryMdPath, 'utf8').substring(0, 500);
    }
    
    // 读取今日笔记
    if (fs.existsSync(todayPath)) {
      todayNote = fs.readFileSync(todayPath, 'utf8').substring(0, 500);
    }
    
    // 读取 USER.md
    const userPath = path.join(workspaceDir, 'USER.md');
    if (fs.existsSync(userPath)) {
      user = fs.readFileSync(userPath, 'utf8').substring(0, 500);
    }
    
    // 读取 IDENTITY.md
    const identityPath = path.join(workspaceDir, 'IDENTITY.md');
    if (fs.existsSync(identityPath)) {
      identity = fs.readFileSync(identityPath, 'utf8').substring(0, 500);
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

// 打开桌面宠物会话（使用系统默认浏览器）
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
    
    // 使用系统默认浏览器打开（不是 Electron 窗口）
    const url = `http://127.0.0.1:18789/?session=${encodeURIComponent(actualKey)}`;
    
    await shell.openExternal(url);
    console.log('🚀 已使用系统默认浏览器打开桌面宠物会话:', url);
    
    return { success: true };
  } catch (error) {
    console.error('❌ 打开会话失败:', error);
    return { success: false, error: error.message };
  }
});
