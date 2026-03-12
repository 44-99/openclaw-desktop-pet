/**
 * 哈基虾情绪系统
 * 
 * 情绪数据来源：
 * 1. 用户互动（点击、夸奖、批评）
 * 2. 对话内容的情感分析
 * 3. 时间/场景（深夜=困倦，早晨=活力）
 * 4. 系统状态（忙碌=焦急，空闲=悠闲）
 */

// ========== 情绪类型定义 ==========
const EMOTION_TYPES = {
  HAPPY: 'happy',      // 开心
  IDLE: 'idle',        // 悠闲
  SLEEPY: 'sleepy',    // 困倦
};

// ========== 情绪配置表 ==========
const EXPRESSION_CONFIG = {
  [EMOTION_TYPES.HAPPY]: {
    eyeScale: 1.2,           // 眼睛放大
    eyeY: 0.35,              // 眼睛位置上移
    mouthRotate: 0,          // 嘴巴微笑（向上）
    mouthScale: 1.5,         // 嘴巴放大
    // color: 0xFF6666,      // ❌ 删除 - 颜色由系统状态统一控制
    floatAmp: 0.15,          // 漂浮幅度增大
    floatSpeed: 1.3,         // 漂浮速度加快
    antennaSpeed: 0.08,      // 触角摆动加快
  },
  
  [EMOTION_TYPES.IDLE]: {
    eyeScale: 1.0,           // 正常眼睛
    eyeY: 0.3,               // 眼睛位置正常
    mouthRotate: Math.PI,    // 嘴巴自然状态（向下）
    mouthScale: 1.0,         // 嘴巴正常
    // color: 0xFF4444,      // ❌ 删除 - 颜色由系统状态统一控制
    floatAmp: 0.1,           // 漂浮幅度正常
    floatSpeed: 1.0,         // 漂浮速度正常
    antennaSpeed: 0.03,      // 触角摆动缓慢
  },
  
  [EMOTION_TYPES.SLEEPY]: {
    eyeScale: 0.5,           // 眼睛半闭
    eyeY: 0.2,               // 眼睛位置下降
    mouthRotate: Math.PI * 0.8,  // 嘴巴微张
    mouthScale: 0.9,         // 嘴巴缩小
    // color: 0x9966FF,      // ❌ 删除 - 颜色由系统状态统一控制
    floatAmp: 0.05,          // 漂浮幅度减小
    floatSpeed: 0.5,         // 漂浮速度减慢
    antennaSpeed: 0.01,      // 触角几乎不动
  },
};

// ========== 情绪状态类 ==========
class EmotionState {
  constructor() {
    // 当前主导情绪
    this.currentEmotion = EMOTION_TYPES.IDLE;
    
    // 目标情绪（用于平滑过渡）
    this.targetEmotion = EMOTION_TYPES.IDLE;
    
    // 情绪强度（0-100）
    this.intensity = 50;
    
    // 情绪持续时间（毫秒）
    this.duration = 0;
    
    // 情绪开始时间
    this.startTime = Date.now();
    
    // 情绪衰减率（每秒减少的强度）
    this.decayRate = 3;
    
    // 情绪过渡进度（0-1，用于平滑动画）
    this.transitionProgress = 1;
    
    // 情绪触发源（用于调试）
    this.trigger = null;
  }
  
  /**
   * 设置情绪
   * @param {string} emotion - 情绪类型 (happy/idle/sleepy)
   * @param {number} intensity - 强度 (0-100)
   * @param {number} duration - 持续时间（毫秒，0=永久）
   * @param {string} trigger - 触发源（用于调试）
   */
  set(emotion, intensity = 70, duration = 5000, trigger = null) {
    if (!EXPRESSION_CONFIG[emotion]) {
      console.warn('Unknown emotion:', emotion);
      return;
    }
    
    this.targetEmotion = emotion;
    this.intensity = intensity;
    this.duration = duration;
    this.trigger = trigger;
    this.startTime = Date.now();
    this.transitionProgress = 0; // 开始过渡
    
    console.log(`🎭 Emotion: ${emotion} (${intensity}%) - ${trigger || 'manual'}`);
  }
  
