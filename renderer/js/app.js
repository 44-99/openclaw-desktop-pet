// 全局错误捕获
window.addEventListener('error', (event) => {
  console.error('❌ Global Error:', event.message);
  console.error('Stack:', event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled Rejection:', event.reason);
});

console.log('🦞 [app.js] Module loading...');

import * as THREE from 'three';
import { TopicGenerator } from './topic-generator.js';
import { ColorRenderer } from './color-renderer.js';
import { InnerVoiceManager } from './inner-voice.js';
import { ModelLoader } from './model-loader.js';
import { ParticleSystemManagerEnhanced, CodeRainParticle } from './particle-system-enhanced.js';
import { MinimalGatewayClient } from './gateway/minimal-gateway-client.js';
import { getToolConfig, getToolColor } from './tool-mappings.js';
import { initGatewayConnection } from './app-gateway-init.js';

console.log('✅ [app.js] Modules loaded');

// 全局变量
let scene, camera, renderer, pet;
let petParts = {};
let modelLoader = null;
let colorRenderer = null;
let particleManager = null;
let innerVoiceManager = null;
let topicGenerator = null;
let websocket = null;
let gatewayClient = null;
let isRotating = false;
let rotateStartX = 0, rotateStartY = 0;
let isActionInProgress = false;
let cameraBaseZ = 5;
let cameraFloatOffset = 0;
let cameraFloatTime = 0;
let petWrapper = null;
// 工具调用状态
let currentToolState = null;
let toolActionInterval = null;
let currentToolEffect = null;
// ==================== 加载 GLB 模型（替换手搓龙虾） ====================
async function loadGLBModel() {
  modelLoader = new ModelLoader();
  try {
    const gltf = await modelLoader.load('models/gray_wolf.glb');
    
    petWrapper = new THREE.Group();
    
    pet = modelLoader.setup(gltf, {
      scale: 2,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: -Math.PI / 2, z: 0 },
      color: 0xB0C4DE,  // 默认浅蓝色（系统空闲状态颜色）
      useFlatColor: true
    });
    
    petWrapper.add(pet);
    scene.add(petWrapper);
    
    // GLB 动画控制器已删除，使用粒子特效代替
    if (particleManager) {
      particleManager.triggerEffect('idle', petWrapper.position);
    }
  } catch (error) {
    createPetFallback();
  }
}
// ==================== 创建哈基虾（Q 版萌化版）- Fallback ====================
function createPetFallback() {
  pet = new THREE.Group();
  
  const mainColor = 0xFF4444;  // 初始龙虾红
  const accentColor = 0xFF9999;
  const white = 0xFFFFFF;
  const darkPupil = 0x1a1a2e;
  
  pet.position.y = 0;
  
  // ========== 1. 头胸部（中心）- 缩小一点 ==========
  const cephalothoraxGeometry = new THREE.SphereGeometry(0.95, 48, 48);
  cephalothoraxGeometry.scale(1.0, 0.85, 0.95);
  cephalothoraxGeometry.computeVertexNormals();
  const cephalothoraxMaterial = new THREE.MeshPhongMaterial({ 
    color: mainColor, shininess: 90, specular: 0x444444 
  });
  const cephalothorax = new THREE.Mesh(cephalothoraxGeometry, cephalothoraxMaterial);
  pet.add(cephalothorax);
  petParts.cephalothorax = cephalothorax;
  
  // ========== 2. 腹部（3 节，大小递减明显） ==========
  const abdomenSizes = [0.65, 0.5, 0.35];
  for (let i = 0; i < 3; i++) {
    const size = abdomenSizes[i];
    const segmentGeometry = new THREE.SphereGeometry(size, 32, 32);
    segmentGeometry.scale(0.9, 0.8, 0.8);
    segmentGeometry.computeVertexNormals();
    const segmentMaterial = new THREE.MeshPhongMaterial({ 
      color: mainColor, shininess: 85, specular: 0x444444 
    });
    const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
    segment.position.set(0, -0.65 - i * 0.45, -0.1);
    pet.add(segment);
    petParts[`abdomen${i}`] = segment;
  }
  
  // ========== 3. 尾巴（倒三角扇形） ==========
  const tailMaterial = new THREE.MeshPhongMaterial({ 
    color: mainColor, shininess: 80, specular: 0x333333, side: THREE.DoubleSide 
  });
  
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.quadraticCurveTo(0.4, -0.3, 0.3, -0.6);
  tailShape.quadraticCurveTo(0, -0.45, -0.3, -0.6);
  tailShape.quadraticCurveTo(-0.4, -0.3, 0, 0);
  
  const tailGeometry = new THREE.ShapeGeometry(tailShape);
  tailGeometry.computeVertexNormals();
  const tail = new THREE.Mesh(tailGeometry, tailMaterial);
  tail.position.set(0, -1.7, -0.15);
  pet.add(tail);
  petParts.tail = tail;
  
  // ========== 4. 眼睛（陷进头部，不突出） ==========
  const eyeballGeometry = new THREE.SphereGeometry(0.13, 32, 32);
  const eyeballMaterial = new THREE.MeshPhongMaterial({ color: white, shininess: 100, specular: 0x555555 });
  
  const leftEyeball = new THREE.Mesh(eyeballGeometry, eyeballMaterial);
  leftEyeball.position.set(-0.42, 0.25, 0.72);
  pet.add(leftEyeball);
  petParts.leftEyeball = leftEyeball;
  
  const rightEyeball = new THREE.Mesh(eyeballGeometry, eyeballMaterial);
  rightEyeball.position.set(0.42, 0.25, 0.72);
  pet.add(rightEyeball);
  petParts.rightEyeball = rightEyeball;
  
  // 瞳孔（缩小并深陷）
  const pupilGeometry = new THREE.SphereGeometry(0.07, 24, 24);
  const pupilMaterial = new THREE.MeshBasicMaterial({ color: darkPupil });
  
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  leftPupil.position.set(0, 0.02, 0.09);
  leftEyeball.add(leftPupil);
  petParts.leftPupil = leftPupil;
  
  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  rightPupil.position.set(0, 0.02, 0.09);
  rightEyeball.add(rightPupil);
  petParts.rightPupil = rightPupil;
  
  // 高光（缩小并深陷）
  const highlightGeometry = new THREE.SphereGeometry(0.02, 12, 12);
  const highlightMaterial = new THREE.MeshBasicMaterial({ color: white });
  
  const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
  leftHighlight.position.set(0.05, 0.07, 0.1);
  leftEyeball.add(leftHighlight);
  
  const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
  rightHighlight.position.set(0.05, 0.07, 0.1);
  rightEyeball.add(rightHighlight);
  
  // ========== 5. 腮红 ==========
  const blushGeometry = new THREE.SphereGeometry(0.1, 20, 20);
  blushGeometry.scale(1.3, 0.6, 0.7);
  blushGeometry.computeVertexNormals();
  const blushMaterial = new THREE.MeshPhongMaterial({ 
    color: accentColor, transparent: true, opacity: 0.5, shininess: 70 
  });
  
  const leftBlush = new THREE.Mesh(blushGeometry, blushMaterial);
  leftBlush.position.set(-0.65, 0.05, 0.78);
  pet.add(leftBlush);
  petParts.leftBlush = leftBlush;
  
  const rightBlush = new THREE.Mesh(blushGeometry, blushMaterial);
  rightBlush.position.set(0.65, 0.05, 0.78);
  pet.add(rightBlush);
  petParts.rightBlush = rightBlush;
  
  // ========== 6. 嘴巴 ==========
  const mouthGeometry = new THREE.TorusGeometry(0.07, 0.02, 8, 16, Math.PI);
  const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x883344 });
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  mouth.position.set(0, -0.05, 0.95);
  mouth.rotation.x = Math.PI;
  pet.add(mouth);
  petParts.mouth = mouth;
  
  // ========== 7. 钳子 ==========
  const createClaw = (size, side) => {
    const clawGroup = new THREE.Group();
    const armGeometry = new THREE.CylinderGeometry(0.06 * size, 0.09 * size, 0.45 * size, 16);
    const armMaterial = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 85, specular: 0x444444 });
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.y = -0.15 * size;
    arm.position.x = side * 0.03 * size;
    arm.position.z = -0.03 * size;
    arm.rotation.z = side * 0.15;
    arm.rotation.x = 0.03;
    clawGroup.add(arm);
    
    const palmGroup = new THREE.Group();
    palmGroup.position.y = -0.375 * size;
    palmGroup.position.x = side * 0.06 * size;
    palmGroup.position.z = 0.0 * size;
    palmGroup.rotation.x = 0.05;
    palmGroup.rotation.z = side * 0.05;
    clawGroup.add(palmGroup);
    
    const palmGeometry = new THREE.SphereGeometry(0.11 * size, 20, 20);
    palmGeometry.scale(1, 1.0, 0.7);
    palmGeometry.computeVertexNormals();
    const palmMaterial = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 85, specular: 0x444444 });
    const palm = new THREE.Mesh(palmGeometry, palmMaterial);
    palm.position.y = -0.11 * size;
    palmGroup.add(palm);
    
    return clawGroup;
  };
  
  const leftClaw = createClaw(1.1, -1);
  leftClaw.position.set(-0.55, -0.53, 0.36);
  leftClaw.rotation.z = 0.1;
  leftClaw.rotation.y = 0.03;
  pet.add(leftClaw);
  petParts.leftClaw = leftClaw;
  
  const rightClaw = createClaw(1.1, 1);
  rightClaw.position.set(0.55, -0.53, 0.36);
  rightClaw.rotation.z = -0.1;
  rightClaw.rotation.y = -0.03;
  pet.add(rightClaw);
  petParts.rightClaw = rightClaw;
  
  // ========== 8. 触角 ==========
  const antennaGeometry = new THREE.CylinderGeometry(0.015, 0.025, 0.7, 12);
  const antennaMaterial = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 80 });
  
  const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  leftAntenna.position.set(-0.4, 0.65, 0.7);
  leftAntenna.rotation.z = 0.3;
  leftAntenna.rotation.x = -0.15;
  pet.add(leftAntenna);
  petParts.leftAntenna = leftAntenna;
  
  const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  rightAntenna.position.set(0.4, 0.65, 0.7);
  rightAntenna.rotation.z = -0.3;
  rightAntenna.rotation.x = -0.15;
  pet.add(rightAntenna);
  petParts.rightAntenna = rightAntenna;
  
  // ========== 9. 腿部 ==========
  const legGeometry = new THREE.CapsuleGeometry(0.035, 0.2, 8, 8);
  const legMaterial = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 75 });
  
  const legXPositions = [-0.62, -0.48, -0.34];
  const legYPositions = [-0.65, -1.1, -1.55];
  
  for (let i = 0; i < 3; i++) {
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(legXPositions[i], legYPositions[i], -0.08);
    leftLeg.rotation.z = -0.3;
    leftLeg.rotation.x = -0.1;
    pet.add(leftLeg);
    petParts[`leftLeg${i}`] = leftLeg;
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(-legXPositions[i], legYPositions[i], -0.08);
    rightLeg.rotation.z = 0.3;
    rightLeg.rotation.x = -0.1;
    pet.add(rightLeg);
    petParts[`rightLeg${i}`] = rightLeg;
  }
  
  //
  petWrapper = new THREE.Group();
  petWrapper.add(pet);
  scene.add(petWrapper);

  //
  if (particleManager) {
    particleManager.triggerEffect('idle', petWrapper.position);
  }
}
// ==================== 初始化所有模块 ====================
async function initModules() {
  // 1. 颜色渲染器
  colorRenderer = new ColorRenderer(pet);
  
  // 2. 粒子系统
  particleManager = new ParticleSystemManagerEnhanced(scene);
  
  // 4. 内心戏管理器
  innerVoiceManager = new InnerVoiceManager({
    sendToOpenClaw: async (message) => {
      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(message));
      }
    },
    showBubble: (message, autoHide) => {
      showBubble(message, autoHide);
    }
  });
  
  // 5. 话题生成器（异步初始化 Tavily API 状态）
  const initTopicGenerator = async () => {
    const hasTavilyAPI = await window.electronAPI?.hasTavilyAPIKey?.() || false;
    
    topicGenerator = new TopicGenerator({
      sendToOpenClaw: async (prompt, sessionKey) => {
        if (window.electronAPI?.sendToOpenClaw) {
          return await window.electronAPI.sendToOpenClaw(prompt, sessionKey);
        }
        return { success: false, error: 'IPC not available' };
      },
      showBubble: (message, autoHide = true) => {
        // ⭐ 来者居上：话题气泡
        showBubble(message, autoHide, 'topic');
      },
      hasTavilyAPI: hasTavilyAPI,
      memoryPath: ''
    });

  };
  
  await initTopicGenerator();

}
// ==================== 鼠标控制 ====================
let isLeftButtonDown = false;
let isLeftDragging = false;
let dragStartX = 0, dragStartY = 0;
let windowStartX = 0, windowStartY = 0;
let clickStartTime = 0;
const LONG_CLICK_THRESHOLD = 200;
const DRAG_THRESHOLD = 3;
function setupMouseControls() {
  const canvas = renderer.domElement;
  
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isLeftButtonDown = true;
      clickStartTime = Date.now();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      isLeftDragging = false;
      
      windowStartX = window.screenX || 0;
      windowStartY = window.screenY || 0;

    } else if (e.button === 2) {
      rotateStartX = e.clientX;
      rotateStartY = e.clientY;
      isRotating = true;
    }
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (isLeftButtonDown) {
      const offsetX = e.clientX - dragStartX;
      const offsetY = e.clientY - dragStartY;
      
      if (Math.abs(offsetX) > DRAG_THRESHOLD || Math.abs(offsetY) > DRAG_THRESHOLD) {
        if (!isLeftDragging) {
          isLeftDragging = true;
          
        }
        
        const targetX = windowStartX + offsetX;
        const targetY = windowStartY + offsetY;

        if (window.electronAPI && window.electronAPI.setWindowPosition) {
          window.electronAPI.setWindowPosition(targetX, targetY);
        }
      }
    } else if (isRotating && pet) {
      const deltaX = (e.clientX - rotateStartX) * 0.008;
      const deltaY = (e.clientY - rotateStartY) * 0.008;
      pet.rotation.y += deltaX;
      pet.rotation.x = Math.max(-0.5, Math.min(0.5, pet.rotation.x + deltaY * 0.3));
      rotateStartX = e.clientX;
      rotateStartY = e.clientY;
    }
  });
  
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      isLeftButtonDown = false;
      
      const clickDuration = Date.now() - clickStartTime;
      
      if (!isLeftDragging && clickDuration < LONG_CLICK_THRESHOLD) {

        if (topicGenerator) {
          if (topicGenerator.isBusy()) {
            showBubble('别急嘛，正在努力思考中～🤔', false, 'topic');
            return;
          }
          showBubble('让我想想哦～🤔', false, 'topic');
          const topicTimeout = setTimeout(() => {
            showBubble('网络开小差了，再试一次吧～🌊', true, 'topic');
          }, 20000);
          topicGenerator.generateTopic().then(topic => {
            clearTimeout(topicTimeout);
            if (topic) {
              showBubble(topic, false, 'topic');
            } else {
              const currentBubble = document.getElementById('bubble-text');
              if (currentBubble && currentBubble.textContent.includes('网络开小差')) {
                return;
              }
              showBubble('网络开小差了，再试一次吧～🌊', true, 'topic');
            }
          });
        }
      } else if (isLeftDragging) {
        
      }
      isLeftDragging = false;
    } else if (e.button === 2) {
      isRotating = false;
    }
  });
  
  canvas.addEventListener('mouseleave', () => {
    isLeftButtonDown = false;
    isLeftDragging = false;
    isRotating = false;
  });
  
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
  });
  
  //
  canvas.addEventListener('mousedown', () => {
    const menu = document.getElementById('context-menu');
    if (menu) {
      menu.classList.add('hidden');
      if (menuAutoHideTimer) {
        clearTimeout(menuAutoHideTimer);
        menuAutoHideTimer = null;
      }
    }
  });
}
let menuAutoHideTimer = null;  //
function showContextMenu(x, y) {
  const menu = document.getElementById('context-menu');
  if (menu) {
    if (menuAutoHideTimer) {
      clearTimeout(menuAutoHideTimer);
    }
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
    
    menuAutoHideTimer = setTimeout(() => {
      menu.classList.add('hidden');
    }, 3000);
    
    menu.querySelectorAll('.menu-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        if (action) handleMenuAction(action);
        menu.classList.add('hidden');
        
        if (menuAutoHideTimer) {
          clearTimeout(menuAutoHideTimer);
          menuAutoHideTimer = null;
        }
      };
    });
  }
}

