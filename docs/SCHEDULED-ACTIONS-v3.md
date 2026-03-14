# 🦞 哈基虾定时动作系统 v3.0

## ✨ 功能总览

### 1. 静态 Idle 状态
- **镜头轻微浮动**：Z 轴 ±0.15 单位正弦波运动
- **呼吸光晕**：Fresnel 边缘光效果，红色脉冲
- **漂浮微光**：20 个彩色粒子缓慢漂浮
- **无特效触发**：保持安静，不干扰用户

### 2. 定时动作（15 秒间隔）
- **顺时针旋转** + 星光轨迹 + 旋转光环
- **逆时针旋转** + 星光轨迹 + 旋转光环
- **跳跃** + 拖尾粒子 + 落地冲击波

### 3. 手动交互
- **左键拖动**：移动窗口
- **左键单击**：生成话题
- **右键拖动**：旋转模型（无特效，纯手动）
- **右键菜单**：删除"360° 查看我"，保留其他功能

---

## 🎨 设计理念

### 镜头浮动（Camera Float）
```javascript
// 静态时的呼吸感
cameraFloatTime += delta * 0.5;
cameraFloatOffset = Math.sin(cameraFloatTime) * 0.15;
camera.position.z = cameraBaseZ + cameraFloatOffset;
```

**效果**：
- 镜头在 Z 轴 ±0.15 单位范围内缓慢浮动
- 周期约 12.5 秒（0.5 弧度/秒）
- 创造"活着"的感觉，不是僵硬的静态

### 定时动作间隔
```javascript
const ACTION_INTERVAL = 15000; // 15 秒
```

**为什么是 15 秒？**
- 太短（<5 秒）：干扰用户，视觉疲劳
- 太长（>30 秒）：缺乏存在感
- 15 秒：恰到好处，既有存在感又不打扰

### 防重复机制
```javascript
let isActionInProgress = false;

if (!isActionInProgress && now - lastActionTime > ACTION_INTERVAL) {
  triggerScheduledAction();
  lastActionTime = now;
}
```

**确保**：
- 动作进行中不触发新动作
- 时间到后自动触发
- 用户交互（右键旋转）不受影响

---

## 🎬 动作详情

### 1. 顺时针旋转（rotateCW）
```javascript
pet.rotation.y += 0.15;  // 每帧 0.15 弧度
// 42 帧 ≈ 360°
```

**特效**：
- ⭐ 星光轨迹：80 个金黄色粒子环绕
- 💫 旋转光环：金色光环扩大并旋转
- **持续时间**：2 秒

### 2. 逆时针旋转（rotateCCW）
```javascript
pet.rotation.y -= 0.15;  // 负方向
```

**特效**：同顺时针旋转

### 3. 跳跃（jump）
```javascript
pet.position.y = Math.sin(jumpProgress) * 0.3;
// 抛物线轨迹
```

**特效**：
- 💖 拖尾粒子：粉紫色粒子 trail
- 🌊 落地冲击波：地面环形波纹
- **持续时间**：1.5 秒

---

## 🎯 粒子特效系统

### 特效层级

| 状态 | 特效 | 粒子数 | 持续时间 |
|------|------|--------|---------|
| **Idle** | 呼吸光晕 + 漂浮微光 | ~20 | 永久 |
| **旋转** | 星光轨迹 + 旋转光环 | ~80 | 2 秒 |
| **跳跃** | 拖尾粒子 + 冲击波 | ~40 | 1.5 秒 |

### 性能优化

```javascript
// 使用 Points 而非 Mesh（减少 Draw Calls）
const material = new THREE.PointsMaterial({
  size: 0.3,
  vertexColors: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

// 生命周期管理
update(delta) {
  this.activeParticles = this.activeParticles.filter(particle => {
    const alive = particle.update(delta);
    if(!alive) particle.dispose();
    return alive;
  });
}
```

---

## 📊 代码架构

### 文件结构
```
renderer/js/
├── app.js                        # 主逻辑
├── particle-system-enhanced.js   # ⭐ 增强粒子系统
├── particle-system.js            # 原有粒子系统（保留兼容）
└── ...
```

### 关键函数

