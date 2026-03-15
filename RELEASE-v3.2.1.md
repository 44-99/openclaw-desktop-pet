# v3.2.1 - 系统负载监控 + 工具事件解耦

**发布时间**: 2026-03-15 14:25 CST  
**分支**: `feature/model-import-v2`  
**提交**: `83e8942`

---

## 🎯 核心改进

### 1. 系统负载 → 颜色（4 级，不可覆盖）

**修复问题**：
- ❌ `color-renderer.js` 初始化颜色索引越界（`PERFORMANCE_COLORS[4]` → `PERFORMANCE_COLORS[3]`）
- ❌ Python 后端残留 `state_manager` 调用导致报错

**颜色映射**：
| 等级 | 分数 | 颜色 | Hex |
|------|------|------|-----|
| 空闲 | 76-100 | 浅蓝色 | `#B0C4DE` |
| 忙碌 | 51-75 | 黄色 | `#FFD700` |
| 紧张 | 26-50 | 橙色 | `#FF8C00` |
| 夯爆了 | 0-25 | 红色 | `#FF0000` |

---

### 2. 工具事件 → 动作 + 特效 + 气泡（不影响颜色）

**核心工具（4 个）**：
| 工具 | 气泡文案 | 动作 | 特效 |
|------|---------|------|------|
| read | "读文件中..." | wiggle | floating_glow |
| write | "写代码中..." | bounce | star_trail |
| edit | "编辑代码中..." | shake | spark |
| exec | "执行命令..." | stretch | code_rain（新增） |

**可选工具（2 个）**：
| 工具 | 气泡文案 | 动作 | 特效 |
|------|---------|------|------|
| web_fetch | "查资料中..." | spiral | aura_ring |
| browser | "操作浏览器..." | jump | trail |

**新增动作**：
- ✅ `nod` - 点头思考（适合无骨骼 GLB）
- ✅ `pulse` - 脉动（适合无骨骼 GLB）

**新增特效**：
- ✅ `CodeRainParticle` - 代码雨（exec 专用，白色/黄色/蓝色字符下落）

---

### 3. 📊 系统状态实时监控模式

**功能**：
- 右键菜单 → 点击"状态" → 进入实时监控模式
- 气泡实时显示：`💻 CPU: 15% | 内存：42% | 空闲`
- Python 后端每秒推送系统状态
- 用户操作后自动关闭（点击哈基虾/工具调用/其他菜单项）

**使用场景**：
- 监控系统负载时保持可见
- 长时间编译/渲染时实时查看
- 性能调优时持续观察

---

## 🧹 代码清理

**删除文件**：
- ❌ `python/states.py` - 5 级状态系统（冗余，已被 4 级性能等级替代）

**清理代码**：
- ❌ 删除 `server.py` 中 `state_manager` 调用
- ❌ 删除发送的 `state` 字段
- ✅ 简化 WebSocket 消息结构

---

## 📦 修改的文件

| 文件 | 改动 | 说明 |
|------|------|------|
| `python/states.py` | ❌ 删除 | 冗余状态系统 |
| `python/server.py` | 🔧 修改 | 删除 state_manager 调用 |
| `index.ts` | ✨ 新增 | 工具映射（CORE_TOOLS + OPTIONAL_TOOLS） |
| `electron/main.cjs` | ✨ 新增 | IPC 消息监听 + 转发 |
| `electron/preload.cjs` | ✨ 新增 | onGatewayEvent 桥接 |
| `renderer/js/app.js` | ✨ 新增 | handleToolCall + 监控模式 |
| `renderer/js/color-renderer.js` | 🐛 修复 | 初始化颜色索引 |
| `renderer/js/particle-system-enhanced.js` | ✨ 新增 | CodeRainParticle 类 |
| `renderer/js/model-loader.js` | - | 无改动 |

**统计**：
- 新增：+420 行
- 删除：-125 行
- 净增：+295 行

---

## 🎨 测试建议

### 1. 系统负载颜色
```bash
# 空闲状态（浅蓝色）
# 打开任务管理器，观察 CPU <20%

# 忙碌状态（黄色）
# 运行多个程序，CPU 30-50%

# 紧张状态（橙色）
# 运行大型程序，CPU 60-80%

# 夯爆了状态（红色）
# 压力测试，CPU >90%
```

### 2. 工具事件
```bash
# read 工具
# 在对话中让 AI 读取文件

# write 工具
# 让 AI 创建/修改文件

# exec 工具（代码雨特效）
# 让 AI 执行命令：ls, dir, npm install 等

# web_fetch 工具
# 让 AI 访问网页：https://example.com
```

### 3. 系统状态监控
```
1. 右键哈基虾 → 点击"状态"
2. 观察气泡实时显示 CPU/内存/负载
3. 点击哈基虾或执行工具 → 监控自动关闭
```

---

## 🚀 下一步计划

### v3.2.2（可选）
- [ ] 优化气泡位置（避免遮挡模型）
- [ ] 添加工具完成提示音
- [ ] 支持自定义气泡样式

### v3.3.0（MOD 系统）
- [ ] 主题切换 UI
- [ ] 3 个新主题（猫/狗/龙）
- [ ] 配置持久化

---

**发布说明**：
- ✅ 已推送到 GitHub：`feature/model-import-v2` 分支
- ⏳ 等待用户测试确认
- ⏳ 准备 PR 合并到 main 分支

---

_维护者：哈基虾 🦞_
_最后更新：2026-03-15 14:25_