function handleMenuAction(action) {
  if (systemStatusMonitorEnabled && action !== 'status') {
    systemStatusMonitorEnabled = false;
  }
  
  switch(action) {
    case 'talk':
      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'chat', message: '你好！' }));
      }
      break;
    case 'status':
      systemStatusMonitorEnabled = true;
      showBubble(`💻 系统监控中... ${colorRenderer.currentLevel}`, false, 'status');
      break;
    case 'openclaw':
      if (topicGenerator) {
        const sessionKey = topicGenerator.getFullSessionKey();

        if (window.electronAPI && window.electronAPI.openDesktopPetSession) {
          window.electronAPI.openDesktopPetSession(sessionKey)
            .then(result => {
              if (result.success) {
                
                topicGenerator.markAsOpened();
                showBubble('在浏览器中打开对话～', true);
              } else {
                
                showBubble('打开失败：' + result.error, true);
              }
            })
            .catch(err => {
              
              showBubble('打开出错：' + err.message, true);
            });
        }
      }
      break;
    case 'hide':
      //
      if (window.electronAPI?.hideWindow) {
        window.electronAPI.hideWindow();
      }
      break;
    case 'quit':
      if (window.electronAPI?.quitApp) window.electronAPI.quitApp();
      break;
  }
}
document.addEventListener('click', () => {
  const menu = document.getElementById('context-menu');
  if (menu) menu.classList.add('hidden');
});
// ==================== WebSocket 连接 ====================
// ⭐ 修复：只连接 8765 端口，避免端口扫描错误日志
function connectWebSocket() {
  if (websocket) {
    try { websocket.close(); } catch(e) {}
  }
  
  const PYTHON_PORT = 8765;  // 固定端口
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;  // 最多 5 次重连
  const RECONNECT_DELAY = 3000;  // 3 秒重连间隔
  
  function tryConnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('⚠️ WebSocket 重连次数已达上限，停止连接');
      simulateSystemStatus();
      return;
    }
    
    reconnectAttempts++;
    console.log(`🔌 尝试连接 Python WebSocket (ws://localhost:${PYTHON_PORT}) - 第 ${reconnectAttempts} 次`);
    
    try {
      websocket = new WebSocket(`ws://localhost:${PYTHON_PORT}`);
      
      websocket.onopen = () => {
        console.log('✅ Python WebSocket 连接成功');
        reconnectAttempts = 0;  // 重置重连计数
      };
      
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'topic_response') {
            showBubble(data.message || data.text, true);
          } else if (data.type === 'system_status') {
            handleSystemStatus(data);
          } else if (data.type === 'tool.call') {
            handleToolCall(data);
          }
        } catch(e) {}
      };
      
      websocket.onclose = () => {
        console.log('⚠️ Python WebSocket 连接关闭');
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          console.log(`⏳ ${RECONNECT_DELAY/1000}秒后重连...`);
          setTimeout(tryConnect, RECONNECT_DELAY);
        }
      };
      
      websocket.onerror = (error) => {
        console.error('❌ Python WebSocket 错误:', error);
      };
    } catch(e) {
      console.error('❌ WebSocket 连接失败:', e);
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        setTimeout(tryConnect, RECONNECT_DELAY);
      }
    }
  }
  
  tryConnect();
}
// ========== 系统状态监控模式 ==========
let systemStatusMonitorEnabled = false;  // 是否开启实时监控模式

