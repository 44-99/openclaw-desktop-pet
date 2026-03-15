/**
 * 哈基虾桌面宠物 - OpenClaw Extension 入口
 * 
 * @author 44-99
 * @version 1.0.0
 * 
 * ⚠️ 重要说明：OpenClaw Gateway 目前不支持 tool.call/session.start/session.end 等事件钩子
 * 工具调用动画功能需要通过其他方式实现（如轮询会话日志、监听 WebSocket 等）
 * 当前版本仅启动 Electron 和 Python 进程，工具调用事件监听暂不实现
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
      'python',
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
  
  const config: ExtensionConfig = api.config || {};
  
  if (config.enabled === false) {
    console.log('ℹ️ 哈基虾 Extension 已禁用，跳过初始化');
    return { dispose: () => {} };
  }
  
  // 启动进程
  startElectron(config);
  startPython();
  
  // ⚠️ 注意：OpenClaw Gateway 目前不支持 tool.call/session.start/session.end 等事件钩子
  // 日志显示：unknown typed hook "tool.call" ignored
  // 工具调用动画功能需要后续通过其他方式实现（如轮询会话日志、WebSocket 监听等）
  
  // 监听配置变更
  api.onConfigChange?.((newConfig: ExtensionConfig) => {
    console.log('📝 配置已更新:', newConfig);
  });
  
  console.log('✅ 哈基虾 Extension 初始化完成');
  console.log('⚠️ 工具调用动画功能暂未实现（Gateway 不支持事件钩子）');
  
  return {
    dispose: () => {
      console.log('🦞 哈基虾 Extension 清理中...');
      stopProcesses();
    }
  };
}
