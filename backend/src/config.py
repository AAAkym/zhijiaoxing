"""
智教星 - 配置文件

集中管理所有应用配置，支持从环境变量读取
"""
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


class Config:
    """基础配置类"""
    
    # ============================================
    # 应用基础配置
    # ============================================
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')
    
    # ============================================
    # 数据库基础配置
    # ============================================
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = int(os.environ.get('DB_PORT', 5432))
    DB_NAME = os.environ.get('DB_NAME', 'zhijiaoxing_db')
    DB_USER = os.environ.get('DB_USER', 'zhijiaoxing_user')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', 'zhijiaoxing_password')
    
    # 构建数据库连接字符串
    # 优先使用完整的DATABASE_URL，如果没有则使用单独的配置参数
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if not DATABASE_URL:
        DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # ============================================
    # 数据库连接池配置
    # ============================================
    # 连接池大小: 保持的连接数
    DB_POOL_SIZE = int(os.environ.get('DB_POOL_SIZE', 10))
    
    # 最大溢出连接数: 超出pool_size后可额外创建的连接数
    DB_MAX_OVERFLOW = int(os.environ.get('DB_MAX_OVERFLOW', 20))
    
    # 连接池超时时间(秒): 获取连接的最大等待时间
    DB_POOL_TIMEOUT = int(os.environ.get('DB_POOL_TIMEOUT', 30))
    
    # 连接回收时间(秒): 连接在池中保留的最长时间
    DB_POOL_RECYCLE = int(os.environ.get('DB_POOL_RECYCLE', 1800))
    
    # 连接前ping测试: 检测连接是否有效，避免使用失效连接
    DB_POOL_PRE_PING = os.environ.get('DB_POOL_PRE_PING', 'true').lower() in ('true', '1', 'yes')
    
    # SQLAlchemy引擎选项
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': DB_POOL_SIZE,
        'max_overflow': DB_MAX_OVERFLOW,
        'pool_timeout': DB_POOL_TIMEOUT,
        'pool_recycle': DB_POOL_RECYCLE,
        'pool_pre_ping': DB_POOL_PRE_PING,
        
        # 额外的连接池配置
        'echo': False,                # 是否打印SQL语句（调试用）
        'echo_pool': False,           # 是否打印连接池日志
    }
    
    # ============================================
    # 缓存配置 (Redis)
    # ============================================
    # 缓存类型: RedisCache (生产环境) 或 NullCache (开发测试环境，无缓存)
    # 可选值: 'RedisCache', 'SimpleCache', 'NullCache'
    CACHE_TYPE = os.environ.get('CACHE_TYPE', 'SimpleCache')
    
    # Redis连接配置
    REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
    REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))
    REDIS_DB = int(os.environ.get('REDIS_DB', 0))
    REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD', None)
    
    # Redis连接URL
    REDIS_URL = os.environ.get('REDIS_URL')
    if not REDIS_URL:
        if REDIS_PASSWORD:
            REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
        else:
            REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
    
    # Flask-Caching 配置
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = int(os.environ.get('CACHE_DEFAULT_TIMEOUT', 300))  # 默认5分钟
    
    # 缓存键前缀
    CACHE_KEY_PREFIX = os.environ.get('CACHE_KEY_PREFIX', 'zhijiaoxing:')
    
    # ============================================
    # 缓存策略配置
    # ============================================
    # 用户会话缓存时间 (24小时 = 86400秒)
    CACHE_SESSION_TIMEOUT = int(os.environ.get('CACHE_SESSION_TIMEOUT', 86400))
    
    # 课程列表缓存时间 (1小时 = 3600秒)
    CACHE_COURSES_TIMEOUT = int(os.environ.get('CACHE_COURSES_TIMEOUT', 3600))
    
    # 统计数据缓存时间 (5分钟 = 300秒)
    CACHE_STATS_TIMEOUT = int(os.environ.get('CACHE_STATS_TIMEOUT', 300))
    
    # 教学内容缓存时间 (30分钟 = 1800秒)
    CACHE_CONTENT_TIMEOUT = int(os.environ.get('CACHE_CONTENT_TIMEOUT', 1800))
    
    # 考核数据缓存时间 (15分钟 = 900秒)
    CACHE_ASSESSMENT_TIMEOUT = int(os.environ.get('CACHE_ASSESSMENT_TIMEOUT', 900))
    
    # ============================================
    # Spark AI API配置
    # ============================================
    SPARK_API_KEY = os.environ.get('SPARK_API_KEY')
    SPARK_API_SECRET = os.environ.get('SPARK_API_SECRET')
    SPARK_API_PASSWORD = os.environ.get('SPARK_API_PASSWORD')
    SPARK_APP_ID = os.environ.get('SPARK_APP_ID')
    # 默认选用已开通的 Spark Lite，如需更高规格请在环境变量中改成已授权的模型名
    SPARK_MODEL = os.environ.get('SPARK_MODEL', 'lite')
    SPARK_API_URL = os.environ.get('SPARK_API_URL', 'https://spark-api-open.xf-yun.com/v1/chat/completions')
    
    # ============================================
    # Elasticsearch配置
    # ============================================
    ELASTICSEARCH_ENABLED = os.environ.get('ELASTICSEARCH_ENABLED', 'true').lower() in ('true', '1', 'yes')
    ELASTICSEARCH_HOST = os.environ.get('ELASTICSEARCH_HOST', 'localhost')
    ELASTICSEARCH_PORT = int(os.environ.get('ELASTICSEARCH_PORT', 9200))
    ELASTICSEARCH_USERNAME = os.environ.get('ELASTICSEARCH_USERNAME', '')
    ELASTICSEARCH_PASSWORD = os.environ.get('ELASTICSEARCH_PASSWORD', '')
    ELASTICSEARCH_CONNECTION_TIMEOUT = int(os.environ.get('ELASTICSEARCH_CONNECTION_TIMEOUT', 10))
    ELASTICSEARCH_RETRY_COUNT = int(os.environ.get('ELASTICSEARCH_RETRY_COUNT', 3))
    ELASTICSEARCH_RETRY_DELAY = int(os.environ.get('ELASTICSEARCH_RETRY_DELAY', 5))
    
    # ============================================
    # 会话配置
    # ============================================
    SESSION_TYPE = 'filesystem'
    PERMANENT_SESSION_LIFETIME = 86400  # 会话有效期24小时
    SESSION_COOKIE_SAMESITE = 'Lax'  # 开发环境使用Lax，生产环境可用None
    SESSION_COOKIE_HTTPONLY = True  # 防止JavaScript访问cookie
    SESSION_COOKIE_SECURE = False  # 开发环境设为False，生产环境应为True
    SESSION_COOKIE_NAME = 'session_id'
    SESSION_COOKIE_PATH = '/'
    
    # ============================================
    # CORS配置
    # ============================================
    CORS_SUPPORTS_CREDENTIALS = True
    CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']


