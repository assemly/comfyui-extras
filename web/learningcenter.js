import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { $el } from "./utils.js";
import { LearningCenterPanel } from "./learningcenter-ui.js";
import { TEMPLATE_ICON_SVG } from "./templates.js";

// 检查学习中心目录是否存在
async function checkDirectories() {
    try {
        const resp = await api.fetchApi("/learningcenter/chapters?limit=1");
        if (resp.status !== 200) {
            console.warn("学习中心目录可能不存在，但将继续尝试");
        }
    } catch (error) {
        console.warn("检查学习中心目录时出错", error);
    }
}

// 加载CSS
function loadCSS() {
    const styleElement = document.createElement("style");
    styleElement.textContent = `
        /* 确保样式与ComfyUI原生按钮一致 */
        button.comfyui-button {
            display: flex;
            align-items: center;
            background-color: var(--comfy-input-bg);
            gap: 0.3em;
            padding: 0.4em 0.8em;
            font-size: 0.9em;
            border-radius: var(--comfy-button-border-radius);
            border: 1px solid var(--comfy-button-border);
            cursor: pointer;
            color: var(--comfy-button-text);
            transition: background-color 0.1s ease-out;
        }
        
        button.comfyui-button.primary {
            background-color: var(--comfy-primary-color, #1F6FEB);
            color: var(--comfy-primary-text-color, #fff);
            border: none;
        }
        
        button.comfyui-button.primary:hover {
            background-color: var(--comfy-primary-hover-color, #1a62d9);
        }
        
        button.comfyui-button i.mdi {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
        }
        
        /* 学习中心图标特殊样式 */
        #learningcenter-btn i.mdi svg.learningcenter-icon {
            width: 20px !important;
            height: 20px !important;
            overflow: visible;
        }
        
        #learningcenter-btn i.mdi svg.learningcenter-icon path,
        #learningcenter-btn i.mdi svg.learningcenter-icon rect {
            stroke: currentColor;
            vector-effect: non-scaling-stroke;
        }
        
        #learningcenter-btn i.mdi svg.learningcenter-icon rect[opacity] {
            fill: currentColor;
            fill-opacity: 0.5;
            stroke: none;
        }
        
        /* 学习中心面板图标样式 */
        .learningcenter-header-icon {
            width: 16px;
            height: 16px;
            margin-right: 5px;
            vertical-align: middle;
        }
        
        .learningcenter-header-icon path,
        .learningcenter-header-icon rect {
            stroke: currentColor;
            vector-effect: non-scaling-stroke;
        }
        
        .learningcenter-header-icon rect[opacity] {
            fill: currentColor;
            fill-opacity: 0.5;
            stroke: none;
        }
        
        /* 面板样式 */
        .learningcenter-panel {
            position: absolute;
            right: 10px;
            top: 40px;
            width: 300px;
            max-height: calc(100vh - 60px);
            background-color: #333;
            color: #fff;
            border-radius: 6px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            z-index: 100;
            overflow: hidden;
            display: none;
            flex-direction: column;
            transition: transform 0.3s ease, opacity 0.3s ease;
            transform: translateY(-20px);
            opacity: 0;
        }
        
        /* 面板头部 */
        .learningcenter-header {
            padding: 10px;
            border-bottom: 1px solid #555;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .learningcenter-title {
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .learningcenter-controls {
            display: flex;
            gap: 5px;
        }
        
        .learningcenter-close-btn {
            background: none;
            border: none;
            cursor: pointer;
            color: #fff;
            opacity: 0.6;
            transition: opacity 0.2s;
            padding: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .learningcenter-close-btn:hover {
            opacity: 1;
        }
        
        /* 搜索区域 */
        .learningcenter-search-container {
            padding: 10px;
            border-bottom: 1px solid #555;
        }
        
        .learningcenter-search-input {
            width: 100%;
            padding: 5px 10px;
            border: 1px solid #666;
            border-radius: 4px;
            background-color: #444;
            color: #fff;
        }
        
        /* 模板列表 */
        .learningcenter-templates-container {
            padding: 10px;
            overflow-y: auto;
            max-height: calc(100vh - 200px);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        /* 模板卡片 */
        .learningcenter-template-card {
            background-color: #444;
            border-radius: 4px;
            padding: 10px;
            cursor: pointer;
            border: 1px solid #666;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            position: relative;
        }
        
        .learningcenter-template-title {
            font-weight: bold;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    `;
    document.head.appendChild(styleElement);
}

