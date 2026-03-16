/**
 * OpenClaw Gateway WebSocket 连接器
 * 用于接收工具调用事件、会话状态等实时数据
 * 
 * @author 44-99
 * @version 1.0.0
 */

export class GatewayConnector {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || 'ws://127.0.0.1:18789';
    this.gatewayToken = options.gatewayToken || null;
    this.onToolCall = options.onToolCall || (() => {});
    this.onSessionStart = options.onSessionStart || (() => {});
    this.onSessionEnd = options.onSessionEnd || (() => {});
    this.onError = options.onError || (() => {});
    
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.clientId = 'openclaw-desktop-pet';
    this.version = '1.0.0';
  }

  /**
   * 连接到 Gateway WebSocket
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // 构建连接 URL（带 Token 认证）
        let url = this.wsUrl;
        if (this.gatewayToken) {
          url += `?token=${encodeURIComponent(this.gatewayToken)}`;
        }
        
        const logMsg = '🔌 正在连接 Gateway WebSocket: ' + url.replace(this.gatewayToken, '***');
        if (window.electronAPI?.logToConsole) {
          window.electronAPI.logToConsole(logMsg);
        } else {
          console.log(logMsg);
        }
        
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          const logMsg = '✅ Gateway WebSocket 已连接';
          if (window.electronAPI?.logToConsole) {
            window.electronAPI.logToConsole(logMsg);
          } else {
            console.log(logMsg);
          }
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // 注册客户端，声明支持 tool-events 能力
          this.registerClient();
          
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            const logMsg = '❌ 解析 Gateway 消息失败';
            if (window.electronAPI?.logToConsole) {
              window.electronAPI.logToConsole(logMsg, error);
            } else {
              console.error(logMsg, error);
            }
          }
        };
        
        this.ws.onclose = (event) => {
          const logMsg = '⚠️ Gateway WebSocket 已关闭';
          if (window.electronAPI?.logToConsole) {
            window.electronAPI.logToConsole(logMsg, { code: event.code, reason: event.reason });
          } else {
            console.log(logMsg, event.code, event.reason);
          }
          this.isConnected = false;
          this.scheduleReconnect();
        };
        
        this.ws.onerror = (error) => {
          const logMsg = '❌ Gateway WebSocket 错误';
          if (window.electronAPI?.logToConsole) {
            window.electronAPI.logToConsole(logMsg, error);
          } else {
            console.error(logMsg, error);
          }
          this.onError(error);
          reject(error);
        };
        
      } catch (error) {
        const logMsg = '❌ 创建 Gateway 连接失败';
        if (window.electronAPI?.logToConsole) {
          window.electronAPI.logToConsole(logMsg, error);
        } else {
          console.error(logMsg, error);
        }
        reject(error);
      }
    });
  }

  /**
   * 注册客户端到 Gateway
   */
  registerClient() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket 未连接，无法注册客户端');
      return;
    }
    
    const registrationMessage = {
      type: 'connect',
      client: this.clientId,
      version: this.version,
      platform: 'electron',
      mode: 'ui',
      caps: ['tool-events']  // ⭐ 关键：声明支持工具事件
    };
    
    console.log('📝 注册客户端:', registrationMessage);
    this.ws.send(JSON.stringify(registrationMessage));
  }

  /**
   * 处理接收到的消息
   * @param {object} message - Gateway 消息
   */
  handleMessage(message) {
    // console.log('📨 收到 Gateway 消息:', message.type, message.stream);
    
    if (message.type === 'agent') {
      if (message.stream === 'tool') {
        // 工具调用事件
        // console.log('🔧 工具事件:', message.data);
        this.onToolCall(message.data);
        
      } else if (message.stream === 'lifecycle') {
        // 会话生命周期事件
        if (message.data.phase === 'start') {
          this.onSessionStart(message.data);
        } else if (message.data.phase === 'end') {
          this.onSessionEnd(message.data);
        }
        
      } else if (message.stream === 'assistant') {
        // AI 助手回复（可选：用于显示 AI 正在思考）
        // console.log('💬 AI 回复:', message.data);
      }
    }
  }

  /**
   * 安排重连（指数退避）
   */
  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`🔄 ${delay}ms 后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        console.log('🔄 开始重连 Gateway WebSocket...');
        this.connect().catch(err => {
          console.error('❌ 重连失败:', err);
        });
      }, delay);
      
    } else {
      console.error('❌ 达到最大重连次数，放弃连接');
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws) {
      console.log('🔌 断开 Gateway WebSocket 连接');
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  /**
   * 获取连接状态
   * @returns {boolean}
   */
  isConnecting() {
    return this.ws && this.ws.readyState === WebSocket.CONNECTING;
  }

  /**
   * 获取连接状态
   * @returns {boolean}
   */
  isOpen() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default GatewayConnector;
