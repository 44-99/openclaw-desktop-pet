# 哈基虾桌面宠物 - OpenClaw Extension

> 🦞 3D 桌面宠物，深度集成 OpenClaw，实时显示 AI 状态

**最新版本**: v3.2.8 (2026-03-19)

---

## 📁 目录结构

```
openclaw-desktop-pet/
├── openclaw.plugin.json    # OpenClaw 插件配置
├── package.json            # NPM 配置
├── tsconfig.json           # TypeScript 配置
├── index.ts                # Extension 入口（TypeScript）
├── electron/
│   ├── main.cjs            # Electron 主进程（CommonJS）
│   └── preload.cjs         # 预加载脚本（IPC 桥接）
├── renderer/
│   ├── index.html          # 主界面（含 CSP 配置）
│   ├── css/
│   │   └── style.css       # 样式文件
│   └── js/
│       ├── app.js          # Three.js 主逻辑
│       ├── app-gateway-init.js  # Gateway 连接初始化
│       ├── model-loader.js      # GLB 模型加载器
│       ├── particle-system-enhanced.js  # 增强粒子系统
│       ├── tool-mappings.js       # 工具调用映射表
│       ├── topic-generator.js     # 话题生成器
│       ├── color-renderer.js      # 颜色渲染器（系统负载）
│       ├── inner-voice.js         # 内心戏管理器
│       └── gateway/
│           └── minimal-gateway-client.js  # 精简 Gateway 客户端
├── models/
│   └── gray_wolf.glb       # 默认 3D 模型（灰太狼）
├── python/
│   ├── server.py           # WebSocket 服务器（端口 8765）
│   └── monitor.py          # 系统监控（CPU/内存/温度）
└── assets/
    └── lobster.png         # 哈基虾图标
```

---

## 🚀 安装

### 方式 1：开发环境（推荐）

```powershell
# 1. 克隆或复制到 extensions 目录
Copy-Item "path/to/source" "$env:USERPROFILE\.openclaw\extensions\openclaw-desktop-pet" -Recurse

# 2. 安装依赖
cd ~/.openclaw/extensions/openclaw-desktop-pet
npm install

# 3. 安装 Python 依赖
pip install -r python/requirements.txt

# 4. 重启 OpenClaw Gateway
openclaw gateway restart
```

### 方式 2：生产环境

```powershell
# 1. 从 GitHub 下载
git clone https://github.com/44-99/openclaw-desktop-pet.git
cd openclaw-desktop-pet

# 2. 移动到 extensions 目录
Move-Item . "$env:USERPROFILE\.openclaw\extensions\openclaw-desktop-pet"

# 3. 安装依赖
cd ~/.openclaw/extensions/openclaw-desktop-pet
npm install
pip install -r python/requirements.txt

# 4. 重启 OpenClaw Gateway
openclaw gateway restart
```

---

## ⚙️ 配置

### 正确配置方式（重要！）

在 `~/.openclaw/openclaw.json` 的 **`plugins.entries`** 中添加：

```json
{
  "plugins": {
    "entries": {
      "openclaw-desktop-pet": {
        "enabled": true
      }
    }
  }
}
```

### ⚠️ 常见错误

**错误**：在根级别使用 `extensions` key（OpenClaw 不识别，会报错）

```json
// ❌ 错误配置
{
  "extensions": {  // ← 这会报错：Unrecognized key: "extensions"
    "openclaw-desktop-pet": {
      "enabled": true
    }
  }
}
```

**正确**：使用 `plugins.entries`

```json
// ✅ 正确配置
{
  "plugins": {
    "entries": {
      "openclaw-desktop-pet": {
        "enabled": true
      }
    }
  }
}
```

### 完整配置示例

