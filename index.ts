/**
 * 哈基虾桌面宠物 - OpenClaw Extension 入口
 * 
 * @author 44-99
 * @version 1.0.0
 */

import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取 __dirname（ES Module 需要）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extension 配置
interface ExtensionConfig {
  enabled?: boolean;
  alwaysOnTop?: boolean;
  transparent?: boolean;
  theme?: string;
  performanceMode?: 'normal' | 'low';
}

// 进程引用
let electronProcess: ChildProcess | null = null;
let pythonProcess: ChildProcess | null = null;

function getExtensionRoot() {
  // __dirname 已经是 index.ts 所在目录
  return __dirname;
}

function resolveElectronCommand() {
  const extensionRoot = getExtensionRoot();

  if (process.platform === 'win32') {
    const localElectronExe = path.join(extensionRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
    if (fs.existsSync(localElectronExe)) {
      return localElectronExe;
    }

    const localElectron = path.join(extensionRoot, 'node_modules', '.bin', 'electron.cmd');
    if (fs.existsSync(localElectron)) {
      return localElectron;
    }
  } else {
    const localElectron = path.join(extensionRoot, 'node_modules', '.bin', 'electron');
    if (fs.existsSync(localElectron)) {
      return localElectron;
    }
  }

  return 'electron';
}

function resolvePythonCommand() {
  const extensionRoot = getExtensionRoot();
  const userOpenClawRoot = path.join(process.env.USERPROFILE || '', '.openclaw');

  if (process.platform === 'win32') {
    const candidates = [
      path.join(extensionRoot, '.venv', 'Scripts', 'python.exe'),
      path.join(userOpenClawRoot, '.venv', 'Scripts', 'python.exe'),
      'python',  // 使用系统 Python
    ];

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return 'python';
  }

  const candidates = [
    path.join(extensionRoot, '.venv', 'bin', 'python3'),
    path.join(userOpenClawRoot, '.venv', 'bin', 'python3'),
    'python3',
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'python3';
}

/**
 * 启动 Electron 窗口
 */
function startElectron(config: ExtensionConfig) {
  try {
    const extensionRoot = getExtensionRoot();
    const electronCommand = resolveElectronCommand();
    const electronPath = path.join(extensionRoot, 'electron', 'main.cjs');
    
    electronProcess = spawn(electronCommand, [electronPath], {
      cwd: extensionRoot,
      env: {
        ...process.env,
        PET_THEME: config.theme || 'default',
        PET_ALWAYS_ON_TOP: String(config.alwaysOnTop ?? true),
        PET_TRANSPARENT: String(config.transparent ?? true),
        // 确保不传递任何会开启开发者工具的环境变量
        ELECTRON_ENABLE_LOGGING: undefined,
        ELECTRON_ENABLE_STACK_DUMPING: undefined,
        DEBUG: undefined,
      },
    });

    electronProcess.stdout?.on('data', (data) => {
      console.log(`[Electron] ${data.toString().trim()}`);
    });

    electronProcess.stderr?.on('data', (data) => {
      console.error(`[Electron Error] ${data.toString().trim()}`);
    });

    electronProcess.on('error', (error) => {
      console.error('❌ Electron 进程启动失败:', error);
      electronProcess = null;
    });

    electronProcess.on('close', (code) => {
      console.log(`[Electron] 进程退出，代码：${code}`);
      electronProcess = null;
    });

    console.log('✅ Electron 窗口已启动');
  } catch (error) {
    console.error('❌ 启动 Electron 失败:', error);
  }
}

/**
 * 启动 Python 后端
 */
function startPython() {
  try {
    const extensionRoot = getExtensionRoot();
    const pythonPath = path.join(extensionRoot, 'python', 'server.py');
    const pythonCommand = resolvePythonCommand();
    
    pythonProcess = spawn(pythonCommand, [pythonPath], {
      cwd: path.join(extensionRoot, 'python'),
      env: process.env,
    });

    pythonProcess.stdout?.on('data', (data) => {
      console.log(`[Python] ${data.toString().trim()}`);
    });

    pythonProcess.stderr?.on('data', (data) => {
      console.error(`[Python Error] ${data.toString().trim()}`);
    });

    pythonProcess.on('error', (error) => {
      console.error('❌ Python 进程启动失败:', error);
      pythonProcess = null;
    });

    pythonProcess.on('close', (code) => {
      console.log(`[Python] 进程退出，代码：${code}`);
      pythonProcess = null;
    });

    console.log('✅ Python 后端已启动');
  } catch (error) {
    console.error('❌ 启动 Python 失败:', error);
  }
}

/**
 * 停止所有进程
 */
function stopProcesses() {
  console.log('🛑 停止所有进程...');
  
  if (electronProcess) {
    console.log('🛑 停止 Electron...');
    if (process.platform === 'win32') {
      // Windows 使用 taskkill 确保完全退出
      spawn('taskkill', ['/F', '/PID', String(electronProcess.pid)], { stdio: 'ignore' });
    } else {
      electronProcess.kill('SIGTERM');
    }
    electronProcess = null;
  }
  
  if (pythonProcess) {
    console.log('🛑 停止 Python...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/PID', String(pythonProcess.pid)], { stdio: 'ignore' });
    } else {
      pythonProcess.kill('SIGTERM');
    }
    pythonProcess = null;
  }
  
  console.log('✅ 所有进程已停止');
}

/**
 * Extension 注册函数
 * 
 * @param api - OpenClaw Plugin API
 */
export default function register(api: any) {
  console.log('🦞 哈基虾 Extension 初始化...');
  
  // 获取配置
  const config: ExtensionConfig = api.config || {};
  
  // 检查是否启用
  if (config.enabled === false) {
    console.log('ℹ️ 哈基虾 Extension 已禁用，跳过初始化');
    return { dispose: () => {} };
  }
  
  // 启动进程
  startElectron(config);
  startPython();
  
  // 监听 Gateway 事件
  api.on?.('tool.call', (event: any) => {
    // 发送事件到 Electron（通过进程间通信）
    if (electronProcess) {
      electronProcess.send?.({ type: 'tool.call', event });
    }
  });
  
  api.on?.('session.start', (session: any) => {
    if (electronProcess) {
      electronProcess.send?.({ type: 'session.start', session });
    }
  });
  
  api.on?.('session.end', (session: any) => {
    if (electronProcess) {
      electronProcess.send?.({ type: 'session.end', session });
    }
  });
  
  // 监听配置变更
  api.onConfigChange?.((newConfig: ExtensionConfig) => {
    console.log('📝 配置已更新:', newConfig);
    // TODO: 动态更新配置（如切换主题）
  });
  
  console.log('✅ 哈基虾 Extension 初始化完成');
  
  // 返回清理函数
  return {
    dispose: () => {
      console.log('🦞 哈基虾 Extension 清理中...');
      stopProcesses();
    }
  };
}
