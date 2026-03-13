# 🦞 哈基虾桌面宠物 v2.0 - 模型导入架构升级

> **分支**: `feature/model-import-v2`  
> **创建时间**: 2026-03-14  
> **目标**: 从 Three.js 手搓 → GLB/FBX 模型加载，支持 AI 生成模型导入

---

## 🎯 核心目标

### 当前痛点 (v1.x)
- ❌ Three.js 手搓模型调整效率低
- ❌ 美学效果依赖手工调试
- ❌ 动画系统简单（仅基础旋转/缩放）
- ❌ 每个部位手动搭建，复杂度高

### v2.0 解决方案
- ✅ 使用 **GLTFLoader** 加载 GLB/FBX 模型
- ✅ 使用 **AnimationMixer** 播放专业动画
- ✅ 支持 **AI 图片转 3D 模型**（Tripo3D 等工具）
- ✅ 用户可导入自定义角色模型
- ✅ 模型与交互逻辑分离，架构更清晰

---

## 🛠️ 技术架构

### 核心依赖

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@types/three": "^0.160.0"
  }
}
```

**Three.js 内置加载器**：
| 加载器 | 用途 | 格式 |
|--------|------|------|
| `GLTFLoader` | 主加载器（推荐） | .glb, .gltf |
| `FBXLoader` | 备选加载器 | .fbx |
| `OBJLoader` | 简单模型 | .obj |
| `DRACOLoader` | 压缩模型解码 | .drc |

### 文件结构

```
openclaw-desktop-pet/
├── electron/
│   ├── main.cjs                 # 不变
│   └── preload.cjs              # 不变
│
├── renderer/
│   ├── index.html               # 不变
│   ├── css/
│   │   └── style.css            # 不变
│   ├── models/                  # ⭐ 新增：模型文件夹
│   │   ├── lobster.glb         # 哈基虾主模型
│   │   ├── test-astronaut.glb  # 测试模型
│   │   └── characters/         # 用户自定义角色
│   │
│   └── js/
│       ├── app.js               # 重构：从手搓 → 加载器
│       ├── model-loader.js      # ⭐ 新增：模型加载封装
│       ├── animation-controller.js  # ⭐ 新增：动画状态机
│       ├── topic-generator.js   # 不变
│       ├── emotion-system.js    # 不变
│       └── inner-voice.js       # 不变
│
├── python/                      # 不变
├── index.ts                     # 不变
└── docs/
    └── MODEL-IMPORT-GUIDE.md    # ⭐ 本文件
```

---

## 🌐 AI 3D 模型生成工具推荐

### 免费/试用工具

| 工具 | 网址 | 免费额度 | 输出格式 | 备注 |
|------|------|---------|---------|------|
| **Tripo3D** | https://www.tripo3d.ai | 免费试用 | GLB, FBX, OBJ | 图片→3D，速度快 |
| **3DAI Studio** | https://www.3daistudio.com | 部分免费 | GLB, FBX | 多模型对比 |
| **Meshy** | https://www.meshy.ai | 免费额度 | GLB, FBX | 游戏级质量 |
| **Rodin AI** | https://rodin.deemos.com | 试用 | GLB, OBJ | 高质量 |
| **Spline** | https://spline.design/ai | 免费试用 | GLB, OBJ | 交互式编辑 |
| **Hitem3D** | https://www.hitem3d.ai | 免费 | GLB, STL | 无注册 |
| **ImageToSTL** | https://imagetostl.com | 免费 | STL, OBJ | 简单转换 |
| **Upsampler** | https://upsampler.com | 免费 | GLB | 无注册 |

### 推荐工作流

```
1. 准备哈基虾正面图/三视图 (PNG/JPG)
   ↓
2. 上传到 Tripo3D / Meshy / 3DAI Studio
   ↓
3. AI 生成 3D 模型 (等待 1-5 分钟)
   ↓
4. 下载 GLB 格式 (优先) 或 FBX/OBJ
   ↓
5. (可选) 用 Blender 修复/优化
   ↓
6. 放入 renderer/models/lobster.glb
   ↓