// 处理工具调用事件（不改变颜色！）
function handleToolCall(event) {
  const { tool, summary, action } = event;

  // 1. 更新气泡（不消失，直到新工具到来）
  showBubble(summary, false);  // autoHide=false，气泡不自动消失
  
  // 2. ❌ 不改变颜色！颜色只由系统负载决定
  
  // 3. 清除旧的动作循环
  if (toolActionInterval) {
    clearInterval(toolActionInterval);
    isActionInProgress = false;
  }
  
  // 4. 清除旧的特效
  if (currentToolEffect) {
    currentToolEffect.dispose();
    currentToolEffect = null;
  }
  
  // 5. 启动新动作循环
  if (action && !isActionInProgress) {
    // 立即执行一次
    executeSpecificAction(action);
    
    // 设置循环（每个动作完成后自动重播）
    toolActionInterval = setInterval(() => {
      if (!isActionInProgress) {
        executeSpecificAction(action);
      }
    }, 3000); // 3 秒检查一次
  }
  
  // 6. 启动新特效
  if (tool === 'exec' && typeof CodeRainParticle !== 'undefined') {
    currentToolEffect = new CodeRainParticle(scene);
  }
  
  // 7. 保存当前工具状态
  currentToolState = { tool, action };
  
  // 8. 如果开启了系统状态监控，关闭它（工具事件优先级更高）
  if (systemStatusMonitorEnabled) {
    systemStatusMonitorEnabled = false;
  }
}

