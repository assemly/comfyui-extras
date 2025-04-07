from server import PromptServer
from aiohttp import web
import json
import os
import shutil
import time
import uuid
from pathlib import Path

# 确保目录存在
def ensure_directory(directory):
    """确保目录存在"""
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"[LearningCenter] 创建目录: {directory}")
    return directory

# 获取模板目录路径
def get_template_directories():
    """获取模板和用户进度目录"""
    current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    templates_dir = ensure_directory(os.path.join(current_dir, "templates"))
    user_progress_dir = ensure_directory(os.path.join(current_dir, "user_progress"))
    return templates_dir, user_progress_dir

# 获取用户进度文件路径
def get_user_progress_file():
    _, user_progress_dir = get_template_directories()
    return os.path.join(user_progress_dir, "progress.json")

# 读取用户进度
def load_user_progress():
    progress_file = get_user_progress_file()
    if os.path.exists(progress_file):
        try:
            with open(progress_file, "r", encoding="utf-8-sig") as f:
                return json.load(f)
        except Exception as e:
            print(f"[LearningCenter] 读取用户进度出错: {e}")
    
    # 如果文件不存在或读取错误，返回空进度
    return {"completed_chapters": {}}

# 保存用户进度
def save_user_progress(progress):
    progress_file = get_user_progress_file()
    try:
        with open(progress_file, "w", encoding="utf-8-sig") as f:
            json.dump(progress, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[LearningCenter] 保存用户进度出错: {e}")
        return False

# 插件初始化时打印信息
def init_LearningCenter():
    """初始化学习中心插件"""
    templates_dir, user_progress_dir = get_template_directories()
    print(f"[LearningCenter] 模板目录: {templates_dir}")
    print(f"[LearningCenter] 用户进度目录: {user_progress_dir}")
    
    # 确保用户进度文件存在
    progress_file = get_user_progress_file()
    if not os.path.exists(progress_file):
        # 创建空的进度文件
        save_user_progress({"completed_chapters": {}, "favorites": []})
        print(f"[LearningCenter] 创建空的用户进度文件: {progress_file}")
    else:
        # 验证进度文件格式
        try:
            progress = load_user_progress()
            if not isinstance(progress, dict):
                print(f"[LearningCenter] 警告: 用户进度文件格式不正确，重置为空")
                save_user_progress({"completed_chapters": {}, "favorites": []})
        except Exception as e:
            print(f"[LearningCenter] 警告: 读取用户进度出错，重置为空: {e}")
            save_user_progress({"completed_chapters": {}, "favorites": []})
    
    return True

# 初始化插件
init_LearningCenter()

# 教程难度分类
CHAPTER_DIFFICULTIES = ["beginner", "intermediate", "advanced"]

# API路由：获取所有章节
@PromptServer.instance.routes.get("/api/learningcenter/chapters")
async def get_chapters(request):
    try:
        templates_dir, _ = get_template_directories()
        chapters = []
        user_progress = load_user_progress()
        
        # 获取查询参数
        query_params = request.query
        search_term = query_params.get("search", "").lower()
        difficulty_filter = query_params.get("difficulty")
        purpose_filter = query_params.get("purpose")
        model_filter = query_params.get("model")
        
        print(f"[LearningCenter] 正在查询章节，过滤条件 search={search_term}, difficulty={difficulty_filter}, purpose={purpose_filter}, model={model_filter}")
        print(f"[LearningCenter] 原始查询参数: {dict(query_params)}")
        
        # 检查templates目录是否存在
        if not os.path.exists(templates_dir):
            print(f"[LearningCenter] 教程目录不存在 {templates_dir}")
            return web.json_response([])
                
        print(f"[LearningCenter] 正在扫描目录: {templates_dir}")
        
        # 遍历templates目录下的所有文件夹
        model_dirs = [d for d in os.listdir(templates_dir) 
                     if os.path.isdir(os.path.join(templates_dir, d))]
        
        # 临时存储所有章节的列表，用于计算过滤前后的数量
        all_chapters = []
        
        # 简单安全的读取JSON文件的辅助函数
        def safe_read_json(file_path):
            try:
                # 尝试以utf-8-sig方式读取，可以处理含BOM的文件
                with open(file_path, "r", encoding="utf-8-sig") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[LearningCenter] 读取文件出错 {file_path}: {e}")
                # 尝试不同的编码方式
                try:
                    with open(file_path, "r", encoding="gbk") as f:
                        return json.load(f)
                except Exception as e2:
                    print(f"[LearningCenter] 第二次尝试读取文件也失败 {file_path}: {e2}")
                    return {}
        
        # 扫描两种目录结构:
        # 1. 传统的章节结构: templates/chapter*/*
        # 2. 新的模型结构: templates/model/workflow_type/*
        
        # 扫描旧式章节目录结构
        chapter_dirs = [d for d in model_dirs if d.startswith("chapter")]
        chapter_dirs.sort(key=lambda x: int(x.replace("chapter", "").split("_")[0]) if x.replace("chapter", "").split("_")[0].isdigit() else 999)
        
        for chapter_dir in chapter_dirs:
            chapter_path = os.path.join(templates_dir, chapter_dir)
            
            # 检查是否有metadata.json文件
            metadata_path = os.path.join(chapter_path, "metadata.json")
            if not os.path.exists(metadata_path):
                print(f"[LearningCenter] 章节目录中没有元数据文件，跳过 {chapter_path}")
                continue
            
            # 读取章节元数据
            metadata = safe_read_json(metadata_path)
            
            # 章节ID就是目录名
            chapter_id = chapter_dir
            
            # 检查练习和答案工作流是否存在
            exercise_path = os.path.join(chapter_path, "exercise.json")
            answer_path = os.path.join(chapter_path, "answer.json")
            
            has_exercise = os.path.exists(exercise_path)
            has_answer = os.path.exists(answer_path)
            
            # 检查是否有预览图
            preview_path = os.path.join(chapter_path, "preview.png")
            has_preview = os.path.exists(preview_path)
            
            # 获取用户完成状态
            is_completed = user_progress.get("completed_chapters", {}).get(chapter_id, False)
            
            # 补充元数据
            metadata.update({
                "id": chapter_id,
                "has_exercise": has_exercise,
                "has_answer": has_answer,
                "has_preview": has_preview,
                "completed": is_completed,
                "created_at": os.path.getctime(chapter_path)
            })
            
            # 添加到临时列表
            all_chapters.append(metadata)
        
        # 扫描新的模型目录结构
        for model_dir in model_dirs:
            if model_dir.startswith("chapter"):
                continue  # 已经处理过的旧式目录结构，跳过
                
            model_path = os.path.join(templates_dir, model_dir)
            # 检查是否为目录
            if not os.path.isdir(model_path):
                continue
                
            print(f"[LearningCenter] 扫描模型目录: {model_dir}")
            
            # 检查模型目录中的元数据文件
            model_metadata_path = os.path.join(model_path, "metadata.json")
            model_metadata = safe_read_json(model_metadata_path)
            
            # 遍历模型下的所有工作流类型目录
            workflow_dirs = [d for d in os.listdir(model_path) 
                           if os.path.isdir(os.path.join(model_path, d))]
            
            for workflow_dir in workflow_dirs:
                workflow_path = os.path.join(model_path, workflow_dir)
                print(f"[LearningCenter] 扫描工作流目录: {workflow_dir}")
                
                # 检查工作流类型目录中的元数据文件
                workflow_metadata_path = os.path.join(workflow_path, "metadata.json")
                if not os.path.exists(workflow_metadata_path):
                    print(f"[LearningCenter] 工作流目录中没有元数据文件，跳过 {workflow_path}")
                    continue
                
                # 读取工作流元数据
                workflow_metadata = safe_read_json(workflow_metadata_path)
                
                # 构建章节ID
                chapter_id = f"{model_dir}/{workflow_dir}"
                
                # 检查练习和答案工作流是否存在
                exercise_path = os.path.join(workflow_path, "exercise.json")
                answer_path = os.path.join(workflow_path, "answer.json")
                
                has_exercise = os.path.exists(exercise_path)
                has_answer = os.path.exists(answer_path)
                
                # 检查是否有预览图
                preview_path = os.path.join(workflow_path, "preview.png")
                has_preview = os.path.exists(preview_path)
                
                # 获取用户完成状态
                is_completed = user_progress.get("completed_chapters", {}).get(chapter_id, False)
                
                # 补充元数据
                combined_metadata = workflow_metadata.copy()
                combined_metadata.update({
                    "id": chapter_id,
                    "has_exercise": has_exercise,
                    "has_answer": has_answer,
                    "has_preview": has_preview,
                    "completed": is_completed,
                    "created_at": os.path.getctime(workflow_path),
                    "model": model_dir if "model" not in combined_metadata else combined_metadata["model"]
                })
                
                # 添加到临时列表
                all_chapters.append(combined_metadata)
                print(f"[LearningCenter] 添加章节: {chapter_id}")
            
        # 简化过滤逻辑，确保过滤器正确工作
        # 在应用过滤器前打印总章节数
        print(f"[LearningCenter] 过滤前总章节数: {len(all_chapters)}")
            
        # 应用过滤器
        filtered_chapters = []
        for metadata in all_chapters:
            should_include = True  # 假设初始条件为包含此章节
            
            # 搜索词过滤
            if search_term:
                if not (
                    search_term in metadata.get("title", "").lower() or
                    search_term in metadata.get("description", "").lower() or
                    search_term in metadata.get("id", "").lower()
                ):
                    print(f"[LearningCenter] 章节 {metadata.get('id')} 因搜索词不匹配而被过滤掉")
                    should_include = False
            
            # 难度过滤
            if difficulty_filter and should_include:
                chapter_difficulty = metadata.get("difficulty", "").lower()
                if chapter_difficulty != difficulty_filter.lower():
                    print(f"[LearningCenter] 章节 {metadata.get('id')} 因难度不匹配而被过滤掉：章节难度={chapter_difficulty}, 过滤条件={difficulty_filter.lower()}")
                    should_include = False
                
            # 用途过滤
            if purpose_filter and purpose_filter.lower() != "" and should_include:
                chapter_purpose = metadata.get("purpose", "").lower()
                print(f"[LearningCenter] 比较用途 章节用途{chapter_purpose}, 过滤条件={purpose_filter.lower()}")
                if chapter_purpose != purpose_filter.lower():
                    print(f"[LearningCenter] 章节 {metadata.get('id')} 因用途不匹配而被过滤掉：章节用途{chapter_purpose}, 过滤条件={purpose_filter.lower()}")
                    should_include = False
                else:
                    print(f"[LearningCenter] 章节 {metadata.get('id')} 通过用途过滤")
                
            # 模型过滤
            if model_filter and model_filter.lower() != "" and should_include:
                chapter_model = metadata.get("model", "").lower()
                print(f"[LearningCenter] 比较模型: 章节模型={chapter_model}, 过滤条件={model_filter.lower()}")
                if chapter_model != model_filter.lower():
                    print(f"[LearningCenter] 章节 {metadata.get('id')} 因模型不匹配而被过滤掉：章节模型={chapter_model}, 过滤条件={model_filter.lower()}")
                    should_include = False
                else:
                    print(f"[LearningCenter] 章节 {metadata.get('id')} 通过模型过滤")
            
            # 如果通过所有过滤条件，添加到结果列表
            if should_include:
                print(f"[LearningCenter] 章节 {metadata.get('id')} 通过了所有过滤条件")
                filtered_chapters.append(metadata)
            
        # 在应用过滤器后打印章节数
        print(f"[LearningCenter] 过滤后章节数: {len(filtered_chapters)}")
        
        # 返回过滤后的章节
        return web.json_response(filtered_chapters)
    except Exception as e:
        print(f"[LearningCenter] 获取章节列表错误: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)

# API路由：获取章节详情
@PromptServer.instance.routes.get("/api/learningcenter/chapters/{chapter_id}")
async def get_chapter_details(request):
    try:
        chapter_id = request.match_info["chapter_id"]
        templates_dir, _ = get_template_directories()
        user_progress = load_user_progress()
        
        print(f"[LearningCenter] 正在查找章节详情: {chapter_id}")
        print(f"[LearningCenter] 模板目录: {templates_dir}")
        
        # 安全读取JSON文件的辅助函数
        def safe_read_json(file_path):
            try:
                with open(file_path, "r", encoding="utf-8-sig") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[LearningCenter] 读取文件出错 {file_path}: {e}")
                try:
                    with open(file_path, "r", encoding="gbk") as f:
                        return json.load(f)
                except Exception as e2:
                    print(f"[LearningCenter] 第二次尝试读取文件也失败 {file_path}: {e2}")
                    return {}
        
        # 安全读取文本文件的辅助函数    
        def safe_read_text(file_path):
            try:
                with open(file_path, "r", encoding="utf-8-sig") as f:
                    return f.read()
            except Exception as e:
                print(f"[LearningCenter] 读取文件出错 {file_path}: {e}")
                try:
                    with open(file_path, "r", encoding="gbk") as f:
                        return f.read()
                except Exception as e2:
                    print(f"[LearningCenter] 第二次尝试读取文件也失败 {file_path}: {e2}")
                    return None
        
        # 处理新的目录结构格式
        is_new_format = '/' in chapter_id
        
        print(f"[LearningCenter] 章节ID格式: {'新格式 (model/workflow)' if is_new_format else '旧格式 (chapterX)'}")
        
        if is_new_format:
            # 新格式: model_name/workflow_type
            path_parts = chapter_id.split('/')
            print(f"[LearningCenter] 章节ID分割结果: {path_parts}, 部分数量: {len(path_parts)}")
            
            if len(path_parts) == 2:
                model_name, workflow_type = path_parts
                chapter_dir = os.path.join(templates_dir, model_name, workflow_type)
                print(f"[LearningCenter] 解析为模型名称: {model_name}, 工作流类型: {workflow_type}")
                print(f"[LearningCenter] 对应章节目录: {chapter_dir}")
            else:
                print(f"[LearningCenter] 章节ID格式错误: {chapter_id}, 应为'model/workflow'格式")
                return web.json_response({"error": "Invalid chapter ID format"}, status=400)
        else:
            # 旧格式: chapter*
            chapter_dir = os.path.join(templates_dir, chapter_id)
            print(f"[LearningCenter] 对应章节目录: {chapter_dir}")
        
        # 检查目录是否存在
        if not os.path.isdir(chapter_dir):
            print(f"[LearningCenter] 未找到章节目录 {chapter_dir}, 当前存在的目录: {os.listdir(templates_dir)}")
            
            # 如果是新格式，检查模型目录是否存在
            if is_new_format:
                model_dir = os.path.join(templates_dir, model_name)
                if os.path.isdir(model_dir):
                    print(f"[LearningCenter] 模型目录存在: {model_dir}, 内容: {os.listdir(model_dir)}")
                else:
                    print(f"[LearningCenter] 模型目录不存在: {model_dir}")
            
            return web.json_response({"error": "Chapter not found"}, status=404)
        
        # 元数据文件
        metadata_path = os.path.join(chapter_dir, "metadata.json")
        print(f"[LearningCenter] 检查元数据文件: {metadata_path}")
        
        if not os.path.exists(metadata_path):
            print(f"[LearningCenter] 未找到章节元数据: {metadata_path}")
            return web.json_response({"error": "Chapter metadata not found"}, status=404)
        
        # 读取元数据
        print(f"[LearningCenter] 开始读取元数据: {metadata_path}")
        metadata = safe_read_json(metadata_path)
        if not metadata:
            print(f"[LearningCenter] 元数据读取失败或为空")
            return web.json_response({"error": "Failed to read chapter metadata"}, status=500)
        
        print(f"[LearningCenter] 成功读取元数据: {metadata}")
        
        # 练习工作流
        exercise_path = os.path.join(chapter_dir, "exercise.json")
        print(f"[LearningCenter] 检查练习工作流: {exercise_path}, 存在: {os.path.exists(exercise_path)}")
        exercise_workflow = safe_read_text(exercise_path) if os.path.exists(exercise_path) else None
        
        # 答案工作流（只有已完成的章节或请求预览时才提供）
        answer_path = os.path.join(chapter_dir, "answer.json")
        
        # 检查请求参数是否包含preview_answer=true
        show_answer = request.query.get("preview_answer") == "true"
        is_completed = user_progress.get("completed_chapters", {}).get(chapter_id, False)
        
        answer_workflow = None
        if (show_answer or is_completed) and os.path.exists(answer_path):
            answer_workflow = safe_read_text(answer_path)
        
        # 补充元数据
        metadata.update({
            "id": chapter_id,
            "has_exercise": exercise_workflow is not None,
            "has_answer": os.path.exists(answer_path),
            "has_preview": os.path.exists(os.path.join(chapter_dir, "preview.png")),
            "completed": is_completed
        })
        
        # 如果是新格式且元数据中没有指定模型，添加模型信息
        if is_new_format and "model" not in metadata:
            metadata["model"] = path_parts[0]
        
        response = {
            "metadata": metadata,
            "exercise_workflow": exercise_workflow,
            "answer_workflow": answer_workflow
        }
        
        return web.json_response(response)
    except Exception as e:
        print(f"[LearningCenter] 获取章节详情错误: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)

# API路由：获取预览图
@PromptServer.instance.routes.get("/api/learningcenter/chapters/{chapter_id}/preview")
async def get_preview(request):
    try:
        chapter_id = request.match_info["chapter_id"]
        templates_dir, _ = get_template_directories()
        
        print(f"[LearningCenter] 请求章节预览 {chapter_id}")
        print(f"[LearningCenter] 请求路径: {request.path}")
        print(f"[LearningCenter] 模板目录: {templates_dir}")
        
        # 尝试直接打印请求相关信息，帮助诊断
        try:
            print(f"[LearningCenter] 请求头: {dict(request.headers)}")
            print(f"[LearningCenter] 请求查询参数: {dict(request.query)}")
        except Exception as e:
            print(f"[LearningCenter] 打印请求信息时出错: {e}")
        
        # 处理新的目录结构格式
        is_new_format = '/' in chapter_id
        
        print(f"[LearningCenter] 章节ID格式: {'新格式 (model/workflow)' if is_new_format else '旧格式 (chapterX)'}")
        
        if is_new_format:
            # 新格式: model_name/workflow_type
            path_parts = chapter_id.split('/')
            print(f"[LearningCenter] 章节ID分割结果: {path_parts}, 部分数量: {len(path_parts)}")
            
            if len(path_parts) == 2:
                model_name, workflow_type = path_parts
                chapter_dir = os.path.join(templates_dir, model_name, workflow_type)
                print(f"[LearningCenter] 解析为模型名称: {model_name}, 工作流类型: {workflow_type}")
                print(f"[LearningCenter] 对应章节目录: {chapter_dir}")
            else:
                print(f"[LearningCenter] 章节ID格式错误: {chapter_id}, 应为'model/workflow'格式")
                return web.Response(
                    status=400,
                    text="Invalid chapter ID format",
                    content_type="text/plain"
                )
        else:
            # 旧格式: chapter*
            chapter_dir = os.path.join(templates_dir, chapter_id)
            print(f"[LearningCenter] 对应章节目录: {chapter_dir}")
        
        # 检查目录是否存在
        if not os.path.exists(chapter_dir):
            print(f"[LearningCenter] 未找到章节目录 {chapter_dir}")
            # 如果是新格式，检查模型目录是否存在
            if is_new_format:
                model_dir = os.path.join(templates_dir, model_name)
                if os.path.exists(model_dir):
                    print(f"[LearningCenter] 模型目录存在: {model_dir}, 内容: {os.listdir(model_dir)}")
                else:
                    print(f"[LearningCenter] 模型目录不存在: {model_dir}")
            
            return web.Response(
                status=404,
                text=f"Chapter directory not found: {chapter_dir}",
                content_type="text/plain"
            )
        
        # 列出章节目录中的所有文件
        print(f"[LearningCenter] 章节目录内容: {os.listdir(chapter_dir)}")
        
        preview_path = os.path.join(chapter_dir, "preview.png")
        
        # 检查预览图路径并打印详细信息
        print(f"[LearningCenter] 检查预览图路径: {preview_path}")
        print(f"[LearningCenter] 预览图存在: {os.path.exists(preview_path)}")
        
        # 检查文件属性
        if os.path.exists(preview_path):
            try:
                file_size = os.path.getsize(preview_path)
                file_time = os.path.getmtime(preview_path)
                print(f"[LearningCenter] 预览图文件大小: {file_size} 字节")
                print(f"[LearningCenter] 预览图修改时间: {time.ctime(file_time)}")
                
                # 尝试打开文件来验证是否可读
                try:
                    with open(preview_path, "rb") as f:
                        first_bytes = f.read(16)
                        print(f"[LearningCenter] 预览图文件前16字节: {first_bytes.hex()}")
                except Exception as e:
                    print(f"[LearningCenter] 尝试读取预览图时出错: {e}")
                
                print(f"[LearningCenter] 找到预览图，返回: {preview_path}")
                # 设置缓存控制和内容类型
                headers = {
                    "Cache-Control": "max-age=3600",
                    "Content-Type": "image/png"
                }
                
                # 尝试使用aiohttp的构造器来创建响应，而不是直接使用FileResponse
                try:
                    with open(preview_path, "rb") as f:
                        file_data = f.read()
                        
                    return web.Response(
                        body=file_data,
                        headers=headers,
                        content_type="image/png"
                    )
                except Exception as e:
                    print(f"[LearningCenter] 创建文件响应时出错: {e}")
                    return web.FileResponse(preview_path, headers=headers)
            except Exception as e:
                print(f"[LearningCenter] 获取预览图文件信息时出错: {e}")
        
        # 如果没有预览图，尝试找其他图
        print(f"[LearningCenter] 没有找到preview.png，尝试其他格式")
        alt_exts = ['.jpg', '.jpeg', '.webp', '.gif']
        
        for ext in alt_exts:
            alt_preview = os.path.join(chapter_dir, f"preview{ext}")
            print(f"[LearningCenter] 检查替代预览图: {alt_preview}, 存在: {os.path.exists(alt_preview)}")
            
            if os.path.exists(alt_preview):
                print(f"[LearningCenter] 找到替代预览图 {alt_preview}")
                content_type = f"image/{ext[1:]}" if ext != '.jpg' else "image/jpeg"
                headers = {
                    "Cache-Control": "max-age=3600",
                    "Content-Type": content_type
                }
                return web.FileResponse(alt_preview, headers=headers)
        
        # 尝试找目录中的第一张图
        print(f"[LearningCenter] 尝试寻找目录中的任意图片作为预览")
        image_exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
        
        try:
            for file in os.listdir(chapter_dir):
                file_lower = file.lower()
                print(f"[LearningCenter] 检查目录中的文件: {file}")
                
                if any(file_lower.endswith(ext) for ext in image_exts):
                    img_path = os.path.join(chapter_dir, file)
                    print(f"[LearningCenter] 使用目录中的图片作为预览: {img_path}")
                    ext = os.path.splitext(file_lower)[1]
                    content_type = f"image/{ext[1:]}" if ext != '.jpg' else "image/jpeg"
                    headers = {
                        "Cache-Control": "max-age=3600",
                        "Content-Type": content_type
                    }
                    return web.FileResponse(img_path, headers=headers)
        except Exception as e:
            print(f"[LearningCenter] 查找目录中的图片时出错: {e}")
        
        # 如果没有找到任何预览图，尝试创建一个默认的预览图
        try:
            print(f"[LearningCenter] 尝试创建默认预览图")
            from PIL import Image, ImageDraw, ImageFont
            import io
            
            # 创建一个简单的图像，显示章节ID
            img = Image.new('RGB', (400, 300), color=(73, 109, 137))
            d = ImageDraw.Draw(img)
            d.text((10, 10), f"Chapter: {chapter_id}", fill=(255, 255, 0))
            d.text((10, 50), "No preview available", fill=(255, 255, 0))
            
            # 转换为字节
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            
            print(f"[LearningCenter] 已创建默认预览图")
            return web.Response(
                body=img_byte_arr.getvalue(),
                content_type="image/png",
                headers={"Cache-Control": "max-age=60"}  # 短缓存时间
            )
        except Exception as e:
            print(f"[LearningCenter] 创建默认预览图时出错: {e}")
        
        # 如果没有找到任何预览图
        print(f"[LearningCenter] 未找到任何预览图且无法创建默认预览图: {chapter_id}，返回404状态码")
        return web.Response(
            status=404,
            text="Preview image not found and failed to create default preview",
            content_type="text/plain"
        )
    except Exception as e:
        print(f"[LearningCenter] 获取预览图错误: {e}")
        import traceback
        traceback.print_exc()
        return web.Response(
            status=500,
            text=f"Error loading preview: {str(e)}",
            content_type="text/plain"
        )

# API路由：更新章节完成状态
@PromptServer.instance.routes.post("/api/learningcenter/chapters/{chapter_id}/complete")
async def mark_chapter_completed(request):
    try:
        chapter_id = request.match_info["chapter_id"]
        templates_dir, _ = get_template_directories()
        
        print(f"[LearningCenter] 更新章节完成状态 {chapter_id}")
        
        # 处理新的目录结构格式
        is_new_format = '/' in chapter_id
        
        if is_new_format:
            # 新格式: model_name/workflow_type
            path_parts = chapter_id.split('/')
            if len(path_parts) == 2:
                model_name, workflow_type = path_parts
                chapter_dir = os.path.join(templates_dir, model_name, workflow_type)
            else:
                print(f"[LearningCenter] 章节ID格式错误: {chapter_id}")
                return web.json_response({"error": "Invalid chapter ID format"}, status=400)
        else:
            # 旧格式: chapter*
            chapter_dir = os.path.join(templates_dir, chapter_id)
        
        # 检查章节是否存在
        if not os.path.isdir(chapter_dir):
            print(f"[LearningCenter] 未找到章节 {chapter_id}")
            return web.json_response({"error": "Chapter not found"}, status=404)
        
        # 读取请求体
        data = await request.json()
        submitted_workflow = data.get("workflow")
        
        if not submitted_workflow:
            return web.json_response({"error": "No workflow submitted"}, status=400)
        
        # 读取用户进度
        user_progress = load_user_progress()
        
        # 检查是否有答案文件
        answer_path = os.path.join(chapter_dir, "answer.json")
        has_answer = os.path.exists(answer_path)
        
        # 即使没有答案文件，也允许将章节标记为已完成
        if not has_answer:
            print(f"[LearningCenter] 章节没有答案文件 {chapter_id}，但仍允许标记为已完成")
        
        # 更新完成状态
        user_progress.setdefault("completed_chapters", {})[chapter_id] = True
        
        # 保存用户进度
        save_result = save_user_progress(user_progress)
        if not save_result:
            return web.json_response({"error": "Failed to save progress"}, status=500)
        
        return web.json_response({
            "success": True,
            "message": "章节已标记为完成"
        })
    except Exception as e:
        print(f"[LearningCenter] 更新章节完成状态错误: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)

# API路由：重置用户进度
@PromptServer.instance.routes.post("/api/learningcenter/reset-progress")
async def reset_user_progress(request):
    try:
        print(f"[LearningCenter] 请求重置用户进度")
        
        # 读取请求体，检查确认标志
        try:
            data = await request.json()
            confirm = data.get("confirm", False)
        except:
            confirm = False
        
        if not confirm:
            return web.json_response({
                "success": False,
                "message": "需要确认才能重置进度",
                "require_confirmation": True
            }, status=400)
        
        # 读取当前进度，仅重置已完成章节
        current_progress = load_user_progress()
        current_progress["completed_chapters"] = {}
        
        # 保存修改后的进度
        save_result = save_user_progress(current_progress)
        if not save_result:
            return web.json_response({"error": "保存进度失败"}, status=500)
        
        print(f"[LearningCenter] 用户进度已成功重置")
        return web.json_response({
            "success": True,
            "message": "用户进度已重置"
        })
    except Exception as e:
        print(f"[LearningCenter] 重置用户进度错误: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)

# API路由：删除章节
@PromptServer.instance.routes.post("/api/learningcenter/chapters/{chapter_id}/delete")
async def delete_chapter(request):
    try:
        chapter_id = request.match_info["chapter_id"]
        templates_dir, _ = get_template_directories()
        
        print(f"[LearningCenter] 删除章节 {chapter_id}")
        
        # 处理新的目录结构格式
        is_new_format = '/' in chapter_id
        
        if is_new_format:
            # 新格式: model_name/workflow_type
            path_parts = chapter_id.split('/')
            if len(path_parts) == 2:
                model_name, workflow_type = path_parts
                chapter_dir = os.path.join(templates_dir, model_name, workflow_type)
            else:
                print(f"[LearningCenter] 章节ID格式错误: {chapter_id}")
                return web.json_response({"error": "Invalid chapter ID format"}, status=400)
        else:
            # 旧格式: chapter*
            chapter_dir = os.path.join(templates_dir, chapter_id)
        
        # 检查章节是否存在
        if not os.path.isdir(chapter_dir):
            print(f"[LearningCenter] 未找到章节 {chapter_id}")
            return web.json_response({"error": "Chapter not found"}, status=404)
        
        # 删除章节目录及其所有内容
        shutil.rmtree(chapter_dir)
        
        # 更新用户进度
        user_progress = load_user_progress()
        user_progress["completed_chapters"].pop(chapter_id, None)
        
        # 保存用户进度
        save_result = save_user_progress(user_progress)
        if not save_result:
            return web.json_response({"error": "Failed to delete chapter"}, status=500)
        
        return web.json_response({
            "success": True,
            "message": "章节已成功删除"
        })
    except Exception as e:
        print(f"[LearningCenter] 删除章节错误: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)

# API路由：获取特定模型下的章节详情
@PromptServer.instance.routes.get("/api/learningcenter/chapters/{model_name}/{workflow_type}")
async def get_model_chapter_details(request):
    try:
        model_name = request.match_info["model_name"]
        workflow_type = request.match_info["workflow_type"]
        chapter_id = f"{model_name}/{workflow_type}"
        
        print(f"[LearningCenter] 使用新路由处理模型章节请求: {chapter_id}")
        print(f"[LearningCenter] 模型名称: {model_name}, 工作流类型: {workflow_type}")
        
        templates_dir, _ = get_template_directories()
        user_progress = load_user_progress()
        
        chapter_dir = os.path.join(templates_dir, model_name, workflow_type)
        print(f"[LearningCenter] 对应章节目录: {chapter_dir}")
        
        # 安全读取JSON文件的辅助函数
        def safe_read_json(file_path):
            try:
                with open(file_path, "r", encoding="utf-8-sig") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[LearningCenter] 读取文件出错 {file_path}: {e}")
                try:
                    with open(file_path, "r", encoding="gbk") as f:
                        return json.load(f)
                except Exception as e2:
                    print(f"[LearningCenter] 第二次尝试读取文件也失败 {file_path}: {e2}")
                    return {}
        
        # 安全读取文本文件的辅助函数    
        def safe_read_text(file_path):
            try:
                with open(file_path, "r", encoding="utf-8-sig") as f:
                    return f.read()
            except Exception as e:
                print(f"[LearningCenter] 读取文件出错 {file_path}: {e}")
                try:
                    with open(file_path, "r", encoding="gbk") as f:
                        return f.read()
                except Exception as e2:
                    print(f"[LearningCenter] 第二次尝试读取文件也失败 {file_path}: {e2}")
                    return None
        
        # 检查目录是否存在
        if not os.path.isdir(chapter_dir):
            print(f"[LearningCenter] 未找到章节目录 {chapter_dir}")
            
            # 检查模型目录是否存在
            model_dir = os.path.join(templates_dir, model_name)
            if os.path.isdir(model_dir):
                print(f"[LearningCenter] 模型目录存在: {model_dir}, 内容: {os.listdir(model_dir)}")
            else:
                print(f"[LearningCenter] 模型目录不存在: {model_dir}")
            
            return web.json_response({"error": "Chapter not found"}, status=404)
        
        # 元数据文件
        metadata_path = os.path.join(chapter_dir, "metadata.json")
        print(f"[LearningCenter] 检查元数据文件: {metadata_path}")
        
        if not os.path.exists(metadata_path):
            print(f"[LearningCenter] 未找到章节元数据: {metadata_path}")
            return web.json_response({"error": "Chapter metadata not found"}, status=404)
        
        # 读取元数据
        print(f"[LearningCenter] 开始读取元数据: {metadata_path}")
        metadata = safe_read_json(metadata_path)
        if not metadata:
            print(f"[LearningCenter] 元数据读取失败或为空")
            return web.json_response({"error": "Failed to read chapter metadata"}, status=500)
        
        print(f"[LearningCenter] 成功读取元数据: {metadata}")
        
        # 练习工作流
        exercise_path = os.path.join(chapter_dir, "exercise.json")
        print(f"[LearningCenter] 检查练习工作流: {exercise_path}, 存在: {os.path.exists(exercise_path)}")
        exercise_workflow = safe_read_text(exercise_path) if os.path.exists(exercise_path) else None
        
        # 答案工作流（只有已完成的章节或请求预览时才提供）
        answer_path = os.path.join(chapter_dir, "answer.json")
        
        # 检查请求参数是否包含preview_answer=true
        show_answer = request.query.get("preview_answer") == "true"
        is_completed = user_progress.get("completed_chapters", {}).get(chapter_id, False)
        
        answer_workflow = None
        if (show_answer or is_completed) and os.path.exists(answer_path):
            answer_workflow = safe_read_text(answer_path)
        
        # 补充元数据
        metadata.update({
            "id": chapter_id,
            "has_exercise": exercise_workflow is not None,
            "has_answer": os.path.exists(answer_path),
            "has_preview": os.path.exists(os.path.join(chapter_dir, "preview.png")),
            "completed": is_completed
        })
        
        # 如果元数据中没有指定模型，添加模型信息
        if "model" not in metadata:
            metadata["model"] = model_name
        
        response = {
            "metadata": metadata,
            "exercise_workflow": exercise_workflow,
            "answer_workflow": answer_workflow
        }
        
        return web.json_response(response)
    except Exception as e:
        print(f"[LearningCenter] 获取模型章节详情错误: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)

# API路由：获取特定模型下章节的预览图
@PromptServer.instance.routes.get("/api/learningcenter/chapters/{model_name}/{workflow_type}/preview")
async def get_model_chapter_preview(request):
    try:
        model_name = request.match_info["model_name"]
        workflow_type = request.match_info["workflow_type"]
        chapter_id = f"{model_name}/{workflow_type}"
        
        print(f"[LearningCenter] 使用新路由处理模型章节预览请求: {chapter_id}")
        print(f"[LearningCenter] 模型名称: {model_name}, 工作流类型: {workflow_type}")
        
        templates_dir, _ = get_template_directories()
        chapter_dir = os.path.join(templates_dir, model_name, workflow_type)
        
        print(f"[LearningCenter] 对应章节目录: {chapter_dir}")
        print(f"[LearningCenter] 检查目录是否存在: {os.path.exists(chapter_dir)}")
        
        if not os.path.isdir(chapter_dir):
            print(f"[LearningCenter] 未找到章节目录: {chapter_dir}")
            return web.Response(
                status=404,
                text="Chapter directory not found",
                content_type="text/plain"
            )
        
        preview_path = os.path.join(chapter_dir, "preview.png")
        
        # 检查预览图路径并打印详细信息
        print(f"[LearningCenter] 检查预览图路径: {preview_path}")
        print(f"[LearningCenter] 预览图存在: {os.path.exists(preview_path)}")
        
        if os.path.exists(preview_path):
            print(f"[LearningCenter] 找到预览图，返回: {preview_path}")
            # 设置缓存控制和内容类型
            headers = {
                "Cache-Control": "max-age=3600",
                "Content-Type": "image/png"
            }
            return web.FileResponse(preview_path, headers=headers)
        
        # 如果没有预览图，尝试找其他图
        print(f"[LearningCenter] 未找到预览图，尝试其他格式")
        for ext in ['.jpg', '.jpeg', '.webp', '.gif']:
            alt_preview = os.path.join(chapter_dir, f"preview{ext}")
            print(f"[LearningCenter] 检查替代预览图: {alt_preview}, 存在: {os.path.exists(alt_preview)}")
            if os.path.exists(alt_preview):
                print(f"[LearningCenter] 找到替代预览图 {alt_preview}")
                content_type = f"image/{ext[1:]}" if ext != '.jpg' else "image/jpeg"
                headers = {
                    "Cache-Control": "max-age=3600",
                    "Content-Type": content_type
                }
                return web.FileResponse(alt_preview, headers=headers)
        
        # 尝试找目录中的第一张图
        print(f"[LearningCenter] 尝试寻找目录中的任意图片作为预览")
        image_exts = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
        try:
            dir_contents = os.listdir(chapter_dir)
            print(f"[LearningCenter] 目录内容: {dir_contents}")
            
            for file in dir_contents:
                file_lower = file.lower()
                if any(file_lower.endswith(ext) for ext in image_exts):
                    img_path = os.path.join(chapter_dir, file)
                    print(f"[LearningCenter] 使用目录中的图片作为预览: {img_path}")
                    ext = os.path.splitext(file_lower)[1]
                    content_type = f"image/{ext[1:]}" if ext != '.jpg' else "image/jpeg"
                    headers = {
                        "Cache-Control": "max-age=3600",
                        "Content-Type": content_type
                    }
                    return web.FileResponse(img_path, headers=headers)
        except Exception as e:
            print(f"[LearningCenter] 查找目录中的图片时出错: {e}")
        
        # 如果没有找到任何预览图
        print(f"[LearningCenter] 未找到任何预览图: {chapter_id}，返回404状态码")
        return web.Response(
            status=404,
            text="Preview image not found",
            content_type="text/plain"
        )
    except Exception as e:
        print(f"[LearningCenter] 获取模型章节预览错误: {e}")
        import traceback
        traceback.print_exc()
        return web.Response(
            status=500,
            text=f"Error loading preview: {str(e)}",
            content_type="text/plain"
        ) 

# API路由：更新特定模型下章节的完成状态
@PromptServer.instance.routes.post("/api/learningcenter/chapters/{model_name}/{workflow_type}/complete")
async def mark_model_chapter_completed(request):
    try:
        model_name = request.match_info["model_name"]
        workflow_type = request.match_info["workflow_type"]
        chapter_id = f"{model_name}/{workflow_type}"
        
        print(f"[LearningCenter] 使用新路由更新模型章节完成状态: {chapter_id}")
        print(f"[LearningCenter] 模型名称: {model_name}, 工作流类型: {workflow_type}")
        
        templates_dir, _ = get_template_directories()
        chapter_dir = os.path.join(templates_dir, model_name, workflow_type)
        
        # 检查章节是否存在
        if not os.path.isdir(chapter_dir):
            print(f"[LearningCenter] 未找到章节目录: {chapter_dir}")
            return web.json_response({"error": "Chapter not found"}, status=404)
        
        # 读取请求体
        data = await request.json()
        submitted_workflow = data.get("workflow")
        
        if not submitted_workflow:
            return web.json_response({"error": "No workflow submitted"}, status=400)
        
        # 读取用户进度
        user_progress = load_user_progress()
        
        # 检查是否有答案文件
        answer_path = os.path.join(chapter_dir, "answer.json")
        has_answer = os.path.exists(answer_path)
        
        # 即使没有答案文件，也允许将章节标记为已完成
        if not has_answer:
            print(f"[LearningCenter] 章节没有答案文件 {chapter_id}，但仍允许标记为已完成")
        
        # 更新完成状态
        user_progress.setdefault("completed_chapters", {})[chapter_id] = True
        
        # 保存用户进度
        save_result = save_user_progress(user_progress)
        if not save_result:
            return web.json_response({"error": "Failed to save progress"}, status=500)
        
        return web.json_response({
            "success": True,
            "message": "章节已标记为完成"
        })
    except Exception as e:
        print(f"[LearningCenter] 更新模型章节完成状态错误: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)

# API路由：删除特定模型下的章节
@PromptServer.instance.routes.post("/api/learningcenter/chapters/{model_name}/{workflow_type}/delete")
async def delete_model_chapter(request):
    try:
        model_name = request.match_info["model_name"]
        workflow_type = request.match_info["workflow_type"]
        chapter_id = f"{model_name}/{workflow_type}"
        
        print(f"[LearningCenter] 使用新路由删除模型章节: {chapter_id}")
        print(f"[LearningCenter] 模型名称: {model_name}, 工作流类型: {workflow_type}")
        
        templates_dir, _ = get_template_directories()
        chapter_dir = os.path.join(templates_dir, model_name, workflow_type)
        
        # 检查章节是否存在
        if not os.path.isdir(chapter_dir):
            print(f"[LearningCenter] 未找到章节目录: {chapter_dir}")
            return web.json_response({"error": "Chapter not found"}, status=404)
        
        # 删除章节目录及其所有内容
        shutil.rmtree(chapter_dir)
        
        # 更新用户进度
        user_progress = load_user_progress()
        user_progress["completed_chapters"].pop(chapter_id, None)
        
        # 保存用户进度
        save_result = save_user_progress(user_progress)
        if not save_result:
            return web.json_response({"error": "Failed to delete chapter"}, status=500)
        
        return web.json_response({
            "success": True,
            "message": "章节已成功删除"
        })
    except Exception as e:
        print(f"[LearningCenter] 删除模型章节错误: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500) 