7. 修改 app.js 加载新模型
```

---

## 📝 实施计划

### 阶段 1: 技术验证 (1-2 天) ✅

**目标**: 用测试模型验证 GLTFLoader 流程

- [ ] 创建 `model-loader.js` 封装 GLTFLoader
- [ ] 创建 `animation-controller.js` 管理 AnimationMixer
- [ ] 下载测试模型 (如 astronaut.glb)
- [ ] 验证模型加载、显示、基础动画
- [ ] 保留现有交互逻辑（点击、拖动）

**验收标准**:
- 测试模型能正常显示在屏幕中央
- 滚轮缩放、鼠标拖动正常工作
- 点击模型有反馈（话题生成）

---

### 阶段 2: 哈基虾模型化 (3-7 天)

**目标**: 用 AI 工具生成哈基虾 GLB 模型

- [ ] 准备哈基虾参考图（正面、侧面、背面）
- [ ] 使用 Tripo3D / Meshy 生成初始模型
- [ ] (可选) Blender 修复拓扑/UV
- [ ] 添加简单动画（idle、wave、talk）
- [ ] 替换测试模型为哈基虾模型

**动画需求**:
| 动画名 | 描述 | 触发条件 |
|--------|------|---------|
| `idle` | 待机呼吸动画 | 默认状态 |
| `wave` | 挥手 | 用户点击 |
| `talk` | 说话嘴巴动 | 话题生成时 |
| `happy` | 开心跳动 | 积极情绪 |
| `sleep` | 闭眼休息 | 空闲时间长 |

---

### 阶段 3: 交互迁移 (2-3 天)

**目标**: 将现有交互逻辑迁移到新模型

- [ ] 射线检测点击（身体部位识别）
- [ ] 情绪系统对接（颜色 → 动画）
- [ ] 系统监控对接（CPU/内存 → 动画）
- [ ] 话题生成器保持不变
- [ ] 内心戏系统保持不变

---

### 阶段 4: 用户自定义 (扩展功能)

**目标**: 支持用户导入自己的模型

- [ ] 模型配置文件格式设计 (JSON)
- [ ] 模型导入 UI（选择 GLB 文件）
- [ ] 模型大小/位置调整工具
- [ ] 动画映射配置（模型动画 → 系统事件）
- [ ] 模型分享功能（可选）

**配置文件示例**:
```json
{
  "name": "哈基虾",
  "model": "models/lobster.glb",
  "scale": 1.3,
  "position": { "x": 0, "y": 0, "z": 0 },
  "animations": {
    "idle": "Armature|idle",
    "wave": "Armature|wave",
    "talk": "Armature|talk",
    "happy": "Armature|jump"
  },
  "clickZones": [
    { "name": "head", "bone": "Head", "action": "topic" },
    { "name": "claw", "bone": "Claw.L", "action": "wave" }
  ]
}
```

---

## 🔧 核心代码示例

### ModelLoader 封装

```javascript
// renderer/js/model-loader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelLoader {
  constructor() {
    this.loader = new GLTFLoader();
  }

  async loadModel(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          console.log('✅ 模型加载成功:', url);
          resolve(gltf);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`📥 加载进度: ${percent.toFixed(1)}%`);
        },
        (error) => {
          console.error('❌ 模型加载失败:', error);
          reject(error);
        }
      );
    });
  }

  setupModel(gltf, options = {}) {
    const { scale = 1, position = { x: 0, y: 0, z: 0 } } = options;
    
    const model = gltf.scene;
    model.scale.set(scale, scale, scale);
    model.position.set(position.x, position.y, position.z);
    
    // 启用阴影
    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    
    return model;
  }
}
```

### AnimationController

```javascript
// renderer/js/animation-controller.js
import * as THREE from 'three';

export class AnimationController {
  constructor(model) {
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.animations = {};
    this.currentAction = null;
    
    // 加载所有动画
    if (gltf.animations && gltf.animations.length) {
      gltf.animations.forEach((clip) => {
        const action = this.mixer.clipAction(clip);
        this.animations[clip.name] = action;
      });
      console.log('🎬 可用动画:', Object.keys(this.animations));
    }
  }

