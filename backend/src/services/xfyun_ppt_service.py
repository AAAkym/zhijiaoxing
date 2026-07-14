"""讯飞智能PPT生成服务封装。

对接 zwapi.xfyun.cn 智能PPT生成接口，封装：
- 鉴权（MD5 + HMAC-SHA1 + Base64）
- 创建PPT生成任务（POST /api/ppt/v2/create）
- 轮询生成进度（GET /api/ppt/v2/progress，限流3秒/次）
- 下载.pptx文件并落盘

凭证仅从环境变量读取，禁止硬编码（遵循项目安全底线）。
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urljoin

import requests
from dotenv import load_dotenv

# 与 spark_service.py 一致，从 backend/.env 加载
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(env_path)

logger = logging.getLogger(__name__)


class XfyunPPTService:
    """讯飞智能PPT生成服务单例。

    复刻 spark_service.py 的单例 + is_configured 模式，
    供 PPTAgent 与 ppt 路由共用。
    """

    # API 端点（v2 接口，支持模板/配图/演讲备注）
    _CREATE_PATH = '/api/ppt/v2/create'
    _PROGRESS_PATH = '/api/ppt/v2/progress'
    _OUTLINE_PATH = '/api/ppt/v2/outline'

    def __init__(self):
        self._app_id = os.environ.get('XFYUN_PPT_APP_ID')
        self._api_secret = os.environ.get('XFYUN_PPT_API_SECRET')
        self._api_base = os.environ.get('XFYUN_PPT_API_BASE', 'https://zwapi.xfyun.cn')
        self._poll_interval = int(os.environ.get('XFYUN_PPT_POLL_INTERVAL', 3))
        self._max_wait = int(os.environ.get('XFYUN_PPT_MAX_WAIT', 180))

    # ------------------------------------------------------------------ #
    #  配置检测
    # ------------------------------------------------------------------ #
    def is_configured(self) -> bool:
        """凭证是否已配置。复刻 spark_service.is_configured 风格。"""
        return bool(self._app_id and self._api_secret)

    # ------------------------------------------------------------------ #
    #  鉴权
    # ------------------------------------------------------------------ #
    def _build_auth_headers(self) -> Dict[str, str]:
        """构建讯飞鉴权 Header。

        算法（来自官方文档）：
            ts = 当前时间戳（秒）
            auth = MD5(appId + ts)          # 32位十六进制
            signature = HMAC-SHA1(auth, apiSecret) → Base64
        Header: appId / timestamp / signature
        """
        if not self.is_configured():
            raise RuntimeError("讯飞PPT凭证未配置，请检查 XFYUN_PPT_APP_ID / XFYUN_PPT_API_SECRET 环境变量")

        ts = int(time.time())
        auth = hashlib.md5(f"{self._app_id}{ts}".encode('utf-8')).hexdigest()
        signature = base64.b64encode(
            hmac.new(self._api_secret.encode('utf-8'), auth.encode('utf-8'), hashlib.sha1).digest()
        ).decode('utf-8')

        return {
            'appId': self._app_id,
            'timestamp': str(ts),
            'signature': signature,
        }

    # ------------------------------------------------------------------ #
    #  创建PPT生成任务
    # ------------------------------------------------------------------ #
    def create_task(self, query: str, template_id: Optional[str] = None,
                    is_card_note: bool = True, is_figure: bool = True) -> Dict[str, Any]:
        """创建PPT生成任务。

        Args:
            query: PPT生成主题/描述文本
            template_id: PPT模板ID（可选，从模板列表接口获取）
            is_card_note: 是否生成演讲备注
            is_figure: 是否自动配图

        Returns:
            讯飞返回的完整JSON响应（含 sid）

        Note:
            讯飞 v2 接口 (/api/ppt/v2/create) 要求表单格式提交
            （application/x-www-form-urlencoded 或 multipart/form-data），
            若用 application/json 提交，讯飞会返回 21001 "query不能为空"。
            因此这里用 requests 的 data=dict 形式提交，由 requests 自动
            以 application/x-www-form-urlencoded 编码。
        """
        url = urljoin(self._api_base + '/', 'api/ppt/v2/create')
        # 不设置 Content-Type，让 requests 根据 data 类型自动选择
        headers = self._build_auth_headers()

        # 表单字段（讯飞 v2 接口字段名为 camelCase，值需为字符串）
        form_fields: Dict[str, str] = {'query': query}
        if template_id:
            form_fields['templateId'] = template_id
        form_fields['isCardNote'] = str(is_card_note)
        form_fields['isFigure'] = str(is_figure)
        form_fields['aiImage'] = 'normal'  # 普通配图（20%正文配图）

        logger.info("创建讯飞PPT任务: query=%s", query[:50])
        resp = requests.post(url, data=form_fields, headers=headers, timeout=30)
        result = resp.json()

        if result.get('code') != 0:
            logger.error("讯飞PPT任务创建失败: %s", result)
            raise RuntimeError(f"讯飞PPT任务创建失败: {result.get('desc', result)}")

        logger.info("讯飞PPT任务创建成功: sid=%s", result.get('data', {}).get('sid'))
        return result

    # ------------------------------------------------------------------ #
    #  查询生成进度
    # ------------------------------------------------------------------ #
    def query_progress(self, sid: str) -> Dict[str, Any]:
        """查询单次生成进度（不轮询）。

        Returns:
            讯飞返回的完整JSON响应，data 含 pptStatus / pptUrl / process 等
        """
        url = urljoin(self._api_base + '/', f'api/ppt/v2/progress?sid={sid}')
        headers = self._build_auth_headers()

        resp = requests.get(url, headers=headers, timeout=15)
        return resp.json()

    # ------------------------------------------------------------------ #
    #  轮询直到完成
    # ------------------------------------------------------------------ #
    def wait_until_done(self, sid: str) -> Dict[str, Any]:
        """轮询生成进度直到完成或超时。

        官方限流：3秒/次。

        Returns:
            完成时的响应JSON（含 pptUrl）

        Raises:
            RuntimeError: 生成失败或超时
        """
        start = time.time()
        last_process = 0
        while True:
            elapsed = time.time() - start
            if elapsed > self._max_wait:
                raise RuntimeError(f"PPT生成超时（{self._max_wait}s），当前进度: {last_process}%")

            result = self.query_progress(sid)
            data = result.get('data', {})
            ppt_status = data.get('pptStatus', '')
            ai_image_status = data.get('aiImageStatus', '')
            card_note_status = data.get('cardNoteStatus', '')
            process = data.get('process', 0)
            last_process = process

            # 官方字段：done 表示完成，building 表示构建中，build_failed 表示失败
            if ppt_status == 'done' and ai_image_status == 'done' and card_note_status == 'done':
                logger.info("PPT生成完成: sid=%s, pptUrl=%s", sid, data.get('pptUrl'))
                return result

            if ppt_status == 'build_failed':
                raise RuntimeError(f"PPT生成失败: {data}")

            logger.debug("PPT生成中: sid=%s, process=%s%%, ppt=%s img=%s note=%s",
                         sid, process, ppt_status, ai_image_status, card_note_status)
            time.sleep(self._poll_interval)

    # ------------------------------------------------------------------ #
    #  下载.pptx到本地
    # ------------------------------------------------------------------ #
    def download_pptx(self, ppt_url: str, save_dir: str, filename: Optional[str] = None) -> str:
        """下载.pptx文件到本地目录。

        Args:
            ppt_url: 讯飞返回的.pptx下载链接
            save_dir: 保存目录
            filename: 文件名（不含则按时间戳生成）

        Returns:
            本地文件绝对路径
        """
        os.makedirs(save_dir, exist_ok=True)
        if not filename:
            filename = f"ppt_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{int(time.time()) % 10000}.pptx"
        if not filename.endswith('.pptx'):
            filename += '.pptx'

        save_path = os.path.join(save_dir, filename)
        logger.info("下载PPT: %s → %s", ppt_url, save_path)

        resp = requests.get(ppt_url, timeout=60, stream=True)
        resp.raise_for_status()
        with open(save_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        logger.info("PPT下载完成: %s (%d bytes)", save_path, os.path.getsize(save_path))
        return save_path

    # ------------------------------------------------------------------ #
    #  一站式生成
    # ------------------------------------------------------------------ #
    def generate(self, query: str, save_dir: str, template_id: Optional[str] = None) -> Dict[str, Any]:
        """一站式生成PPT：创建任务 → 轮询 → 下载。

        Args:
            query: PPT主题描述
            save_dir: .pptx保存目录
            template_id: 模板ID（可选）

        Returns:
            dict 含字段:
                - sid: 讯飞任务ID
                - ppt_url: 讯飞原始下载链接（时效性）
                - file_path: 本地.pptx文件路径
                - file_name: 本地文件名
                - outline: 大纲文本（如有）
        """
        create_resp = self.create_task(query, template_id=template_id)
        sid = create_resp['data']['sid']

        done_resp = self.wait_until_done(sid)
        data = done_resp.get('data', {})
        ppt_url = data.get('pptUrl')
        if not ppt_url:
            raise RuntimeError(f"PPT生成完成但未返回下载链接: {done_resp}")

        file_path = self.download_pptx(ppt_url, save_dir)
        return {
            'sid': sid,
            'ppt_url': ppt_url,
            'file_path': file_path,
            'file_name': os.path.basename(file_path),
            'outline': data.get('outline', ''),
        }


# 模块级单例，复刻 spark_service.py 的 spark_service 单例模式
xfyun_ppt_service = XfyunPPTService()


def is_configured() -> bool:
    """模块级便捷函数，复刻 spark_service.is_configured 命名约定。"""
    return xfyun_ppt_service.is_configured()
