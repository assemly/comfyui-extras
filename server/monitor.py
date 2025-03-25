from server import PromptServer
from aiohttp import web
import psutil
import json
import os
import shutil

try:
    import torch
    has_torch = True
except ImportError:
    has_torch = False

try:
    import pynvml
    has_pynvml = True
except ImportError:
    has_pynvml = False

def get_resource_info():
    """获取系统资源信息"""
    # CPU使用率
    cpu_usage = psutil.cpu_percent(interval=0.1)
    
    # 内存使用情况
    memory = psutil.virtual_memory()
    memory_info = {
        "total": memory.total / (1024 * 1024),  # MB
        "used": memory.used / (1024 * 1024),    # MB
        "free": memory.available / (1024 * 1024),  # MB
        "percent": memory.percent
    }
    
    # GPU信息
    gpu_info = {"available": False, "usage": 0, "memory": {"total": 0, "used": 0, "free": 0, "percent": 0}}
    
    # 检查GPU是否可用
    if has_torch and torch.cuda.is_available():
        gpu_info["available"] = True
        
        # 尝试使用pynvml获取GPU详细信息
        if has_pynvml:
            try:
                pynvml.nvmlInit()
                device_count = pynvml.nvmlDeviceGetCount()
                
                if device_count > 0:
                    # 获取第一个GPU的信息（未来可扩展为多GPU支持）
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    
                    # GPU使用率
                    utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    gpu_info["usage"] = float(utilization.gpu)
                    
                    # GPU内存 - 直接获取各个值，而不是使用整个对象
                    memory_obj = pynvml.nvmlDeviceGetMemoryInfo(handle)
                    total_mem = float(memory_obj.total) / (1024 * 1024)  # MB
                    used_mem = float(memory_obj.used) / (1024 * 1024)    # MB
                    free_mem = float(memory_obj.free) / (1024 * 1024)    # MB
                    mem_percent = (used_mem / total_mem) * 100 if total_mem > 0 else 0
                    
                    gpu_info["memory"] = {
                        "total": total_mem,
                        "used": used_mem,
                        "free": free_mem,
                        "percent": mem_percent
                    }
                    
                    # GPU温度
                    try:
                        temperature = float(pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU))
                        gpu_info["temperature"] = temperature
                    except:
                        gpu_info["temperature"] = 0
            except Exception as e:
                print(f"pynvml错误: {e}")
        
        # 如果pynvml不可用或发生错误，使用torch提供的基本信息
        if "total" not in gpu_info["memory"] or gpu_info["memory"]["total"] == 0:
            try:
                # 获取当前已分配的GPU内存
                allocated = float(torch.cuda.memory_allocated(0)) / (1024 * 1024)  # MB
                reserved = float(torch.cuda.memory_reserved(0)) / (1024 * 1024)    # MB
                
                # 获取GPU总内存
                try:
                    total_mem = float(torch.cuda.get_device_properties(0).total_memory) / (1024 * 1024)  # MB
                except:
                    # 如果无法获取总内存，使用预估值
                    total_mem = reserved if reserved > 0 else 8 * 1024  # 预估8GB
                
                gpu_info["memory"] = {
                    "total": total_mem,
                    "used": allocated,
                    "free": total_mem - reserved,
                    "percent": (allocated / total_mem) * 100 if total_mem > 0 else 0
                }
            except Exception as e:
                print(f"torch GPU内存信息获取错误: {e}")
    
    # 确保所有数值都是标准的Python类型，以便JSON序列化
    result = {
        "cpu": {"usage": float(cpu_usage)},
        "memory": {
            "total": float(memory_info["total"]),
            "used": float(memory_info["used"]),
            "free": float(memory_info["free"]),
            "percent": float(memory_info["percent"])
        },
        "gpu": {
            "available": bool(gpu_info["available"]),
            "usage": float(gpu_info["usage"]),
            "memory": {
                "total": float(gpu_info["memory"]["total"]),
                "used": float(gpu_info["memory"]["used"]),
                "free": float(gpu_info["memory"]["free"]),
                "percent": float(gpu_info["memory"]["percent"])
            }
        }
    }
    
    # 如果有GPU温度信息，添加到结果中
    if "temperature" in gpu_info:
        result["gpu"]["temperature"] = float(gpu_info["temperature"])
    
    return result


@PromptServer.instance.routes.get("/monitor/resource_info")
async def get_resource_info_route(request):
    try:
        resource_info = get_resource_info()
        return web.json_response(resource_info)
    except Exception as e:
        print(f"获取资源信息错误: {e}")
        error_info = {"error": str(e), "message": "获取系统资源信息失败"}
        return web.json_response(error_info, status=500)


