"""
@title: ComfyUI学习中心
@nickname: LearningCenter
@version: 1.1.0
@author: AI助手团队
@description: ComfyUI学习中心插件，提供教程章节和示例工作流，帮助用户学习和掌握ComfyUI
"""

import os
import sys
import json
import folder_paths

from aiohttp import web
from server import PromptServer

print("[LearningCenter] 初始化学习中心插件...")

# 获取当前目录
current_dir = os.path.dirname(os.path.abspath(__file__))

# 模板和用户进度目录
TEMPLATES_DIR = os.path.join(current_dir, "templates")
USER_PROGRESS_DIR = os.path.join(current_dir, "user_progress")

# 确保目录存在
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(USER_PROGRESS_DIR, exist_ok=True)

# Web目录
WEB_DIRECTORY = os.path.join(os.path.dirname(os.path.realpath(__file__)), "web")

# 从remote_image.py导入节点
from .server.remote_image import NODE_CLASS_MAPPINGS as REMOTE_IMAGE_NODE_CLASS_MAPPINGS
from .server.remote_image import NODE_DISPLAY_NAME_MAPPINGS as REMOTE_IMAGE_NODE_DISPLAY_NAME_MAPPINGS

# 导入LearningCenter模块
from .server.learningcenter import init_LearningCenter

# 所有自定义节点类
NODE_CLASS_MAPPINGS = {
    **REMOTE_IMAGE_NODE_CLASS_MAPPINGS,
}

# 所有节点的显示名称
NODE_DISPLAY_NAME_MAPPINGS = {
    **REMOTE_IMAGE_NODE_DISPLAY_NAME_MAPPINGS,
}

# 初始化学习中心
init_LearningCenter()

print("[LearningCenter] 学习中心插件初始化完成!")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
