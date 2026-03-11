import * as THREE from 'three';
import { EMOTION_TYPES, EXPRESSION_CONFIG, EmotionState, EmotionTrigger } from './emotion-system.js';
import { ColorRenderer, PERFORMANCE_COLORS, LEVEL_NAMES } from './color-renderer.js';
import { InnerVoiceManager, TONES } from './inner-voice.js';
import { TopicGenerator, TOPIC_TYPES, KNOWLEDGE_CATEGORIES } from './topic-generator.js';
import { ParticleSystemManager } from './particle-system.js';

// ==================== 全局变量 ====================
let scene, camera, renderer, pet, waterSurface, waterContainer;
let websocket;
let currentState = 'idle';
let isHidden = false;
let isWaitingResponse = false;

// 情绪系统
let emotionSystem;
let emotionTrigger;

// 颜色渲染器
let colorRenderer;

// 内心戏管理器
let innerVoiceManager;

// 话题生成器
let topicGenerator;

// 粒子系统管理器
let particleManager;

// 系统状态（从 Python 后端同步）
let systemStatus = {
  cpu: 0,
  memory: 0,
  gpu: 0,
  gpu_temp: 0,
  network: { upload: 0, download: 0 },
  performance_score: 100,
  performance_level: '空闲',
  level_changed: false
};

// 视角旋转控制
let isRotating = false;
let rotationStartX = 0;
let rotationStartY = 0;
let petRotationX = 0;
let petRotationY = 0;
let longPressTimer = null;
let wasLongPress = false;
const LONG_PRESS_DELAY = 200;

// 水箱系统
const WATER_LEVELS = {
  idle: 2.5,        // 最佳状态 - 水最满
  normal: 2.0,      // 正常 - 水稍低
  busy: 1.5,        // 忙碌 - 水一半
  high: 1.0,        // 高负载 - 水很少
  critical: 0.3     // 崩溃 - 几乎没水
};

// 状态颜色（红→黄→蓝→绿渐变）
const STATE_COLORS = {
  idle: 0x00FF00,      // 绿色 - 最佳状态
  normal: 0x88FF00,    // 黄绿色 - 正常
  busy: 0x0088FF,      // 蓝色 - 中等
  high: 0xFF8800,      // 橙色 - 高负载
  critical: 0xFF0000   // 红色 - 崩溃
};

const WATER_COLORS = {
  idle: 0x00FF88,      // 翠绿色
  normal: 0x88FF44,    // 浅绿色
  busy: 0x0088FF,      // 蓝色
  high: 0xFF6600,      // 橙色
  critical: 0xFF0044   // 红色
};

// 状态颜色（龙虾经典红 + 状态色）
const COLORS = {
  idle: 0xFF4444,      // 龙虾红 - 空闲
  normal: 0xFF6666,    // 浅红 - 正常
  busy: 0xFFAA00,      // 橙色 - 忙碌
  high: 0xFF4444,      // 红色 - 高负载
  critical: 0x880000   // 暗红 - 崩溃
};

// 表情配置
const EXPRESSIONS = {
  idle: { eyeScale: 1, mouthRotate: Math.PI, mouthScale: 1, eyeY: 0.3 },
  happy: { eyeScale: 1.2, mouthRotate: 0, mouthScale: 1.5, eyeY: 0.35 },
  surprised: { eyeScale: 1.5, mouthRotate: Math.PI * 1.5, mouthScale: 0.8, eyeY: 0.4 },
  worried: { eyeScale: 0.8, mouthRotate: Math.PI * 0.8, mouthScale: 0.7, eyeY: 0.25 },
  critical: { eyeScale: 0.6, mouthRotate: Math.PI * 0.5, mouthScale: 0.5, eyeY: 0.2 }
};

// 宠物组件引用（用于动画）
let petParts = {};

// ==================== 初始化 ====================
function init() {
  try {
    console.log('🦞 哈基虾初始化开始...');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    console.log('✅ Three.js 初始化完成');
    
    createPet();
    
    console.log('✅ 哈基虾模型创建完成');
    
    // 增强光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 3, -5);
    scene.add(backLight);
    
    console.log('✅ 光照设置完成');
    
    // 初始化情绪系统
    emotionSystem = new EmotionState();
    emotionTrigger = new EmotionTrigger(emotionSystem);
    
    // 根据时间设置初始情绪
    emotionSystem.autoAdjustByTime();
    
    console.log('✅ 情绪系统初始化完成，当前情绪:', emotionSystem.currentEmotion);
    
    // 初始化颜色渲染器
    colorRenderer = new ColorRenderer(petParts);
    console.log('✅ 颜色渲染器初始化完成');
    
    // 初始化内心戏管理器
    innerVoiceManager = new InnerVoiceManager({
      sendToOpenClaw: (message) => window.electronAPI.sendToOpenClaw(message),
      showBubble: (text) => showBubble(text, false)
    });
    console.log('✅ 内心戏管理器初始化完成（检查间隔 20 秒）');
    
    // 初始化话题生成器
    topicGenerator = new TopicGenerator({
      sendToOpenClaw: (message, sessionKey) => window.electronAPI.sendToOpenClaw(message, sessionKey),
      hasTavilyAPI: false  // TODO: 从 Electron 主进程读取
    });
    console.log('✅ 话题生成器初始化完成');
    
    // 初始化粒子系统管理器
    particleManager = new ParticleSystemManager(scene);
    console.log('✅ 粒子系统初始化完成');
    
    connectWebSocket();
    setupEvents();
    
    console.log('✅ WebSocket 和事件设置完成');
    
    setTimeout(() => {
      document.getElementById('loading').style.display = 'none';
      console.log('✅ 加载指示器隐藏，哈基虾上线！');
    }, 1000);
    
    animate();
    
    console.log('✅ 哈基虾初始化完成！');
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    document.getElementById('loading').innerHTML = `<div style="color: red; padding: 20px;">初始化失败：<br>${error.message}</div>`;
  }
}