// 处理系统状态更新（系统负载 → 颜色）
function handleSystemStatus(data) {
  const { cpu, memory, gpu, performance_score, performance_level } = data;
  
  if (colorRenderer && performance_level) {
    colorRenderer.updateColor(performance_level);
  }
  
  updateStatusIndicator(cpu, memory);
  
  if (systemStatusMonitorEnabled && currentBubbleSource === 'status') {
    const bubble = document.getElementById('speech-bubble');
    const text = document.getElementById('bubble-text');
    if (bubble && text && !bubble.classList.contains('hidden')) {
      const statusText = `💻 CPU: ${cpu.toFixed(0)}% | 内存：${memory.toFixed(0)}% | ${performance_level}`;
      text.textContent = statusText;
    }
  }
}

// 执行特定动作（工具事件专用）
function executeSpecificAction(actionName) {
  if (!pet || isActionInProgress) return;
  
  isActionInProgress = true;
  
  // 触发对应的特效
  triggerActionEffects(actionName, petWrapper ? petWrapper.position : pet.position);
  
  // 根据指定的动作执行
  switch(actionName) {
    case 'wiggle':
      let wiggleProgress = 0;
      const wiggleInterval = setInterval(() => {
        wiggleProgress += 0.1;
        if (wiggleProgress <= Math.PI * 4) {
          const rotation = Math.sin(wiggleProgress) * 0.4;
          if (petWrapper) {
            petWrapper.rotation.z = rotation;
          } else {
            pet.rotation.z = rotation;
          }
        } else {
          clearInterval(wiggleInterval);
          if (petWrapper) petWrapper.rotation.z = 0;
          else pet.rotation.z = 0;
          isActionInProgress = false;
        }
      }, 16);
      break;
      
    case 'bounce':
      let bounceCount = 0;
      const bounceInterval = setInterval(() => {
        bounceCount++;
        if (bounceCount <= 7) {
          const jumpHeight = 0.6 * Math.pow(0.7, bounceCount);
          let jumpProgress = 0;
          const jumpInterval = setInterval(() => {
            jumpProgress += 0.1;
            if (jumpProgress <= Math.PI) {
              if (petWrapper) {
                petWrapper.position.y = Math.sin(jumpProgress) * jumpHeight;
              } else {
                pet.position.y = Math.sin(jumpProgress) * jumpHeight;
              }
            } else {
              clearInterval(jumpInterval);
            }
          }, 16);
        } else {
          clearInterval(bounceInterval);
          if (petWrapper) petWrapper.position.y = 0;
          else pet.position.y = 0;
          isActionInProgress = false;
        }
      }, 400);
      break;
      
    case 'shake':
      let shakeCount = 0;
      const shakeInterval = setInterval(() => {
        shakeCount++;
        if (shakeCount <= 20) {
          const offset = (Math.random() - 0.5) * 0.3;
          if (petWrapper) {
            petWrapper.position.x = offset;
            petWrapper.rotation.y += (Math.random() - 0.5) * 0.2;
          } else {
            pet.position.x = offset;
            pet.rotation.y += (Math.random() - 0.5) * 0.2;
          }
        } else {
          clearInterval(shakeInterval);
          if (petWrapper) {
            petWrapper.position.x = 0;
            petWrapper.rotation.y = 0;
          } else {
            pet.position.x = 0;
            pet.rotation.y = 0;
          }
          isActionInProgress = false;
        }
      }, 30);
      break;
      
    case 'stretch':
      let stretchProgress = 0;
      const initialScale = pet.scale.x;
      const stretchInterval = setInterval(() => {
        stretchProgress += 0.12;
        if (stretchProgress <= Math.PI * 2) {
          const stretch = Math.sin(stretchProgress) * 0.15;
          const scaleY = initialScale * (1 - stretch);
          const scaleXZ = initialScale * (1 + stretch * 0.6);
          if (petWrapper) {
            petWrapper.scale.set(scaleXZ, scaleY, scaleXZ);
          } else {
            pet.scale.set(scaleXZ, scaleY, scaleXZ);
          }
        } else {
          clearInterval(stretchInterval);
          if (petWrapper) {
            petWrapper.scale.set(initialScale, initialScale, initialScale);
          } else {
            pet.scale.set(initialScale, initialScale, initialScale);
          }
          isActionInProgress = false;
        }
      }, 16);
      break;
      
    case 'spiral':
      let spiralProgress = 0;
      const direction = Math.random() > 0.5 ? 1 : -1;
      const spiralInterval = setInterval(() => {
        spiralProgress += 0.06;
        if (spiralProgress <= Math.PI * 6) {
          const radius = 0.8;
          const x = Math.cos(spiralProgress * direction) * radius;
          const z = Math.sin(spiralProgress * direction) * radius;
          const y = spiralProgress * 0.12;
          if (petWrapper) {
            petWrapper.position.set(x, y, z);
            petWrapper.rotation.y = -spiralProgress * direction;
          } else {
            pet.position.set(x, y, z);
            pet.rotation.y = -spiralProgress * direction;
          }
        } else {
          clearInterval(spiralInterval);
          if (petWrapper) {
            petWrapper.position.set(0, 0, 0);
            petWrapper.rotation.y = 0;
          } else {
            pet.position.set(0, 0, 0);
            pet.rotation.y = 0;
          }
          isActionInProgress = false;
        }
      }, 16);
      break;
      
    case 'jump':
      let jumpProgress = 0;
      const jumpInterval = setInterval(() => {
        jumpProgress += 0.05;
        if (jumpProgress <= Math.PI) {
          if (petWrapper) {
            petWrapper.position.y = Math.sin(jumpProgress) * 0.5;
          } else {
            pet.position.y = Math.sin(jumpProgress) * 0.5;
          }
        } else {
          clearInterval(jumpInterval);
          if (petWrapper) petWrapper.position.y = 0;
          else pet.position.y = 0;
          isActionInProgress = false;
        }
      }, 16);
      break;
      
    case 'nod':
      let nodCount = 0;
      const nodInterval = setInterval(() => {
        nodCount++;
        if (nodCount <= 6) {
          if (petWrapper) {
            petWrapper.rotation.x = 0.3;
          } else {
            pet.rotation.x = 0.3;
          }
          setTimeout(() => {
            if (petWrapper) {
              petWrapper.rotation.x = -0.2;
            } else {
              pet.rotation.x = -0.2;
            }
          }, 150);
        } else {
          clearInterval(nodInterval);
          if (petWrapper) {
            petWrapper.rotation.x = 0;
          } else {
            pet.rotation.x = 0;
          }
          isActionInProgress = false;
        }
      }, 300);
      break;
      
    case 'pulse':
      let pulseCount = 0;
      const pulseInterval = setInterval(() => {
        pulseCount++;
        if (pulseCount <= 10) {
          const scale = 1 + Math.sin(pulseCount * 0.5) * 0.15;
          if (petWrapper) {
            petWrapper.scale.set(scale, scale, scale);
          } else {
            pet.scale.set(scale, scale, scale);
          }
        } else {
          clearInterval(pulseInterval);
          if (petWrapper) {
            petWrapper.scale.set(1, 1, 1);
          } else {
            pet.scale.set(1, 1, 1);
          }
          isActionInProgress = false;
        }
      }, 150);
      break;
  }
}

