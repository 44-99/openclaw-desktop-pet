/**
 * 哈基虾内心戏管理器
 * 
 * 当性能等级变化时，生成内心戏气泡
 * 显示在哈基虾头顶，10 秒后淡出消失
 */

// 5 种语气类型
const TONES = [
  '批评指责',
  '幽默滑稽',
  '嘲讽谩骂',
  '温柔动人',
  '委屈可怜'
];

// 语气对应的 Prompt 前缀
const TONE_PROMPTS = {
  '批评指责': '用批评指责的语气，抱怨电脑性能',
  '幽默滑稽': '用幽默滑稽的语气，调侃电脑性能',
  '嘲讽谩骂': '用嘲讽谩骂的语气，吐槽电脑性能',
  '温柔动人': '用温柔动人的语气，关心电脑性能',
  '委屈可怜': '用委屈可怜的语气，诉说电脑性能'
};

class InnerVoiceManager {
  /**
   * @param {object} options - 配置选项
   * @param {Function} options.sendToOpenClaw - 发送到 OpenClaw 的函数
   * @param {Function} options.showBubble - 显示气泡的函数
   */
  constructor(options) {
    this.sendToOpenClaw = options.sendToOpenClaw;
    this.showBubble = options.showBubble;
    
    // 当前气泡元素
    this.currentBubble = null;
    
    // 防抖：是否正在显示
    this.isShowing = false;
    
    // ========== 新增状态管理 ==========
    this.lastCheckTime = Date.now();  // 上次检查时间（初始化为现在，避免启动就触发）
    this.lastTriggerTime = 0;         // 上次触发时间
    this.isWaitingResponse = false;   // 是否等待 LLM 回复
    this.checkInterval = 20000;       // 检查间隔（20 秒）
    this.lastLevel = null;            // 上次等级（null 表示还未设置）
    this.lastScore = 100;             // 上次评分
  }
  
  /**
   * 每秒接收性能数据（但不一定触发）
   * @param {object} data - 性能数据
   */
  onPerformanceUpdate(data) {
    const now = Date.now();
    
    // 检查是否到达检查时间（每 20 秒）
    const timeSinceLastCheck = now - this.lastCheckTime;
    if (timeSinceLastCheck < this.checkInterval) {
      // 每 5 秒打印一次倒计时
      if (timeSinceLastCheck % 5000 < 1000 && timeSinceLastCheck > 0) {
        console.log(`💭 距离下次检查：${((this.checkInterval - timeSinceLastCheck) / 1000).toFixed(0)}秒`);
      }
      return;  // 还没到检查时间
    }
    
    // 重置检查计时器
    this.lastCheckTime = now;
    console.log(`💭 检查时间点到达（间隔 ${timeSinceLastCheck/1000}秒）`);
    
    // 检查是否应该触发
    if (this.isWaitingResponse) {
      console.log('💭 等待上一次回复，跳过本次检查');
      return;
    }
    
    // 检查等级是否变化，或者固定时间间隔触发（60 秒）
    const timeSinceLastTrigger = now - this.lastTriggerTime;
    const shouldTriggerByLevel = this.lastLevel !== null && data.performance_level !== this.lastLevel;
    const shouldTriggerByTime = timeSinceLastTrigger > 60000; // 60 秒强制触发一次
    
    console.log(`💭 当前等级：${data.performance_level}, 上次等级：${this.lastLevel || '未设置'}`);
    
    if (shouldTriggerByLevel || shouldTriggerByTime) {
      if (shouldTriggerByLevel) {
        console.log(`💭 等级变化：${this.lastLevel} → ${data.performance_level} (${data.performance_score}分)`);
      } else {
        console.log(`💭 固定时间触发（${(timeSinceLastTrigger/1000).toFixed(0)}秒）`);
      }
      
      this.lastLevel = data.performance_level;
      this.lastScore = data.performance_score;
      this.isWaitingResponse = true;
      
      this.generateInnerVoice(data);
    } else {
      if (this.lastLevel === null) {
        console.log(`💭 首次设置等级：${data.performance_level}`);
        this.lastLevel = data.performance_level;
        this.lastScore = data.performance_score;
      } else {
        console.log(`💭 等级未变（${data.performance_level}），不触发`);
      }
    }
  }
  
