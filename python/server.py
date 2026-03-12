import asyncio
import websockets
import json
import sys
import os
import socket
import subprocess
import platform
import random
import time
import logging
from datetime import datetime
from pathlib import Path

# 设置 UTF-8 编码输出（修复 Windows 中文乱码）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# 配置日志输出（同时输出到控制台和文件）
log_dir = Path(__file__).parent.parent / 'logs'
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"server_{datetime.now().strftime('%Y%m%d')}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),  # 控制台输出
        logging.FileHandler(log_file, encoding='utf-8')  # 文件输出
    ]
)
logger = logging.getLogger(__name__)
logging.getLogger('websockets.server').setLevel(logging.CRITICAL)
logging.getLogger('websockets').setLevel(logging.CRITICAL)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from monitor import SystemMonitor
from states import StateManager

import warnings
warnings.filterwarnings('ignore', category=FutureWarning)

# 加载环境变量
def load_env():
    env_vars = {}
    project_env = Path(__file__).parent.parent / '.env'
    if project_env.exists():
        try:
            with open(project_env, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_vars[key.strip()] = value.strip()
            logger.info(f"[ENV] Loaded: {project_env}")
        except Exception as e:
            logger.error(f"[ENV] Error: {e}")
    return env_vars

ENV = load_env()

class WebSocketServer:
    def __init__(self, host='localhost', port=None):
        self.host = host
        self.port = port if port is not None else int(ENV.get('DEFAULT_PORT', 8765))
        self.monitor = SystemMonitor()
        self.state_manager = StateManager()
        self.clients = set()
        # 注意：LLM 话题生成功能已由前端直接调用 OpenClaw Gateway API
        # Python 后端只负责系统监控（WebSocket 推送状态）
    
    def is_port_in_use(self, port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) == 0
    
    def kill_process_on_port(self, port):
        """强制杀死占用端口的进程，并验证端口是否释放"""
        system = platform.system()
        killed_pids = []
        
        try:
            if system == "Windows":
                # Step 1: 查找占用端口的进程
                result = subprocess.run(
                    f'netstat -ano | findstr :{port}',
                    shell=True,
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace'
                )
                
                if result.stdout:
                    logger.info(f"[Port {port}] Found processes:")
                    for line in result.stdout.strip().split('\n'):
                        if line and 'LISTENING' in line:
                            parts = line.split()
                            if len(parts) >= 5:
                                pid = parts[-1]
                                if pid.isdigit() and pid not in killed_pids:
                                    # Step 2: 强制杀死进程
                                    logger.info(f"[Port {port}] Killing PID {pid}...")
                                    kill_result = subprocess.run(
                                        f'taskkill /F /PID {pid}',
                                        shell=True,
                                        capture_output=True,
                                        text=True
                                    )
                                    
                                    if kill_result.returncode == 0:
                                        logger.info(f"[Port {port}] ✅ Killed PID {pid}")
                                        killed_pids.append(pid)
                                    else:
                                        logger.warning(f"[Port {port}] ❌ Failed to kill PID {pid}: {kill_result.stderr}")
                
                # Step 3: 等待端口释放
                if killed_pids:
                    logger.info(f"[Port {port}] Waiting for port to release...")
                    for _ in range(10):  # 最多等 5 秒
                        time.sleep(0.5)
                        if not self.is_port_in_use(port):
                            logger.info(f"[Port {port}] ✅ Port released!")
                            return True
                    
                    logger.warning(f"[Port {port}] ⚠️ Port still in use after killing processes")
                    return False
                    
        except Exception as e:
            logger.error(f"[Port {port}] Error killing process: {e}")
        
        return len(killed_pids) > 0
    
    def find_available_port(self, start_port=8765, max_attempts=10):
        for port in range(start_port, start_port + max_attempts):
            if not self.is_port_in_use(port):
                return port
        return None
    
    async def generate_topic_with_llm(self, context='casual'):
        """此功能已废弃，话题生成由前端直接调用 OpenClaw Gateway API"""
        logger.warning("[WS] Topic generation requested, but LLM is disabled (use frontend API)")
        return None


    async def handler(self, websocket):
        self.clients.add(websocket)
        logger.info(f"[WS] Connected: {websocket.remote_address}")
        
        try:
            await websocket.send(json.dumps({
                "type": "init",
                "message": "Hajixia server started",
                "version": "0.1.0"
            }))
            
            # 定时发送系统状态（每秒）
            last_status_time = 0
            status_interval = 1.0  # 秒
            
            while True:
                current_time = time.time()
                
                try:
                    # 尝试接收消息（非阻塞）
                    message = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                    data = json.loads(message)
                    self.last_interaction_time = time.time()
                    
                    # 处理心跳请求
                    if data.get('type') == 'ping':
                        await websocket.send(json.dumps({"type": "pong"}))
                    
                    # 收到消息后立即发送状态
                    system_data = self.monitor.get_all_data()
                    state = self.state_manager.determine_state(system_data)
                    await websocket.send(json.dumps({
                        "type": "system_status",
                        **system_data,
                        "state": state
                    }))
                    last_status_time = current_time
                    
                except asyncio.TimeoutError:
                    # 定时发送系统状态（每秒）
                    if current_time - last_status_time >= status_interval:
                        system_data = self.monitor.get_all_data()
                        state = self.state_manager.determine_state(system_data)
                        
                        # 发送常规状态
                        await websocket.send(json.dumps({
                            "type": "system_status",
                            **system_data,
                            "state": state
                        }))
                        
                        # 静默模式：不发送额外的内心戏触发通知
                        
                        last_status_time = current_time
                    continue
                except (EOFError, websockets.exceptions.InvalidMessage, websockets.exceptions.InvalidHandshake):
                    # 无效请求，静默处理
                    continue
                except json.JSONDecodeError:
                    # 非 JSON 消息，忽略
                    continue
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"[WS] Disconnected")
        except websockets.exceptions.InvalidMessage:
            # 无效消息，静默处理
            pass
        finally:
            self.clients.discard(websocket)
    
    async def start(self):
        logger.info("[Hajixia] Starting...")
        
        # Step 1: Try to kill existing process on default port (max 3 attempts)
        max_attempts = 3
        for attempt in range(max_attempts):
            if self.is_port_in_use(self.port):
                logger.warning(f"[Attempt {attempt+1}/{max_attempts}] Port {self.port} in use!")
                
                if self.kill_process_on_port(self.port):
                    logger.info("[OK] Process killed, waiting for port to release...")
                    await asyncio.sleep(2)
                    
                    # Verify port is actually free
                    if not self.is_port_in_use(self.port):
                        logger.info(f"[OK] Port {self.port} is now free!")
                        break
                    else:
                        logger.warning(f"[WARN] Port {self.port} still in use after killing")
                else:
                    logger.warning(f"[WARN] No process killed on port {self.port}")
            else:
                logger.info(f"[OK] Port {self.port} is available")
                break
        
        # Step 2: If port still in use, find alternative port
        if self.is_port_in_use(self.port):
            logger.warning(f"[WARN] Port {self.port} still busy after {max_attempts} attempts, finding alternative...")
            new_port = self.find_available_port(self.port + 1, max_attempts=20)
            
            if new_port:
                logger.info(f"[OK] Using alternative port: {new_port}")
                self.port = new_port
            else:
                logger.error(f"[ERROR] No available port found in range {self.port}-{self.port + 20}")
                raise OSError(f"No available port in range {self.port}-{self.port + 20}")
        
        logger.info(f"[WS] Listening: ws://{self.host}:{self.port}")
        
        # 配置 websockets 服务器，禁用严格的 HTTP 检查以减少握手错误
        async with websockets.serve(
            self.handler, 
            self.host, 
            self.port,
            ping_interval=30,  # 30 秒 ping 一次保持连接
            ping_timeout=10,   # 10 秒超时
            close_timeout=5,   # 5 秒关闭超时
        ):
            await asyncio.Future()

def main():
    server = WebSocketServer()
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        logger.info("\nShutdown")
    except Exception as e:
        logger.error(f"[ERROR] {type(e).__name__}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