// ==================== 创建水箱 ====================
function createWaterTank() {
  // 1. 背景渐变色板（显示状态颜色）
  const bgGeometry = new THREE.CylinderGeometry(3.6, 3.6, 5.2, 32, 1, true);
  const bgMaterial = new THREE.MeshBasicMaterial({
    color: STATE_COLORS.idle,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide
  });
  const bgCylinder = new THREE.Mesh(bgGeometry, bgMaterial);
  bgCylinder.position.y = -0.4;
  scene.add(bgCylinder);
  petParts.stateBg = bgCylinder;
  
  // 2. 透明玻璃容器（圆柱形）
  const tankGeometry = new THREE.CylinderGeometry(3.5, 3.5, 5, 32, 1, true);
  const tankMaterial = new THREE.MeshPhongMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    shininess: 100,
    specular: 0x444444
  });
  const tank = new THREE.Mesh(tankGeometry, tankMaterial);
  tank.position.y = -0.5;
  scene.add(tank);
  petParts.tank = tank;
  
  // 3. 水箱底部
  const bottomGeometry = new THREE.CylinderGeometry(3.5, 3.5, 0.1, 32);
  const bottomMaterial = new THREE.MeshPhongMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0.4,
    shininess: 80
  });
  const bottom = new THREE.Mesh(bottomGeometry, bottomMaterial);
  bottom.position.y = -3;
  scene.add(bottom);
  petParts.tankBottom = bottom;
  
  // 3. 水面（会上下移动）
  const waterGeometry = new THREE.CylinderGeometry(3.4, 3.4, 0.3, 32);
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: WATER_COLORS.idle,
    transparent: true,
    opacity: 0.7,
    shininess: 100,
    specular: 0x666666
  });
  waterSurface = new THREE.Mesh(waterGeometry, waterMaterial);
  waterSurface.position.y = WATER_LEVELS.idle;
  scene.add(waterSurface);
  petParts.waterSurface = waterSurface;
  
  // 4. 水体（半透明填充）
  const waterBodyGeometry = new THREE.CylinderGeometry(3.4, 3.4, WATER_LEVELS.idle, 32);
  const waterBodyMaterial = new THREE.MeshPhongMaterial({
    color: WATER_COLORS.idle,
    transparent: true,
    opacity: 0.4,
    shininess: 80
  });
  const waterBody = new THREE.Mesh(waterBodyGeometry, waterBodyMaterial);
  waterBody.position.y = WATER_LEVELS.idle / 2 - 1.5;
  scene.add(waterBody);
  petParts.waterBody = waterBody;
}

