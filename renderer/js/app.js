// ==================== 导入 Three.js ====================
import * as THREE from 'three';

// ==================== 导入现有模块 ====================
import { TopicGenerator } from './topic-generator.js';
import { ColorRenderer } from './color-renderer.js';
import { EmotionState, EmotionTrigger, EXPRESSION_CONFIG } from './emotion-system.js';
import { ParticleSystemManager } from './particle-system.js';
import { InnerVoiceManager } from './inner-voice.js';

// ==================== 全局变量 ====================
let scene, camera, renderer, pet;
let petParts = {};

// 模块实例
let colorRenderer = null;
let emotionSystem = null;
let particleManager = null;
let innerVoiceManager = null;
let topicGenerator = null;

// WebSocket
let websocket = null;

// 鼠标控制
let isRotating = false;
let rotateStartX = 0, rotateStartY = 0;

// ==================== 创建哈基虾（Q 版萌化版） ====================
function createPet() {
  pet = new THREE.Group();
  
  const mainColor = 0xFF4444;  // 初始龙虾红
  const accentColor = 0xFF9999;
  const white = 0xFFFFFF;
  const darkPupil = 0x1a1a2e;
  
  pet.position.y = 0;
  
  // ========== 1. 头胸部（中心） ==========
  const cephalothoraxGeometry = new THREE.SphereGeometry(1.1, 48, 48);
  cephalothoraxGeometry.scale(1.0, 0.85, 0.95);
  cephalothoraxGeometry.computeVertexNormals();
  const cephalothoraxMaterial = new THREE.MeshPhongMaterial({ 
    color: mainColor, shininess: 90, specular: 0x444444 
  });
  const cephalothorax = new THREE.Mesh(cephalothoraxGeometry, cephalothoraxMaterial);
  pet.add(cephalothorax);
  petParts.cephalothorax = cephalothorax;
  
  // ========== 2. 腹部（3 节，每节分开一点） ==========
  for (let i = 0; i < 3; i++) {
    const size = 0.7 - i * 0.08;
    const segmentGeometry = new THREE.SphereGeometry(size, 32, 32);
    segmentGeometry.scale(0.9, 0.8, 0.8);
    segmentGeometry.computeVertexNormals();
    const segmentMaterial = new THREE.MeshPhongMaterial({ 
      color: mainColor, shininess: 85, specular: 0x444444 
    });
    const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
    // 第一节离头胸部远一点（-0.7），后面每节间隔 0.5
    segment.position.set(0, -0.7 - i * 0.5, -0.12);
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
  
  // ========== 4. 眼睛（嵌入头胸，不要突出太多） ==========
  // 减小眼球半径（0.28 → 0.18），让眼球更嵌入头胸部
  const eyeballGeometry = new THREE.SphereGeometry(0.18, 32, 32);
  const eyeballMaterial = new THREE.MeshPhongMaterial({ color: white, shininess: 100, specular: 0x555555 });
  
  const leftEyeball = new THREE.Mesh(eyeballGeometry, eyeballMaterial);
  // 向头胸部内部移动（z 从 0.9 → 0.78）
  leftEyeball.position.set(-0.42, 0.25, 0.78);
  pet.add(leftEyeball);
  petParts.leftEyeball = leftEyeball;
  
  const rightEyeball = new THREE.Mesh(eyeballGeometry, eyeballMaterial);
  rightEyeball.position.set(0.42, 0.25, 0.78);
  pet.add(rightEyeball);
  petParts.rightEyeball = rightEyeball;
  
  // 瞳孔（同步缩小并嵌入）
  const pupilGeometry = new THREE.SphereGeometry(0.11, 24, 24);
  const pupilMaterial = new THREE.MeshBasicMaterial({ color: darkPupil });
  
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  leftPupil.position.set(0, 0.02, 0.14);
  leftEyeball.add(leftPupil);
  petParts.leftPupil = leftPupil;
  
  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  rightPupil.position.set(0, 0.02, 0.14);
  rightEyeball.add(rightPupil);
  petParts.rightPupil = rightPupil;
  
  // 高光（同步缩小并嵌入）
  const highlightGeometry = new THREE.SphereGeometry(0.035, 12, 12);
  const highlightMaterial = new THREE.MeshBasicMaterial({ color: white });
  
  const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
  leftHighlight.position.set(0.05, 0.07, 0.15);
  leftEyeball.add(leftHighlight);
  
  const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
  rightHighlight.position.set(0.05, 0.07, 0.15);
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
  
  // ========== 7. 钳子（Q 版设计：放大 50%） ==========
  const createClaw = (size, side) => {
    const clawGroup = new THREE.Group();
    
    // 钳子手臂（加粗）
    const armGeometry = new THREE.CylinderGeometry(0.12 * size, 0.15 * size, 0.35 * size, 16);
    const armMaterial = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 85, specular: 0x444444 });
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.y = 0.18 * size;
    clawGroup.add(arm);
    
    // 钳子手掌（放大，更圆润）
    const palmGeometry = new THREE.SphereGeometry(0.2 * size, 20, 20);
    palmGeometry.scale(1, 1.2, 0.9);
    palmGeometry.computeVertexNormals();
    const palmMaterial = new THREE.MeshPhongMaterial({ color: mainColor, shininess: 85, specular: 0x444444 });
    const palm = new THREE.Mesh(palmGeometry, palmMaterial);
    palm.position.y = 0.5 * size;
    clawGroup.add(palm);
    
    // 钳子手指（加粗，更明显）
    const fingerGeometry = new THREE.CapsuleGeometry(0.05 * size, 0.15 * size, 8, 8);
    const fingerMaterial = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 75 });
    
    const finger1 = new THREE.Mesh(fingerGeometry, fingerMaterial);
    finger1.position.set(0, 0.65 * size, 0.03 * size);
    finger1.rotation.x = -0.4;
    clawGroup.add(finger1);
    
    const finger2 = new THREE.Mesh(fingerGeometry, fingerMaterial);
    finger2.position.set(0, 0.65 * size, -0.03 * size);
    finger2.rotation.x = 0.4;
    clawGroup.add(finger2);
    
    return clawGroup;
  };
  
  // 钳子放大 50%
  const leftClaw = createClaw(1.5, -1);
  leftClaw.position.set(-0.95, -0.1, 0.5);
  leftClaw.rotation.z = 0.3;
  pet.add(leftClaw);
  petParts.leftClaw = leftClaw;
  
  const rightClaw = createClaw(1.5, 1);
  rightClaw.position.set(0.95, -0.1, 0.5);
  rightClaw.rotation.z = -0.3;
  pet.add(rightClaw);
  petParts.rightClaw = rightClaw;
  
  // ========== 8. 触角（从头部上方伸出） ==========
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
  
  // ========== 9. 腿部（3 对，围绕 3 段腹部分布，Q 版斜向下） ==========
  const legGeometry = new THREE.CapsuleGeometry(0.035, 0.2, 8, 8);
  const legMaterial = new THREE.MeshPhongMaterial({ color: accentColor, shininess: 75 });
  
  // 腿部 X 位置根据腹部大小调整：第一节最大，第三节最小
  const legXPositions = [-0.65, -0.55, -0.48];
  
  for (let i = 0; i < 3; i++) {
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    // 与腹部位置对齐（腹部 y = -0.7 - i * 0.5），Z=0 更容易看到
    leftLeg.position.set(legXPositions[i], -0.7 - i * 0.5, 0);
    // Q 版设计：腿斜向下
    leftLeg.rotation.z = -0.3;
    leftLeg.rotation.x = -0.15;
    pet.add(leftLeg);
    petParts[`leftLeg${i}`] = leftLeg;
    
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(-legXPositions[i], -0.7 - i * 0.5, 0);
    rightLeg.rotation.z = 0.3;
    rightLeg.rotation.x = -0.15;
    pet.add(rightLeg);
    petParts[`rightLeg${i}`] = rightLeg;
  }
  
  scene.add(pet);
  
  console.log('✅ 哈基虾创建完成！');
}