```json
{
  "plugins": {
    "entries": {
      "openclaw-desktop-pet": {
        "enabled": true,
        "alwaysOnTop": true,
        "transparent": true,
        "theme": "default",
        "performanceMode": "normal"
      }
    }
  }
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | true | 是否启用桌面宠物 |
| `alwaysOnTop` | boolean | true | 窗口是否始终置顶 |
| `transparent` | boolean | true | 是否透明背景 |
| `theme` | string | "default" | 主题/MOD 名称 |
| `performanceMode` | string | "normal" | 性能模式（normal/low） |

---

## 🎮 使用

### 启动后

1. **自动启动**：OpenClaw Gateway 启动时自动运行
2. **查看宠物**：桌面上会出现哈基虾 3D 形象
3. **交互**：
   - 单击左键：对话
   - 长按左键拖动：360° 旋转
   - 右键拖动：移动窗口
   - 右键菜单：功能菜单
   - F12：老板键（隐藏/显示）

### v3.2.8 新功能（2026-03-19）

**系统负载监控**：
- 实时显示 CPU/内存/GPU 使用率
- 4 级颜色指示：🔵空闲 → 🌟忙碌 → 紧张 → 🔴夯爆了
- 右键菜单 → "系统状态" 进入实时监控模式

**工具事件驱动**：
- OpenClaw 调用工具时触发对应动作和特效
- 支持工具：read/write/edit/exec/web_fetch/openclaw-tavily-search/agent-browser
- 气泡显示工具状态，工具完成后自动隐藏

**特效系统**：
- 6 种基础动作：wiggle/bounce/shake/stretch/spiral/jump
- 5 种粒子特效：星光/拖尾/电火花/光环/代码雨

**气泡优先级系统**：
- 话题气泡：永久显示，直到被覆盖
- 系统状态：永久显示（监控模式），实时更新
- 工具调用：临时显示，工具完成后隐藏
- 后来者居上：新气泡覆盖旧气泡

**项目精简**：
- 删除不必要的文档和工具目录
- 保留 models/ 作为用户示例
- 清理代码注释和调试日志

### 停止

```powershell
# 方式 1：禁用 Extension
# 编辑 ~/.openclaw/openclaw.json，设置 enabled: false

# 方式 2：临时关闭
# 右键托盘图标 → 退出

# 方式 3：重启 Gateway
openclaw gateway restart
```

---

## 🛠️ 开发

### 构建 TypeScript

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 启动 Electron（独立测试）

```bash
npm start
```

### 启动 Python 后端

```bash
npm run python
```

---

## 📊 系统要求

- **系统**: Windows 10/11
- **Node.js**: 22+
- **Python**: 3.10+
- **OpenClaw**: 最新版

---

## 🐛 故障排查

### Extension 未加载

1. 检查 `~/.openclaw/openclaw.json` 中是否启用（**使用 `plugins.entries`，不是 `extensions`**）
2. 查看 Gateway 日志：`openclaw gateway logs`
3. 确认 `package.json` 中的 `openclaw.extensions` 配置正确

### Electron 窗口未显示

1. 检查任务栏是否有窗口
2. 按 F12 或 Ctrl+Shift+I 打开 DevTools
3. 查看 Console 是否有错误日志
4. 检查 `renderer/index.html` 的 CSP 配置是否正确

### 3D 模型不显示/无颜色

1. 打开 DevTools 查看 Console 错误
2. 检查 `import` 语句是否在文件顶部（ES Module 要求）
3. 确认 CSP 允许 `blob:` 和 `data:` URL
4. 检查 GLB 模型文件是否存在且有效

### Python 后端无法启动

1. 确认 Python 3.10+ 已安装
2. 安装依赖：`pip install -r python/requirements.txt`
3. 手动测试：`cd python && python server.py`

---

## 📝 更新日志

### v3.2.8 (2026-03-19)
- ✅ 精简项目结构（删除 docs/tools/logs）
- ✅ 清理代码注释和调试日志
- ✅ 优化气泡优先级系统（后来者居上）
- ✅ 更新 README.md 文档（修复配置示例）

### v3.2.7 (2026-03-19)
- ✅ 修复 3D 渲染问题（CSP 配置、import 位置）
- ✅ 修复 WebSocket 连接问题（只连 8765 端口）
- ✅ 添加详细初始化日志
- ✅ 启用 DevTools 便于调试

### v3.2.6 (2026-03-18)
- ✅ 删除旧的情绪系统和粒子系统
- ✅ 使用增强版粒子系统
- ✅ 优化话题生成器

### v3.2.5 (2026-03-17)
- ✅ 修复重复启动和端口冲突
- ✅ 增加 Gateway 工具事件框架

### v3.2.4 (2026-03-16)
- ✅ 修复 Python 语法错误
- ✅ 移除无效事件监听

### v3.2.3 (2026-03-15)
- ✅ 全面清理注释和空行

### v3.2.2 (2026-03-15)
- ✅ 增强系统负载颜色对比度
- ✅ 实施工具事件驱动动画

### v1.0.0 (2026-03-12)
- ✅ 初始 Extension 版本
- ✅ 迁移自 projects/openclaw-desktop-pet
- ✅ 支持 OpenClaw Gateway 事件监听

---

## 📄 License

MIT License

---

## 🔗 链接

- GitHub: https://github.com/44-99/openclaw-desktop-pet
- OpenClaw: https://github.com/openclaw/openclaw
- 文档：`notes/01-extension-planning.md`

---

_维护者：44-99 (哈基虾 🦞)_