// ==================== 创建哈基虾（升级版） ====================
function createPet() {
  pet = new THREE.Group();
  
  const mainColor = COLORS.idle;
  const darkColor = 0xCC3333;
  
  // 将虾放在水箱中央
  pet.position.y = 0;
  
  // ========== 身体部分 ==========
  
  // 1. 头胸部（主要身体）- 更扁平的椭圆形
  const cephalothoraxGeometry = new THREE.SphereGeometry(1, 32, 32);
  cephalothoraxGeometry.scale(1.1, 0.9, 0.85);
  const cephalothoraxMaterial = new THREE.MeshPhongMaterial({ 
    color: mainColor, 
    shininess: 80,
    specular: 0x444444
  });
  const cephalothorax = new THREE.Mesh(cephalothoraxGeometry, cephalothoraxMaterial);
  pet.add(cephalothorax);
  petParts.cephalothorax = cephalothorax;
  
  // 2. 腹部（分节）- 3 节逐渐变小，紧密连接
  for (let i = 0; i < 3; i++) {
    const size = 0.65 - i * 0.1;
    const segmentGeometry = new THREE.SphereGeometry(size, 24, 24);
    segmentGeometry.scale(0.9, 0.85, 0.75);
    const segmentMaterial = new THREE.MeshPhongMaterial({ 
      color: i % 2 === 0 ? mainColor : darkColor,
      shininess: 70
    });
    const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
    // 紧密连接：每节间隔=size*0.85（扁率）
    segment.position.set(0, -0.85 - i * (size * 0.85), -0.3);
    pet.add(segment);
    petParts[`abdomen${i}`] = segment;
  }
  
  // 3. 尾巴（扇形）
  const tailFanGeometry = new THREE.ConeGeometry(0.5, 0.8, 4);
  const tailFanMaterial = new THREE.MeshPhongMaterial({ color: darkColor, shininess: 60 });
  const tailFan = new THREE.Mesh(tailFanGeometry, tailFanMaterial);
  tailFan.position.set(0, -1.9, -0.7);
  tailFan.rotation.x = Math.PI * 0.3;
  pet.add(tailFan);
  petParts.tail = tailFan;
  
  // ========== 头部特征 ==========
  
  // 4. 眼睛（带眼柄）- 在头胸部上方
  const eyeStalkGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.25, 12);
  const eyeStalkMaterial = new THREE.MeshPhongMaterial({ color: mainColor });
  
  const leftEyeStalk = new THREE.Mesh(eyeStalkGeometry, eyeStalkMaterial);
  leftEyeStalk.position.set(-0.4, 0.75, 0.5);
  leftEyeStalk.rotation.z = -0.15;
  pet.add(leftEyeStalk);
  petParts.leftEyeStalk = leftEyeStalk;
  
  const rightEyeStalk = new THREE.Mesh(eyeStalkGeometry, eyeStalkMaterial);
  rightEyeStalk.position.set(0.4, 0.75, 0.5);
  rightEyeStalk.rotation.z = 0.15;
  pet.add(rightEyeStalk);
  petParts.rightEyeStalk = rightEyeStalk;
  
  // 眼球（白色）
  const eyeballGeometry = new THREE.SphereGeometry(0.12, 16, 16);
  const eyeballMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
  
  const leftEyeball = new THREE.Mesh(eyeballGeometry, eyeballMaterial);
  leftEyeball.position.set(0, 0.15, 0);
  leftEyeStalk.add(leftEyeball);
  petParts.leftEyeball = leftEyeball;
  
  const rightEyeball = new THREE.Mesh(eyeballGeometry, eyeballMaterial);
  rightEyeball.position.set(0, 0.15, 0);
  rightEyeStalk.add(rightEyeball);
  petParts.rightEyeball = rightEyeball;
  
  // 瞳孔（黑色，可缩放表达情绪）
  const pupilGeometry = new THREE.SphereGeometry(0.06, 12, 12);
  const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  
  const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  leftPupil.position.set(0, 0.02, 0.1);
  leftEyeball.add(leftPupil);
  petParts.leftPupil = leftPupil;
  
  const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  rightPupil.position.set(0, 0.02, 0.1);
  rightEyeball.add(rightPupil);
  petParts.rightPupil = rightPupil;
  
  // 5. 触角（2 根长的 + 2 根短的）
  const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.04, 1.0, 8);
  const antennaMaterial = new THREE.MeshPhongMaterial({ color: darkColor });
  
  // 长触角（左侧）
  const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  leftAntenna.position.set(-0.5, 0.9, 0.5);
  leftAntenna.rotation.z = 0.3;
  leftAntenna.rotation.x = -0.2;
  pet.add(leftAntenna);
  petParts.leftAntenna = leftAntenna;
  
  // 长触角（右侧）
  const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
  rightAntenna.position.set(0.5, 0.9, 0.5);
  rightAntenna.rotation.z = -0.3;
  rightAntenna.rotation.x = -0.2;
  pet.add(rightAntenna);
  petParts.rightAntenna = rightAntenna;
  
  // 短触角（内侧）
  const shortAntennaGeometry = new THREE.CylinderGeometry(0.015, 0.03, 0.6, 8);
  
  const leftShortAntenna = new THREE.Mesh(shortAntennaGeometry, antennaMaterial);
  leftShortAntenna.position.set(-0.25, 0.95, 0.55);
  leftShortAntenna.rotation.z = 0.15;
  leftShortAntenna.rotation.x = -0.3;
  pet.add(leftShortAntenna);
  petParts.leftShortAntenna = leftShortAntenna;
  
  const rightShortAntenna = new THREE.Mesh(shortAntennaGeometry, antennaMaterial);
  rightShortAntenna.position.set(0.25, 0.95, 0.55);
  rightShortAntenna.rotation.z = -0.15;
  rightShortAntenna.rotation.x = -0.3;
  pet.add(rightShortAntenna);
  petParts.rightShortAntenna = rightShortAntenna;
  
  // 6. 嘴巴（可变形表达情绪）
  const mouthGeometry = new THREE.TorusGeometry(0.12, 0.02, 8, 16, Math.PI);
  const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x330000 });
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  mouth.position.set(0, 0.3, 0.8);
  mouth.rotation.z = Math.PI;
  pet.add(mouth);
  petParts.mouth = mouth;
  
  // ========== 钳子（标志性的大钳子） ==========
  
  // 7. 大钳子（不对称，更真实）
  const createClaw = (size) => {
    const clawGroup = new THREE.Group();
    
    // 钳子臂
    const armGeometry = new THREE.CylinderGeometry(0.07 * size, 0.1 * size, 0.5 * size, 12);
    const armMaterial = new THREE.MeshPhongMaterial({ color: mainColor });
    const arm = new THREE.Mesh(armGeometry, armMaterial);
    arm.position.y = 0.25 * size;
    clawGroup.add(arm);
    
    // 钳子手掌
    const palmGeometry = new THREE.BoxGeometry(0.22 * size, 0.28 * size, 0.13 * size);
    const palmMaterial = new THREE.MeshPhongMaterial({ color: mainColor });
    const palm = new THREE.Mesh(palmGeometry, palmMaterial);
    palm.position.y = 0.65 * size;
    clawGroup.add(palm);
    
    // 钳子手指（2 个）
    const fingerGeometry = new THREE.ConeGeometry(0.035 * size, 0.22 * size, 8);
    const fingerMaterial = new THREE.MeshPhongMaterial({ color: darkColor });
    
    const finger1 = new THREE.Mesh(fingerGeometry, fingerMaterial);
    finger1.position.set(0, 0.85 * size, 0.04 * size);
    finger1.rotation.x = -0.25;
    clawGroup.add(finger1);
    
    const finger2 = new THREE.Mesh(fingerGeometry, fingerMaterial);
    finger2.position.set(0, 0.85 * size, -0.04 * size);
    finger2.rotation.x = 0.25;
    clawGroup.add(finger2);
    
    return clawGroup;
  };
  
  // 左钳子（稍大）
  const leftClaw = createClaw(1.05);
  leftClaw.position.set(-1.0, 0.2, 0.6);
  leftClaw.rotation.z = 0.4;
  leftClaw.rotation.x = -0.15;
  pet.add(leftClaw);
  petParts.leftClaw = leftClaw;
  
  // 右钳子（稍小）
  const rightClaw = createClaw(0.95);
  rightClaw.position.set(1.0, 0.2, 0.6);
  rightClaw.rotation.z = -0.4;
  rightClaw.rotation.x = -0.15;
  pet.add(rightClaw);
  petParts.rightClaw = rightClaw;
  
  // ========== 步足（简化版，每侧 3 条） ==========
  
  const legGeometry = new THREE.CylinderGeometry(0.025, 0.035, 0.35, 8);
  const legMaterial = new THREE.MeshPhongMaterial({ color: darkColor });
  
  for (let i = 0; i < 3; i++) {
    // 左侧腿 - 从腹部连接
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.5, -0.9 - i * 0.35, -0.2);
    leftLeg.rotation.z = 0.5;
    leftLeg.rotation.x = -0.2;
    pet.add(leftLeg);
    petParts[`leftLeg${i}`] = leftLeg;
    
    // 右侧腿
    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.5, -0.9 - i * 0.35, -0.2);
    rightLeg.rotation.z = -0.5;
    rightLeg.rotation.x = -0.2;
    pet.add(rightLeg);
    petParts[`rightLeg${i}`] = rightLeg;
  }
  
  // 添加到场景
  scene.add(pet);
  
  // 初始表情
  updateExpression('idle');
}