  /**
   * 更新情绪状态（每帧调用）
   * @param {number} deltaTime - 距离上一帧的时间（毫秒）
   */
  update(deltaTime) {
    // 平滑过渡到目标情绪
    if (this.transitionProgress < 1) {
      this.transitionProgress += deltaTime / 500; // 500ms 过渡
      this.transitionProgress = Math.min(1, this.transitionProgress);
    }
    
    // 衰减情绪强度
    if (this.duration > 0) {
      this.intensity -= this.decayRate * (deltaTime / 1000);
      this.intensity = Math.max(0, this.intensity);
      
      // 检查是否超时
      if (Date.now() - this.startTime > this.duration) {
        this.intensity = 0;
      }
    }
    
    // 情绪结束后回到空闲状态
    if (this.intensity === 0 && this.currentEmotion !== EMOTION_TYPES.IDLE) {
      this.set(EMOTION_TYPES.IDLE, 50, 0, 'timeout');
    }
    
    // 更新当前情绪（使用过渡进度混合）
    this.currentEmotion = this.targetEmotion;
  }
  
  /**
   * 获取当前表情的混合配置（支持平滑过渡）
   * @param {THREE.Group} petParts - 宠物组件引用
   * @returns {object} 混合后的表情配置
   */
  getBlendedConfig(petParts) {
    const config = EXPRESSION_CONFIG[this.currentEmotion];
    
    // 根据强度调整表情
    const intensityFactor = this.intensity / 100;
    
    return {
      eyeScale: config.eyeScale,
      eyeY: config.eyeY,
      mouthRotate: config.mouthRotate,
      mouthScale: config.mouthScale,
      color: config.color,
      floatAmp: config.floatAmp * intensityFactor,
      floatSpeed: config.floatSpeed * intensityFactor,
      antennaSpeed: config.antennaSpeed * intensityFactor,
    };
  }
  
  /**
   * 根据时间自动调整情绪
   */
  autoAdjustByTime() {
    const hour = new Date().getHours();
    
    // 深夜（23 点 -5 点）：困倦
    if (hour >= 23 || hour <= 5) {
      if (this.currentEmotion !== EMOTION_TYPES.SLEEPY) {
        this.set(EMOTION_TYPES.SLEEPY, 60, 0, 'time:auto');
      }
    }
    // 早晨（6 点 -9 点）：开心
    else if (hour >= 6 && hour <= 9) {
      if (this.currentEmotion !== EMOTION_TYPES.HAPPY) {
        this.set(EMOTION_TYPES.HAPPY, 40, 0, 'time:auto');
      }
    }
    // 其他时间：悠闲
    else {
      if (this.currentEmotion !== EMOTION_TYPES.IDLE) {
        this.set(EMOTION_TYPES.IDLE, 50, 0, 'time:auto');
      }
    }
  }
}

// ========== 情绪触发器 ==========
class EmotionTrigger {
  constructor(emotionSystem) {
    this.emotionSystem = emotionSystem;
    
    // 触发词映射
    this.triggerWords = {
      [EMOTION_TYPES.HAPPY]: ['哈哈', '好笑', '有趣', '喜欢', '棒', '厉害', '聪明', '可爱'],
      [EMOTION_TYPES.SLEEPY]: ['困', '累', '睡', '休息', '晚安'],
    };
  }
  
  /**
   * 分析用户消息并触发情绪
   * @param {string} message - 用户消息
   */
  analyzeMessage(message) {
    // 检测用户消息中的情绪触发词
    for (const [emotion, words] of Object.entries(this.triggerWords)) {
      if (words.some(word => message.includes(word))) {
        this.triggerEmotion(emotion, 70, 5000, `message:${message}`);
        return;
      }
    }
    
    // 检测时间（自动调整）
    this.emotionSystem.autoAdjustByTime();
  }
  
  /**
   * 触发情绪
   * @param {string} emotion - 情绪类型
   * @param {number} intensity - 强度
   * @param {number} duration - 持续时间
   * @param {string} trigger - 触发源
   */
  triggerEmotion(emotion, intensity = 70, duration = 5000, trigger = null) {
    this.emotionSystem.set(emotion, intensity, duration, trigger);
  }
}

// ========== 导出（ES Module） ==========
export { EMOTION_TYPES, EXPRESSION_CONFIG, EmotionState, EmotionTrigger };
