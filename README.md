# ComfyUI 系统资源监控插件

一个为ComfyUI设计的实时系统资源监控插件，帮助您在生成AI图像过程中跟踪计算机资源使用情况。

## 功能特点

- **实时监控:** 动态显示CPU、内存、GPU使用率和温度
- **可视化界面:** 使用进度条直观展示各项资源占用情况
- **可拖拽面板:** 面板位置可自由调整，适应不同工作区布局
- **位置记忆:** 自动保存面板位置，下次启动时恢复
- **面板锁定:** 支持锁定面板位置，防止误操作
- **响应式设计:** 适配不同设备屏幕尺寸

## 安装方法

### 方法一: 使用Git克隆

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/assemly/comfyui-extras.git
```

### 方法二: 下载ZIP文件

1. 下载此仓库的ZIP文件
2. 解压到`ComfyUI/custom_nodes/`目录下
3. 确保文件夹名为`comfyui-extras`

## 使用说明

1. 启动ComfyUI后，界面上会出现"监控"按钮
2. 点击按钮打开监控面板，再次点击关闭
3. 使用面板顶部的拖动区域调整面板位置
4. 点击固定按钮(+)锁定面板位置，防止误拖动
5. 位置和显示状态会被自动保存

## 技术实现

本插件采用模块化设计，主要包含以下组件：

- `server/monitor.py`: 后端API，提供系统资源信息
- `web/monitor.js`: 前端主入口，注册ComfyUI扩展
- `web/monitor-ui.js`: UI逻辑实现，处理面板创建和交互
- `web/templates.js`: HTML模板存储，分离UI结构与逻辑
- `web/utils.js`: 通用工具函数，提供拖拽等公共功能
- `web/monitor.css`: 样式定义，控制面板外观

## 系统要求

- Windows, macOS 或 Linux
- 兼容的GPU（支持CUDA或ROCm）
- Python 3.8+
- 最新版ComfyUI

## 许可证

MIT

## 贡献指南

欢迎提交问题报告和功能建议。如需贡献代码，请：

1. Fork本仓库
2. 创建您的特性分支
3. 提交变更
4. 推送到分支
5. 创建Pull Request 