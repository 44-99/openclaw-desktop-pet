# 哈基虾桌面宠物 - OpenClaw Extension

> 🦞 3D 桌面宠物，深度集成 OpenClaw，实时显示 AI 状态

**最新版本**: v3.2.2 (2026-03-15)

---

## 📁 目录结构

```
openclaw-desktop-pet/
├── openclaw.plugin.json    # OpenClaw 插件配置
├── package.json            # NPM 配置
├── tsconfig.json           # TypeScript 配置
├── index.ts                # Extension 入口（编译后）
├── src/
│   └── index.ts            # TypeScript 源码
├── electron/
│   ├── main.js             # Electron 主进程
│   └── preload.js          # 预加载脚本
├── renderer/
│   ├── index.html          # 主界面
│   ├── css/
│   └── js/
│       ├── app.js          # Three.js 主逻辑
│       ├── emotion-system.js
│       └── ...
├── python/
│   ├── server.py           # Python 后端
│   └── monitor.py          # 系统监控
└── assets/
    └── lobster.png         # 图标
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

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "extensions": {
    "openclaw-desktop-pet": {
      "enabled": true,
      "alwaysOnTop": true,
      "transparent": true,
      "theme": "default",
      "performanceMode": "normal"
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

### v3.2.2 新功能

**系统负载监控**：
- 实时显示 CPU/内存/GPU 使用率
- 4 级颜色指示：🔵空闲 → 🌟忙碌 → 🟠紧张 → 🔴夯爆了
- 右键菜单 → "状态" 进入实时监控模式

**工具事件驱动**：
- OpenClaw 调用工具时触发对应动作和特效
- 支持工具：read/write/edit/exec/web_fetch/browser
- 气泡持续显示工具状态，直到新工具调用

**特效系统**：
- 6 种基础动作：wiggle/bounce/shake/stretch/spiral/jump
- 5 种粒子特效：星光/拖尾/电火花/光环/代码雨

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

1. 检查 `~/.openclaw/openclaw.json` 中是否启用
2. 查看 Gateway 日志：`openclaw gateway logs`
3. 确认 `openclaw.plugin.json` 格式正确

### Electron 窗口未显示

1. 检查任务栏是否有窗口
2. 按 F12 尝试显示/隐藏
3. 查看 `logs/` 目录下的错误日志

### Python 后端无法启动

1. 确认 Python 3.10+ 已安装
2. 安装依赖：`pip install -r python/requirements.txt`
3. 手动测试：`cd python && python server.py`

---

## 📝 更新日志

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
