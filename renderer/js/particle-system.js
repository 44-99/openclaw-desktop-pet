/**
 * 哈基虾粒子特效系统
 * 
 * 实现三种粒子特效：
 * - 爱心 ❤️ (开心时)
 * - 气泡 💭 (思考时)
 * - 彩带 🎉 (兴奋时)
 */

import * as THREE from 'three';

// ==================== 爱心粒子 ====================
class HeartParticle {
  constructor(scene) {
    this.scene = scene;
    this.particleCount = 50;
    this.clock = new THREE.Clock();
    
    this.init();
  }
  
  /**
   * 爱心形状参数方程
   */
  getHeartPosition(t) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
    const z = 0;
    return new THREE.Vector3(x, y, z);
  }
  
  init() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const scales = new Float32Array(this.particleCount);
    const colors = new Float32Array(this.particleCount * 3);
    
    // 粉红色到红色渐变
    const heartColors = [
      new THREE.Color(0xff69b4), // 粉红
      new THREE.Color(0xff1493), // 深粉红
      new THREE.Color(0xdc143c), // 深红
    ];
    
    for(let i = 0; i < this.particleCount; i++) {
      // 在爱心形状上随机分布
      const t = Math.random() * Math.PI * 2;
      const pos = this.getHeartPosition(t);
      
      // 缩放爱心大小
      const scale = 0.05;
      positions[i * 3] = pos.x * scale;
      positions[i * 3 + 1] = pos.y * scale;
      positions[i * 3 + 2] = pos.z;
      
      // 向上飘的速度
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = Math.random() * 0.05 + 0.02; // 向上
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      
      // 随机大小
      scales[i] = Math.random() * 0.5 + 0.5;
      
      // 随机颜色
      const color = heartColors[Math.floor(Math.random() * heartColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // 创建爱心纹理
    const texture = this.createHeartTexture();
    
    const material = new THREE.PointsMaterial({
      size: 0.3,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
    
    // 存储速度数据
    this.velocities = velocities;
    this.scales = scales;
    
    // 生命周期
    this.lifetime = 3000; // 3 秒
    this.birthTime = Date.now();
  }
  
  createHeartTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // 绘制爱心
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const topCurveHeight = 64 * 0.3;
    ctx.moveTo(32, 32);
    ctx.bezierCurveTo(32, topCurveHeight, 0, topCurveHeight, 0, 32);
    ctx.bezierCurveTo(0, 56, 32, 64, 32, 64);
    ctx.bezierCurveTo(32, 64, 64, 56, 64, 32);
    ctx.bezierCurveTo(64, topCurveHeight, 32, topCurveHeight, 32, 32);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
  
  update() {
    const positions = this.particleSystem.geometry.attributes.position.array;
    const time = this.clock.getElapsedTime();
    
    for(let i = 0; i < this.particleCount; i++) {
      // 更新位置
      positions[i * 3] += this.velocities[i * 3];
      positions[i * 3 + 1] += this.velocities[i * 3 + 1];
      positions[i * 3 + 2] += this.velocities[i * 3 + 2];
      
      // 添加波动效果
      positions[i * 3] += Math.sin(time * 2 + i) * 0.005;
      
      // 如果飘出屏幕，重置到底部
      if(positions[i * 3 + 1] > 5) {
        positions[i * 3 + 1] = -2;
      }
    }
    
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    
    // 检查生命周期
    const age = Date.now() - this.birthTime;
    if(age > this.lifetime) {
      return false; // 粒子系统应该被销毁
    }
    
    // 逐渐淡出
    const remaining = 1 - (age / this.lifetime);
    this.particleSystem.material.opacity = remaining * 0.9;
    
    return true; // 继续存在
  }
  
  dispose() {
    this.scene.remove(this.particleSystem);
    this.particleSystem.geometry.dispose();
    this.particleSystem.material.dispose();
  }
}

// ==================== 气泡粒子 ====================
class BubbleParticle {
  constructor(scene, petPosition) {
    this.scene = scene;
    this.petPosition = petPosition;
    this.particleCount = 30;
    this.clock = new THREE.Clock();
    
    this.init();
  }
  
  init() {
    // 使用圆形纹理作为气泡
    const texture = this.createBubbleTexture();
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    
    for(let i = 0; i < this.particleCount; i++) {
      // 从宠物头部位置生成
      positions[i * 3] = this.petPosition.x + (Math.random() - 0.5) * 1;
      positions[i * 3 + 1] = this.petPosition.y + 1 + Math.random() * 0.5;
      positions[i * 3 + 2] = this.petPosition.z + (Math.random() - 0.5) * 1;
      
      // 缓慢上升
      velocities[i * 3] = (Math.random() - 0.5) * 0.01;
      velocities[i * 3 + 1] = Math.random() * 0.03 + 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
      
      sizes[i] = Math.random() * 0.3 + 0.2;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
      size: 0.5,
      map: texture,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    
    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
    
    this.velocities = velocities;
    
    // 生命周期
    this.lifetime = 4000; // 4 秒
    this.birthTime = Date.now();
  }
  
  createBubbleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // 绘制渐变圆形（气泡效果）
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(150, 180, 255, 0.1)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    
    // 添加高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(24, 24, 8, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
  
  update() {
    const positions = this.particleSystem.geometry.attributes.position.array;
    
    for(let i = 0; i < this.particleCount; i++) {
      positions[i * 3] += this.velocities[i * 3];
      positions[i * 3 + 1] += this.velocities[i * 3 + 1];
      positions[i * 3 + 2] += this.velocities[i * 3 + 2];
      
      // 超出范围重置
      if(positions[i * 3 + 1] > this.petPosition.y + 3) {
        positions[i * 3 + 1] = this.petPosition.y + 1;
      }
    }
    
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    
    // 检查生命周期
    const age = Date.now() - this.birthTime;
    if(age > this.lifetime) {
      return false;
    }
    
    // 逐渐淡出
    const remaining = 1 - (age / this.lifetime);
    this.particleSystem.material.opacity = remaining * 0.6;
    
    return true;
  }
  
  dispose() {
    this.scene.remove(this.particleSystem);
    this.particleSystem.geometry.dispose();
    this.particleSystem.material.dispose();
  }
}

// ==================== 彩带粒子 ====================
class ConfettiParticle {
  constructor(scene) {
    this.scene = scene;
    this.particleCount = 200;
    this.clock = new THREE.Clock();
    
    this.init();
  }
  
  init() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const rotations = new Float32Array(this.particleCount);
    const rotationSpeeds = new Float32Array(this.particleCount);
    
    // 彩带颜色
    const confettiColors = [
      new THREE.Color(0xff0000), // 红
      new THREE.Color(0x00ff00), // 绿
      new THREE.Color(0x0000ff), // 蓝
      new THREE.Color(0xffff00), // 黄
      new THREE.Color(0xff00ff), // 紫
      new THREE.Color(0x00ffff), // 青
    ];
    
    for(let i = 0; i < this.particleCount; i++) {
      // 从顶部随机位置
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = Math.random() * 10 + 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      
      // 下落速度 + 飘动
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = -Math.random() * 0.05 - 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      
      // 随机颜色
      const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      // 旋转
      rotations[i] = Math.random() * Math.PI;
      rotationSpeeds[i] = (Math.random() - 0.5) * 0.1;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
    geometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    
    const material = new THREE.PointsMaterial({
      size: 0.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: this.createSquareTexture(),
      alphaTest: 0.001,
      depthWrite: false,
    });
    
    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
    
    this.velocities = velocities;
    this.rotations = rotations;
    this.rotationSpeeds = rotationSpeeds;
    
    // 生命周期
    this.lifetime = 5000; // 5 秒
    this.birthTime = Date.now();
  }
  
  createSquareTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
  }
  
  update() {
    const positions = this.particleSystem.geometry.attributes.position.array;
    const rotations = this.particleSystem.geometry.attributes.rotation.array;
    
    for(let i = 0; i < this.particleCount; i++) {
      // 更新位置
      positions[i * 3] += this.velocities[i * 3];
      positions[i * 3 + 1] += this.velocities[i * 3 + 1];
      positions[i * 3 + 2] += this.velocities[i * 3 + 2];
      
      // 添加飘动效果
      positions[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.01;
      
      // 更新旋转
      rotations[i] += this.rotationSpeeds[i];
      
      // 超出底部重置到顶部
      if(positions[i * 3 + 1] < -5) {
        positions[i * 3 + 1] = 10;
      }
    }
    
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    this.particleSystem.geometry.attributes.rotation.needsUpdate = true;
    
    // 检查生命周期
    const age = Date.now() - this.birthTime;
    if(age > this.lifetime) {
      return false;
    }
    
    // 逐渐淡出
    const remaining = 1 - (age / this.lifetime);
    this.particleSystem.material.opacity = remaining * 0.9;
    
    return true;
  }
  
  dispose() {
    this.scene.remove(this.particleSystem);
    this.particleSystem.geometry.dispose();
    this.particleSystem.material.dispose();
  }
}

// ==================== 粒子系统管理器 ====================
class ParticleSystemManager {
  constructor(scene) {
    this.scene = scene;
    this.activeParticles = [];
  }
  
  /**
   * 根据情绪触发粒子特效
   */
  triggerEffect(emotion, petPosition) {
    // 清除旧粒子
    this.clearAll();
    
    let particle;
    
    switch(emotion) {
      case 'happy':
        particle = new HeartParticle(this.scene);
        break;
      case 'excited':
        particle = new ConfettiParticle(this.scene);
        break;
      case 'idle':
      case 'thinking':
        if(petPosition) {
          particle = new BubbleParticle(this.scene, petPosition);
        }
        break;
      default:
        return;
    }
    
    if(particle) {
      this.activeParticles.push(particle);
    }
  }
  
  /**
   * 更新所有粒子
   */
  update() {
    // 更新并过滤存活的粒子
    this.activeParticles = this.activeParticles.filter(particle => {
      const alive = particle.update();
      if(!alive) {
        particle.dispose();
      }
      return alive;
    });
  }
  
  /**
   * 清除所有粒子
   */
  clearAll() {
    this.activeParticles.forEach(particle => particle.dispose());
    this.activeParticles = [];
  }
  
  /**
   * 清理资源
   */
  dispose() {
    this.clearAll();
  }
}

// 导出
export { HeartParticle, BubbleParticle, ConfettiParticle, ParticleSystemManager };