  play(animationName, fadeIn = 0.3) {
    if (!this.animations[animationName]) {
      console.warn(`⚠️ 动画不存在: ${animationName}`);
      return;
    }

    const newAction = this.animations[animationName];
    
    if (this.currentAction && this.currentAction !== newAction) {
      this.currentAction.fadeOut(fadeIn);
    }
    
    newAction.reset();
    newAction.setEffectiveTimeScale(1);
    newAction.setEffectiveWeight(1);
    newAction.fadeIn(fadeIn);
    newAction.play();
    
    this.currentAction = newAction;
    console.log(`🎭 播放动画: ${animationName}`);
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }
}
```

### App.js 集成

```javascript
// renderer/js/app.js (重构后)
import { ModelLoader } from './model-loader.js';
import { AnimationController } from './animation-controller.js';

async function init() {
  // Three.js 基础设置（相机、渲染器等）保持不变
  setupScene();
  setupCamera();
  setupRenderer();
  
  // ⭐ 加载模型
  const modelLoader = new ModelLoader();
  const gltf = await modelLoader.loadModel('models/lobster.glb');
  const pet = modelLoader.setupModel(gltf, {
    scale: 1.3,
    position: { x: 0, y: 0, z: 0 }
  });
  scene.add(pet);
  
  // ⭐ 初始化动画控制器
  const animController = new AnimationController(gltf, pet);
  animController.play('idle'); // 播放待机动画
  
  // 交互逻辑（射线检测、点击等）保持不变
  setupInteraction(pet);
  
  // 渲染循环
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    animController.update(delta); // ⭐ 更新动画
    renderer.render(scene, camera);
  }
  animate();
}
```

---

## ⚠️ 注意事项

### 模型优化
- **文件大小**: GLB < 5MB（网络加载）或 < 20MB（本地）
- **面数**: 建议 < 50k 三角面（桌面宠物不需要太高精度）
- **纹理**: 使用 1024x1024 或 2048x2048 贴图
- **动画**: 关键帧动画优先，避免骨骼过多

### 兼容性
- **GLB vs GLTF**: 优先使用 GLB（二进制，单文件）
- **FBX 支持**: 需要额外加载器，建议转 GLB
- **动画命名**: 确保动画名称在 Blender/导出时正确标记

### 调试技巧
- 使用 `console.log(gltf)` 查看模型结构
- 使用 Three.js Inspector Chrome 扩展
- 在 Blender 中预览动画再导出

---

## 📚 学习资源

| 资源 | 链接 | 类型 |
|------|------|------|
| Three.js GLTFLoader 文档 | https://threejs.org/docs/#examples/en/loaders/GLTFLoader | 官方文档 |
| AnimationMixer 教程 | https://threejs.org/docs/#api/en/animation/AnimationMixer | 官方文档 |
| GLB vs GLTF 区别 | https://www.khronos.org/gltf/ | 规范说明 |
| Blender 导出 GLB | https://www.blender.org/ | 3D 软件 |
| Tripo3D 使用教程 | https://www.tripo3d.ai/zh | AI 工具 |

---

## 🚀 快速开始

```bash
# 1. 切换到新分支
cd C:\Users\Administrator\.openclaw\extensions\openclaw-desktop-pet
git checkout feature/model-import-v2

# 2. 下载测试模型
# 从 https://github.com/KhronosGroup/glTF-Sample-Models 下载
# 推荐：https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/Astronaut/glTF-Binary

# 3. 放入 models 文件夹
mkdir renderer/models
# 将 Astronaut.glb 放入 renderer/models/test-astronaut.glb

# 4. 开始编码
# 按照上面代码示例创建 model-loader.js 和 animation-controller.js

# 5. 测试运行
npm run dev  # 或重启 OpenClaw
```

---

## 📊 进度追踪

| 阶段 | 状态 | 预计完成 | 实际完成 |
|------|------|---------|---------|
| 阶段 1: 技术验证 | 🔄 进行中 | 2026-03-15 | - |
| 阶段 2: 哈基虾模型化 | ⏳ 待开始 | 2026-03-20 | - |
| 阶段 3: 交互迁移 | ⏳ 待开始 | 2026-03-22 | - |
| 阶段 4: 用户自定义 | ⏳ 待开始 | 2026-03-30 | - |

---

**最后更新**: 2026-03-14  
**维护者**: 陈伯乐 (哈基虾) 🦞
