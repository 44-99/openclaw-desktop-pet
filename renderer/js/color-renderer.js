/**
 * 哈基虾颜色渲染器
 * 
 * 根据性能评分渲染龙虾身体颜色
 * 5 级渐变：浅蓝灰 → 淡蓝 → 橙黄 → 橙红 → 亮红
 */

// 性能等级对应的颜色（4 级渐变）
const PERFORMANCE_COLORS = [
  0xFF0000,  // 夯爆了 (0-25 分) - 亮红色
  0xFF8C00,  // 紧张 (26-50 分) - 橙红色
  0xFFD700,  // 忙碌 (51-75 分) - 橙黄色
  0xB0C4DE,  // 空闲 (76-100 分) - 浅蓝灰色
];

// 性能等级名称（4 级）
const LEVEL_NAMES = ['夯爆了', '紧张', '忙碌', '空闲'];

class ColorRenderer {
  /**
   * @param {THREE.Group} petParts - 宠物组件引用
   */
  constructor(petParts) {
    this.petParts = petParts;
    this.currentLevel = '空闲';
    this.currentColor = PERFORMANCE_COLORS[4]; // 默认浅蓝灰
  }
  
  /**
   * 根据性能等级获取颜色
   * @param {string} level - 性能等级名称
   * @returns {number} 颜色值（hex）
   */
  getColorForLevel(level) {
    const index = LEVEL_NAMES.indexOf(level);
    if (index === -1) {
      return PERFORMANCE_COLORS[4]; // 默认空闲
    }
    return PERFORMANCE_COLORS[index];
  }
  
  /**
   * 更新颜色
   * @param {string} level - 性能等级
   */
  updateColor(level) {
    if (level === this.currentLevel) {
      return; // 等级未变化，不更新
    }
    
    this.currentLevel = level;
    const targetColor = this.getColorForLevel(level);
    this.currentColor = targetColor;
    
    console.log(`🎨 颜色更新：${level} → ${this.colorToHex(targetColor)}`);
    
    // 更新龙虾身体颜色
    this.applyColor(targetColor);
  }
  
  /**
   * 应用颜色到龙虾身体（全身所有部位颜色一致）
   * @param {number} color - 颜色值（hex）
   */
  applyColor(color) {
    const targetColor = new THREE.Color(color);
    
    console.log(`🎨 应用颜色：${this.colorToHex(color)}`);
    
    // 递归应用颜色到所有子对象
    const applyToMesh = (mesh) => {
      if (!mesh) return;
      
      if (mesh.material) {
        // 所有部位使用相同颜色，不交替
        mesh.material.color.lerp(targetColor, 0.9);
      }
      
      // 递归处理子对象
      if (mesh.children) {
        mesh.children.forEach(child => applyToMesh(child));
      }
    };
    
    // 头胸部
    applyToMesh(this.petParts.cephalothorax);
    
    // 腹部（3 节）
    for (let i = 0; i < 3; i++) {
      applyToMesh(this.petParts[`abdomen${i}`]);
    }
    
    // 尾巴
    applyToMesh(this.petParts.tail);
    
    // 钳子（左右）
    applyToMesh(this.petParts.leftClaw);
    applyToMesh(this.petParts.rightClaw);
    
    // 眼柄和眼球
    applyToMesh(this.petParts.leftEyeStalk);
    applyToMesh(this.petParts.rightEyeStalk);
    applyToMesh(this.petParts.leftEyeball);
    applyToMesh(this.petParts.rightEyeball);
    
    // 触角（长 + 短）
    applyToMesh(this.petParts.leftAntenna);
    applyToMesh(this.petParts.rightAntenna);
    applyToMesh(this.petParts.leftShortAntenna);
    applyToMesh(this.petParts.rightShortAntenna);
    
    // 步足（左右各 3 条）
    for (let i = 0; i < 3; i++) {
      applyToMesh(this.petParts[`leftLeg${i}`]);
      applyToMesh(this.petParts[`rightLeg${i}`]);
    }
    
    // 嘴巴
    applyToMesh(this.petParts.mouth);
    
    console.log('🎨 全身颜色更新完成（所有部位颜色一致）');
  }
  
  /**
   * 颜色值转十六进制字符串
   * @param {number} color - 颜色值（hex）
   * @returns {string} 十六进制字符串
   */
  colorToHex(color) {
    return '#' + color.toString(16).padStart(6, '0').toUpperCase();
  }
  
  /**
   * 获取当前等级
   * @returns {string} 当前等级名称
   */
  getCurrentLevel() {
    return this.currentLevel;
  }
  
  /**
   * 获取当前颜色
   * @returns {number} 当前颜色值（hex）
   */
  getCurrentColor() {
    return this.currentColor;
  }
}

// 导出
export { ColorRenderer, PERFORMANCE_COLORS, LEVEL_NAMES };