// ==================== 初始化所有模块 ====================
function initModules() {
  // 1. 颜色渲染器
  colorRenderer = new ColorRenderer(petParts);
  
  // 2. 情绪系统
  emotionSystem = new EmotionState();
  new EmotionTrigger(emotionSystem, petParts);
  
  // 3. 粒子系统
  particleManager = new ParticleSystemManager(scene);
  
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
  
  // 5. 话题生成器
  topicGenerator = new TopicGenerator({
    sendToOpenClaw: async (prompt, sessionKey) => {
      if (window.electronAPI?.sendToOpenClaw) {
        return await window.electronAPI.sendToOpenClaw(prompt, sessionKey);
      }
      return { success: false, error: 'IPC not available' };
    },
    showBubble: (message) => {
      showBubble(message, true);
    },
    hasTavilyAPI: false,
    memoryPath: ''
  });
  
  console.log('✅ 所有模块初始化完成！');
}

// ==================== 鼠标控制 ====================
let isLeftButtonDown = false; // 左键是否按下
let isLeftDragging = false;   // 是否正在拖动
let dragStartX = 0, dragStartY = 0; // 鼠标按下时的位置
let windowStartX = 0, windowStartY = 0; // 窗口起始位置
let clickStartTime = 0;
const LONG_CLICK_THRESHOLD = 200; // 200ms 以上算长按
const DRAG_THRESHOLD = 3; // 3px 移动阈值

