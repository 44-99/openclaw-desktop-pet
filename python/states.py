class StateManager:
    """状态管理器"""
    
    # 状态阈值
    THRESHOLDS = {
        'idle': 20,       # <20% 空闲
        'normal': 50,     # 20-50% 正常
        'busy': 80,       # 50-80% 忙碌
        'high': 90,       # 80-90% 高负载
        'critical': 100   # >90% 崩溃
    }
    
    # 状态描述
    STATE_DESCRIPTIONS = {
        'idle': '空闲',
        'normal': '正常',
        'busy': '忙碌',
        'high': '高负载',
        'critical': '崩溃'
    }
    
    def __init__(self):
        self.current_state = 'idle'
        self.state_history = []
    
    def determine_state(self, system_data):
        """
        根据系统数据确定状态
        
        Args:
            system_data: dict, 包含 cpu, memory, gpu 等数据
        
        Returns:
            str: 状态名称
        """
        # 取 CPU 和 GPU 的最大值作为主要负载指标
        cpu = system_data.get('cpu', 0)
        gpu = system_data.get('gpu', 0)
        max_load = max(cpu, gpu)
        
        # 确定状态
        if max_load < self.THRESHOLDS['idle']:
            new_state = 'idle'
        elif max_load < self.THRESHOLDS['normal']:
            new_state = 'normal'
        elif max_load < self.THRESHOLDS['busy']:
            new_state = 'busy'
        elif max_load < self.THRESHOLDS['high']:
            new_state = 'high'
        else:
            new_state = 'critical'
        
        # 记录状态变化
        if new_state != self.current_state:
            self.state_history.append({
                'from': self.current_state,
                'to': new_state,
                'load': max_load
            })
            self.current_state = new_state
            print(f"状态变化：{self.STATE_DESCRIPTIONS[self.current_state]} (负载：{max_load:.1f}%)")
        
        return new_state
    
    def get_state_description(self, state=None):
        """获取状态描述"""
        if state is None:
            state = self.current_state
        return self.STATE_DESCRIPTIONS.get(state, '未知')
    
    def get_state_history(self, limit=10):
        """获取状态历史"""
        return self.state_history[-limit:]
    
    def reset(self):
        """重置状态"""
        self.current_state = 'idle'
        self.state_history = []


# 测试
if __name__ == "__main__":
    manager = StateManager()
    
    # 测试不同负载下的状态
    test_data = [
        {'cpu': 10, 'gpu': 5},    # 应该 idle
        {'cpu': 35, 'gpu': 20},   # 应该 normal
        {'cpu': 65, 'gpu': 40},   # 应该 busy
        {'cpu': 85, 'gpu': 60},   # 应该 high
        {'cpu': 95, 'gpu': 80},   # 应该 critical
    ]
    
    for data in test_data:
        state = manager.determine_state(data)
        print(f"CPU: {data['cpu']}%, GPU: {data['gpu']}% -> 状态：{manager.get_state_description(state)}")