function simulateSystemStatus() {
  const levels = ['空闲', '忙碌', '紧张', '夯爆了'];
  setInterval(() => {
    const level = levels[Math.floor(Math.random() * levels.length)];
    if (colorRenderer) colorRenderer.updateColor(level);
  }, 5000);
}
function updateStatusIndicator(cpu, memory) {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const colors = { '空闲': '#B0C4DE', '忙碌': '#FFD700', '紧张': '#FF8C00', '夯爆了': '#FF0000' };
  if (statusDot) statusDot.style.backgroundColor = colors[colorRenderer?.currentLevel] || '#B0C4DE';
  if (statusText) statusText.textContent = colorRenderer?.currentLevel || '空闲';
}
function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}
let bubbleHideTimer = null;
// 气泡来源追踪
let currentBubbleSource = null;

function showBubble(message, autoHide = true, source = 'default') {
  const bubble = document.getElementById('speech-bubble');
  const text = document.getElementById('bubble-text');
  
  if (bubble && text) {
    currentBubbleSource = source;
    
    if (bubbleHideTimer) {
      clearTimeout(bubbleHideTimer);
      bubbleHideTimer = null;
    }
    
    text.textContent = message;
    bubble.classList.remove('hidden');
    bubble.classList.add('visible');
    
    if (autoHide) {
      bubbleHideTimer = setTimeout(() => {
        bubble.classList.remove('visible');
        bubble.classList.add('hidden');
        currentBubbleSource = null;
        bubbleHideTimer = null;
      }, 8000);
    }
  }
}
// ==================== Gateway 工具事件处理 ====================
let toolEventTimer = null;  // 节流定时器

