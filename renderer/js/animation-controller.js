// renderer/js/animation-controller.js
import * as THREE from 'three';

/**
 * GLB 动画控制器
 * 基于 Three.js 官方 AnimationMixer 和 AnimationAction API
 * @see https://threejs.org/docs/#api/en/animation/AnimationMixer
 * @see https://threejs.org/docs/#api/en/animation/AnimationAction
 */
export class AnimationController {
  /**
   * @param {THREE.Group} gltf - GLTF 加载结果
   * @param {THREE.Group} model - 3D 模型对象
   */
  constructor(gltf, model) {
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    this.currentAction = null;
    this.availableAnimations = [];
    
    // 加载所有动画
    if (gltf.animations && gltf.animations.length > 0) {
      gltf.animations.forEach((clip) => {
        // 为每个动画创建 Action
        const action = this.mixer.clipAction(clip);
        
        // 存储动画名称（去除可能的 "Armature|" 前缀）
        const cleanName = clip.name.replace(/^[^|]*\|/, '');
        this.actions[cleanName] = action;
        this.availableAnimations.push(cleanName);
        
      });
      
    } else {
      console.warn('⚠️ 模型没有动画数据，请检查 GLB 导出设置');
    }
  }

  /**
   * 播放指定动画
   * @param {string} name - 动画名称
   * @param {number} fadeIn - 淡入时间（秒）
   * @param {boolean} loop - 是否循环
   */
  play(name, fadeIn = 0.3, loop = true) {
    if (!this.actions[name]) {
      console.warn(`⚠️ 动画不存在：${name}`);
      return;
    }

    const newAction = this.actions[name];
    
    // 如果当前正在播放其他动画，淡出
    if (this.currentAction && this.currentAction !== newAction) {
      this.currentAction.fadeOut(fadeIn);
    }
    
    // 重置并播放新动画
    newAction.reset();
    newAction.setEffectiveTimeScale(1);
    newAction.setEffectiveWeight(1);
    
    // 设置循环模式
    if (loop) {
      newAction.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      newAction.setLoop(THREE.LoopOnce, 1);
      newAction.clampWhenFinished = true; // 结束后保持最后一帧
    }
    
    newAction.fadeIn(fadeIn);
    newAction.play();
    
    this.currentAction = newAction;
  }

  /**
   * 停止当前动画
   * @param {number} fadeOut - 淡出时间（秒）
   */
  stop(fadeOut = 0.3) {
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeOut);
      this.currentAction = null;
    }
  }

  /**
   * 在渲染循环中调用，更新动画状态
   * @param {number} delta - 时间间隔（秒）
   */
  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  /**
   * 获取所有可用动画名称
   * @returns {string[]}
   */
  getAvailableAnimations() {
    return this.availableAnimations;
  }
}