function setupMouseControls() {
  const canvas = renderer.domElement;
  
  // 左键按下 - 开始拖动或准备单击
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // 左键按下
      isLeftButtonDown = true;
      clickStartTime = Date.now();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      isLeftDragging = false;
      
      // 使用 screenX/screenY 获取窗口位置（同步，不会阻塞）
      windowStartX = window.screenX || 0;
      windowStartY = window.screenY || 0;
      
      console.log('🖱️ 左键按下，窗口起始位置:', windowStartX, windowStartY);
    } else if (e.button === 2) { // 右键
      rotateStartX = e.clientX;
      rotateStartY = e.clientY;
      isRotating = true;
    }
  });
  
  // 左键移动 - 拖动窗口（使用绝对位置，更精准）
  canvas.addEventListener('mousemove', (e) => {
    // 只有左键按下时才处理拖动
    if (isLeftButtonDown) {
      // 计算鼠标相对于按下位置的偏移量
      const offsetX = e.clientX - dragStartX;
      const offsetY = e.clientY - dragStartY;
      
      // 如果移动距离超过阈值，认为是拖动
      if (Math.abs(offsetX) > DRAG_THRESHOLD || Math.abs(offsetY) > DRAG_THRESHOLD) {
        if (!isLeftDragging) {
          isLeftDragging = true;
          console.log('🖱️ 开始拖动窗口，offset:', offsetX, offsetY);
        }
        
        // 计算窗口的目标位置（绝对位置）
        const targetX = windowStartX + offsetX;
        const targetY = windowStartY + offsetY;
        
        console.log('🚀 移动窗口到:', targetX, targetY, '(windowStart:', windowStartX, windowStartY, ')');
        
        // 使用绝对位置移动窗口（更精准）
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
  
  // 左键释放 - 判断是单击还是拖动
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      isLeftButtonDown = false; // 关键：释放左键
      
      const clickDuration = Date.now() - clickStartTime;
      
      // 如果不是拖动且是短按，生成话题
      if (!isLeftDragging && clickDuration < LONG_CLICK_THRESHOLD) {
        console.log('🖱️ 左键单击，生成话题...');
        if (topicGenerator) {
          topicGenerator.generateTopic().then(topic => {
            if (topic) {
              console.log('✅ 生成话题:', topic);
            }
          });
        }
      } else if (isLeftDragging) {
        console.log('🖱️ 拖动结束');
      }
      isLeftDragging = false;
    } else if (e.button === 2) {
      isRotating = false;
    }
  });
  
  // 鼠标离开画布 - 重置所有状态
  canvas.addEventListener('mouseleave', () => {
    isLeftButtonDown = false;
    isLeftDragging = false;
    isRotating = false;
  });
  
  // 右键菜单
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
  });
}

function showContextMenu(x, y) {
  const menu = document.getElementById('context-menu');
  if (menu) {
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
    
    menu.querySelectorAll('.menu-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        if (action) handleMenuAction(action);
        menu.classList.add('hidden');
      };
    });
  }
}

function handleMenuAction(action) {
  console.log('菜单动作:', action);
  switch(action) {
    case 'talk':
      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'chat', message: '你好！' }));
      }
      break;
    case 'rotate':
      if (pet) {
        // 360° = 2π 弧度，每次转 0.3 弧度，需要约 21 次
        let count = 0;
        const totalRotations = 21; // 21 × 0.3 = 6.3 弧度 ≈ 361°
        const interval = setInterval(() => {
          pet.rotation.y += 0.3;
          if (++count >= totalRotations) {
            clearInterval(interval);
            console.log('✅ 360° 旋转完成');
          }
        }, 50);
      }
      break;
    case 'status':
      showBubble(`状态：${colorRenderer.currentLevel}`, false);
      break;
    case 'openclaw':
      // 打开最新生成的话题（如果有的话）
      if (topicGenerator) {
        const sessionKey = topicGenerator.getFullSessionKey();
        console.log('🚀 打开 OpenClaw，会话 Key:', sessionKey);
        
        if (window.electronAPI && window.electronAPI.openDesktopPetSession) {
          // 使用系统默认浏览器打开
          window.electronAPI.openDesktopPetSession(sessionKey)
            .then(result => {
              if (result.success) {
                console.log('✅ 已使用系统浏览器打开 OpenClaw 会话');
                // 标记话题为已打开
                topicGenerator.markAsOpened();
                showBubble('在浏览器中打开对话～', true);
              } else {
                console.error('❌ 打开会话失败:', result.error);
                showBubble('打开失败：' + result.error, true);
              }
            })
            .catch(err => {
              console.error('❌ 打开会话错误:', err);
              showBubble('打开出错：' + err.message, true);
            });
        }
      }
      break;
    case 'hide':
      if (renderer?.domElement) renderer.domElement.style.display = 'none';
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
function connectWebSocket() {
  if (websocket) {
    try { websocket.close(); } catch(e) {}
  }
  
  const ports = [8765, 8766, 8767, 8768, 8769, 8770];
  let currentPortIndex = 0;
  
  function tryConnect() {
    if (currentPortIndex >= ports.length) {
      console.log('端口全满，使用模拟模式');
      simulateSystemStatus();
      return;
    }
    
    const port = ports[currentPortIndex];
    console.log(`连接端口 ${port}...`);
    
    try {
      websocket = new WebSocket(`ws://localhost:${port}`);
      
      websocket.onopen = () => {
        console.log(`✅ 连接成功 (${port})`);
        hideLoading();
      };
      
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'topic_response' || data.type === 'auto_chat') {
            showBubble(data.message || data.text, true);
          } else if (data.type === 'system_status') {
            handleSystemStatus(data);
          }
        } catch(e) {}
      };
      
      websocket.onclose = () => {
        currentPortIndex++;
        if (currentPortIndex < ports.length) setTimeout(tryConnect, 300);
      };
      
      websocket.onerror = () => { currentPortIndex++; };
    } catch(e) {
      currentPortIndex++;
      tryConnect();
    }
  }
  
  tryConnect();
}

