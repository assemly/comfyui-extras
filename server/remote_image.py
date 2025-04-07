import os
import folder_paths
import requests
import urllib.parse
import hashlib
import time
from PIL import Image, ImageDraw, ImageFont
import io
import json
import aiohttp
import asyncio
from server import PromptServer
import numpy as np
import torch


class RemoteImageLoader:
    """加载远程图像的节点，支持HTTP和HTTPS链接"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "url": ("STRING", {"default": "https://example.com/image.jpg"}),
            },
            "optional": {
                "cache_timeout": ("INT", {"default": 3600, "min": 0, "max": 86400, "step": 60}),
                "api_key": ("STRING", {"default": ""}),
            }
        }
    
    RETURN_TYPES = ("IMAGE", )
    RETURN_NAMES = ("image", )
    OUTPUT_NODE = True
    FUNCTION = "load_image"
    CATEGORY = "学习中心"
    
    def __init__(self):
        self.output_dir = folder_paths.get_temp_directory()
        self.cache_dir = os.path.join(self.output_dir, "remote_cache")
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def get_cache_path(self, url):
        """获取URL对应的缓存路径"""
        # 使用URL的MD5哈希作为文件名
        url_hash = hashlib.md5(url.encode()).hexdigest()
        return os.path.join(self.cache_dir, f"{url_hash}.png")
    
    def is_cache_valid(self, cache_path, timeout):
        """检查缓存是否有效"""
        if not os.path.exists(cache_path):
            return False
        
        # 检查文件修改时间
        file_time = os.path.getmtime(cache_path)
        current_time = time.time()
        return (current_time - file_time) < timeout
    
    def create_error_image(self, error_message):
        """创建表示错误的图像"""
        # 创建一个256x256的红色背景图像
        error_img = Image.new("RGB", (480, 240), (40, 40, 40))
        draw = ImageDraw.Draw(error_img)
        
        # 添加红色标题背景
        draw.rectangle([(0, 0), (480, 40)], fill=(180, 30, 30))
        
        # 添加错误标题
        draw.text((10, 10), "远程图像加载错误", fill=(255, 255, 255))
        
        # 错误消息（可能很长，需要换行）
        error_lines = []
        words = error_message.split()
        current_line = ""
        
        for word in words:
            test_line = current_line + " " + word if current_line else word
            if len(test_line) <= 60:  # 每行最多60个字符
                current_line = test_line
            else:
                error_lines.append(current_line)
                current_line = word
                
        if current_line:
            error_lines.append(current_line)
            
        # 绘制错误消息
        y_position = 50
        for line in error_lines:
            draw.text((10, y_position), line, fill=(255, 255, 255))
            y_position += 20
            
        # 转换为ComfyUI格式的张量
        img_np = np.array(error_img).astype(np.float32) / 255.0
        img_tensor = torch.from_numpy(img_np)[None,]
        return img_tensor
    
    def load_image(self, url, cache_timeout=3600, api_key=""):
        try:
            # 清理URL
            url = url.strip()
            if not url.startswith(('http://', 'https://')):
                raise ValueError("URL必须以http://或https://开头")
            
            # 获取缓存路径
            cache_path = self.get_cache_path(url)
            
            # 检查缓存
            if self.is_cache_valid(cache_path, cache_timeout):
                print(f"[RemoteImageLoader] 从缓存加载图像: {url}")
                img = Image.open(cache_path)
                img = img.convert("RGB")
                img_np = np.array(img).astype(np.float32) / 255.0
                img_tensor = torch.from_numpy(img_np)[None,]
                return (img_tensor, )
            
            # 设置请求头
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            
            # 下载图像
            print(f"[RemoteImageLoader] 下载远程图像: {url}")
            response = requests.get(url, headers=headers, stream=True, timeout=10)
            response.raise_for_status()
            
            # 从响应中读取图像
            img = Image.open(io.BytesIO(response.content))
            
            # 保存到缓存
            img.save(cache_path, "PNG")
            
            # 转换为RGB模式
            img = img.convert("RGB")
            
            # 转换为ComfyUI格式的张量
            img_np = np.array(img).astype(np.float32) / 255.0
            img_tensor = torch.from_numpy(img_np)[None,]
            
            return (img_tensor, )
        
        except requests.RequestException as e:
            print(f"[RemoteImageLoader] 网络请求错误: {e}")
            if hasattr(e, 'response') and e.response is not None:
                status_code = e.response.status_code
                error_msg = f"网络错误 ({status_code}): {str(e)}"
            else:
                error_msg = f"网络错误: {str(e)}"
            return (self.create_error_image(error_msg), )
            
        except ValueError as e:
            print(f"[RemoteImageLoader] URL格式错误: {e}")
            return (self.create_error_image(f"URL格式错误: {str(e)}"), )
            
        except Exception as e:
            print(f"[RemoteImageLoader] 加载远程图像出错: {e}")
            import traceback
            traceback.print_exc()
            return (self.create_error_image(f"未知错误: {str(e)}"), )


class ProgressIndicator:
    """生成进度指示器图像，显示完成情况和当前状态"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "title": ("STRING", {"default": "学习进度"}),
                "status": ("STRING", {"default": "学习中..."}),
                "progress": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
            "optional": {
                "completed_color": (["绿色", "蓝色", "橙色", "紫色"], {"default": "绿色"}),
                "width": ("INT", {"default": 512, "min": 256, "max": 1024, "step": 8}),
                "show_percentage": ("BOOLEAN", {"default": True}),
            }
        }
    
    RETURN_TYPES = ("IMAGE", )
    RETURN_NAMES = ("image", )
    OUTPUT_NODE = True
    FUNCTION = "generate_progress"
    CATEGORY = "学习中心"
    
    def generate_progress(self, title, status, progress, completed_color="绿色", width=512, show_percentage=True):
        """生成进度指示器图像"""
        height = int(width * 0.2)  # 高度为宽度的20%
        
        # 创建背景
        img = Image.new("RGB", (width, height), (40, 40, 40))
        draw = ImageDraw.Draw(img)
        
        # 标题区域
        draw.rectangle([(0, 0), (width, 40)], fill=(60, 60, 60))
        
        # 绘制标题
        draw.text((10, 10), title, fill=(255, 255, 255))
        
        # 绘制状态
        status_y = 50
        draw.text((10, status_y), status, fill=(200, 200, 200))
        
        # 确定进度条颜色
        if completed_color == "绿色":
            bar_color = (0, 180, 0)
        elif completed_color == "蓝色":
            bar_color = (0, 120, 255)
        elif completed_color == "橙色":
            bar_color = (255, 140, 0)
        elif completed_color == "紫色":
            bar_color = (180, 0, 180)
        else:
            bar_color = (0, 180, 0)
        
        # 绘制进度条背景
        bar_y = status_y + 30
        bar_height = 20
        border = 2
        draw.rectangle([(10, bar_y), (width - 10, bar_y + bar_height)], fill=(70, 70, 70), outline=(100, 100, 100))
        
        # 绘制进度条
        progress_width = int((width - 20 - 2 * border) * progress)
        if progress_width > 0:
            draw.rectangle([(10 + border, bar_y + border), 
                           (10 + border + progress_width, bar_y + bar_height - border)], 
                           fill=bar_color)
        
        # 绘制百分比
        if show_percentage:
            percent_text = f"{int(progress * 100)}%"
            draw.text((width // 2, bar_y + 2), percent_text, fill=(255, 255, 255))
        
        # 转换为ComfyUI格式的张量
        img_np = np.array(img).astype(np.float32) / 255.0
        img_tensor = torch.from_numpy(img_np)[None,]
        
        return (img_tensor, )


class ChapterInfoDisplay:
    """显示章节信息的节点"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "chapter_id": ("STRING", {"default": "chapter1_intro"}),
            }
        }
    
    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "chapter_title")
    OUTPUT_NODE = True
    FUNCTION = "get_chapter_info"
    CATEGORY = "学习中心"
    
    def generate_info_image(self, title, description, difficulty, completed=False, stats=None):
        """生成章节信息图像"""
        width = 768
        height = 320
        
        # 创建背景
        img = Image.new("RGB", (width, height), (40, 40, 40))
        draw = ImageDraw.Draw(img)
        
        # 尝试加载字体，如果失败则使用默认字体
        try:
            # 尝试加载微软雅黑字体(Windows)或其他常见字体
            font_paths = [
                "c:/windows/fonts/msyh.ttc",  # Windows 微软雅黑
                "c:/windows/fonts/simhei.ttf",  # Windows 黑体
                "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",  # Linux
                "/System/Library/Fonts/PingFang.ttc"  # macOS
            ]
            
            title_font = None
            normal_font = None
            
            for path in font_paths:
                if os.path.exists(path):
                    title_font = ImageFont.truetype(path, 22)
                    normal_font = ImageFont.truetype(path, 16)
                    small_font = ImageFont.truetype(path, 14)
                    break
        except Exception as e:
            print(f"[ChapterInfoDisplay] 加载字体出错: {e}")
            title_font = None
            normal_font = None
            small_font = None
        
        # 标题区域
        if completed:
            header_color = (0, 120, 0)  # 已完成使用绿色
        else:
            header_color = (50, 80, 120)  # 未完成使用蓝色
            
        draw.rectangle([(0, 0), (width, 50)], fill=header_color)
        
        # 绘制标题
        draw.text((20, 15), title, fill=(255, 255, 255), font=title_font)
        
        # 绘制完成状态
        if completed:
            status_text = "已完成"
            status_color = (100, 255, 100)
        else:
            status_text = "未完成"
            status_color = (200, 200, 200)
            
        # 在右上角显示状态
        status_width = 80
        if title_font:
            status_width = title_font.getbbox(status_text)[2]
        draw.text((width - status_width - 20, 15), status_text, fill=status_color, font=title_font)
        
        # 绘制难度指示器
        difficulty_map = {
            "beginner": ("初级", (100, 255, 100)),
            "intermediate": ("中级", (255, 180, 0)),
            "advanced": ("高级", (255, 100, 100))
        }
        
        diff_text, diff_color = difficulty_map.get(difficulty, ("未知", (200, 200, 200)))
        draw.text((20, 60), f"难度: {diff_text}", fill=diff_color, font=normal_font)
        
        # 分割线
        draw.line([(20, 90), (width - 20, 90)], fill=(80, 80, 80), width=1)
        
        # 改进的中文文本分行算法
        def split_text_to_lines(text, max_width, font=None):
            if not text:
                return []
                
            lines = []
            current_line = ""
            
            # 对于中文，按字符分割更合适
            for char in text:
                test_line = current_line + char
                
                # 如果有字体，使用字体计算宽度；否则按字符数计算
                if font:
                    text_width = font.getbbox(test_line)[2]
                    is_too_wide = text_width > max_width
                else:
                    is_too_wide = len(test_line) > max_width
                
                if is_too_wide and current_line:
                    lines.append(current_line)
                    current_line = char
                else:
                    current_line = test_line
            
            if current_line:
                lines.append(current_line)
                
            return lines
        
        # 将描述分成多行，最多显示7行
        desc_max_width = width - 40  # 左右各留20像素
        desc_lines = split_text_to_lines(description, desc_max_width, normal_font)
        
        # 最多显示7行描述
        if len(desc_lines) > 7:
            desc_lines = desc_lines[:6]
            desc_lines.append("...")
            
        # 绘制描述
        y_position = 100
        for line in desc_lines:
            draw.text((20, y_position), line, fill=(220, 220, 220), font=normal_font)
            y_position += 30 if normal_font else 25
            
        # 如果有统计信息，显示在底部
        if stats:
            draw.line([(20, height - 60), (width - 20, height - 60)], fill=(80, 80, 80), width=1)
            stats_y = height - 50
            draw.text((20, stats_y), stats, fill=(180, 180, 180), font=small_font)
        
        # 转换为ComfyUI格式的张量
        img_np = np.array(img).astype(np.float32) / 255.0
        img_tensor = torch.from_numpy(img_np)[None,]
        return img_tensor
    
    def get_chapter_info(self, chapter_id):
        """获取并显示章节信息"""
        try:
            # 获取当前模块路径
            current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            
            # 模板目录
            templates_dir = os.path.join(current_dir, "templates")
            chapter_dir = os.path.join(templates_dir, chapter_id)
            
            # 检查目录是否存在
            if not os.path.isdir(chapter_dir):
                error_msg = f"找不到章节: {chapter_id}"
                print(f"[ChapterInfoDisplay] {error_msg}")
                error_image = self.generate_info_image(
                    "错误", 
                    error_msg, 
                    "unknown", 
                    False
                )
                return (error_image, "错误")
            
            # 读取元数据
            metadata_path = os.path.join(chapter_dir, "metadata.json")
            if not os.path.exists(metadata_path):
                error_msg = f"章节缺少元数据文件: {chapter_id}"
                print(f"[ChapterInfoDisplay] {error_msg}")
                error_image = self.generate_info_image(
                    "元数据错误", 
                    error_msg, 
                    "unknown", 
                    False
                )
                return (error_image, "元数据错误")
            
            # 安全读取JSON文件的辅助函数
            def safe_read_json(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8-sig") as f:
                        return json.load(f)
                except Exception as e:
                    print(f"[ChapterInfoDisplay] 读取文件出错 {file_path}: {e}")
                    try:
                        with open(file_path, "r", encoding="gbk") as f:
                            return json.load(f)
                    except Exception as e2:
                        print(f"[ChapterInfoDisplay] 第二次尝试读取文件也失败 {file_path}: {e2}")
                        return None

            try:
                metadata = safe_read_json(metadata_path)
                if metadata is None:
                    error_msg = "无法读取元数据文件"
                    print(f"[ChapterInfoDisplay] {error_msg}")
                    error_image = self.generate_info_image(
                        "元数据读取错误", 
                        error_msg, 
                        "unknown", 
                        False
                    )
                    return (error_image, "元数据读取错误")
            except Exception as e:
                error_msg = f"读取元数据出错: {str(e)}"
                print(f"[ChapterInfoDisplay] {error_msg}")
                error_image = self.generate_info_image(
                    "元数据读取错误", 
                    error_msg, 
                    "unknown", 
                    False
                )
                return (error_image, "元数据读取错误")
            
            # 检查用户进度
            user_progress_dir = os.path.join(current_dir, "user_progress")
            progress_file = os.path.join(user_progress_dir, "progress.json")
            completed = False
            
            if os.path.exists(progress_file):
                progress = safe_read_json(progress_file)
                if progress:
                    completed = progress.get("completed_chapters", {}).get(chapter_id, False)
            
            # 提取信息
            title = metadata.get("title", "未知标题")
            description = metadata.get("description", "没有描述")
            difficulty = metadata.get("difficulty", "beginner")
            
            # 章节统计信息
            exercise_path = os.path.join(chapter_dir, "exercise.json")
            answer_path = os.path.join(chapter_dir, "answer.json")
            has_exercise = os.path.exists(exercise_path)
            has_answer = os.path.exists(answer_path)
            
            stats = f"练习: {'有' if has_exercise else '无'} | 答案: {'有' if has_answer else '无'}"
            if "estimated_time" in metadata:
                stats += f" | 预计学习时间: {metadata['estimated_time']}"
            
            # 生成图像
            info_image = self.generate_info_image(
                title, 
                description, 
                difficulty, 
                completed,
                stats
            )
            print(f"[ChapterInfoDisplay] 生成章节信息图像: {title}")
            return (info_image, title)
            
        except Exception as e:
            print(f"[ChapterInfoDisplay] 处理章节信息出错: {e}")
            import traceback
            traceback.print_exc()
            error_image = self.generate_info_image(
                "处理错误", 
                f"处理章节信息时出错: {str(e)}", 
                "unknown", 
                False
            )
            return (error_image, "处理错误")


# API路由：清除图像缓存
@PromptServer.instance.routes.post("/api/remote_image/clear_cache")
async def clear_cache(request):
    try:
        loader = RemoteImageLoader()
        cache_dir = loader.cache_dir
        
        # 统计删除的文件数
        count = 0
        for file in os.listdir(cache_dir):
            if file.endswith(".png"):
                os.remove(os.path.join(cache_dir, file))
                count += 1
        
        return aiohttp.web.json_response({"success": True, "message": f"已清除{count}个缓存文件"})
    
    except Exception as e:
        print(f"[RemoteImageLoader] 清除缓存出错: {e}")
        return aiohttp.web.json_response({"success": False, "error": str(e)}, status=500)


# API路由：获取缓存状态
@PromptServer.instance.routes.get("/api/remote_image/cache_status")
async def cache_status(request):
    try:
        loader = RemoteImageLoader()
        cache_dir = loader.cache_dir
        
        # 统计缓存文件
        files = []
        total_size = 0
        
        for file in os.listdir(cache_dir):
            if file.endswith(".png"):
                file_path = os.path.join(cache_dir, file)
                file_size = os.path.getsize(file_path)
                file_time = os.path.getmtime(file_path)
                
                files.append({
                    "file": file,
                    "size": file_size,
                    "time": file_time,
                    "time_str": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(file_time))
                })
                
                total_size += file_size
        
        # 按时间排序
        files.sort(key=lambda x: x["time"], reverse=True)
        
        return aiohttp.web.json_response({
            "success": True,
            "cache_count": len(files),
            "cache_size": total_size,
            "cache_size_mb": round(total_size / (1024 * 1024), 2),
            "files": files[:100]  # 只返回最近的100个文件
        })
    
    except Exception as e:
        print(f"[RemoteImageLoader] 获取缓存状态出错: {e}")
        return aiohttp.web.json_response({"success": False, "error": str(e)}, status=500)


# 注册节点
NODE_CLASS_MAPPINGS = {
    "RemoteImageLoader": RemoteImageLoader,
    "ProgressIndicator": ProgressIndicator,
    "ChapterInfoDisplay": ChapterInfoDisplay
}

# 节点显示名称
NODE_DISPLAY_NAME_MAPPINGS = {
    "RemoteImageLoader": "远程图像加载器",
    "ProgressIndicator": "进度指示器",
    "ChapterInfoDisplay": "章节信息显示"
} 