// ==================== 更新表情 ====================
function updateExpression(state) {
  // 优先使用情绪系统的配置
  if (emotionSystem) {
    const config = emotionSystem.getBlendedConfig(petParts);
    
    if (petParts.leftPupil && petParts.rightPupil) {
      petParts.leftPupil.scale.setScalar(config.eyeScale);
      petParts.rightPupil.scale.setScalar(config.eyeScale);
    }
    
    if (petParts.leftEyeStalk && petParts.rightEyeStalk) {
      petParts.leftEyeStalk.position.y = config.eyeY;
      petParts.rightEyeStalk.position.y = config.eyeY;
    }
    
    if (petParts.mouth) {
      petParts.mouth.rotation.z = config.mouthRotate;
      petParts.mouth.scale.setScalar(config.mouthScale);
    }
    
    // 更新触角速度
    petParts.antennaSpeed = config.antennaSpeed;
    
    // 更新颜色（根据情绪强度）
    if (petParts.cephalothorax) {
      const targetColor = new THREE.Color(config.color);
      petParts.cephalothorax.material.color.lerp(targetColor, 0.1);
    }
  } else {
    // 回退到旧的表情系统
    const expr = EXPRESSIONS[state] || EXPRESSIONS.idle;
    
    if (petParts.leftPupil && petParts.rightPupil) {
      petParts.leftPupil.scale.setScalar(expr.eyeScale);
      petParts.rightPupil.scale.setScalar(expr.eyeScale);
    }
    
    if (petParts.leftEyeStalk && petParts.rightEyeStalk) {
      petParts.leftEyeStalk.position.y = expr.eyeY;
      petParts.rightEyeStalk.position.y = expr.eyeY;
    }
    
    if (petParts.mouth) {
      petParts.mouth.rotation.z = expr.mouthRotate;
      petParts.mouth.scale.setScalar(expr.mouthScale);
    }
    
    // 触角动画（紧张时抖动）
    const antennaSpeed = state === 'critical' || state === 'high' ? 0.15 : 0.03;
    petParts.antennaSpeed = antennaSpeed;
  }
}