#### 1. triggerScheduledAction()
```javascript
// 定时触发器（15 秒间隔）
function triggerScheduledAction() {
  if (!pet || isActionInProgress) return;
  
  const actions = ['rotateCW', 'rotateCCW', 'jump'];
  const action = actions[Math.random() * actions.length];
  
  particleManager.triggerEffect(action, pet.position);
  // 执行动作...
}
```

#### 2. animate()
```javascript
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  const time = Date.now() * 0.001;
  const now = Date.now();
  
  // 定时动作检测
  if (!isActionInProgress && now - lastActionTime > ACTION_INTERVAL) {
    triggerScheduledAction();
    lastActionTime = now;
  }
  
  // 镜头浮动
  cameraFloatTime += delta * 0.5;
  camera.position.z = cameraBaseZ + cameraFloatOffset;
  
  // 更新粒子
  particleManager.update(delta);
  
  renderer.render(scene, camera);
}
```

#### 3. ParticleSystemManagerEnhanced
```javascript
class ParticleSystemManagerEnhanced {
  triggerEffect(effectType, petPosition) {
    this.clearTemporary();
    
    switch(effectType) {
      case 'rotateCW':
        this.activeParticles.push(
          new StarTrailParticle(this.scene, petPosition, 1),
          new RotationRing(this.scene, petPosition, 1)
        );
        break;
      // ... 其他特效
    }
  }
  
  update(delta) {
    // 更新并清理过期粒子
  }
}
```

---

## 🎮 用户交互

### 左键操作
| 操作 | 效果 |
|------|------|
| **单击** (<200ms) | 生成话题 |
| **长按拖动** (>3px) | 移动窗口 |

### 右键操作
| 操作 | 效果 |
|------|------|
| **拖动** | 手动旋转模型（无特效） |
| **菜单** | 显示功能菜单（无"360° 查看我"） |

### 自动行为
| 间隔 | 行为 |
|------|------|
| **每帧** | 镜头浮动（±0.15 Z 轴） |
| **15 秒** | 随机动作（旋转/跳跃）+ 特效 |
| **永久** | Idle 特效（呼吸光晕 + 微光） |

---

## 🔧 配置参数

### 可调参数
```javascript
// 定时动作间隔
const ACTION_INTERVAL = 15000;  // 15 秒

// 镜头浮动
let cameraBaseZ = 5;             // 基础距离
let cameraFloatOffset = 0;       // 浮动偏移
let cameraFloatTime = 0;         // 浮动时间

// 旋转速度
pet.rotation.y += 0.15;          // 每帧 0.15 弧度
// 42 帧完成 360°

// 跳跃高度
pet.position.y = Math.sin(progress) * 0.3;  // 最大 0.3 单位
```

### 自定义建议

**更频繁的动作用**：
```javascript
const ACTION_INTERVAL = 8000;  // 8 秒
```

**更夸张的镜头浮动**：
```javascript
cameraFloatOffset = Math.sin(cameraFloatTime) * 0.3;  // ±0.3 单位
```

**更快的旋转**：
```javascript
pet.rotation.y += 0.25;  // 每帧 0.25 弧度
```

---

## 🐛 故障排查

### 动作不触发
1. 检查 `isActionInProgress` 标志
2. 确认 `particleManager` 已初始化
3. 查看 Console 日志是否有错误

### 镜头不浮动
1. 检查 `cameraBaseZ` 初始值
2. 确认 `animate()` 中更新了 `camera.position.z`
3. 验证 `clock.getDelta()` 返回值

### 特效不显示
1. 检查粒子系统是否导入
2. 确认 `triggerEffect()` 被调用
3. 查看 Console 是否有 Three.js 错误

---

## 📚 参考资料

- [Three.js Animation](https://threejs.org/docs/#manual/en/introduction/Animation-system)
- [Three.js Points](https://threejs.org/docs/#api/en/objects/Points)
- [Fresnel Shader](https://en.wikipedia.org/wiki/Fresnel_effect)
- [Particle System Tutorial](https://threejs.org/examples/#webgl_points_sprites)

---

**版本**: v3.0  
**更新日期**: 2026-03-15 01:50  
**作者**: 伯乐 (哈基虾 🦞)
