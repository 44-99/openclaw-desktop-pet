/**
 * OpenClaw Gateway 简化连接器 - 测试版
 * 
 * 目标：测试只发送 Token 能否连接 Gateway
 * 如果成功，就不需要完整的 GatewayBrowserClient 实现
 * 
 * @author 44-99
 * @version 0.1.0 (test)
 */

export class SimpleGatewayClient {
  constructor(options = {}) {
    this.url = options.url || 'ws://127.0.0.1:18789';
    this.token = options.token || null;
    this.onHello = options.onHello || (() => {});
    this.onEvent = options.onEvent || (() => {});
    this.onClose = options.onClose || (() => {});
    
    this.ws = null;
    this.isConnected = false;
  }

  /**
   * 启动连接
   */
  start() {
    console.log('🔌 [SimpleGateway] 正在连接:', this.url);
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('✅ [SimpleGateway] WebSocket 已连接');
        this.isConnected = true;
        
        // 发送简化的 Connect 帧（只带 Token）
        this.sendConnect();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 [SimpleGateway] 收到消息:', message);
          
          if (message.type === 'hello-ok') {
            console.log('✅ [SimpleGateway] 连接成功！');
            this.onHello(message);
          } else if (message.type === 'event') {
            this.onEvent(message);
          } else if (message.type === 'error') {
            console.error('❌ [SimpleGateway] 错误:', message);
          }
        } catch (error) {
          console.error('❌ [SimpleGateway] 解析消息失败:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('⚠️ [SimpleGateway] 连接关闭:', event.code, event.reason);
        this.isConnected = false;
        this.onClose({ code: event.code, reason: event.reason });
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ [SimpleGateway] 连接错误:', error);
      };
      
    } catch (error) {
      console.error('❌ [SimpleGateway] 创建连接失败:', error);
    }
  }

  /**
   * 发送 Connect 帧（简化版）
   */
  sendConnect() {
    const connectFrame = {
      type: 'connect',
      client: 'openclaw-desktop-pet',
      version: '1.0.0',
      platform: 'electron',
      mode: 'ui',
      caps: ['tool-events'],  // ⭐ 声明支持工具事件
      auth: {
        token: this.token  // 只发送 Token
      }
    };
    
    console.log('📤 [SimpleGateway] 发送 Connect:', JSON.stringify(connectFrame, null, 2));
    this.ws.send(JSON.stringify(connectFrame));
  }

  /**
   * 停止连接
   */
  stop() {
    if (this.ws) {
      console.log('🛑 [SimpleGateway] 停止连接');
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  /**
   * 检查连接状态
   */
  get connected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export default SimpleGatewayClient;
