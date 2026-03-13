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
   * 设置模型属性（缩放、位置、阴影）
   * @param {THREE.Group} gltf - GLTF 加载结果
   * @param {Object} options - 配置选项
   * @returns {THREE.Group} - 设置完成的模型
   */
  setup(gltf, options = {}) {
    const {
      scale = 1,
      position = { x: 0, y: 0, z: 0 },
      rotation = { x: 0, y: 0, z: 0 }
    } = options;
    
    const model = gltf.scene;
    
    // 设置缩放
    model.scale.set(scale, scale, scale);
    
    // 设置位置
    model.position.set(position.x, position.y, position.z);
    
    // 设置旋转（弧度制）
    model.rotation.set(rotation.x, rotation.y, rotation.z);
    
    // 启用阴影（遍历所有子对象）
    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        
        // 如果是蒙皮网格（带骨骼），确保材质正确
        if (node.isSkinnedMesh && node.material) {
          node.material.skinning = true;
        }
      }
    });
    
    console.log('⚙️ 模型设置完成:', {
      scale: model.scale,
      position: model.position,
      rotation: model.rotation
    });
    
    return model;
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
