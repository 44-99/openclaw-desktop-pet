// renderer/js/model-loader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * GLB 模型加载器封装类
 * 基于 Three.js 官方 GLTFLoader 文档
 * @see https://threejs.org/docs/#examples/en/loaders/GLTFLoader
 */
export class ModelLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.currentColor = 0xB0C4DE; // 默认浅蓝色（系统空闲状态颜色）
    this.materialsCache = []; // 缓存原始材质，用于恢复
  }

  /**
   * 异步加载 GLB 模型
   * @param {string} url - 模型文件路径（相对于 index.html）
   * @returns {Promise<THREE.Group>} - 加载完成的模型
   */
  async load(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          console.log('✅ 模型加载成功:', url);
          console.log('📦 GLB 数据结构:', {
            scenes: gltf.scenes?.length,
            scene: gltf.scene,
            animations: gltf.animations?.length,
            cameras: gltf.cameras?.length,
            nodes: gltf.nodes?.length,
            meshes: gltf.meshes?.length,
            materials: gltf.materials?.length,
            textures: gltf.textures?.length,
            images: gltf.images?.length
          });
          resolve(gltf);
        },
        (progress) => {
          // 加载进度回调
          if (progress.total > 0) {
            const percent = ((progress.loaded / progress.total) * 100).toFixed(1);
            console.log(`📥 加载进度：${percent}%`);
          }
        },
        (error) => {
          // 错误处理
          console.error('❌ 模型加载失败:', error);
          console.error('📁 检查文件路径:', url);
          reject(error);
        }
      );
    });
  }

  /**
   * 设置模型属性（缩放、位置、阴影、颜色）
   * @param {THREE.Group} gltf - GLTF 加载结果
   * @param {Object} options - 配置选项
   * @returns {THREE.Group} - 设置完成的模型
   */
  setup(gltf, options = {}) {
    const {
      scale = 1,
      position = { x: 0, y: 0, z: 0 },
      rotation = { x: 0, y: 0, z: 0 },
      color = null,  // 新增：自定义颜色覆盖
      useFlatColor = false  // 新增：是否使用纯色覆盖（忽略纹理）
    } = options;
    
    const model = gltf.scene;
    
    // 设置缩放
    model.scale.set(scale, scale, scale);
    
    // 设置位置
    model.position.set(position.x, position.y, position.z);
    
    // 设置旋转（弧度制）
    model.rotation.set(rotation.x, rotation.y, rotation.z);
    
    // 遍历所有子对象，应用材质和阴影
    this.materialsCache = [];
    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        
        // 如果是蒙皮网格（带骨骼），确保材质正确
        if (node.isSkinnedMesh && node.material) {
          node.material.skinning = true;
        }
        
        // 如果指定了颜色，应用颜色覆盖
        if (useFlatColor || color) {
          const targetColor = color || this.currentColor;
          
          if (node.material) {
            // 缓存原始材质（第一次遍历时）
            if (!this.materialsCache.includes(node.material)) {
              this.materialsCache.push(node.material);
            }
            
            // 应用新颜色
            if (node.material.color) {
              node.material.color.setHex(targetColor);
            }
            
            // 如果是标准材质，调整金属度和粗糙度以获得更好的纯色效果
            if (useFlatColor) {
              node.material.metalness = 0.3;
              node.material.roughness = 0.7;
              node.material.emissive = new THREE.Color(targetColor);
              node.material.emissiveIntensity = 0.1;
            }
          }
        }
      }
    });
    
    if (color) {
      this.currentColor = color;
    }
    
    console.log('⚙️ 模型设置完成:', {
      scale: model.scale,
      position: model.position,
      rotation: model.rotation,
      color: color ? '#' + color.toString(16).padStart(6, '0') : '使用模型自带纹理'
    });
    
    return model;
  }

  /**
   * 动态修改模型颜色
   * @param {THREE.Group} model - 模型引用
   * @param {number} colorHex - 颜色值（16 进制）
   * @param {boolean} useFlatColor - 是否使用纯色覆盖
   */
  setColor(model, colorHex, useFlatColor = false) {
    if (!model) {
      console.warn('⚠️ 模型未加载，无法设置颜色');
      return;
    }
    
    this.currentColor = colorHex;
    
    model.traverse((node) => {
      if (node.isMesh && node.material) {
        if (node.material.color) {
          node.material.color.setHex(colorHex);
        }
        
        if (useFlatColor) {
          node.material.metalness = 0.3;
          node.material.roughness = 0.7;
          if (node.material.emissive) {
            node.material.emissive = new THREE.Color(colorHex);
            node.material.emissiveIntensity = 0.1;
          }
        }
      }
    });
    
    console.log('🎨 模型颜色已更新:', '#' + colorHex.toString(16).padStart(6, '0'));
  }

  /**
   * 恢复模型原始纹理
   * @param {THREE.Group} model - 模型引用
   */
  restoreOriginalMaterials(model) {
    if (!model) {
      console.warn('⚠️ 模型未加载，无法恢复材质');
      return;
    }
    
    // 这个功能需要更复杂的材质缓存机制
    // 简单版本：重新加载模型
    console.log('🔄 恢复原始材质需要重新加载模型');
  }

  /**
   * 获取当前颜色
   * @returns {number} 当前颜色值（16 进制）
   */
  getCurrentColor() {
    return this.currentColor;
  }

  /**
   * 检查文件是否存在（调试用）
   */
  async checkFileExists(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}