function handleSystemStatus(data) {
  const { cpu, memory, gpu, performance_score, performance_level } = data;
  
  // 使用颜色渲染器更新颜色
  if (colorRenderer && performance_level) {
    colorRenderer.updateColor(performance_level);
  }
  
  // 更新状态指示器
  updateStatusIndicator(cpu, memory);
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

// 当前气泡自动隐藏定时器
let bubbleHideTimer = null;

function showBubble(message, autoHide = true) {
  const bubble = document.getElementById('speech-bubble');
  const text = document.getElementById('bubble-text');
  
  if (bubble && text) {
    // 清除之前的定时器
    if (bubbleHideTimer) {
      clearTimeout(bubbleHideTimer);
      bubbleHideTimer = null;
    }
    
    // 更新气泡内容
    text.textContent = message;
    
    // 显示气泡
    bubble.classList.remove('hidden');
    bubble.classList.add('visible');
    
    console.log('💬 气泡显示:', message.substring(0, 50));
    
    // 自动隐藏
    if (autoHide) {
      bubbleHideTimer = setTimeout(() => {
        bubble.classList.remove('visible');
        bubble.classList.add('hidden');
        console.log('💬 气泡隐藏');
      }, 8000); // 8 秒后隐藏
    }
  } else {
    console.error('❌ 气泡元素未找到');
  }
}

// ==================== 初始化 ====================
function init() {
  console.log('🦞 哈基虾初始化...');
  
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, -0.3, 5);
  
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.background = 'transparent';
  document.getElementById('canvas-container').appendChild(renderer.domElement);
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(3, 5, 5);
  scene.add(directionalLight);
  
  const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
  backLight.position.set(-3, 2, -3);
  scene.add(backLight);
  
  createPet();
  initModules();
  setupMouseControls();
  connectWebSocket();
  
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  animate();
  
  console.log('✅ 完成！');
}

// ==================== 渲染循环 ====================
function animate() {
  requestAnimationFrame(animate);
  
  const time = Date.now() * 0.001;
  
  if (pet) {
    // 漂浮动画
    const floatSpeed = colorRenderer?.currentLevel === '夯爆了' ? 2.5 : 1;
    const floatAmp = colorRenderer?.currentLevel === '夯爆了' ? 0.12 : 0.06;
    pet.position.y = Math.sin(time * floatSpeed) * floatAmp;
    
    // 触角摆动（使用情绪系统）
    if (petParts.leftAntenna) {
      const speed = colorRenderer?.currentLevel === '夯爆了' ? 0.15 : 0.08;
      petParts.leftAntenna.rotation.z = 0.3 + Math.sin(time * 2.5) * speed;
    }
    if (petParts.rightAntenna) {
      const speed = colorRenderer?.currentLevel === '夯爆了' ? 0.15 : 0.08;
      petParts.rightAntenna.rotation.z = -0.3 + Math.sin(time * 2.5) * speed;
    }
    
    // 钳子摆动
    if (petParts.leftClaw) petParts.leftClaw.rotation.z = 0.4 + Math.sin(time * 1.8) * 0.08;
    if (petParts.rightClaw) petParts.rightClaw.rotation.z = -0.4 + Math.sin(time * 1.8) * 0.08;
    
    // 尾巴摆动
    if (petParts.tail) petParts.tail.rotation.x = Math.PI * 0.1 + Math.sin(time * 1.5) * 0.1;
    
    // 更新粒子系统
    if (particleManager) particleManager.update();
  }
  
  renderer.render(scene, camera);
}

init();