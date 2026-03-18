/**
 * Minimal Gateway Client for Desktop Pet
 * 精简版 Gateway 客户端 - 只实现核心握手 + 工具事件监听
 * 
 * @author 哈基虾 🦞
 * @version 1.0.0
 * @based OpenClaw src/gateway/client.ts
 */

// ==================== 工具函数 ====================

/**
 * 生成 UUID v4
 */
function generateUUID() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 降级方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Base64URL 编码
 */
function base64UrlEncode(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}

/**
 * Base64URL 解码
 */
function base64UrlDecode(input) {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ==================== Ed25519 密钥对生成 ====================

/**
 * 生成 Ed25519 密钥对
 * 注意：Web Crypto API 不支持 Ed25519，使用 ECDSA P-256 替代
 */
async function generateEd25519KeyPair() {
  try {
    // 尝试使用 Ed25519（如果支持）
    return await crypto.subtle.generateKey(
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      true,
      ['sign', 'verify']
    );
  } catch (e) {
    // 降级：使用 ECDSA P-256
    console.warn('⚠️ Ed25519 不支持，使用 ECDSA P-256 替代');
    return await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );
  }
}

/**
 * 导出公钥为 PEM 格式
 */
async function exportPublicKeyPem(key) {
  const exported = await crypto.subtle.exportKey('spki', key);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)))
    .match(/.{1,64}/g)
    .join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}

/**
 * 导出私钥为 PEM 格式
 */
