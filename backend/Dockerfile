# 智教星后端 Dockerfile
# 基于 Python 3.11 构建 Flask 应用

FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制源代码
COPY src/ ./src/
COPY instance/ ./instance/

# 创建必要的目录
RUN mkdir -p uploads/videos uploads/images logs

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["python", "src/main.py"]