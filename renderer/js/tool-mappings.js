/**
 * 工具调用映射配置
 * 定义每个工具对应的气泡文案、动画和特效
 * 
 * @author 44-99
 * @version 1.0.0
 */

/**
 * 工具映射表
 * @typedef {Object} ToolMapping
 * @property {string} summary - 气泡显示的文案
 * @property {string} action - 动画名称（需与 AnimationController 支持的动作匹配）
 * @property {string|null} effect - 特效名称（如 'code-rain'）
 * @property {string} color - 模型颜色（十六进制）
 */

/** @type {Record<string, ToolMapping>} */
export const TOOL_MAPPINGS = {
  // ========== P0-Core 核心工具（所有用户可用）==========
  read: {
    summary: '读文件中...',
    action: 'wiggle',      // 摇摆动画
    effect: null,          // 无特效
    color: '#4CAF50'       // 绿色
  },
  
  write: {
    summary: '写代码中...',
    action: 'bounce',      // 弹跳动画
    effect: null,
    color: '#2196F3'       // 蓝色
  },
  
  edit: {
    summary: '编辑代码中...',
    action: 'shake',       // 抖动动画
    effect: null,
    color: '#FF9800'       // 橙色
  },
  
  exec: {
    summary: '执行命令...',
    action: 'stretch',     // 伸展动画
    effect: 'code-rain',   // 代码雨特效
    color: '#9C27B0'       // 紫色
  },
  
  // ========== P0-Optional 可选工具（需要配置）==========
  web_fetch: {
    summary: '查资料中...',
    action: 'spiral',      // 旋转动画
    effect: null,
    color: '#00BCD4'       // 青色
  },
  
  browser: {
    summary: '操作浏览器...',
    action: 'jump',        // 跳跃动画
    effect: null,
    color: '#E91E63'       // 粉色
  },
  
  tavily_search: {
    summary: '搜索中...',
    action: 'think',       // 思考动画
    effect: null,
    color: '#3F51B5'       // 靛蓝色
  },
  
  // ========== 其他常用工具 ==========
  search: {
    summary: '搜索中...',
    action: 'think',
    effect: null,
    color: '#3F51B5'
  },
  
  github: {
    summary: 'GitHub 操作中...',
    action: 'bounce',
    effect: null,
    color: '#607D8B'       // 蓝灰色
  },
  
  git: {
    summary: 'Git 操作中...',
    action: 'wiggle',
    effect: null,
    color: '#F44336'       // 红色
  },
  
  memory_search: {
    summary: '搜索记忆中...',
    action: 'think',
    effect: 'spark',       // 闪烁火花特效
    color: '#FFC107'       // 琥珀色
  },
  
  sessions_send: {
    summary: '发送消息中...',
    action: 'bounce',
    effect: null,
    color: '#4CAF50'
  },
  
  // ========== 默认 fallback ==========
  default: {
    summary: '工作中...',
    action: 'wiggle',
    effect: null,
    color: '#B0C4DE'       // 浅蓝色（系统空闲色）
  }
};

/**
 * 根据工具名称获取配置
 * @param {string} toolName - 工具名称
 * @returns {ToolMapping} 工具配置
 */
export function getToolConfig(toolName) {
  return TOOL_MAPPINGS[toolName] || TOOL_MAPPINGS.default;
}

/**
 * 获取所有工具名称列表
 * @returns {string[]} 工具名称数组
 */
export function getAllToolNames() {
  return Object.keys(TOOL_MAPPINGS);
}

/**
 * 检查工具是否有特效
 * @param {string} toolName - 工具名称
 * @returns {boolean} 是否有特效
 */
export function hasEffect(toolName) {
  const config = getToolConfig(toolName);
  return config.effect !== null;
}

/**
 * 获取工具的颜色
 * @param {string} toolName - 工具名称
 * @returns {string} 颜色（十六进制）
 */
export function getToolColor(toolName) {
  const config = getToolConfig(toolName);
  return config.color;
}

export default TOOL_MAPPINGS;
