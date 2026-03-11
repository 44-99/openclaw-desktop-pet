import psutil
import platform
import warnings
import time

# 忽略 pynvml 警告
warnings.filterwarnings('ignore', category=FutureWarning)

class SystemMonitor:
    """系统监控器"""
    
    # 性能等级名称（4 级）
    LEVEL_NAMES = ['空闲', '忙碌', '紧张', '夯爆了']
    
    # 基准线（正常使用范围，用于调分）
    CPU_BASE = 25      # CPU 空闲时约 5-15%，正常 25-45%
    MEM_BASE = 35      # 内存空闲时约 25-45%
    GPU_BASE = 15      # GPU 空闲时约 5-15%
    TEMP_BASE = 45     # GPU 温度空闲时约 35-45°C
    
    def __init__(self):
        self.system = platform.system()
        self.last_net = psutil.net_io_counters()
        self.last_score = 100
        self.last_level = '空闲'
        self.last_level_change_time = time.time()
    
    def get_cpu_percent(self):
        """获取 CPU 使用率"""
        return psutil.cpu_percent(interval=0.5)
    
    def get_memory_percent(self):
        """获取内存使用率"""
        return psutil.virtual_memory().percent
    
    def get_disk_percent(self):
        """获取磁盘使用率"""
        try:
            return psutil.disk_usage('/').percent
        except:
            return psutil.disk_usage('C:\\').percent
    
    def get_network_speed(self):
        """获取网络速度（字节/秒）"""
        try:
            current_net = psutil.net_io_counters()
            upload = current_net.bytes_sent - self.last_net.bytes_sent
            download = current_net.bytes_recv - self.last_net.bytes_recv
            self.last_net = current_net
            return {
                "upload": upload,
                "download": download
            }
        except:
            return {"upload": 0, "download": 0}
    
    def get_gpu_percent(self):
        """获取 GPU 使用率"""
        try:
            if self.system == "Windows":
                import pynvml
                try:
                    pynvml.nvmlInit()
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    gpu_percent = pynvml.nvmlDeviceGetUtilizationRates(handle).gpu
                    return gpu_percent
                except:
                    return 0
                finally:
                    try:
                        pynvml.nvmlShutdown()
                    except:
                        pass
            else:
                return 0
        except:
            return 0
    
    def get_gpu_temperature(self):
        """获取 GPU 温度"""
        try:
            if self.system == "Windows":
                import pynvml
                try:
                    pynvml.nvmlInit()
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    temp = pynvml.nvmlDeviceGetTemperature(handle, 0)
                    return temp
                except:
                    return 0
                finally:
                    try:
                        pynvml.nvmlShutdown()
                    except:
                        pass
            else:
                return 0
        except:
            return 0
    
    def calculate_score(self, cpu, memory, gpu, gpu_temp):
        """
        计算性能综合评分（0-100）
        使用学科调分，确保覆盖 0-100 大部分范围
        """
        # 计算偏离度（超过基准线越多，分数越低）
        cpu_score = max(0, 100 - (cpu - self.CPU_BASE) * 1.5)
        mem_score = max(0, 100 - (memory - self.MEM_BASE) * 1.5)
        gpu_score = max(0, 100 - (gpu - self.GPU_BASE) * 1.5)
        temp_score = max(0, 100 - (gpu_temp - self.TEMP_BASE) * 2)
        
        # 加权平均（CPU 和内存权重更高）
        score = (cpu_score * 0.35 + mem_score * 0.35 + 
                 gpu_score * 0.15 + temp_score * 0.15)
        
        return max(0, min(100, score))
    
    def get_level(self, score):
        """
        根据分数获取性能等级（4 级）
        0-25: 夯爆了
        26-50: 紧张
        51-75: 忙碌
        76-100: 空闲
        """
        if score >= 76:
            return '空闲'
        elif score >= 51:
            return '忙碌'
        elif score >= 26:
            return '紧张'
        else:
            return '夯爆了'
    
    def get_level_index(self, level):
        """获取等级索引（用于颜色映射）"""
        try:
            return self.LEVEL_NAMES.index(level)
        except ValueError:
            return 4  # 默认空闲
    
    def get_all_data(self):
        """获取所有系统数据"""
        net = self.get_network_speed()
        cpu = self.get_cpu_percent()
        memory = self.get_memory_percent()
        gpu = self.get_gpu_percent()
        gpu_temp = self.get_gpu_temperature()
        
        # 计算性能评分
        score = self.calculate_score(cpu, memory, gpu, gpu_temp)
        level = self.get_level(score)
        
        # 检查等级是否变化
        level_changed = (level != self.last_level)
        if level_changed:
            self.last_level = level
            self.last_score = score
            self.last_level_change_time = time.time()
        else:
            self.last_score = score
        
        return {
            "cpu": cpu,
            "memory": memory,
            "disk": self.get_disk_percent(),
            "gpu": gpu,
            "gpu_temp": gpu_temp,
            "network": {
                "upload": net["upload"],
                "download": net["download"]
            },
            "performance_score": score,
            "performance_level": level,
            "level_changed": level_changed
        }

# 测试
if __name__ == "__main__":
    monitor = SystemMonitor()
    data = monitor.get_all_data()
    print("系统数据:")
    print(f"CPU: {data['cpu']}%")
    print(f"内存：{data['memory']}%")
    print(f"磁盘：{data['disk']}%")
    print(f"GPU: {data['gpu']}%")
    print(f"GPU 温度：{data['gpu_temp']}°C")
    print(f"网络上传：{data['network']['upload']} B/s")
    print(f"网络下载：{data['network']['download']} B/s")
