/**
 * 哈基虾颜色渲染器 - 根据系统负载渲染模型颜色
 */

import * as THREE from 'three';

const PERFORMANCE_COLORS = [
  0xFF0000,  // 夯爆了 (0-25 分)
  0xFF8C00,  // 紧张 (26-50 分)
  0xFFE500,  // 忙碌 (51-75 分)
  0x4A90E2,  // 空闲 (76-100 分)
];

const LEVEL_NAMES = ['夯爆了', '紧张', '忙碌', '空闲'];

class ColorRenderer {
  constructor(pet) {
    this.pet = pet;
    this.currentLevel = '空闲';
    this.currentColor = PERFORMANCE_COLORS[3];
  }
  
  getColorForLevel(level) {
    const index = LEVEL_NAMES.indexOf(level);
    if (index === -1) return PERFORMANCE_COLORS[4];
    return PERFORMANCE_COLORS[index];
  }
  
  updateColor(level) {
    if (level === this.currentLevel) return;
    
    this.currentLevel = level;
    const targetColor = this.getColorForLevel(level);
    this.currentColor = targetColor;
    this.applyColor(targetColor);
  }
  
  applyColor(color) {
    const targetColor = new THREE.Color(color);
    const applyToMesh = (mesh) => {
      if (!mesh) return;
      if (mesh.material && mesh.material.color) {
        mesh.material.color.lerp(targetColor, 0.9);
      }
      if (mesh.children) {
        mesh.children.forEach(child => applyToMesh(child));
      }
    };
    applyToMesh(this.pet);
  }
  

  colorToHex(color) {
    return '#' + color.toString(16).padStart(6, '0').toUpperCase();
  }
  

  getCurrentLevel() {
    return this.currentLevel;
  }
  

  getCurrentColor() {
    return this.currentColor;
  }
}

export { ColorRenderer, PERFORMANCE_COLORS, LEVEL_NAMES };
