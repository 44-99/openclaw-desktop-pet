/**
 * 哈基虾增强粒子特效系统 v2.0
 * 
 * 特效类型：
 * - 旋转特效：星光轨迹 + 旋转光环
 * - 跳跃特效：拖尾粒子 + 落地冲击波
 * - 抖动特效：电火花 + 震动波纹
 * - Idle 特效：呼吸光晕 + 漂浮微光
 */

import * as THREE from 'three';

// ==================== 星光轨迹粒子 (旋转特效) ====================
class StarTrailParticle {
  constructor(scene, petPosition, rotationDirection = 1) {
    this.scene = scene;
    this.petPosition = petPosition;
    this.rotationDirection = rotationDirection; // 1=顺时针，-1=逆时针
    this.particleCount = 80;
    this.clock = new THREE.Clock();
    
    this.init();
  }
  
  init() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    const angles = new Float32Array(this.particleCount);
    const radiuses = new Float32Array(this.particleCount);
    
    // 金黄色到白色渐变
    const starColors = [
      new THREE.Color(0xffd700), // 金黄
      new THREE.Color(0xffec8b), // 淡金
      new THREE.Color(0xffffff), // 白色
    ];
    
    for(let i = 0; i < this.particleCount; i++) {
      const angle = (i / this.particleCount) * Math.PI * 2;
      const radius = 1.2 + Math.random() * 0.3;
      
      angles[i] = angle;
      radiuses[i] = radius;
      
      positions[i * 3] = this.petPosition.x + Math.cos(angle) * radius;
      positions[i * 3 + 1] = this.petPosition.y + Math.sin(angle) * radius * 0.3;
      positions[i * 3 + 2] = this.petPosition.z + Math.sin(angle) * radius;
      
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = Math.random() * 0.02 + 0.01;
      velocities[i * 3 + 2] = 0;
      
      const color = starColors[Math.floor(Math.random() * starColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      sizes[i] = Math.random() * 0.15 + 0.1;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
    geometry.setAttribute('radius', new THREE.BufferAttribute(radiuses, 1));
    
    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      map: this.createStarTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
    
    this.velocities = velocities;
    this.lifetime = 2000;
    this.birthTime = Date.now();
  }
  
  createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 220, 100, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    
    return new THREE.CanvasTexture(canvas);
  }
  
  update(delta) {
    const positions = this.particleSystem.geometry.attributes.position.array;
    const angles = this.particleSystem.geometry.attributes.angle.array;
    
    for(let i = 0; i < this.particleCount; i++) {
      angles[i] += 0.05 * this.rotationDirection * delta * 60;
      
      positions[i * 3] = this.petPosition.x + Math.cos(angles[i]) * radiuses[i];
      positions[i * 3 + 1] += this.velocities[i * 3 + 1];
      positions[i * 3 + 2] = this.petPosition.z + Math.sin(angles[i]) * radiuses[i];
    }
    
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    this.particleSystem.geometry.attributes.angle.needsUpdate = true;
    
    const age = Date.now() - this.birthTime;
    if(age > this.lifetime) return false;
    
    const remaining = 1 - (age / this.lifetime);
    this.particleSystem.material.opacity = remaining * 0.95;
    
    return true;
  }
  
  dispose() {
    this.scene.remove(this.particleSystem);
    this.particleSystem.geometry.dispose();
    this.particleSystem.material.dispose();
  }
}

// ==================== 旋转光环 (旋转特效) ====================
class RotationRing {
  constructor(scene, petPosition, direction = 1) {
    this.scene = scene;
    this.petPosition = petPosition;
    this.direction = direction;
    this.clock = new THREE.Clock();
    
    this.init();
  }
  
  init() {
    const geometry = new THREE.TorusGeometry(1.5, 0.08, 16, 100);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    
    this.ring = new THREE.Mesh(geometry, material);
    this.ring.position.copy(this.petPosition);
    this.ring.rotation.x = Math.PI / 2;
    this.scene.add(this.ring);
    
    this.lifetime = 1500;
    this.birthTime = Date.now();
    this.rotationSpeed = 3 * this.direction;
  }
  
  update(delta) {
    this.ring.rotation.z += this.rotationSpeed * delta;
    this.ring.scale.lerp(new THREE.Vector3(1.3, 1.3, 1.3), 0.05);
    
    const age = Date.now() - this.birthTime;
    if(age > this.lifetime) return false;
    
    const remaining = 1 - (age / this.lifetime);
    this.ring.material.opacity = remaining * 0.8;
    
    return true;
  }
  
