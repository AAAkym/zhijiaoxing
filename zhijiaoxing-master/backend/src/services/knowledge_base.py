# encoding:UTF-8
"""
本地知识库服务
管理cp07、cp08、cp09等本地资料库文件
"""
from typing import Dict, List


class KnowledgeBaseService:
    """本地知识库服务"""
    
    def __init__(self):
        self.knowledge_base = {}
        self._load_knowledge_base()
    
    def _load_knowledge_base(self):
        """加载本地知识库"""
        # 这里存储从文档中提取的关键内容
        self.knowledge_base = {
            "tensorflow_js": {
                "title": "TensorFlow.js应用开发",
                "content": """
TensorFlow.js 是一个用于使用 JavaScript 进行机器学习开发的库，用于在浏览器和 Node.js 训练和部署机器学习模型。

主要特点：
1. 支持GPU硬件加速
2. 可运行在Node.js或浏览器环境中
3. 支持完全基于JavaScript从头开发、训练和部署模型
4. 可以运行已有的Python版TensorFlow模型

核心概念：
- 张量(Tensor)：TensorFlow.js中的中心数据单元
- 变量(Variable)：用张量的值进行初始化，值是可变的
- 操作(Ops)：用于操作数据的运算
- 模型和层：可以用高层API(Layers API)或Core API创建模型

环境配置：
1. 使用Script Tag直接在HTML中引用
2. 通过yarn/npm安装并使用构建工具

项目实例：
1. 预测汽车油耗效率 - 线性回归实验
2. 手写数字识别 - CNN卷积神经网络

应用场景：
- 图像识别
- 语音识别  
- 人体姿态识别
- 物体识别
- 文字分类
                """
            },
            "tensorflow_lite": {
                "title": "TensorFlow Lite",
                "content": """
TensorFlow Lite 是一个轻量、快速、兼容度高的专门针对移动式应用场景的深度学习工具。

主要特点：
1. 更轻量：二进制文件约1MB
2. 特别为各种端侧设备优化的算子库
3. 能够利用各种硬件加速

体系结构：
- TensorFlow Lite 解释器(Interpreter)
- TensorFlow Lite 转换器(Converter)  
- 算子库(Op kernels)
- 硬件加速代理(Hardware accelerator delegate)

工作流程：
1. 选择模型
2. 转换模型（使用TFLite转换器）
3. 部署到设备
4. 优化模型

应用领域：
- 移动应用（Android、iOS）
- 嵌入式设备
- IoT设备
- 微控制器(MCU)

优化技术：
- 量化：降低权重精确表示
- 算子融合
- 模型压缩

实际应用：
- Google Assistant语音识别
- Google Photos图像处理
- 网易OCR处理
- 爱奇艺视频AR效果
                """
            },
            "embedded_python": {
                "title": "嵌入式Python开发",
                "content": """
嵌入式Python开发是在资源受限的嵌入式系统中使用Python进行开发的技术。

主要特点：
1. 轻量级Python解释器
2. 适用于微控制器和小型设备
3. 支持硬件接口编程
4. 实时性能优化

开发环境：
- MicroPython：专为微控制器设计的Python实现
- CircuitPython：基于MicroPython的变种
- 支持的硬件平台：ESP32、树莓派、Arduino等

核心功能：
1. GPIO控制
2. 传感器数据采集
3. 通信协议支持（I2C、SPI、UART）
4. 网络连接（WiFi、蓝牙）

应用场景：
- IoT设备开发
- 传感器网络
- 智能家居系统
- 工业自动化
- 机器人控制

开发优势：
1. 快速原型开发
2. 丰富的库支持
3. 易于调试和维护
4. 跨平台兼容性

性能优化：
- 内存管理优化
- 代码编译优化
- 硬件加速利用
- 实时任务调度
                """
            }
        }
    
    def get_knowledge_by_topic(self, topic: str) -> str:
        """根据主题获取知识库内容"""
        topic_lower = topic.lower()
        
        # 简单的关键词匹配
        if "tensorflow.js" in topic_lower or "tfjs" in topic_lower:
            return self.knowledge_base["tensorflow_js"]["content"]
        elif "tensorflow lite" in topic_lower or "tflite" in topic_lower:
            return self.knowledge_base["tensorflow_lite"]["content"]
        elif "python" in topic_lower and ("嵌入式" in topic_lower or "embedded" in topic_lower):
            return self.knowledge_base["embedded_python"]["content"]
        elif "机器学习" in topic_lower or "深度学习" in topic_lower:
            # 返回所有相关内容
            return f"{self.knowledge_base['tensorflow_js']['content']}\n\n{self.knowledge_base['tensorflow_lite']['content']}"
        
        return ""
    
    def get_all_knowledge(self) -> str:
        """获取所有知识库内容"""
        all_content = []
        for key, value in self.knowledge_base.items():
            all_content.append(f"## {value['title']}\n{value['content']}")
        return "\n\n".join(all_content)
    
    def search_knowledge(self, query: str) -> List[Dict[str, str]]:
        """搜索知识库"""
        results = []
        query_lower = query.lower()
        
        for key, value in self.knowledge_base.items():
            if query_lower in value["content"].lower() or query_lower in value["title"].lower():
                results.append({
                    "key": key,
                    "title": value["title"],
                    "content": value["content"][:500] + "..." if len(value["content"]) > 500 else value["content"]
                })
        
        return results


# 全局实例
knowledge_base_service = KnowledgeBaseService()

