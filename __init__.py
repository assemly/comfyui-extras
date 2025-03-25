"""
@author: assemly
@title:  Monitor
@nickname: Monitor
@version: 1.0.0
@description: 系统资源监控插件，用于显示CPU、RAM、GPU等资源使用情况
"""
from .server.monitor import *

NODE_CLASS_MAPPINGS = {
   
}

NODE_DISPLAY_NAME_MAPPINGS = {
   
}

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