// ==================== 状态切换 ====================
function changeState(newState) {
  currentState = newState;
  
  // 更新虾的颜色
  const targetColor = COLORS[newState];
  if (petParts.cephalothorax) {
    petParts.cephalothorax.material.color.setHex(targetColor);
  }
  
  for (let i = 0; i < 3; i++) {
    const segment = petParts[`abdomen${i}`];
    if (segment) {
      segment.material.color.setHex(i % 2 === 0 ? targetColor : targetColor - 0x111111);
    }
  }
  
  if (petParts.leftClaw) {
    petParts.leftClaw.children.forEach(child => {
      if (child.material) child.material.color.setHex(targetColor);
    });
  }
  if (petParts.rightClaw) {
    petParts.rightClaw.children.forEach(child => {
      if (child.material) child.material.color.setHex(targetColor);
    });
  }
  
  // 更新表情
  updateExpression(newState);
  
  // 更新水箱状态（水位 + 颜色）
  updateWaterTank(newState);
}

// ==================== 更新水箱 ====================
function updateWaterTank(state) {
  const targetLevel = WATER_LEVELS[state];
  const targetColor = WATER_COLORS[state];
  const stateColor = STATE_COLORS[state];
  
  // 平滑过渡水位
  if (petParts.waterSurface && petParts.waterBody) {
    const surfaceTargetY = targetLevel;
    const bodyTargetHeight = targetLevel;
    const bodyTargetY = targetLevel / 2 - 1.5;
    
    waterSurface.position.y += (surfaceTargetY - waterSurface.position.y) * 0.1;
    
    petParts.waterBody.geometry.dispose();
    petParts.waterBody.geometry = new THREE.CylinderGeometry(3.4, 3.4, bodyTargetHeight, 32);
    petParts.waterBody.position.y = bodyTargetY;
    
    petParts.waterSurface.material.color.lerp(new THREE.Color(targetColor), 0.15);
    petParts.waterBody.material.color.lerp(new THREE.Color(targetColor), 0.15);
  }
  
  // 更新背景颜色（状态渐变色）
  if (petParts.stateBg) {
    petParts.stateBg.material.color.lerp(new THREE.Color(stateColor), 0.1);
    // 状态越差，背景越不透明
    const targetOpacity = state === 'critical' ? 0.4 : 0.15;
    petParts.stateBg.material.opacity += (targetOpacity - petParts.stateBg.material.opacity) * 0.1;
  }
}

// ==================== WebSocket 连接 ====================
let websocketReconnectTimer = null;
let websocketConnectCount = 0;

function connectWebSocket() {
  if (websocketReconnectTimer) {
    clearTimeout(websocketReconnectTimer);
    websocketReconnectTimer = null;
  }
  
  if (websocket) {
    websocket.close();
    websocket = null;
  }
  
  try {
    websocket = new WebSocket('ws://localhost:8765');
    websocketConnectCount = 0;
    
    websocket.onopen = () => {
      console.log('WebSocket 连接成功');
      updateStatus('已连接', 'idle');
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'topic_response') {
        showBubble(data.message, true);
        isWaitingResponse = false;
      } else if (data.type === 'auto_chat') {
        showBubble(data.message, true);
        if (window.electronAPI) {
          window.electronAPI.playSound('notification');
        }
      } else if (data.type === 'system_status') {
        handleSystemStatus(data);
        
        // 保存系统状态，用于对话时引用
        systemStatus = {
          cpu: data.cpu || 0,
          memory: data.memory || 0,
          gpu: data.gpu || 0,
          gpu_temp: data.gpu_temp || 0,
          network: data.network || { upload: 0, download: 0 },
          performance_score: data.performance_score || 100,
          performance_level: data.performance_level || '空闲',
          level_changed: data.level_changed || false
        };
        
        // 颜色实时更新（每秒）
        if (data.level_changed && colorRenderer) {
          colorRenderer.updateColor(data.performance_level);
        }
        
        // 内心戏检查（每 20 秒）
        if (innerVoiceManager) {
          console.log('📡 性能数据更新，传递给内心戏管理器');
          innerVoiceManager.onPerformanceUpdate(systemStatus);
        } else {
          console.warn('⚠️ innerVoiceManager 未初始化');
        }
      }
    };
    
    websocket.onclose = () => {
      console.log('WebSocket 连接关闭');
      updateStatus('未连接', 'critical');
      websocketReconnectTimer = setTimeout(connectWebSocket, 5000);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket 错误:', error);
      updateStatus('连接错误', 'critical');
    };
  } catch (error) {
    console.error('WebSocket 连接失败:', error);
    websocketConnectCount++;
    if (websocketConnectCount < 5) {
      // 最多重试 5 次，每次间隔增加
      const delay = Math.min(1000 * websocketConnectCount, 5000);
      console.log(`WebSocket 将在 ${delay}ms 后重试 (${websocketConnectCount}/5)`);
      websocketReconnectTimer = setTimeout(connectWebSocket, delay);
    } else {
      console.log('WebSocket 连接失败，使用模拟模式');
      simulateSystemStatus();
    }
  }
}