  dispose() {
    this.scene.remove(this.ring);
    this.ring.geometry.dispose();
    this.ring.material.dispose();
  }
}

// ==================== 拖尾粒子 (跳跃特效) ====================
class TrailParticle {
  constructor(scene, startPosition) {
    this.scene = scene;
    this.startPosition = startPosition;
    this.particleCount = 40;
    this.clock = new THREE.Clock();
    
    this.init();
  }
  
  init() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    
    const trailColors = [
      new THREE.Color(0xff69b4),
      new THREE.Color(0xff1493),
      new THREE.Color(0x9370db),
    ];
    
    for(let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = this.startPosition.x + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = this.startPosition.y + i * 0.05;
      positions[i * 3 + 2] = this.startPosition.z + (Math.random() - 0.5) * 0.3;
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.01;
      velocities[i * 3 + 1] = -Math.random() * 0.02 - 0.01;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
      
      const color = trailColors[Math.floor(Math.random() * trailColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      sizes[i] = Math.random() * 0.2 + 0.1;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      map: this.createSoftCircleTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
    
    this.velocities = velocities;
    this.lifetime = 1500;
    this.birthTime = Date.now();
  }
  
  createSoftCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 100, 200, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 100, 200, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    
    return new THREE.CanvasTexture(canvas);
  }
  
  update() {
    const positions = this.particleSystem.geometry.attributes.position.array;
    
    for(let i = 0; i < this.particleCount; i++) {
      positions[i * 3] += this.velocities[i * 3];
      positions[i * 3 + 1] += this.velocities[i * 3 + 1];
      positions[i * 3 + 2] += this.velocities[i * 3 + 2];
    }
    
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    
    const age = Date.now() - this.birthTime;
    if(age > this.lifetime) return false;
    
    const remaining = 1 - (age / this.lifetime);
    this.particleSystem.material.opacity = remaining * 0.7;
    
    return true;
  }
  
  dispose() {
    this.scene.remove(this.particleSystem);
    this.particleSystem.geometry.dispose();
    this.particleSystem.material.dispose();
  }
}

// ==================== 落地冲击波 (跳跃特效) ====================
class ShockwaveParticle {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position;
    this.clock = new THREE.Clock();
    
    this.init();
  }
  
  init() {
    const geometry = new THREE.RingGeometry(0.1, 0.2, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff69b4,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    
    this.ring = new THREE.Mesh(geometry, material);
    this.ring.position.copy(this.position);
    this.ring.position.y = -1.5;
    this.ring.rotation.x = Math.PI / 2;
    this.scene.add(this.ring);
    
    this.lifetime = 800;
    this.birthTime = Date.now();
  }
  
  update(delta) {
    const scale = 1 + (Date.now() - this.birthTime) / 200;
    this.ring.scale.set(scale, scale, scale);
    
    const age = Date.now() - this.birthTime;
    if(age > this.lifetime) return false;
    
    const remaining = 1 - (age / this.lifetime);
    this.ring.material.opacity = remaining * 0.8;
    
    return true;
  }
  
  dispose() {
    this.scene.remove(this.ring);
    this.ring.geometry.dispose();
    this.ring.material.dispose();
  }
}

// ==================== 呼吸光晕 (Idle 特效) ====================
class AuraParticle {
  constructor(scene, petPosition, color = 0xff4444) {
    this.scene = scene;
    this.petPosition = petPosition;
    this.baseColor = new THREE.Color(color);
    this.clock = new THREE.Clock();
    
    this.init();
  }
  
  init() {
    const geometry = new THREE.SphereGeometry(1.8, 32, 32);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: this.baseColor },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          float pulse = sin(time * 2.0) * 0.3 + 0.7;
          gl_FragColor = vec4(color * pulse, intensity * 0.4);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    this.aura = new THREE.Mesh(geometry, material);
    this.aura.position.copy(this.petPosition);
    this.scene.add(this.aura);
  }
  
  update(delta) {
    this.aura.material.uniforms.time.value += delta;
    return true;
  }
  
  dispose() {
    this.scene.remove(this.aura);
    this.aura.geometry.dispose();
    this.aura.material.dispose();
  }
}

// ==================== 漂浮微光 (Idle 特效) ====================
class FloatingGlowParticle {
  constructor(scene, petPosition) {
    this.scene = scene;
    this.petPosition = petPosition;
    this.particleCount = 20;
    this.clock = new THREE.Clock();
    
    this.init();
  }
  