/**
 * 处理 Gateway 工具调用事件
 * @param {object} toolData - 工具事件数据
 */
function handleGatewayToolCall(toolData) {
  const { tool, phase, params, result, error } = toolData;
  
  // 打印到 PowerShell 控制台
  window.electronAPI?.logToConsole?.('🔧 Gateway 工具事件', { tool, phase, params });
  
  // 节流处理（80ms，与 Control UI 一致）
  if (toolEventTimer) {
    clearTimeout(toolEventTimer);
  }
  
  toolEventTimer = setTimeout(() => {
    processToolEvent(toolData);
  }, 80);
}

/**
 * 实际处理工具事件的函数
 * @param {object} toolData - 工具事件数据
 */
function processToolEvent(toolData) {
  const { tool, phase, params, result, error } = toolData;
  
  if (phase === 'start') {
    const config = getToolConfig(tool);
    
    showBubble(config.summary, false, 'tool');
    
    if (!isActionInProgress) {
      executeSpecificAction(config.action);
      isActionInProgress = true;
    }
    
    if (config.effect && particleManager) {
      if (currentToolEffect) {
        currentToolEffect.dispose();
      }
      
      if (config.effect === 'code-rain') {
        currentToolEffect = new CodeRainParticle(scene);
      } else if (config.effect === 'spark') {
        particleManager.triggerEffect('spark', petWrapper.position);
      }
    }
    
    if (colorRenderer) {
      colorRenderer.updateColor(config.color);
    }
    
    currentToolState = { tool, config };
    
  } else if (phase === 'result') {
    hideBubble();
    
    if (toolActionInterval) {
      clearInterval(toolActionInterval);
      toolActionInterval = null;
      isActionInProgress = false;
    }
    
    if (currentToolEffect) {
      if (currentToolEffect.dispose) {
        currentToolEffect.dispose();
      }
      currentToolEffect = null;
    }
    
    if (colorRenderer) {
      colorRenderer.updateColor('#B0C4DE');
    }
    
    currentToolState = null;
    
  } else if (phase === 'error') {
    showBubble(`❌ ${tool} 执行失败`, true, 'tool');
    window.electronAPI?.logToConsole?.('✅ 错误气泡已显示');
    
    // 恢复空闲状态
    if (colorRenderer) {
      colorRenderer.updateColor('#B0C4DE');
      window.electronAPI?.logToConsole?.('✅ 颜色已恢复空闲状态');
    }
  } else {
    window.electronAPI?.logToConsole?.('⚠️ 未知 phase:', phase);
  }
}