// ==================== 处理系统状态 ====================
function handleSystemStatus(data) {
  const { cpu, memory, gpu, state } = data;
  if (state !== currentState) {
    changeState(state);
  }
  updateStatusIndicator(cpu, memory);
}

// ==================== 模拟系统状态 ====================
function simulateSystemStatus() {
  const states = ['idle', 'normal', 'busy', 'high', 'critical'];
  const weights = [0.4, 0.3, 0.2, 0.08, 0.02];
  
  setInterval(() => {
    const random = Math.random();
    let cumulative = 0;
    let state = 'idle';
    
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        state = states[i];
        break;
      }
    }
    
    const cpu = { idle: 10, normal: 35, busy: 65, high: 85, critical: 95 }[state];
    
    if (state !== currentState) {
      changeState(state);
    }
    
    updateStatusIndicator(cpu, 50);
  }, 3000);
}

// ==================== 更新状态指示器 ====================
function updateStatusIndicator(cpu, memory) {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  statusDot.className = `status-${currentState}`;
  statusText.textContent = `${currentState.toUpperCase()} | CPU: ${cpu}% | MEM: ${memory}%`;
}

function updateStatus(text, state) {
  const statusText = document.getElementById('status-text');
  statusText.textContent = text;
}

// ==================== 显示对话气泡 ====================
let currentTopic = '';

function showBubble(text, isClickable = false) {
  const bubble = document.getElementById('speech-bubble');
  const bubbleText = document.getElementById('bubble-text');
  bubbleText.textContent = text;
  currentTopic = text;
  
  if (isClickable) {
    bubble.style.cursor = 'pointer';
    bubble.title = '双击打开聊天';
  } else {
    bubble.style.cursor = 'default';
  }
  
  bubble.classList.remove('hidden');
  
  if (!isClickable) {
    setTimeout(() => {
      bubble.classList.add('hidden');
    }, 3000);
  }
}

