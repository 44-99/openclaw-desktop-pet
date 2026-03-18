/**
 * 初始化 Gateway WebSocket 连接 - 精简版
 * 
 * 注意：此函数需要在全局 gatewayClient 变量定义后调用
 * 
 * 实现完整的 Gateway 握手协议：
 * 1. WebSocket 连接
 * 2. 等待 connect.challenge
 * 3. 使用 Ed25519 签名 nonce
 * 4. 发送 connect 帧
 * 5. 监听工具事件
 */

// 声明外部变量（在 app.js 中定义）
/* eslint-disable no-unused-vars */
/* global gatewayClient, handleGatewayToolCall */
/* eslint-enable no-unused-vars */

export async function initGatewayConnection() {
  try {
    // 从 Electron 获取 Gateway Token
    let gatewayToken = null;
    if (window.electronAPI?.getGatewayToken) {
      gatewayToken = await window.electronAPI.getGatewayToken();
    }
    
    window.electronAPI?.logToConsole?.('🔌 开始连接 OpenClaw Gateway...');
    window.electronAPI?.logToConsole?.('🔑 Gateway Token:', gatewayToken ? '***' + gatewayToken.slice(-4) : '无');
    
    // 导入精简版 Gateway 客户端
    const { MinimalGatewayClient } = await import('./gateway/minimal-gateway-client.js');
    
    // 创建客户端
    gatewayClient = new MinimalGatewayClient({
      url: 'ws://127.0.0.1:18789',
      token: gatewayToken,
      onConnected: (helloOk) => {
        window.electronAPI?.logToConsole?.('✅ Gateway 连接成功！');
        window.electronAPI?.logToConsole?.('🎉 协议版本:', helloOk.protocol);
        if (helloOk.auth?.deviceToken) {
          window.electronAPI?.logToConsole?.('🔑 设备 Token 已获取');
        }
      },
      onConnectError: (error) => {
        window.electronAPI?.logToConsole?.('❌ Gateway 连接失败', error);
      },
      onToolCall: (payload) => {
        window.electronAPI?.logToConsole?.('🔧 收到工具调用', payload);
        handleGatewayToolCall(payload);
      },
      onSessionStart: (payload) => {
        window.electronAPI?.logToConsole?.('📝 会话启动', payload);
      },
      onSessionEnd: (payload) => {
        window.electronAPI?.logToConsole?.('📝 会话结束', payload);
      }
    });
    
    // 启动连接
    await gatewayClient.start();
    window.electronAPI?.logToConsole?.('⏳ 等待 Gateway challenge...');
    
  } catch (error) {
    window.electronAPI?.logToConsole?.('❌ Gateway 初始化失败', error);
  }
}