class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    SQLALCHEMY_ENGINE_OPTIONS = {
        **Config.SQLALCHEMY_ENGINE_OPTIONS,
        'echo': True,  # 开发环境打印SQL语句方便调试
    }

    # 开发环境使用SimpleCache (内存缓存，无需安装Redis服务器)
    CACHE_TYPE = 'SimpleCache'

    # 开发环境较短的缓存时间，方便调试
    CACHE_DEFAULT_TIMEOUT = 60  # 1分钟
    CACHE_SESSION_TIMEOUT = 300  # 5分钟
    CACHE_COURSES_TIMEOUT = 120  # 2分钟
    CACHE_STATS_TIMEOUT = 60     # 1分钟


class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False
    
    # 生产环境更严格的连接池配置
    SQLALCHEMY_ENGINE_OPTIONS = {
        **Config.SQLALCHEMY_ENGINE_OPTIONS,
        'pool_size': 20,           # 更大的连接池
        'max_overflow': 30,        # 更多的溢出连接
        'pool_timeout': 60,        # 更长的超时时间
        'pool_recycle': 3600,      # 每小时回收连接
        'pool_pre_ping': True,     # 确保连接有效
    }
    
    # 生产环境使用真实Redis
    CACHE_TYPE = 'RedisCache'
    
    # 生产环境较长的缓存时间
    CACHE_DEFAULT_TIMEOUT = 300   # 5分钟
    CACHE_SESSION_TIMEOUT = 86400 # 24小时
    CACHE_COURSES_TIMEOUT = 3600  # 1小时
    CACHE_STATS_TIMEOUT = 300     # 5分钟
    CACHE_CONTENT_TIMEOUT = 1800  # 30分钟
    CACHE_ASSESSMENT_TIMEOUT = 900 # 15分钟


class TestingConfig(Config):
    """测试环境配置"""
    TESTING = True
    DEBUG = True

    # 测试环境使用内存数据库或独立测试数据库
    SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL') or \
        'postgresql://zhijiaoxing_user:zhijiaoxing_password@localhost:5432/zhijiaoxing_test_db'

    # 测试环境较小的连接池
    SQLALCHEMY_ENGINE_OPTIONS = {
        **Config.SQLALCHEMY_ENGINE_OPTIONS,
        'pool_size': 5,
        'max_overflow': 10,
    }

    # 测试环境使用NullCache (禁用缓存，确保测试准确性)
    CACHE_TYPE = 'NullCache'

    # 测试环境最短的缓存时间
    CACHE_DEFAULT_TIMEOUT = 10    # 10秒
    CACHE_SESSION_TIMEOUT = 30    # 30秒
    CACHE_COURSES_TIMEOUT = 10    # 10秒
    CACHE_STATS_TIMEOUT = 5       # 5秒


# 配置映射字典
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config():
    """
    获取当前环境的配置
    
    根据环境变量 FLASK_ENV 返回对应的配置类
    """
    env = os.environ.get('FLASK_ENV', 'development')
    return config_by_name.get(env, DevelopmentConfig)