// ==================== 事件监听 ====================
function setupEvents() {
  const canvas = document.getElementById('canvas-container');
  const contextMenu = document.getElementById('context-menu');
  
  let clickTimer = null;
  let lastClickTime = 0;
  
  // ========== 鼠标按下 - 开始长按检测 ==========
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return; // 只处理左键
    
    // 如果在拖拽窗口，不触发旋转
    if (event.target.closest('#context-menu')) return;
    
    rotationStartX = event.clientX;
    rotationStartY = event.clientY;
    
    // 启动长按计时器
    longPressTimer = setTimeout(() => {
      isRotating = true;
      canvas.style.cursor = 'grabbing';
      showBubble('🔄 拖动查看我的全身~', false);
    }, LONG_PRESS_DELAY);
  });
  
  // ========== 鼠标移动 - 处理旋转 ==========
  canvas.addEventListener('mousemove', (event) => {
    if (!isRotating) return;
    
    const deltaX = event.clientX - rotationStartX;
    const deltaY = event.clientY - rotationStartY;
    
    // 更新旋转角度
    petRotationY += deltaX * 0.01; // 左右拖动绕 Y 轴旋转
    petRotationX += deltaY * 0.01; // 上下拖动绕 X 轴旋转
    
    // 限制 X 轴旋转角度（避免翻转）
    petRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, petRotationX));
    
    // 应用旋转
    if (pet) {
      pet.rotation.x = petRotationX;
      pet.rotation.y = petRotationY;
    }
    
    rotationStartX = event.clientX;
    rotationStartY = event.clientY;
  });
  
  // ========== 鼠标松开 - 取消长按 ==========
  canvas.addEventListener('mouseup', (event) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    
    if (isRotating) {
      isRotating = false;
      wasLongPress = true; // 标记本次是长按，不是单击
      canvas.style.cursor = 'pointer';
    }
  });
  
  // ========== 鼠标离开窗口 - 取消旋转 ==========
  canvas.addEventListener('mouseleave', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    isRotating = false;
    canvas.style.cursor = 'pointer';
  });
  
  // ========== 原有的单击/双击处理 ==========
  canvas.addEventListener('click', (event) => {
    if (event.button !== 0) return;
    
    // 如果刚结束长按旋转，不触发单击（关键修复！）
    if (wasLongPress) {
      wasLongPress = false; // 重置标志
      return;
    }
    
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;
    lastClickTime = now;
    
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      return;
    }
    
    clickTimer = setTimeout(() => {
      clickTimer = null;
      handleSingleClick();
    }, 300);
  });
  
  function handleSingleClick() {
    if (isWaitingResponse) {
      showBubble("💭 正在思考中，稍等一下嘛~", false);
      return;
    }
    
    // 使用话题生成器（带防抖和概率分配）
    if (topicGenerator) {
      showBubble("💭 思考中...", true);
      
      topicGenerator.generateTopic()
        .then(topic => {
          if (topic) {
            showBubble(topic, true);
            // 触发粒子特效（根据当前情绪）
            if(particleManager && emotionSystem) {
              particleManager.triggerEffect(emotionSystem.currentEmotion, pet.position);
            }
          } else {
            showBubble("⚠️ 网络开小差了，等下再聊吧～", false);
          }
        })
        .catch(error => {
          console.error('话题生成失败:', error);
          showBubble("⚠️ 出错了，等下再试吧～", false);
        });
      
      window.electronAPI.playSound('click');
    } else {
      // 降级：没有话题生成器时使用简单 Prompt
      showBubble("💭 思考中...", true);
      isWaitingResponse = true;
      
      window.electronAPI.sendToOpenClaw('（用 1-2 句话回复，50 字以内，口语化）和我聊聊天吧～')
        .then(result => {
          isWaitingResponse = false;
          if (result.success) {
            const reply = result.reply.length > 100 ? result.reply.substring(0, 100) + '...' : result.reply;
            showBubble(reply, true);
          } else {
            showBubble("⚠️ 网络开小差了，等下再聊吧～", false);
          }
        })
        .catch(error => {
          isWaitingResponse = false;
          console.error('OpenClaw error:', error);
          showBubble("⚠️ 出错了，等下再试吧～", false);
        });
      
      window.electronAPI.playSound('click');
    }
  }
  
  canvas.addEventListener('dblclick', (event) => {
    if (event.button === 0) {
      if (window.electronAPI) {
        window.electronAPI.openOpenClaw();
      }
      showBubble("打开 OpenClaw 啦~ 🚀");
    }
  });
  
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.classList.remove('hidden');
  });
  
  document.addEventListener('click', (event) => {
    if (!contextMenu.contains(event.target)) {
      contextMenu.classList.add('hidden');
    }
  });
  
  contextMenu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      handleMenuAction(action);
      contextMenu.classList.add('hidden');
    });
  });
  
  // 窗口拖拽（使用右键或中键，避免与旋转冲突）
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  canvas.addEventListener('mousedown', (event) => {
    if ((event.button === 2 || event.button === 1) && !event.target.closest('#context-menu')) {
      isDragging = true;
      dragOffsetX = event.screenX;
      dragOffsetY = event.screenY;
      event.preventDefault();
    }
  });
  
  document.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    
    const deltaX = event.screenX - dragOffsetX;
    const deltaY = event.screenY - dragOffsetY;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      if (window.electronAPI) {
        window.electronAPI.moveWindow(event.screenX, event.screenY, deltaX, deltaY);
      }
      dragOffsetX = event.screenX;
      dragOffsetY = event.screenY;
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const scale = pet.scale.x * (event.deltaY > 0 ? 0.9 : 1.1);
    pet.scale.set(scale, scale, scale);
  });
  
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  document.addEventListener('keydown', (event) => {
    if (event.key === 'F12') {
      event.preventDefault();
      if (window.electronAPI) {
        window.electronAPI.toggleVisibility();
      }
      isHidden = !isHidden;
      if (isHidden) {
        showBubble("已隐藏~ 再按 F12 出现哦~ 👻");
      }
    }
  });
}

// ==================== 菜单动作处理 ====================
function handleMenuAction(action) {
  switch (action) {
    case 'talk':
      // 通过 WebSocket 请求 LLM 生成话题，不使用模板
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        showBubble("💬 想聊什么呢？", false);
        websocket.send(JSON.stringify({
          type: 'generate_topic',
          context: 'casual'
        }));
      } else {
        showBubble("⚠️ 网络开小差了，等下再聊吧～", false);
      }
      break;
    case 'rotate':
      // 重置视角或展示旋转提示
      petRotationX = 0;
      petRotationY = 0;
      if (pet) {
        pet.rotation.x = 0;
        pet.rotation.y = 0;
      }
      showBubble('🔄 视角已重置~ 长按左键拖动可以 360° 查看我哦！');
      break;
    case 'status':
      showBubble(`当前状态：${currentState.toUpperCase()} 📊`);
      break;
    case 'openclaw':
      if (window.electronAPI) {
        // 标记话题为已打开（单对话模式）
        if (topicGenerator) {
          topicGenerator.markAsOpened();
          // 打开桌面宠物会话（使用完整 sessionKey）
          const sessionKey = topicGenerator.getFullSessionKey();
          window.electronAPI.openDesktopPetSession(sessionKey);
          console.log('🚀 打开话题:', sessionKey);
        } else {
          // 降级：没有话题生成器时打开默认会话
          window.electronAPI.openDesktopPetSession('agent:main:openai-user:desktop-pet:default');
        }
      }
      showBubble("打开 OpenClaw 啦~ 🚀");
      break;
    case 'hide':
      if (window.electronAPI) {
        window.electronAPI.toggleVisibility();
      }
      isHidden = !isHidden;
      break;
    case 'quit':
      if (window.electronAPI) {
        window.electronAPI.quitApp();
      }
      break;
    
    // ========== 情绪测试 ==========
    case 'emotion-happy':
      if (emotionSystem) {
        emotionSystem.set(EMOTION_TYPES.HAPPY, 80, 5000, 'menu:test');
        showBubble('😊 好开心呀～ 谢谢主人陪我玩！');
        // 触发爱心粒子
        if(particleManager) {
          particleManager.triggerEffect('happy', pet.position);
        }
      }
      break;
    case 'emotion-idle':
      if (emotionSystem) {
        emotionSystem.set(EMOTION_TYPES.IDLE, 50, 0, 'menu:test');
        showBubble('😌 悠闲自在～');
      }
      break;
    case 'emotion-sleepy':
      if (emotionSystem) {
        emotionSystem.set(EMOTION_TYPES.SLEEPY, 70, 5000, 'menu:test');
        showBubble('😴 好困啊～ 想睡觉了...');
      }
      break;
    case 'emotion-excited':
      if (emotionSystem) {
        emotionSystem.set(EMOTION_TYPES.EXCITED, 90, 5000, 'menu:test');
        showBubble('🎉 太兴奋啦！彩带飘飘～');
        // 触发彩带粒子
        if(particleManager) {
          particleManager.triggerEffect('excited', pet.position);
        }
      }
      break;
  }
}