// ==================== 初始化 ====================
async function init() {
  console.log('🚀 [init] Initializing...');
  
  try {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0.6, 5);
    
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.background = 'transparent';
    
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) {
      throw new Error('canvas-container not found');
    }
    canvasContainer.appendChild(renderer.domElement);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(3, 5, 5);
    scene.add(directionalLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-3, 2, -3);
    scene.add(backLight);
    
    await loadGLBModel();
    await initModules();
    setupMouseControls();
    connectWebSocket();
    initGatewayConnection();
    
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    animate();
    hideLoading();
    
    console.log('✅ [init] Complete');
    
  } catch (error) {
    console.error('❌ [init] Failed:', error);
  }
}
//
let disableAnimationUpdate = false;
// ==================== 特效类型定义 ====================
//
const EFFECT_TYPES = [
  'star_trail',      //
  'rotation_ring',   // 💫 旋转光环
  'trail',           // 💨 拖尾粒子（跳跃）
  'shockwave',       // 🌊 冲击波（跳跃落地）
  'expansion_ring',  // 🔵 扩张光环（脉冲）
  'spark',           // ⚡ 电火花（抖动）- ✅ 新增
];
// ==================== 动作与特效映射 ====================
//
const ACTION_EFFECT_MAP = {
  'wiggle': ['star_trail', 'expansion_ring'],           // 摇摆舞：星光/光环
  'bounce': ['trail', 'shockwave', 'expansion_ring'],   // 弹跳：拖尾/冲击波/光环
  'shake': ['spark', 'expansion_ring', 'star_trail'],   // 抖动：电火花/光环/星光
  'stretch': ['expansion_ring', 'spark'],               // 拉伸：光环/电火花
  'spiral': ['star_trail', 'trail'],                    // 螺旋：星光/拖尾
  'jump': ['trail', 'shockwave', 'star_trail'],         // 跳跃：拖尾/冲击波/星光
};
// ==================== 触发动作对应的特效 ====================
function triggerActionEffects(actionType, petPosition) {
  if (!particleManager) return;
  
  // 获取该动作可用的特效列表
  const availableEffects = ACTION_EFFECT_MAP[actionType] || ['expansion_ring'];
  
  //
  const effectIndex = Math.floor(Math.random() * availableEffects.length);
  const selectedEffect = availableEffects[effectIndex];

  //
  const effectMapping = {
    'star_trail': 'rotateCW',      // 复用星光轨迹 + 旋转光环
    'trail': 'jump',               // 复用拖尾粒子 + 冲击波
    'shockwave': 'jump',           // 复用拖尾粒子 + 冲击波
    'expansion_ring': 'pulse',     // 复用扩张光环
    'spark': 'spark',              //
  };
  
  const mappedEffect = effectMapping[selectedEffect] || 'pulse';
  particleManager.triggerEffect(mappedEffect, petPosition);
}
// ==================== 定时动作触发器 ====================
// ==================== 渲染循环 ====================
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  const time = Date.now() * 0.001;
  const now = Date.now();
  
  if (pet) {
    // Fallback：手搓龙虾的漂浮动画
    if (!isActionInProgress) {
      const floatSpeed = colorRenderer?.currentLevel === '夯爆了' ? 2.5 : 1;
      const floatAmp = colorRenderer?.currentLevel === '夯爆了' ? 0.12 : 0.06;
      pet.position.y = Math.sin(time * floatSpeed) * floatAmp;
      
      if (petParts.leftAntenna) {
        const speed = colorRenderer?.currentLevel === '夯爆了' ? 0.15 : 0.08;
        petParts.leftAntenna.rotation.z = 0.3 + Math.sin(time * 2.5) * speed;
      }
      if (petParts.rightAntenna) {
        const speed = colorRenderer?.currentLevel === '夯爆了' ? 0.15 : 0.08;
        petParts.rightAntenna.rotation.z = -0.3 + Math.sin(time * 2.5) * speed;
      }
      
      if (petParts.leftClaw) petParts.leftClaw.rotation.z = 0.4 + Math.sin(time * 1.8) * 0.08;
      if (petParts.rightClaw) petParts.rightClaw.rotation.z = -0.4 + Math.sin(time * 1.8) * 0.08;
      
      if (petParts.tail) petParts.tail.rotation.x = Math.PI * 0.1 + Math.sin(time * 1.5) * 0.1;
    }
    
    //
    cameraFloatTime += delta * 0.5;
    cameraFloatOffset = Math.sin(cameraFloatTime) * 0.2;
    camera.position.z = cameraBaseZ + cameraFloatOffset;
    
    //
    if (!isActionInProgress) {
      const breathSpeed = colorRenderer?.currentLevel === '夯爆了' ? 2.0 : 1.2;
      const breathAmp = colorRenderer?.currentLevel === '夯爆了' ? 0.08 : 0.05;
      const breathY = Math.sin(time * breathSpeed) * breathAmp;
      const breathScale = 1 + Math.sin(time * breathSpeed) * 0.03;
      
      // Y 轴浮动
      if (petWrapper) {
        petWrapper.position.y = breathY;
        petWrapper.scale.set(breathScale, breathScale, breathScale);
      } else if (pet) {
        pet.position.y = breathY;
        pet.scale.set(breathScale, breathScale, breathScale);
      }
    }
    
    //
    if (particleManager) particleManager.update(delta);
  }
  
  renderer.render(scene, camera);
}
// 时钟（用于动画）
const clock = new THREE.Clock();

// ==================== 全局 API：动态修改模型颜色 ====================
// 可以通过 window.setPetColor(colorHex) 来修改颜色
window.setPetColor = function(colorHex, useFlatColor = true) {
  if (modelLoader && pet) {
    modelLoader.setColor(pet, colorHex, useFlatColor);
  } else {
    console.warn('⚠️ 模型未加载，无法修改颜色');
  }
};

// 获取当前颜色
window.getPetColor = function() {
  if (modelLoader) {
    return modelLoader.getCurrentColor();
  }
  return null;
};

init();