app.registerExtension({
    name: "comfy.learningcenter",
    async setup() {
        // 加载CSS
        loadCSS();
        
        // 检查目录
        await checkDirectories();
        
        // 创建工具栏按钮
        console.log("[LearningCenter] 正在创建工具栏按钮..");
        
        // 尝试插入到Manager按钮左侧
        const findButtonContainer = () => {
            console.log("[LearningCenter] 开始查找右侧菜单容器..");
            
            try {
                // 1. 查找右侧菜单容器
                const rightMenu = document.querySelector('.comfyui-menu-right');
                if (rightMenu) {
                    console.log("[LearningCenter] 找到右侧菜单容器");
                    
                    // 2. 查找内部按钮组容器
                    const flexDiv = rightMenu.querySelector('.flex.gap-2');
                    if (flexDiv) {
                        console.log("[LearningCenter] 找到右侧菜单内部flex容器");
                        
                        // 3. 查找按钮组
                        const buttonGroups = flexDiv.querySelectorAll('.comfyui-button-group');
                        if (buttonGroups && buttonGroups.length > 0) {
                            console.log("[LearningCenter] 找到按钮组");
                            
                            // 返回第一个按钮组(最左侧的组)
                            return {
                                container: flexDiv,
                                firstGroup: buttonGroups[0],
                                insertAsFirst: true
                            };
                        }
                        
                        // 如果没有按钮组，但有容器，也返回
                        return {
                            container: flexDiv,
                            firstGroup: null,
                            insertAsFirst: true
                        };
                    }
                    
                    // 如果找不到内部容器，返回菜单本身
                    return {
                        container: rightMenu,
                        firstGroup: null,
                        insertAsFirst: true
                    };
                }
            } catch (e) {
                console.warn("[LearningCenter] 查找右侧菜单容器时出错", e);
            }
            
            // 如果找不到任何相关元素，返回null
            return { container: null, firstGroup: null, insertAsFirst: false };
        };

        // 插入按钮的函数
        const insertButton = (button) => {
            const { container, firstGroup, insertAsFirst } = findButtonContainer();
            
            if (!container) {
                console.log("[LearningCenter] 未找到合适的容器");
                return false;
            }
            
            try {
                // 创建一个新的按钮组
                const newButtonGroup = document.createElement('div');
                newButtonGroup.className = 'comfyui-button-group';
                newButtonGroup.appendChild(button);
                
                // 插入到指定位置
                if (insertAsFirst) {
                    console.log("[LearningCenter] 尝试插入到最左侧位置");
                    // 检查是否有子元素
                    if (container.firstChild) {
                        container.insertBefore(newButtonGroup, container.firstChild);
                    } else {
                        container.appendChild(newButtonGroup);
                    }
                    console.log("[LearningCenter] 成功插入按钮到最左侧位置");
                } else {
                    // 如果找不到特定位置，就直接加到容器中
                    container.appendChild(newButtonGroup);
                    console.log("[LearningCenter] 成功添加按钮到容器");
                }
                return true;
            } catch (e) {
                console.error("[LearningCenter] 插入按钮时出错:", e);
                return false;
            }
        };

        // 创建学习中心按钮
        const createTemplateButton = () => {
            const button = document.createElement("button");
            button.id = "learningcenter-btn";
            button.title = "学习中心";
            button.setAttribute("aria-label", "学习中心");
            button.className = "comfyui-button comfyui-menu-mobile-collapse primary";
            
            // 创建图标 - 优先使用SVG图标
            const mdiIcon = document.createElement("i");
            mdiIcon.className = "mdi";
            mdiIcon.innerHTML = `<svg class="learningcenter-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="9" height="9" rx="1" stroke-width="1.5" opacity="0.4" />
                <rect x="2" y="13" width="9" height="9" rx="1" stroke-width="1.5" />
                <rect x="13" y="2" width="9" height="9" rx="1" stroke-width="1.5" />
                <rect x="13" y="13" width="9" height="9" rx="1" stroke-width="1.5" opacity="0.4" />
            </svg>`;
            mdiIcon.style.display = "flex";
            mdiIcon.style.alignItems = "center";
            mdiIcon.style.justifyContent = "center";
            
            // 调整SVG图标样式
            setTimeout(() => {
                const svg = mdiIcon.querySelector("svg");
                if (svg) {
                    svg.style.width = "20px";
                    svg.style.height = "20px";
                    svg.style.display = "block";
                    svg.style.fill = "none";
                    svg.style.stroke = "currentColor";
                }
            }, 0);
            
            const spanText = document.createElement("span");
            spanText.textContent = "学习中心";
            
            button.appendChild(mdiIcon);
            button.appendChild(spanText);
            
            // 添加点击事件，并阻止冒泡
            button.onclick = (e) => {
                // 阻止事件冒泡到document
                e.stopPropagation();
                
                console.log("[LearningCenter] 学习中心按钮被点击");
                
                // 切换面板显示状态
                const instance = LearningCenterPanel.toggle();
                
                // 如果面板变为可见，给予一点延迟，等待其完全显示
                if (instance.isVisible) {
                    // 强制重绘，确保面板正确显示
                    setTimeout(() => {
                        instance.panelContainer.style.opacity = "1";
                        instance.panelContainer.style.transform = "translateY(0)";
                    }, 50);
                }
            };
            
            return button;
        };

        const learningCenterButton = createTemplateButton();

        // 尝试插入按钮
        const inserted = insertButton(learningCenterButton);
        if (!inserted) {
            console.log("[LearningCenter] 未能在右侧菜单插入，尝试其他方法");
            tryFallbackInsertion(learningCenterButton);
        }

        // 回退方法，尝试其他插入位置
        function tryFallbackInsertion(button) {
            console.log("[LearningCenter] 尝试备用插入方法");
            
            // 尝试查找顶部工具栏
            try {
                // 1. 尝试直接添加到ComfyUI的工具栏
                const comfyToolbar = document.querySelector('#comfy-toolbar');
                if (comfyToolbar) {
                    console.log("[LearningCenter] 找到ComfyUI工具栏，添加按钮");
                    const buttonGroup = document.createElement('div');
                    buttonGroup.className = 'comfyui-button-group';
                    buttonGroup.appendChild(button);
                    comfyToolbar.appendChild(buttonGroup);
                    return true;
                }
                
                // 2. 尝试其他可能的工具栏选择器
                const possibleToolbars = [
                    ".comfy-toolbar",
                    ".toolbar",
                    "#toolbar",
                    ".tools",
                    "#tools",
                    ".tool-panel",
                    ".menu-bar",
                    ".header-toolbar",
                    "header"
                ];
                
                for (const selector of possibleToolbars) {
                    const toolbar = document.querySelector(selector);
                    if (toolbar) {
                        console.log(`[LearningCenter] 找到工具栏: ${selector}，添加按钮`);
                        
                        // 创建按钮组
                        const buttonGroup = document.createElement('div');
                        buttonGroup.className = 'comfyui-button-group';
                        buttonGroup.appendChild(button);
                        
                        // 优先尝试插入到工具栏开始位置
                        if (toolbar.firstChild) {
                            toolbar.insertBefore(buttonGroup, toolbar.firstChild);
                        } else {
                            toolbar.appendChild(buttonGroup);
                        }
                        return true;
                    }
                }
                
                // 3. 创建一个浮动按钮作为最后的备选方案
                console.log("[LearningCenter] 未找到任何工具栏，创建浮动按钮");
                
                const floatingButton = document.createElement("div");
                floatingButton.style.position = "fixed";
                floatingButton.style.top = "10px";
                floatingButton.style.left = "10px";
                floatingButton.style.zIndex = "9999";
                floatingButton.style.backgroundColor = "var(--comfy-menu-bg, #333)";
                floatingButton.style.padding = "5px";
                floatingButton.style.borderRadius = "4px";
                floatingButton.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
                floatingButton.appendChild(button);
                
                // 添加到文档
                document.body.appendChild(floatingButton);
                return true;
            } catch (e) {
                console.error("[LearningCenter] 回退插入失败:", e);
                return false;
            }
        }
        
        // 延迟部分也要修改
        setTimeout(() => {
            if (!document.body.contains(learningCenterButton)) {
                console.log("[LearningCenter] 延迟后再次尝试添加按钮");
                
                // 创建一个新按钮进行尝试
                const newButton = createTemplateButton();
                
                // 尝试插入
                const inserted = insertButton(newButton);
                if (!inserted) {
                    console.log("[LearningCenter] 延迟插入仍然失败，尝试备用方法");
                    tryFallbackInsertion(newButton);
                }
            }
        }, 2000);
        
        // 初始化模板面板
        LearningCenterPanel.init();
    },
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 针对SaveAsTemplate节点的处理
        if (nodeData.name === "SaveAsTemplate") {
            const origProcess = nodeType.prototype.onExecuted;
            
            // 扩展节点的onExecuted方法
            nodeType.prototype.onExecuted = function(message) {
                if (origProcess) {
                    origProcess.apply(this, arguments);
                }
                
                // 当节点执行成功时显示提示
                if (message.success) {
                    app.ui.dialog.show("模板保存成功", "工作流已成功保存为模板！");
                }
            };
        }
    },
    
    // 获取当前工作流
    getCurrentWorkflow() {
        const workflow = app.graph.serialize();
        return JSON.stringify(workflow);
    },
    
    // 加载工作流
    loadWorkflow(workflowJson) {
        try {
            const workflow = JSON.parse(workflowJson);
            app.loadGraphData(workflow);
            return true;
        } catch (error) {
            console.error("加载工作流时出错:", error);
            return false;
        }
    }
}); 