  /**
   * 生成内心戏
   * @param {object} data - 性能数据
   */
  async generateInnerVoice(data) {
    const { score, level, cpu, memory, gpu, gpu_temp } = data;
    
    console.log(`💭 生成内心戏：${level} (${score.toFixed(1)}分)`);
    
    // 随机选择语气
    const tone = TONES[Math.floor(Math.random() * TONES.length)];
    console.log(`  → 语气：${tone}`);
    
    // 构建 Prompt
    const prompt = this.buildPrompt(tone, level, score, cpu, memory, gpu, gpu_temp);
    
    // 调用 OpenClaw 生成内心戏
    try {
      const result = await this.sendToOpenClaw(prompt);
      
      if (result.success) {
        // 显示内心戏气泡（头顶位置）
        this.showInnerVoiceBubble(result.reply);
        
        // 10 秒后淡出
        setTimeout(() => {
          this.fadeOutBubble();
        }, 10000);
      } else {
        console.error('❌ 内心戏生成失败:', result.error);
      }
    } catch (error) {
      console.error('❌ 内心戏生成错误:', error);
    } finally {
      // 重置状态
      this.isWaitingResponse = false;
      this.lastTriggerTime = Date.now();
      console.log('💭 内心戏生成完成');
    }
  }
  
  /**
   * 构建内心戏 Prompt
   */
  buildPrompt(tone, level, score, cpu, memory, gpu, gpu_temp) {
    return `你是哈基虾（一只 AI 龙虾🦞），现在要表达内心戏。

【当前系统性能】
- 等级：${level}
- 综合评分：${score.toFixed(1)}分
- CPU: ${cpu.toFixed(1)}%
- 内存：${memory.toFixed(1)}%
- GPU: ${gpu.toFixed(1)}%
- GPU 温度：${gpu_temp.toFixed(0)}°C

【语气要求】
${TONES[tone]}

【回复要求】
1. 用 1 句话，20 字以内
2. 口语化，像内心独白
3. 不要称呼"主人"，像是自言自语
4. 可以带 emoji

示例：
- 批评指责："这破电脑，卡成 PPT 了！😤"
- 幽默滑稽："CPU 在跳迪斯科，内存在蹦极～🤡"
- 嘲讽谩骂："就这？这配置是上个世纪的吗？🙄"
- 温柔动人："电脑辛苦了，休息一下吧～💕"
- 委屈可怜："呜呜呜，好烫好累...🥺"

请生成内心戏：`;
  }
  
  /**
   * 显示内心戏气泡（头顶位置）
   * @param {string} text - 气泡文本
   */
  showInnerVoiceBubble(text) {
    // 创建气泡元素
    const bubble = document.createElement('div');
    bubble.id = 'inner-voice-bubble';
    bubble.className = 'inner-voice-bubble';
    bubble.innerHTML = `
      <div class="inner-voice-text">${text}</div>
      <div class="inner-voice-arrow"></div>
    `;
    
    // 添加到页面
    document.getElementById('canvas-container').appendChild(bubble);
    
    // 强制重绘，触发动画
    bubble.offsetHeight;
    bubble.classList.add('visible');
    
    this.currentBubble = bubble;
    
    console.log('💭 内心戏气泡显示:', text);
  }
  
  /**
   * 淡出气泡
   */
  fadeOutBubble() {
    if (!this.currentBubble) {
      return;
    }
    
    const bubble = this.currentBubble;
    
    // 添加淡出类
    bubble.classList.remove('visible');
    bubble.classList.add('fade-out');
    
    // 动画结束后移除
    setTimeout(() => {
      if (bubble.parentNode) {
        bubble.parentNode.removeChild(bubble);
      }
      this.currentBubble = null;
      this.isShowing = false;
      console.log('💭 内心戏气泡已移除');
    }, 1000); // 淡出动画 1 秒
  }
}

// 导出
export { InnerVoiceManager, TONES };
