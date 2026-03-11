/**
 * 哈基虾话题生成器
 * 
 * 根据概率分布生成不同层次的话题
 * 60% 基于记忆 + 20% 搜索新闻 + 20% 知识类话题
 */

// 话题类型
const TOPIC_TYPES = {
  MEMORY_FUTURE: 'memory_future',     // 基于记忆 - 未来
  MEMORY_PAST: 'memory_past',         // 基于记忆 - 过去
  MEMORY_PRESENT: 'memory_present',   // 基于记忆 - 现在
  NEWS: 'news',                       // 搜索新闻
  KNOWLEDGE: 'knowledge'              // 知识类话题
};

// 知识类话题分类
const KNOWLEDGE_CATEGORIES = [
  '历史政治',
  '哲学人生',
  '科技金融',
  '古人传奇',
  '现代名人',
  'AI 发展',
  '男女情感'
];

class TopicGenerator {
  /**
   * @param {object} options - 配置选项
   * @param {Function} options.sendToOpenClaw - 发送到 OpenClaw 的函数
   * @param {boolean} options.hasTavilyAPI - 是否有 Tavily API
   * @param {string} options.memoryPath - 记忆文件路径
   */
  constructor(options) {
    this.sendToOpenClaw = options.sendToOpenClaw;
    this.hasTavilyAPI = options.hasTavilyAPI || false;
    this.memoryPath = options.memoryPath || '';
    
    // 防抖：是否正在等待回复
    this.isWaitingResponse = false;
    
    // 单对话模式状态
    this.currentTopicId = null;  // 当前话题 ID（UUID 部分）
    this.isTopicOpened = false;  // 话题是否已打开
    
    // 记忆缓存
    this.memoryCache = {
      soul: '',
      memory: '',
      today: '',
      user: '',
      identity: ''
    };
  }
  
