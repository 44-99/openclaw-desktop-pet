/**
 * 哈基虾颜色渲染器
 * 
 * 根据性能评分渲染龙虾身体颜色
 * 5 级渐变：浅蓝灰 → 淡蓝 → 橙黄 → 橙红 → 亮红
 */

import * as THREE from 'three';

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
   * @param {THREE.Group} pet - 宠物模型引用（可以是 pet 或 petWrapper）
   */
  constructor(pet) {
    this.pet = pet;
    this.currentLevel = '空闲';
    this.currentColor = PERFORMANCE_COLORS[3]; // 默认浅蓝灰（索引 3 = 空闲）
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
   * 应用颜色到模型（递归遍历所有 Mesh）
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
    
    // 应用到整个模型（递归遍历所有 Mesh）
    applyToMesh(this.pet);
    
    console.log('🎨 全身颜色更新完成');
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