// ==================== 动画循环 ====================
let lastFrameTime = Date.now();

function animate() {
  requestAnimationFrame(animate);
  
  // 计算帧时间差（用于情绪更新）
  const currentTime = Date.now();
  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  
  // 更新情绪系统
  if (emotionSystem) {
    emotionSystem.update(deltaTime);
  }
  
  // 更新粒子系统
  if (particleManager) {
    particleManager.update();
  }
  
  if (pet) {
    const time = Date.now() * 0.001;
    
    // 根据状态调整动画参数
    const stateParams = {
      idle: { floatSpeed: 1, floatAmp: 0.1, shakeAmp: 0, rotSpeed: 0.5 },
      normal: { floatSpeed: 1.2, floatAmp: 0.1, shakeAmp: 0, rotSpeed: 0.6 },
      busy: { floatSpeed: 1.5, floatAmp: 0.12, shakeAmp: 0.02, rotSpeed: 0.8 },
      high: { floatSpeed: 2, floatAmp: 0.15, shakeAmp: 0.05, rotSpeed: 1 },
      critical: { floatSpeed: 3, floatAmp: 0.2, shakeAmp: 0.1, rotSpeed: 1.5 }
    };
    
    const params = stateParams[currentState] || stateParams.idle;
    
    // 整体漂浮（幅度和速度随状态变化）
    // 情绪系统会覆盖这些参数
    const emotionConfig = emotionSystem ? emotionSystem.getBlendedConfig() : null;
    const floatAmp = emotionConfig ? emotionConfig.floatAmp : params.floatAmp;
    const floatSpeed = emotionConfig ? emotionConfig.floatSpeed : params.floatSpeed;
    
    pet.position.y = Math.sin(time * floatSpeed) * floatAmp;
    pet.rotation.z = Math.sin(time * params.rotSpeed) * 0.05;
    
    // 紧张时身体抖动
    if (params.shakeAmp > 0) {
      pet.position.x = Math.sin(time * 10) * params.shakeAmp;
    } else {
      pet.position.x = 0;
    }
    
    // 更新表情（根据情绪系统）
    updateExpression(currentState);
    
    // 触角摆动（根据状态）
    const antennaSpeed = petParts.antennaSpeed || 0.03;
    if (petParts.leftAntenna) {
      petParts.leftAntenna.rotation.z = 0.4 + Math.sin(time * 2) * antennaSpeed;
    }
    if (petParts.rightAntenna) {
      petParts.rightAntenna.rotation.z = -0.4 + Math.sin(time * 2) * antennaSpeed;
    }
    
    // 钳子微动
    if (petParts.leftClaw) {
      petParts.leftClaw.rotation.z = 0.5 + Math.sin(time * 0.8) * 0.03;
    }
    if (petParts.rightClaw) {
      petParts.rightClaw.rotation.z = -0.5 + Math.sin(time * 0.8) * 0.03;
    }
    
    // 尾巴摆动
    if (petParts.tail) {
      petParts.tail.rotation.x = Math.PI * 0.3 + Math.sin(time * 1.5) * 0.05;
    }
  }
  
  // 水面波动效果（始终存在，紧张时更剧烈）
  if (petParts.waterSurface) {
    const waveSpeed = currentState === 'critical' ? 3 : 1;
    const waveAmp = currentState === 'critical' ? 0.08 : 0.03;
    petParts.waterSurface.rotation.x = Math.sin(time * waveSpeed) * waveAmp;
    petParts.waterSurface.rotation.z = Math.cos(time * waveSpeed * 0.8) * waveAmp;
  }
  
  renderer.render(scene, camera);
}

// ==================== 启动 ====================
init();