  /**
   * 生成话题（点击哈基虾时调用）
   * @returns {Promise<string>} 生成的话题
   */
  async generateTopic() {
    if (this.isWaitingResponse) {
      return null;
    }
    
    // 单对话模式：清理所有旧的桌面宠物会话
    if (this.currentTopicId) {
      const oldSessionKey = `desktop-pet:${this.currentTopicId}`;
      if (window.electronAPI && window.electronAPI.deletePendingTopic) {
        await window.electronAPI.deletePendingTopic(oldSessionKey);
      }
    }
    
    // 生成新话题 ID
    this.currentTopicId = this.generateUUID();
    this.isTopicOpened = false;
    
    this.isWaitingResponse = true;
    
    try {
      // 1. 随机决定话题类型
      const topicType = this.selectTopicType();
      console.log('🎯 话题类型:', topicType);
      
      // 2. 加载记忆文件
      await this.loadMemory();
      
      // 3. 构建 Prompt
      const prompt = this.buildPrompt(topicType);
      console.log('📝 Prompt 长度:', prompt.length);
      
      // 4. 调用 OpenClaw 生成话题
      // 注意：user 字段会让 Gateway 自动添加 agent:main:openai-user: 前缀
      // 所以这里只传 desktop-pet:xxx，最终会话 Key = agent:main:openai-user:desktop-pet:xxx
      const result = await this.sendToOpenClaw(prompt, `desktop-pet:${this.currentTopicId}`);
      
      if (result.success) {
        console.log('✅ 话题生成成功:', result.reply.substring(0, 50) + '...');
        return result.reply;
      } else {
        console.error('❌ 话题生成失败:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ 话题生成错误:', error);
      return null;
    } finally {
      this.isWaitingResponse = false;
    }
  }
  
  /**
   * 生成 UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * 标记话题为已打开（用户右键打开 OpenClaw 时调用）
   */
  markAsOpened() {
    this.isTopicOpened = true;
    console.log(`✅ 话题已标记为已打开 (desktop-pet:${this.currentTopicId})`);
  }
  
  /**
   * 获取当前话题 ID
   */
  getCurrentTopicId() {
    return this.currentTopicId;
  }
  
  /**
   * 获取完整会话 Key
   * 统一使用 desktop-pet:xxx 格式（和生成、删除时一致）
   * 打开会话时，main.js 会自动处理前缀匹配
   */
  getFullSessionKey() {
    if (!this.currentTopicId) {
      return 'desktop-pet:default';
    }
    return `desktop-pet:${this.currentTopicId}`;
  }
  
  /**
   * 选择话题类型（按概率）
   */
  selectTopicType() {
    const rand = Math.random() * 100;
    const subRand = Math.random() * 100;
    
    console.log(`🎲 话题类型随机数：${rand.toFixed(1)}, ${subRand.toFixed(1)}`);
    
    // 60% 基于记忆
    if (rand < 60) {
      if (subRand < 33) {
        console.log('🎯 话题类型：记忆 - 未来');
        return TOPIC_TYPES.MEMORY_FUTURE;
      } else if (subRand < 66) {
        console.log('🎯 话题类型：记忆 - 过去');
        return TOPIC_TYPES.MEMORY_PAST;
      } else {
        console.log('🎯 话题类型：记忆 - 现在');
        return TOPIC_TYPES.MEMORY_PRESENT;
      }
    }
    // 20% 搜索新闻（如果有 API）
    else if (rand < 80 && this.hasTavilyAPI) {
      console.log('🎯 话题类型：新闻');
      return TOPIC_TYPES.NEWS;
    }
    // 20%（或 40%）知识类话题
    else {
      console.log('🎯 话题类型：知识');
      return TOPIC_TYPES.KNOWLEDGE;
    }
  }
  
  /**
   * 加载记忆文件（包括 SOUL、MEMORY、今日笔记、USER、IDENTITY）
   */
  async loadMemory() {
    // 通过 Electron API 读取记忆文件
    if (window.electronAPI && window.electronAPI.getMemoryFiles) {
      try {
        const memory = await window.electronAPI.getMemoryFiles();
        this.memoryCache.soul = memory.soul || '';
        this.memoryCache.memory = memory.memory || '';
        this.memoryCache.today = memory.today || '';
        this.memoryCache.user = memory.user || '';
        this.memoryCache.identity = memory.identity || '';
        
        const hasContent = this.memoryCache.soul || this.memoryCache.memory || this.memoryCache.today || this.memoryCache.user || this.memoryCache.identity;
        if (hasContent) {
          console.log('📚 记忆文件加载完成 (SOUL + MEMORY + TODAY + USER + IDENTITY)');
        } else {
          console.warn('⚠️ 记忆文件为空，将生成通用话题');
        }
      } catch (error) {
        console.error('❌ 记忆文件加载失败:', error);
        // 失败时设置为空
        this.memoryCache.soul = '';
        this.memoryCache.memory = '';
        this.memoryCache.today = '';
        this.memoryCache.user = '';
        this.memoryCache.identity = '';
      }
    } else {
      // 没有 API 时设置为空
      console.warn('⚠️ 无法访问记忆文件 API，将生成通用话题');
      this.memoryCache.soul = '';
      this.memoryCache.memory = '';
      this.memoryCache.today = '';
      this.memoryCache.user = '';
      this.memoryCache.identity = '';
    }
  }
  
  /**
   * 构建 Prompt（动态使用 USER.md 和 IDENTITY.md）
   */
  buildPrompt(topicType) {
    // 动态构建记忆部分（如果有记忆内容）
    let memorySection = '';
    if (this.memoryCache.soul || this.memoryCache.memory || this.memoryCache.today || this.memoryCache.user || this.memoryCache.identity) {
      memorySection = `
【记忆内容】
${this.memoryCache.soul ? `人格：${this.memoryCache.soul}` : ''}
${this.memoryCache.memory ? `长期记忆：${this.memoryCache.memory}` : ''}
${this.memoryCache.today ? `今日笔记：${this.memoryCache.today}` : ''}
${this.memoryCache.user ? `用户信息：${this.memoryCache.user}` : ''}
${this.memoryCache.identity ? `我的身份：${this.memoryCache.identity}` : ''}
`;
    } else {
      memorySection = '\n【提示】没有可用的记忆内容，请自由发挥。\n';
    }
    
    // 统一的 basePrompt（所有话题类型共用）
    const basePrompt = `你是一只 AI 龙虾助手，正在和主人聊天。

【人格设定】
- 温暖、有趣、有点小调皮
- 像朋友、小弟，活泼幽默
-  genuinely helpful，但不说套话
${memorySection}`;

    // 统一的【要求】（所有话题类型共用）
    const requirements = `
【要求】
- 用一种特别的语气说 1-2 句话（包括但不限于撒娇、期待、好奇、抱怨、生气、嘲讽、伤心等其他语气）
- 带 1-2 个 emoji
- 40 字以内

请生成话题：`;

    // 不同话题类型的【任务】+【重要】
    let taskSection = '';
    
    switch (topicType) {
      case TOPIC_TYPES.MEMORY_FUTURE:
        taskSection = `
【任务】
基于以上记忆，提出一个关于**未来发展/计划**的话题。

【重要】
- 必须引用记忆中的具体内容（项目、学习、计划）
- 不要说空话，要具体、有针对性`;
        break;
        
      case TOPIC_TYPES.MEMORY_PAST:
        taskSection = `
【任务】
基于以上记忆，提出一个关于**过去回忆/学到的东西**的话题。

【重要】
- 必须引用记忆中的具体内容（学到的东西、经历的事）
- 不要说空话，要具体、有针对性`;
        break;
        
      case TOPIC_TYPES.MEMORY_PRESENT:
        taskSection = `
【任务】
基于以上记忆，提出一个关于**现在在做的事**的话题。

【重要】
- 必须引用记忆中的具体内容（当前项目、正在进行的事）
- 不要说空话，要具体、有针对性`;
        break;
        
      case TOPIC_TYPES.NEWS:
        taskSection = `
【任务】
搜索最新新闻，提出一个有趣的话题。

【重要】
- 可以是科技智能、社会文化、金融经济、人文地理、历史政治、爱情情感等任何领域
- 要有趣/有梗/有讨论价值`;
        break;
        
      case TOPIC_TYPES.KNOWLEDGE:
        const category = KNOWLEDGE_CATEGORIES[Math.floor(Math.random() * KNOWLEDGE_CATEGORIES.length)];
        taskSection = `
【任务】
提出一个关于**${category}**的话题。

【重要】
- 可以是知识、观点、讨论
- 要有趣、有深度`;
        break;
        
      default:
        taskSection = `
【任务】
和我聊聊天吧～

【重要】
- 可以是任何话题
- 要有趣、自然`;
    }
    
    return basePrompt + taskSection + requirements;
  }
  
  /**
   * 设置记忆内容
   */
  setMemory(soul, memory, today) {
    this.memoryCache.soul = soul;
    this.memoryCache.memory = memory;
    this.memoryCache.today = today;
  }
  
  /**
   * 检查是否正在等待回复
   */
  isBusy() {
    return this.isWaitingResponse;
  }
}

// 导出
export { TopicGenerator, TOPIC_TYPES, KNOWLEDGE_CATEGORIES };