async function exportPrivateKeyPem(key) {
  const exported = await crypto.subtle.exportKey('pkcs8', key);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)))
    .match(/.{1,64}/g)
    .join('\n');
  return `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
}

/**
 * 计算公钥指纹（deviceId）
 */
async function fingerprintPublicKey(publicKeyPem) {
  const encoder = new TextEncoder();
  const data = encoder.encode(publicKeyPem);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== 设备身份管理 ====================

const STORAGE_KEY = 'desktop-pet-device-identity';

/**
 * 加载或创建设备身份
 */
async function loadOrCreateDeviceIdentity() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.version === 1 && parsed.deviceId && parsed.publicKeyPem && parsed.privateKeyPem) {
        console.log('✅ 加载现有设备身份:', parsed.deviceId.substring(0, 16) + '...');
        return parsed;
      }
    }
  } catch (e) {
    console.warn('⚠️ 加载设备身份失败:', e);
  }

  // 生成新身份
  console.log('🔑 生成新设备身份...');
  const keyPair = await generateEd25519KeyPair();
  const publicKeyPem = await exportPublicKeyPem(keyPair.publicKey);
  const privateKeyPem = await exportPrivateKeyPem(keyPair.privateKey);
  const deviceId = await fingerprintPublicKey(publicKeyPem);

  const identity = {
    version: 1,
    deviceId,
    publicKeyPem,
    privateKeyPem,
    createdAtMs: Date.now()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  console.log('✅ 设备身份已保存:', deviceId.substring(0, 16) + '...');
  
  return identity;
}

// ==================== 签名函数 ====================

/**
 * 构建 v3 设备认证 payload
 * 格式：v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
 */
function buildDeviceAuthPayloadV3(params) {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  const platform = params.platform ?? '';
  const deviceFamily = params.deviceFamily ?? '';
  
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily
  ].join('|');
}

/**
 * 使用 Ed25519 私钥签名 payload
 */
async function signDevicePayload(privateKeyPem, payload) {
  try {
    // 导入私钥
    const base64Data = privateKeyPem
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replaceAll('\n', '');
    
    const privateKeyDer = base64UrlDecode(base64Data);
    
    const algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyDer,
      algorithm,
      true,
      ['sign']
    );

    // 签名
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      data
    );

    return base64UrlEncode(signature);
  } catch (e) {
    console.error('❌ 签名失败:', e);
    throw e;
  }
}

// ==================== Minimal Gateway Client ====================

export class MinimalGatewayClient {
  constructor(options = {}) {
    this.url = options.url || 'ws://127.0.0.1:18789';
    this.token = options.token || null;
    this.onToolCall = options.onToolCall || (() => {});
    this.onSessionStart = options.onSessionStart || (() => {});
    this.onSessionEnd = options.onSessionEnd || (() => {});
    this.onConnectError = options.onConnectError || (() => {});
    this.onConnected = options.onConnected || (() => {});
    
    this.ws = null;
    this.isConnected = false;
    this.connectNonce = null;
    this.connectSent = false;
    this.deviceIdentity = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    
    // 客户端信息
    this.clientInfo = {
      id: 'openclaw-desktop-pet',
      version: '3.2.7',
      platform: 'electron',
      mode: 'ui'
    };
  }

  /**
   * 启动连接
   */
  async start() {
    console.log('🔌 [MinimalGateway] 启动连接:', this.url);
    
    try {
      // 加载或创建设备身份
      this.deviceIdentity = await loadOrCreateDeviceIdentity();
      
      // 创建 WebSocket 连接
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event.data);
      this.ws.onclose = (event) => this.handleClose(event);
      this.ws.onerror = (error) => this.handleError(error);
      
    } catch (error) {
      console.error('❌ [MinimalGateway] 启动失败:', error);
      this.onConnectError(error);
    }
  }

  /**
   * WebSocket 连接成功
   */
  handleOpen() {
    console.log('✅ [MinimalGateway] WebSocket 已连接');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // 等待 Gateway 发送 connect.challenge
    console.log('⏳ [MinimalGateway] 等待 connect.challenge...');
    
    // 设置超时：如果 10 秒内没收到 challenge，关闭连接
    setTimeout(() => {
      if (!this.connectNonce && this.ws?.readyState === WebSocket.OPEN) {
        console.error('❌ [MinimalGateway] connect.challenge 超时');
        this.ws?.close(1008, 'connect.challenge timeout');
      }
    }, 10000);
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(raw) {
    try {
      const message = JSON.parse(raw);
      // console.log('📨 [MinimalGateway] 收到消息:', message.type, message.event);
      
      if (message.type === 'event') {
        this.handleEvent(message);
      } else if (message.type === 'res') {
        this.handleResponse(message);
      }
    } catch (error) {
      console.error('❌ [MinimalGateway] 解析消息失败:', error);
    }
  }

  /**
   * 处理事件
   */
  handleEvent(event) {
    if (event.event === 'connect.challenge') {
      this.handleChallenge(event.payload);
    } else if (event.event === 'tool.call') {
      // 工具调用事件
      console.log('🔧 [MinimalGateway] 工具调用:', event.payload);
      this.onToolCall(event.payload);
    } else if (event.event === 'session.start') {
      this.onSessionStart(event.payload);
    } else if (event.event === 'session.end') {
      this.onSessionEnd(event.payload);
    } else {
      // console.log('📨 [MinimalGateway] 其他事件:', event.event);
    }
  }

  /**
   * 处理 connect.challenge
   */
  async handleChallenge(payload) {
    const nonce = payload?.nonce;
    
    if (!nonce || nonce.trim().length === 0) {
      console.error('❌ [MinimalGateway] challenge nonce 为空');
      this.ws?.close(1008, 'challenge nonce missing');
      return;
    }
    
    console.log('🔐 [MinimalGateway] 收到 challenge, nonce:', nonce.substring(0, 16) + '...');
    this.connectNonce = nonce.trim();
    
    // 发送 connect 帧
    await this.sendConnect();
  }

  /**
   * 发送 connect 帧
   */
  async sendConnect() {
    if (this.connectSent) {
      console.warn('⚠️ [MinimalGateway] connect 已发送，跳过');
      return;
    }
    
    if (!this.connectNonce) {
      console.error('❌ [MinimalGateway] connectNonce 为空，无法发送 connect');
      return;
    }
    
    this.connectSent = true;
    console.log('📤 [MinimalGateway] 发送 connect 帧...');
    
    const requestId = generateUUID();
    const signedAtMs = Date.now();
    const role = 'operator';
    const scopes = ['operator.admin'];
    
    // 构建 v3 payload
    const payload = buildDeviceAuthPayloadV3({
      deviceId: this.deviceIdentity.deviceId,
      clientId: this.clientInfo.id,
      clientMode: this.clientInfo.mode,
      role,
      scopes,
      signedAtMs,
      token: this.token,
      nonce: this.connectNonce,
      platform: this.clientInfo.platform,
      deviceFamily: 'desktop-pet'
    });
    
    console.log('📝 [MinimalGateway] 签名 payload:', payload.substring(0, 50) + '...');
    
    // 签名
    const signature = await signDevicePayload(this.deviceIdentity.privateKeyPem, payload);
    console.log('✍️ [MinimalGateway] 签名完成:', signature.substring(0, 32) + '...');
    
    // 构建 connect 请求
    const connectRequest = {
      type: 'req',
      id: requestId,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: this.clientInfo.id,
          version: this.clientInfo.version,
          platform: this.clientInfo.platform,
          mode: this.clientInfo.mode
        },
        role,
        scopes,
        caps: ['tool-events'],
        auth: {
          token: this.token
        },
        device: {
          id: this.deviceIdentity.deviceId,
          publicKey: base64UrlEncode(base64UrlDecode(
            this.deviceIdentity.publicKeyPem
              .replace('-----BEGIN PUBLIC KEY-----', '')
              .replace('-----END PUBLIC KEY-----', '')
              .replaceAll('\n', '')
          )),
          signature,
          signedAt: signedAtMs,
          nonce: this.connectNonce
        }
      }
    };
    
    console.log('📤 [MinimalGateway] 发送 connect:', JSON.stringify(connectRequest, null, 2).substring(0, 500) + '...');
    this.ws.send(JSON.stringify(connectRequest));
  }

  /**
   * 处理响应
   */
  handleResponse(response) {
    if (response.ok && response.payload?.type === 'hello-ok') {
      console.log('✅ [MinimalGateway] 连接成功！protocol:', response.payload.protocol);
      console.log('🎉 [MinimalGateway] 设备 Token:', response.payload.auth?.deviceToken ? '已获取' : '未获取');
      this.onConnected(response.payload);
    } else if (!response.ok) {
      console.error('❌ [MinimalGateway] 连接失败:', response.error);
      this.onConnectError(response.error);
    }
  }

  /**
   * WebSocket 关闭
   */
  handleClose(event) {
    console.log('⚠️ [MinimalGateway] 连接关闭:', event.code, event.reason);
    this.isConnected = false;
    this.connectSent = false;
    this.connectNonce = null;
    
    // 自动重连
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * WebSocket 错误
   */
  handleError(error) {
    console.error('❌ [MinimalGateway] 连接错误:', error);
    this.onConnectError(error);
  }

  /**
   * 安排重连
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [MinimalGateway] 重连次数已达上限');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`🔄 [MinimalGateway] ${delay}ms 后重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      console.log('🔄 [MinimalGateway] 开始重连...');
      this.start();
    }, delay);
  }

  /**
   * 停止连接
   */
  stop() {
    console.log('🛑 [MinimalGateway] 停止连接');
    if (this.ws) {
      this.ws.close(1000, 'client stopped');
      this.ws = null;
    }
    this.isConnected = false;
    this.connectSent = false;
    this.connectNonce = null;
  }

  /**
   * 检查连接状态
   */
  get connected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export default MinimalGatewayClient;