  init() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    const phases = new Float32Array(this.particleCount);
    const speeds = new Float32Array(this.particleCount);
    
    const glowColors = [
      new THREE.Color(0xff69b4),
      new THREE.Color(0x87ceeb),
      new THREE.Color(0xdda0dd),
    ];
    
    for(let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = this.petPosition.x + (Math.random() - 0.5) * 2.5;
      positions[i * 3 + 1] = this.petPosition.y + (Math.random() - 0.5) * 2.5;
      positions[i * 3 + 2] = this.petPosition.z + (Math.random() - 0.5) * 1.5 + 1;
      
      const color = glowColors[Math.floor(Math.random() * glowColors.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      sizes[i] = Math.random() * 0.15 + 0.05;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = Math.random() * 0.5 + 0.5;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
    
    const material = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      map: this.createGlowTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
    
    this.phases = phases;
    this.speeds = speeds;
    this.initialPositions = positions.slice();
  }
  
  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    
    return new THREE.CanvasTexture(canvas);
  }
  
  update(delta) {
    const positions = this.particleSystem.geometry.attributes.position.array;
    const time = this.clock.getElapsedTime();
    
    for(let i = 0; i < this.particleCount; i++) {
      const phase = this.phases[i];
      const speed = this.speeds[i];
      
      positions[i * 3] = this.initialPositions[i * 3] + Math.sin(time * speed + phase) * 0.3;
      positions[i * 3 + 1] = this.initialPositions[i * 3 + 1] + Math.cos(time * speed + phase) * 0.3;
      positions[i * 3 + 2] = this.initialPositions[i * 3 + 2] + Math.sin(time * speed + phase) * 0.2;
    }
    
    this.particleSystem.geometry.attributes.position.needsUpdate = true;
    
    return true;
  }
  
  dispose() {
    this.scene.remove(this.particleSystem);
    this.particleSystem.geometry.dispose();
    this.particleSystem.material.dispose();
  }
}

// ==================== 粒子系统管理器 (增强版) ====================
class ParticleSystemManagerEnhanced {
  constructor(scene) {
    this.scene = scene;
    this.activeParticles = [];
    this.auraParticle = null;
    this.glowParticle = null;
  }
  
  triggerEffect(effectType, petPosition) {
    this.clearTemporary();
    
    switch(effectType) {
      case 'rotateCW':
        this.activeParticles.push(new StarTrailParticle(this.scene, petPosition, 1));
        this.activeParticles.push(new RotationRing(this.scene, petPosition, 1));
        break;
        
      case 'rotateCCW':
        this.activeParticles.push(new StarTrailParticle(this.scene, petPosition, -1));
        this.activeParticles.push(new RotationRing(this.scene, petPosition, -1));
        break;
        
      case 'jump':
        this.activeParticles.push(new TrailParticle(this.scene, petPosition));
        this.activeParticles.push(new ShockwaveParticle(this.scene, petPosition));
        break;
        
      case 'idle':
        this.enableIdleEffects(petPosition);
        break;
    }
  }
  
  enableIdleEffects(petPosition) {
    if(!this.auraParticle) {
      this.auraParticle = new AuraParticle(this.scene, petPosition);
    }
    if(!this.glowParticle) {
      this.glowParticle = new FloatingGlowParticle(this.scene, petPosition);
    }
  }
  
  disableIdleEffects() {
    if(this.auraParticle) {
      this.auraParticle.dispose();
      this.auraParticle = null;
    }
    if(this.glowParticle) {
      this.glowParticle.dispose();
      this.glowParticle = null;
    }
  }
  
  clearTemporary() {
    this.activeParticles.forEach(particle => particle.dispose());
    this.activeParticles = [];
  }
  
  update(delta) {
    this.activeParticles = this.activeParticles.filter(particle => {
      const alive = particle.update(delta);
      if(!alive) {
        particle.dispose();
      }
      return alive;
    });
    
    if(this.auraParticle) this.auraParticle.update(delta);
    if(this.glowParticle) this.glowParticle.update(delta);
  }
  
  dispose() {
    this.clearTemporary();
    this.disableIdleEffects();
  }
}

// 导出原有粒子类（向后兼容）
export { HeartParticle, BubbleParticle, ConfettiParticle } from './particle-system.js';
export {
  StarTrailParticle,
  RotationRing,
  TrailParticle,
  ShockwaveParticle,
  AuraParticle,
  FloatingGlowParticle,
  ParticleSystemManagerEnhanced
};
