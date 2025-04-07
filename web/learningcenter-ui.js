import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { $el, debounce, formatDateTime, showNotification, truncateText } from "./utils.js";
import { TEMPLATE_ICON_SVG, TEMPLATE_BUTTON_TEMPLATE, TEMPLATE_HEADER_TEMPLATE, TEMPLATE_CONTENT_TEMPLATE } from "./templates.js";

export class LearningCenterPanel {
    static instance = null;
    
    constructor() {
        this.templates = [];
        this.currentFilter = {
            search: "",
            purpose: "",
            difficulty: "",
            model: "",
            tag: ""
        };
        this.isVisible = false;
        this.isLoading = false;
        this.selectedTemplate = null;
        
        // 添加分页相关变量
        this.currentPage = 1;
        this.pageSize = 10;
        this.hasMoreTemplates = true;
        this.tutorialTemplates = []; // 用于存储教程工作流
        this.otherTemplates = []; // 用于存储其他工作流
        
        this.initDOM();
        this.bindEvents();
    }
    
    // 创建面板DOM
    initDOM() {
        // 主面板容器
        this.panelContainer = $el("div.learningcenter-panel", {
            style: {
                display: "none",
                position: "absolute",
                right: "10px",
                top: "40px",
                width: "300px",
                maxHeight: "calc(100vh - 60px)",
                backgroundColor: "var(--comfy-menu-bg)",
                color: "var(--comfy-text-color)",
                borderRadius: "6px",
                boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
                zIndex: "100",
                overflow: "hidden",
                flexDirection: "column",
                transition: "transform 0.3s ease, opacity 0.3s ease",
                transform: "translateY(-20px)",
                opacity: "0"
            }
        });
        
        // 面板头部
        this.panelHeader = $el("div.learningcenter-header", {
            style: {
                padding: "10px",
                borderBottom: "1px solid var(--comfy-menu-border)"
            },
            innerHTML: TEMPLATE_HEADER_TEMPLATE
        });
        
        // 添加重置进度按钮
        const resetBtn = $el("button.learningcenter-reset-btn", {
            style: {
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--comfy-text-color)",
                opacity: "0.6",
                padding: "4px 8px",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                transition: "opacity 0.2s ease"
            },
            title: "重置所有章节完成状态",
            onmouseover: function() {
                this.style.opacity = "1";
            },
            onmouseout: function() {
                this.style.opacity = "0.7";
            },
            onclick: () => this.resetProgress()
        }, [
            $el("span", {
                style: {
                    fontSize: "14px"
                }
            }, "🔄"),
            $el("span", {}, "重置进度")
        ]);
        
        // 找到面板头部中的标题元素，将按钮添加到标题元素后
        setTimeout(() => {
            const dragHandle = this.panelHeader.querySelector(".learningcenter-drag-handle");
            if (dragHandle) {
                dragHandle.appendChild(resetBtn);
            }
        }, 0);
        
        // 搜索区域
        this.searchContainer = $el("div.learningcenter-search-container", {
            style: {
                padding: "10px",
                borderBottom: "1px solid var(--comfy-menu-border)"
            }
        }, [
            $el("input.learningcenter-search-input", {
                type: "text",
                placeholder: "搜索章节...",
                style: {
                    width: "100%",
                    padding: "5px 10px",
                    border: "1px solid var(--comfy-input-border)",
                    borderRadius: "4px",
                    backgroundColor: "var(--comfy-input-bg)",
                    color: "var(--comfy-text-color)"
                },
                onkeyup: debounce(e => {
                    this.currentFilter.search = e.target.value.trim().toLowerCase();
                    this.loadTemplates();
                }, 500)
            })
        ]);
        
        // 过滤器区域
        this.filterContainer = $el("div.learningcenter-filter-container", {
            style: {
                padding: "10px",
                borderBottom: "1px solid var(--comfy-menu-border)",
                display: "flex",
                flexWrap: "wrap",
                gap: "5px"
            }
        }, [
            this.createFilterSelect("purpose", "用途", [
                { value: "", label: "全部" },
                { value: "image_gen", label: "图像生成" },
                { value: "image_edit", label: "图像编辑" },
                { value: "tutorial", label: "教程" },
                { value: "inpainting", label: "图像修复" },
                { value: "controlnet", label: "ControlNet" },
                { value: "animation", label: "动画制作" },
                { value: "3d", label: "3D建模" },
                { value: "other", label: "其他" }
            ]),
            this.createFilterSelect("difficulty", "复杂度", [
                { value: "", label: "全部" },
                { value: "beginner", label: "初级" },
                { value: "intermediate", label: "中级" },
                { value: "advanced", label: "高级" }
            ]),
            this.createFilterSelect("model", "模型", [
                { value: "", label: "全部" },
                { value: "sd15", label: "SD1.5" },
                { value: "sdxl", label: "SDXL" },
                { value: "sd3", label: "SD3" },
                { value: "stable_cascade", label: "Cascade" },
                { value: "awesome", label: "Awesome" },
                { value: "other", label: "其他" }
            ])
        ]);
        
        // 章节列表容器
        this.templatesContainer = $el("div.learningcenter-templates-container", {
            style: {
                padding: "10px",
                overflowY: "auto",
                maxHeight: "calc(100vh - 200px)",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
            }
        });
        
        // 修改滚动事件处理，添加节流处理，避免频繁触发
        let scrollTimeout = null;
        this.templatesContainer.addEventListener("scroll", () => {
            // 如果已经在加载中或没有更多模板可加载，直接返回
            if (this.isLoading || !this.hasMoreTemplates) return;
            
            // 清除上一个定时器
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            
            // 设置200ms的节流，避免频繁触发
            scrollTimeout = setTimeout(() => {
                const { scrollTop, scrollHeight, clientHeight } = this.templatesContainer;
                
                // 当滚动到距离底部50px时，触发加载更多
                if (scrollTop + clientHeight >= scrollHeight - 50) {
                    console.log("[学习中心] 检测到滚动到底部，加载更多");
                    this.loadTemplates(true);
                }
                
                scrollTimeout = null;
            }, 200);
        });
        
        // 详情面板
        this.detailsContainer = $el("div.learningcenter-details-container", {
            style: {
                display: "none",
                position: "absolute",
                left: "310px",
                top: "0",
                width: "450px",
                backgroundColor: "var(--comfy-menu-bg)",
                borderRadius: "6px",
                boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
                zIndex: "99",
                maxHeight: "calc(100vh - 20px)",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column"
            }
        });
        
        // 组装面板
        this.panelContainer.appendChild(this.panelHeader);
        this.panelContainer.appendChild(this.searchContainer);
        this.panelContainer.appendChild(this.filterContainer);
        this.panelContainer.appendChild(this.templatesContainer);
        
        // 添加到文档
        document.body.appendChild(this.panelContainer);
        document.body.appendChild(this.detailsContainer);
        
        // 空状态提示
        const emptyMessage = "暂无章节内容，请添加教程章节";
        this.emptyState = $el("div.learningcenter-empty-state", {}, emptyMessage);
        this.emptyState.style.padding = "20px";
        this.emptyState.style.textAlign = "center";
        this.emptyState.style.color = "var(--comfy-text-color)";
        this.emptyState.style.opacity = "0.7";
        this.emptyState.style.display = "none";
        
        this.templatesContainer.appendChild(this.emptyState);
    }
    
    // 创建过滤器下拉选择
    createFilterSelect(name, label, options) {
        const container = $el("div.learningcenter-filter-item", {
            style: {
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                flex: "1 0 calc(33% - 5px)"
            }
        }, [
            $el("label", {
                style: {
                    fontSize: "12px",
                    opacity: "0.8"
                }
            }, label),
            $el("select", {
                style: {
                    padding: "4px",
                    border: "1px solid var(--comfy-input-border)",
                    borderRadius: "4px",
                    backgroundColor: "var(--comfy-input-bg)",
                    color: "var(--comfy-text-color)"
                },
                onchange: e => {
                    const value = e.target.value;
                    console.log(`[学习中心] 过滤器 ${name} 更改为: "${value}"`);
                    
                    // 更新过滤条件
                    this.currentFilter[name] = value;
                    
                    // 重置到第一页并重新加载
                    this.currentPage = 1;
                    this.hasMoreTemplates = true;
                    this.tutorialTemplates = [];
                    this.otherTemplates = [];
                    this.loadTemplates();
                }
            }, options.map(option => 
                $el("option", { 
                    value: option.value,
                    selected: this.currentFilter[name] === option.value
                }, option.label)
            ))
        ]);
        
        return container;
    }
    
    // 绑定事件
    bindEvents() {
        // 关闭按钮
        const closeBtn = this.panelHeader.querySelector(".learningcenter-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => this.hide());
            closeBtn.addEventListener("mouseover", () => {
                closeBtn.style.opacity = "1";
            });
            closeBtn.addEventListener("mouseout", () => {
                closeBtn.style.opacity = "0.7";
            });
        }
        
        // 点击外部关闭
        document.addEventListener("click", e => {
            // 如果面板不可见，不需要处理
            if (!this.isVisible) return;
            
            // 检查点击元素是否是模板库按钮或其子元素
            const isButtonClick = e.target.closest("#learningcenter-btn");
            
            // 如果是模板库按钮的点击，不要关闭面板
            if (isButtonClick) return;
            
            // 检查点击元素是否在面板内部
            const isPanelClick = this.panelContainer.contains(e.target) || 
                                this.detailsContainer.contains(e.target);
            
            // 如果点击在面板外部，则关闭面板
            if (!isPanelClick) {
                this.hide();
            }
        });
        
        // 阻止面板内部点击事件冒泡到document
        this.panelContainer.addEventListener("click", e => {
            e.stopPropagation();
        });
        
        this.detailsContainer.addEventListener("click", e => {
            e.stopPropagation();
        });
        
        // 添加调试日志
        console.log("[学习中心] 已绑定面板事件处理器和滚动加载功能");
    }
    
    // 显示面板
    show() {
        if (!this.isVisible) {
            this.panelContainer.style.display = "flex";
            setTimeout(() => {
                this.panelContainer.style.opacity = "1";
                this.panelContainer.style.transform = "translateY(0)";
            }, 10);
            this.isVisible = true;
            this.loadTemplates();
        }
    }
    
    // 隐藏面板
    hide() {
        if (this.isVisible) {
            this.panelContainer.style.opacity = "0";
            this.panelContainer.style.transform = "translateY(-20px)";
            setTimeout(() => {
                this.panelContainer.style.display = "none";
            }, 300);
            this.isVisible = false;
            this.hideDetails();
        }
    }
    
    // 切换面板显示状态
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    // 加载章节列表
    async loadTemplates(loadMore = false) {
        // 如果不是加载更多，重置分页
        if (!loadMore) {
            this.currentPage = 1;
            this.hasMoreTemplates = true;
            this.tutorialTemplates = [];
            this.otherTemplates = [];
        }
        
        // 如果没有更多可加载，直接返回
        if (!this.hasMoreTemplates && loadMore) {
            console.log("[学习中心] 已加载所有章节");
            return;
        }
        
        // 如果正在加载中，避免重复请求
        if (this.isLoading) {
            console.log("[学习中心] 已有加载请求正在进行，跳过此次请求");
            return;
        }
        
        this.isLoading = true;
        if (!loadMore) {
            this.showLoading();
        } else {
            this.showLoadingMore();
        }
        
        try {
            console.log("[学习中心] 开始加载章节. 页码:", this.currentPage);
            console.log("[学习中心] 当前过滤条件:", this.currentFilter);
            
            // 构建查询参数
            const params = new URLSearchParams();
            
            // 只有当有实际搜索内容时才添加搜索参数
            if (this.currentFilter.search && this.currentFilter.search.trim() !== "") {
                params.append("search", this.currentFilter.search.trim());
                console.log(`[学习中心] 添加搜索过滤器: "${this.currentFilter.search.trim()}"`);
            }
            
            // 只有当选择了非"全部"的用途时才添加用途参数
            if (this.currentFilter.purpose && this.currentFilter.purpose !== "") {
                console.log(`[学习中心] 添加用途过滤器: ${this.currentFilter.purpose}`);
                params.append("purpose", this.currentFilter.purpose);
            }
            
            // 只有当选择了非"全部"的复杂度时才添加复杂度参数
            if (this.currentFilter.difficulty && this.currentFilter.difficulty !== "") {
                console.log(`[学习中心] 添加复杂度过滤器: ${this.currentFilter.difficulty}`);
                params.append("difficulty", this.currentFilter.difficulty);
            }
            
            // 只有当选择了非"全部"的模型时才添加模型参数
            if (this.currentFilter.model && this.currentFilter.model !== "") {
                console.log(`[学习中心] 添加模型过滤器: ${this.currentFilter.model}`);
                params.append("model", this.currentFilter.model);
            }
            
            // 只有当有标签时才添加标签参数
            if (this.currentFilter.tag && this.currentFilter.tag !== "") {
                console.log(`[学习中心] 添加标签过滤器: ${this.currentFilter.tag}`);
                params.append("tag", this.currentFilter.tag);
            }
            
            // 添加分页参数
            params.append("page", this.currentPage);
            params.append("limit", this.pageSize);
            
            // 构建请求URL
            const apiUrl = `/learningcenter/chapters?${params.toString()}`;
            console.log(`[学习中心] 请求章节数据: ${apiUrl}`);
            
            // 发送请求
            const response = await api.fetchApi(apiUrl);
            
            if (response.status === 200) {
                console.log("[学习中心] 成功获取章节数据");
                const data = await response.json();
                
                // 检查数据结构
                let newTemplates = [];
                if (Array.isArray(data)) {
                    newTemplates = data;
                } else if (data.templates && Array.isArray(data.templates)) {
                    newTemplates = data.templates;
                    
                    // 检查是否有分页信息
                    if (data.pagination) {
                        this.hasMoreTemplates = data.pagination.has_more || this.currentPage * this.pageSize < data.pagination.total;
                    } else {
                        // 如果返回的数据少于页大小，认为没有更多数据
                        this.hasMoreTemplates = newTemplates.length >= this.pageSize;
                    }
                } else {
                    console.warn("[学习中心] 服务器返回的数据格式不符合预期:", data);
                    newTemplates = [];
                    this.hasMoreTemplates = false;
                }
                
                // 如果没有返回新的模板，认为没有更多数据
                if (newTemplates.length === 0) {
                    console.log("[学习中心] 没有获取到新模板，标记为没有更多数据");
                    this.hasMoreTemplates = false;
                    
                    // 如果是第一页且没有数据，显示"没有找到匹配的章节"
                    if (this.currentPage === 1) {
                        this.showNoResults();
                        this.isLoading = false;
                        if (!loadMore) {
                            this.hideLoading();
                        } else {
                            this.hideLoadingMore();
                        }
                        return;
                    }
                }
                
                console.log(`[学习中心] 获取${newTemplates.length}个章节, 还有更多: ${this.hasMoreTemplates}`);
                
                // 用于检测重复的模板ID集合
                const existingIds = new Set(this.templates.map(t => t.id));
                
                // 分类添加模板，避免重复
                for (const template of newTemplates) {
                    // 跳过已存在的模板
                    if (existingIds.has(template.id)) {
                        console.log(`[学习中心] 跳过重复模板: ${template.id}`);
                        continue;
                    }
                    
                    // 区分教程和其他工作流
                    const isTutorial = template.id && (
                        template.id.startsWith("chapter") || 
                        ["tutorial", "教程"].includes(template.purpose)
                    );
                    
                    if (isTutorial) {
                        // 教程按ID排序
                        this.tutorialTemplates.push(template);
                    } else {
                        this.otherTemplates.push(template);
                    }
                    
                    // 添加到已存在ID集合
                    existingIds.add(template.id);
                }
                
                // 对教程进行排序
                this.tutorialTemplates.sort((a, b) => {
                    // 尝试从ID中提取数字进行排序
                    const numA = parseInt((a.id || "").replace(/[^0-9]/g, "")) || 0;
                    const numB = parseInt((b.id || "").replace(/[^0-9]/g, "")) || 0;
                    return numA - numB;
                });
                
                // 组合所有模板
                this.templates = [...this.tutorialTemplates, ...this.otherTemplates];
                
                // 如果有新数据添加，才增加页码
                if (newTemplates.length > 0) {
                    this.currentPage++;
                }
                
                // 渲染模板
                this.renderTemplates(loadMore);
            } else {
                console.error(`[学习中心] 获取章节失败: 状态码 ${response.status}`, 
                            await response.text());
                this.showError(`获取章节失败: 状态码 ${response.status}`);
                
                // 如果404错误，可能是API路径问题
                if (response.status === 404) {
                    this.showError("API路径可能不正确，请检查服务器是否正常运行");
                }
            }
        } catch (error) {
            console.error("[学习中心] 加载章节时出错", error);
            
            // 提供更详细的错误信息
            if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
                this.showError("无法连接到服务器，请检查网络连接或服务器状态");
            } else {
                this.showError(`加载章节时出错: ${error.message}`);
            }
        } finally {
            this.isLoading = false;
            if (!loadMore) {
                this.hideLoading();
            } else {
                this.hideLoadingMore();
            }
        }
    }
    
    // 渲染章节列表
    renderTemplates(loadMore = false) {
        // 如果不是加载更多，清空现有内容
        if (!loadMore) {
            while (this.templatesContainer.firstChild) {
                this.templatesContainer.removeChild(this.templatesContainer.firstChild);
            }
        } else {
            // 如果是加载更多，移除加载指示器
            const loadingIndicator = this.templatesContainer.querySelector(".learningcenter-load-more");
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        }
        
        // 检查是否有结果
        if (this.templates.length === 0) {
            this.emptyState.style.display = "block";
            this.templatesContainer.appendChild(this.emptyState);
            return;
        } else {
            this.emptyState.style.display = "none";
        }
        
        // 调试输出
        console.log("[学习中心] 调试 - 所有章节数", this.templates.length);
        
        // 获取当前显示的卡片数量
        const existingCards = this.templatesContainer.querySelectorAll(".learningcenter-template-card");
        const startIndex = existingCards.length;
        
        // 添加章节卡片，从当前已显示的数量开始
        for (let i = startIndex; i < this.templates.length; i++) {
            const template = this.templates[i];
            
            // 调试每个章节的字段
            console.log(`[学习中心] 渲染章节 ID: ${template.id}, 难度: ${template.difficulty || "未知"}, 用途: ${template.purpose || "未知"}`);
            
            const templateCard = this.createTemplateCard(template);
            this.templatesContainer.appendChild(templateCard);
        }
        
        // 如果还有更多模板可加载，添加"加载更多"按钮
        if (this.hasMoreTemplates) {
            const loadMoreBtn = $el("div.learningcenter-load-more", {
                style: {
                    textAlign: "center",
                    padding: "12px",
                    cursor: "pointer",
                    color: "var(--comfy-text-color)",
                    backgroundColor: "rgba(var(--comfy-menu-bg-color), 0.5)",
                    borderRadius: "4px",
                    margin: "10px 0",
                    transition: "background-color 0.2s"
                },
                onmouseover: function() {
                    this.style.backgroundColor = "rgba(var(--comfy-menu-bg-color), 0.8)";
                },
                onmouseout: function() {
                    this.style.backgroundColor = "rgba(var(--comfy-menu-bg-color), 0.5)";
                },
                onclick: () => {
                    if (!this.isLoading) {
                        this.loadTemplates(true);
                    }
                }
            }, "加载更多章节...");
            
            this.templatesContainer.appendChild(loadMoreBtn);
        } else {
            console.log("[学习中心] 没有更多章节可加载");
            
            // 如果没有更多但至少有一些章节，显示已全部加载提示
            if (this.templates.length > 0) {
                const noMoreIndicator = $el("div.learningcenter-no-more", {
                    style: {
                        textAlign: "center",
                        padding: "10px",
                        color: "var(--comfy-text-color)",
                        opacity: "0.6",
                        fontSize: "12px",
                        margin: "5px 0"
                    }
                }, "— 已加载全部章节 —");
                
                this.templatesContainer.appendChild(noMoreIndicator);
            }
        }
    }
    
    // 创建章节卡片
    createTemplateCard(template) {
        // 打印完整的章节数据，用于调试
        console.log(`[学习中心] 渲染卡片的完整章节数据`, template);
        
        // 确保template有name字段，如果没有则使用title或id
        const name = template.name || template.title || template.id || "未命名章节";
        
        const card = $el("div.learningcenter-template-card", {
            dataset: { id: template.id },
            style: {
                backgroundColor: "var(--comfy-input-bg)",
                borderRadius: "4px",
                padding: "12px",
                cursor: "pointer",
                border: "1px solid var(--comfy-input-border)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                position: "relative"
            },
            onmouseover: function() {
                this.style.transform = "translateY(-2px)";
                this.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
            },
            onmouseout: function() {
                this.style.transform = "translateY(0)";
                this.style.boxShadow = "none";
            },
            onclick: () => this.showTemplateDetails(template)
        });
        
        // 章节标题
        const titleContainer = $el("div.learningcenter-template-title", {
            style: {
                fontWeight: "bold",
                marginBottom: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
            }
        });
        
        // 标题文本
        const titleText = $el("span", {
            style: {
                fontSize: "14px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
            }
        }, name);
        
        // 如果有预览图片，添加一个小图标
        if (template.has_preview) {
            const previewIndicator = $el("span.learningcenter-preview-indicator", {
                style: {
                    marginLeft: "8px",
                    fontSize: "14px",
                    color: "var(--comfy-text-color)",
                    opacity: "0.6"
                }
            }, "🖼");
            titleText.appendChild(previewIndicator);
        }
        
        titleContainer.appendChild(titleText);
        card.appendChild(titleContainer);
        
        // 章节描述
        if (template.description) {
            const description = $el("div.learningcenter-template-description", {
                style: {
                    fontSize: "12px",
                    color: "var(--comfy-text-color)",
                    opacity: "0.8",
                    marginBottom: "10px",
                    lineHeight: "1.4",
                    maxHeight: "36px", // 行文限制
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    "-webkit-line-clamp": "2",
                    "-webkit-box-orient": "vertical"
                }
            }, template.description);
            card.appendChild(description);
        }
        
        // 预计时间信息
        if (template.estimated_time) {
            const timeInfo = $el("div.learningcenter-template-time", {
                style: {
                    fontSize: "11px",
                    color: "var(--comfy-text-color)",
                    opacity: "0.6",
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                }
            }, [
                $el("span", {style: {fontSize: "11px"}}, "⏱️"),
                $el("span", {}, `预计时间: ${template.estimated_time}分钟`)
            ]);
            card.appendChild(timeInfo);
        }
        
        // 标签容器
        const tagsContainer = $el("div.learningcenter-template-tags", {
            style: {
                display: "flex",
                flexWrap: "wrap",
                gap: "4px",
                marginTop: "6px"
            }
        });
        
        // 确保有标签值，防止undefined显示
        const addTag = (value, type, backgroundColor) => {
            if (!value) return; // 跳过空值
            
            const label = this[`get${type}Label`](value);
            if (!label) return; // 跳过没有标签的值
            
            const tag = $el("span.learningcenter-tag", {
                style: {
                    fontSize: "10px",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    backgroundColor: backgroundColor,
                    color: "var(--comfy-text-color)"
                }
            }, label);
            
            tagsContainer.appendChild(tag);
        };
        
        // 添加各种标签
        addTag(template.difficulty, "Difficulty", "rgba(var(--comfy-green-500), 0.2)");
        
        // 调试打印purpose字段
        console.log(`[学习中心] 章节 ${template.id} 的用途字段`, template.purpose);
        addTag(template.purpose, "Use", "rgba(var(--comfy-red-500), 0.2)");
        
        // 调试打印model字段
        console.log(`[学习中心] 章节 ${template.id} 的模型字段`, template.model);
        addTag(template.model, "Model", "rgba(var(--comfy-blue-500), 0.2)");
        
        addTag(template.complexity, "Complexity", "rgba(var(--comfy-orange-500), 0.2)");
        
        card.appendChild(tagsContainer);
                
        // 完成状态标签
        if (template.completed) {
            const completedIndicator = $el("div.learningcenter-completed-indicator", {
                style: {
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    fontSize: "12px",
                    backgroundColor: "var(--comfy-green)",
                    color: "white",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontWeight: "bold"
                }
            }, "✅");
            card.appendChild(completedIndicator);
        }
        
        return card;
    }
    
    // 获取难度标签显示文本
    getDifficultyLabel(difficulty) {
        const labels = {
            beginner: "初级",
            intermediate: "中级",
            advanced: "高级"
        };
        return labels[difficulty] || difficulty;
    }
    
    // 获取用途标签显示文本
    getUseLabel(purpose) {
        // 防止空值错误
        if (!purpose) return "未知";
        
        // 调试输出
        console.log(`[学习中心] 获取用途标签，原始值:"${purpose}"`);
        
        const labels = {  
            tutorial: "教程",
            image_gen: "图像生成",
            image_edit: "图像编辑",
            inpainting: "图像修复",
            controlnet: "ControlNet",
            animation: "动画制作",
            "3d": "3D建模",
            other: "其他"
        };
        
        const result = labels[purpose] || purpose;
        console.log(`[学习中心] 用途标签结果:"${result}"`);
        return result;
    }
    
    // 显示章节详情
    async showTemplateDetails(template) {
        this.selectedTemplate = template;
        
        try {
            console.log(`[学习中心] 正在加载章节详情: ${template.id}`);
            
            // 显示加载状态
            this.detailsContainer.innerHTML = '<div style="padding: 20px; text-align: center;">正在加载详情...</div>';
            this.detailsContainer.style.display = "flex";
            
            const response = await api.fetchApi(`/learningcenter/chapters/${template.id}`);
            
            if (response.status === 200) {
                try {
                    const data = await response.json();
                    
                    // 检查返回的数据是否包含必要的字段
                    if (!data || !data.metadata) {
                        console.error("[学习中心] 返回的章节数据格式不正确:", data);
                        this.detailsContainer.innerHTML = '<div style="padding: 20px; color: var(--comfy-red); text-align: center;">章节数据格式错误，无法显示详情</div>';
                        return;
                    }
                    
                    // 记录工作流数据状态
                    const exerciseWorkflow = data.exercise_workflow;
                    const answerWorkflow = data.answer_workflow;
                    if (!exerciseWorkflow && !answerWorkflow) {
                        console.warn("[学习中心] 章节数据中不包含任何工作流数据");
                    } else {
                        if (exerciseWorkflow) console.log("[学习中心] 章节包含练习工作流");
                        if (answerWorkflow) console.log("[学习中心] 章节包含参考答案工作流");
                    }
                    
                    // 处理元数据中缺失的字段
                    data.metadata = {
                        ...template,  // 使用列表中的数据作为备用
                        ...data.metadata  // 用详情中的数据覆盖
                    };
                    
                    this.renderTemplateDetails(data);
                } catch (error) {
                    console.error("[学习中心] 解析章节详情JSON时出错", error);
                    this.detailsContainer.innerHTML = '<div style="padding: 20px; color: var(--comfy-red); text-align: center;">解析章节数据时出错</div>';
                }
            } else {
                console.error("获取章节详情失败:", await response.text());
                this.detailsContainer.innerHTML = `<div style="padding: 20px; color: var(--comfy-red); text-align: center;">获取章节详情失败 (${response.status})</div>`;
                showNotification("获取章节详情失败", "error");
            }
        } catch (error) {
            console.error("加载章节详情时出错", error);
            this.detailsContainer.innerHTML = '<div style="padding: 20px; color: var(--comfy-red); text-align: center;">加载章节详情时出错</div>';
            showNotification("加载章节详情时出错", "error");
        }
    }
    
    // 渲染章节详情
    renderTemplateDetails(data) {
        // 清空详情面板
        while (this.detailsContainer.firstChild) {
            this.detailsContainer.removeChild(this.detailsContainer.firstChild);
        }
        
        const metadata = data.metadata;
        const exerciseWorkflow = data.exercise_workflow;
        const answerWorkflow = data.answer_workflow;
        
        // 记录工作流数据状态
        if (!exerciseWorkflow && !answerWorkflow) {
            console.warn("[学习中心] 章节数据中不包含任何工作流数据");
        } else {
            if (exerciseWorkflow) console.log("[学习中心] 章节包含练习工作流");
            if (answerWorkflow) console.log("[学习中心] 章节包含参考答案工作流");
        }
        
        // 详情头部
        const header = $el("div.learningcenter-details-header", {
            style: {
                padding: "15px",
                borderBottom: "1px solid var(--comfy-menu-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
                top: "0",
                backgroundColor: "var(--comfy-menu-bg)",
                zIndex: "1"
            }
        }, [
            $el("h3", {
                style: {
                    margin: "0",
                    fontWeight: "bold",
                    fontSize: "16px"
                }
            }, metadata.name),
            $el("button.learningcenter-details-close", {
                style: {
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--comfy-text-color)",
                    opacity: "0.6",
                    transition: "opacity 0.2s",
                    fontSize: "18px",
                    padding: "5px"
                },
                onmouseover: function() {
                    this.style.opacity = "1";
                },
                onmouseout: function() {
                    this.style.opacity = "0.6";
                },
                onclick: () => this.hideDetails()
            }, "×")
        ]);
        
        // 预览部分
        let previewContainer = null;
        if (metadata.has_preview) {
            console.log(`[学习中心] 正在加载章节预览${metadata.id}`);
            // 确保预览URL正确，添加api前缀
            const previewUrl = `/api/learningcenter/chapters/${metadata.id}/preview`;
            
            // 创建默认的图片占位符
            const defaultImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23aaa' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='9' cy='9' r='2'%3E%3C/circle%3E%3Cpath d='M21 15l-5-5L5 21'%3E%3C/path%3E%3C/svg%3E";
            
            previewContainer = $el("div.learningcenter-details-preview", {
                style: {
                    textAlign: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.05)",
                    borderBottom: "1px solid var(--comfy-menu-border)",
                    padding: "0",
                    position: "relative"
                }
            }, [
                $el("img", {
                    // 先使用一个正在加载的图标
                    src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23aaa' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cpath d='M12 6v6l4 2'%3E%3C/path%3E%3C/svg%3E",
                    alt: `${metadata.name} 预览图`,
                    style: {
                        maxWidth: "100%",
                        maxHeight: "280px",
                        objectFit: "contain",
                        padding: "20px",
                        opacity: "0.5"
                    },
                    onerror: function() {
                        console.error(`[学习中心] 预览图加载失败${previewUrl}`);
                        this.onerror = null; // 防止循环触发错误
                        this.src = defaultImage;
                        this.style.padding = "20px";
                        this.style.opacity = "0.5";
                        this.title = "预览图加载失败，显示默认图片";
                    },
                    onload: function() {
                        // 检查是否是默认图片
                        if (this.src.includes("data:image/svg+xml")) {
                            // 是默认图片或加载指示器，不执行后续逻辑
                            return;
                        }
                        
                        // 实际图片加载成功
                        console.log(`[学习中心] 预览图加载成功${previewUrl}`);
                        this.style.padding = "0";
                        this.style.opacity = "1";
                        this.title = `${metadata.name} 预览图`;
                    }
                })
            ]);
            
            // 在DOM添加完之后，尝试预加载实际图片
            setTimeout(() => {
                try {
                    const img = previewContainer.querySelector("img");
                    if (img) {
                        // 创建一个新的Image对象来测试图片是否可以加载
                        const testImg = new Image();
                        testImg.onload = function() {
                            // 如果测试图片加载成功，则更新显示的图片
                            img.src = previewUrl;
                        };
                        testImg.onerror = function() {
                            // 如果测试图片加载失败，保持默认图片
                            console.error(`[学习中心] 预加载预览图失败: ${previewUrl}`);
                            img.src = defaultImage;
                            img.style.padding = "20px";
                            img.style.opacity = "0.5";
                            img.title = "预览图加载失败，显示默认图片";
                        };
                        testImg.src = previewUrl;
                    }
                } catch (e) {
                    console.error(`[学习中心] 预加载预览图时出错`, e);
                }
            }, 100);
            
            // 添加调试信息
            console.log(`[学习中心] 预览图URL: ${previewUrl}`);
        }
        
        // 详情内容
        const content = $el("div.learningcenter-details-content", {
            style: {
                padding: "15px",
                overflowY: "auto",
                flex: "1"
            }
        });
        
        // 快速信息卡片
        const quickInfoCard = $el("div.learningcenter-quick-info", {
            style: {
                marginBottom: "20px",
                padding: "12px",
                backgroundColor: "rgba(var(--comfy-blue-500), 0.05)",
                borderRadius: "6px",
                border: "1px solid rgba(var(--comfy-blue-500), 0.1)",
                fontSize: "12px"
            }
        }, [
            $el("div.learningcenter-details-tags", {
                style: {
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "10px"
                }
            }, [
                $el("div.learningcenter-details-tag", {
                    style: {
                        padding: "3px 8px",
                        backgroundColor: "rgba(var(--comfy-red-500), 0.2)",
                        borderRadius: "4px",
                        fontSize: "12px"
                    }
                }, `用途: ${this.getUseLabel(metadata.purpose)}`),
                $el("div.learningcenter-details-tag", {
                    style: {
                        padding: "3px 8px",
                        backgroundColor: "rgba(var(--comfy-orange-500), 0.2)",
                        borderRadius: "4px",
                        fontSize: "12px"
                    }
                }, `复杂度: ${this.getComplexityLabel(metadata.difficulty)}`),
                $el("div.learningcenter-details-tag", {
                    style: {
                        padding: "3px 8px",
                        backgroundColor: "rgba(var(--comfy-blue-500), 0.2)",
                        borderRadius: "4px",
                        fontSize: "12px"
                    }
                }, `模型: ${this.getModelLabel(metadata.model)}`)
            ]),
            
            $el("div.learningcenter-details-info", {
                style: {
                    fontSize: "12px",
                    opacity: "0.7",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                }
            }, [
                metadata.estimated_time ? $el("div", {}, `预计时间: ${metadata.estimated_time}分钟`) : null,
                $el("div", {}, `创建时间: ${formatDateTime(metadata.created_at)}`)
            ])
        ]);
        
        content.appendChild(quickInfoCard);
        
        // 描述
        if (metadata.description) {
            const descriptionSection = $el("div.learningcenter-details-section", {
                style: {
                    marginBottom: "20px"
                }
            }, [
                $el("h4", {
                    style: {
                        margin: "0 0 8px 0",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "var(--comfy-text-color)",
                        borderBottom: "1px solid rgba(var(--comfy-menu-border-color), 0.2)",
                        paddingBottom: "5px"
                    }
                }, "描述"),
                $el("p", {
                    style: {
                        margin: "0",
                        whiteSpace: "pre-line",
                        lineHeight: "1.5"
                    }
                }, metadata.description)
            ]);
            content.appendChild(descriptionSection);
        }
        
        // 学习目标
        if (metadata.learning_objectives) {
            const objectivesSection = $el("div.learningcenter-details-section", {
                style: {
                    marginBottom: "20px"
                }
            }, [
                $el("h4", {
                    style: {
                        margin: "0 0 8px 0",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "var(--comfy-text-color)",
                        borderBottom: "1px solid rgba(var(--comfy-menu-border-color), 0.2)",
                        paddingBottom: "5px"
                    }
                }, "学习目标"),
                $el("p", {
                    style: {
                        margin: "0",
                        whiteSpace: "pre-line",
                        lineHeight: "1.5"
                    }
                }, metadata.learning_objectives)
            ]);
            content.appendChild(objectivesSection);
        }
        
        // 标签
        if (metadata.tags && metadata.tags.length > 0) {
            const tagsSection = $el("div.learningcenter-details-section", {
                style: {
                    marginBottom: "20px"
                }
            }, [
                $el("h4", {
                    style: {
                        margin: "0 0 8px 0",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "var(--comfy-text-color)",
                        borderBottom: "1px solid rgba(var(--comfy-menu-border-color), 0.2)",
                        paddingBottom: "5px"
                    }
                }, "相关标签"),
                $el("div.learningcenter-details-tags", {
                    style: {
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "5px",
                        marginTop: "8px"
                    }
                }, metadata.tags.map(tag => 
                    $el("div.learningcenter-details-tag", {
                        style: {
                            padding: "3px 8px",
                            backgroundColor: "rgba(var(--comfy-purple-500), 0.2)",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer"
                        },
                        onclick: e => {
                            e.stopPropagation();
                            this.currentFilter.tag = tag;
                            this.loadTemplates();
                        }
                    }, tag)
                ))
            ]);
            content.appendChild(tagsSection);
        }
        
        // 操作按钮部分
        const actionsContainer = $el("div.learningcenter-details-actions", {
            style: {
                borderTop: "1px solid var(--comfy-menu-border)",
                backgroundColor: "rgba(0, 0, 0, 0.05)",
                padding: "15px"
            }
        });
        
        const actionButtons = $el("div.learningcenter-action-buttons", {
            style: {
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "15px"
            }
        });
        
        // 练习按钮
        if (exerciseWorkflow) {
            actionButtons.appendChild(
                $el("button.learningcenter-import-btn", {
                    style: {
                        backgroundColor: "var(--comfy-green)",
                        border: "none",
                        borderRadius: "4px",
                        padding: "10px 15px",
                        cursor: "pointer",
                        color: "white",
                        flex: "1",
                        fontWeight: "bold",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px",
                        transition: "all 0.2s ease"
                    },
                    onmouseover: function() {
                        this.style.backgroundColor = "var(--comfy-green-bright, #4CAF50)";
                        this.style.transform = "translateY(-2px)";
                        this.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
                    },
                    onmouseout: function() {
                        this.style.backgroundColor = "var(--comfy-green)";
                        this.style.transform = "translateY(0)";
                        this.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
                    },
                    onclick: () => this.importTemplate(exerciseWorkflow)
                }, [
                    $el("span", {style: {fontSize: "18px"}}, "📝"),
                    $el("span", {}, "导入练习工作流")
                ])
            );
        }
        
        // 答案按钮
        if (answerWorkflow) {
            actionButtons.appendChild(
                $el("button.learningcenter-answer-btn", {
                    style: {
                        backgroundColor: "var(--comfy-blue)",
                        border: "none",
                        borderRadius: "4px",
                        padding: "10px 15px",
                        cursor: "pointer",
                        color: "white",
                        flex: "1",
                        fontWeight: "bold",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px",
                        transition: "all 0.2s ease"
                    },
                    onmouseover: function() {
                        this.style.backgroundColor = "var(--comfy-blue-bright, #2196F3)";
                        this.style.transform = "translateY(-2px)";
                        this.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
                    },
                    onmouseout: function() {
                        this.style.backgroundColor = "var(--comfy-blue)";
                        this.style.transform = "translateY(0)";
                        this.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
                    },
                    onclick: () => this.importTemplate(answerWorkflow)
                }, [
                    $el("span", {style: {fontSize: "18px"}}, "答案"),
                    $el("span", {}, "导入参考答案")
                ])
            );
        }
        
        // 如果没有任何工作流数据，显示提示
        if (!exerciseWorkflow && !answerWorkflow) {
            actionButtons.appendChild(
                $el("div", {
                    style: {
                        textAlign: "center",
                        width: "100%",
                        padding: "12px 8px",
                        color: "var(--comfy-text-color-dim)",
                        fontStyle: "italic",
                        backgroundColor: "rgba(0,0,0,0.1)",
                        borderRadius: "4px"
                    }
                }, "此章节没有可用的工作流数据")
            );
        }
        
        actionsContainer.appendChild(actionButtons);
        
        // 完成状态按钮
        console.log(`[学习中心] 渲染完成状态按钮章节完成状态${metadata.completed}`);
        
        const completeButtonContainer = $el("div", {
            style: {
                marginTop: "10px"
            }
        });
        
        // 只有当章节未完成时才显示标记为已完成按钮
        if (metadata.completed !== true) {
            console.log(`[学习中心] 添加"标记为已完成"按钮，章节ID: ${metadata.id}`);
            
            const completeButton = $el("button.learningcenter-complete-btn", {
                style: {
                    backgroundColor: "var(--comfy-orange)",
                    border: "none",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    color: "white",
                    width: "100%",
                    fontWeight: "bold",
                    transition: "background-color 0.2s ease, transform 0.2s ease"
                },
                onmouseover: function() {
                    this.style.backgroundColor = "var(--comfy-orange-bright, #FF9800)";
                    this.style.transform = "translateY(-2px)";
                },
                onmouseout: function() {
                    this.style.backgroundColor = "var(--comfy-orange)";
                    this.style.transform = "translateY(0)";
                },
                onclick: () => {
                    console.log(`[学习中心] 点击"标记为已完成"按钮，章节ID: ${metadata.id}`);
                    this.markAsCompleted(metadata.id);
                }
            }, "标记为已完成");
            
            completeButtonContainer.appendChild(completeButton);
        } else {
            console.log(`[学习中心] 显示已完成状态，章节ID: ${metadata.id}`);
            
            completeButtonContainer.appendChild(
                $el("div", {
                    style: {
                        textAlign: "center",
                        width: "100%",
                        padding: "8px",
                        color: "var(--comfy-green)",
                        fontWeight: "bold",
                        backgroundColor: "rgba(var(--comfy-green-500), 0.1)",
                        borderRadius: "4px"
                    }
                }, "此章节已完成")
            );
        }
        
        actionsContainer.appendChild(completeButtonContainer);
        
        // 删除按钮（如果是用户自己的章节）
        if (metadata.source === "user" || metadata.source === "personal") {
            const deleteContainer = $el("div", {
                style: {
                    marginTop: "12px",
                    display: "flex",
                    justifyContent: "flex-end"
                }
            });
            
            deleteContainer.appendChild(
                $el("button.learningcenter-delete-btn", {
                    style: {
                        backgroundColor: "var(--comfy-red)",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 10px",
                        cursor: "pointer",
                        color: "white",
                        fontSize: "12px"
                    },
                    onclick: () => {
                        if (confirm("确定要删除这个章节吗？此操作不可撤销")) {
                            this.deleteTemplate(metadata.id);
                        }
                    }
                }, "删除章节")
            );
            
            actionsContainer.appendChild(deleteContainer);
        }
        
        // 组装详情面板
        this.detailsContainer.appendChild(header);
        if (previewContainer) {
            this.detailsContainer.appendChild(previewContainer);
        }
        this.detailsContainer.appendChild(content);
        this.detailsContainer.appendChild(actionsContainer);
        
        // 显示详情面板
        this.detailsContainer.style.display = "flex";
    }
    
    // 隐藏详情面板
    hideDetails() {
        this.detailsContainer.style.display = "none";
        this.selectedTemplate = null;
    }
    
    // 导入章节
    importTemplate(workflowJson) {
        try {
            // 检查workflowJson是否存在
            if (!workflowJson) {
                console.error("工作流数据为空");
                showNotification("导入失败：工作流数据为空", "error");
                return;
            }
            
            // 尝试解析JSON
            let workflow;
            try {
                workflow = JSON.parse(workflowJson);
            } catch (e) {
                // 如果JSON解析失败，检查workflowJson是否已经是对象
                if (typeof workflowJson === 'object') {
                    workflow = workflowJson;
                } else {
                    throw e;
                }
            }
            
            // 加载工作流
            app.loadGraphData(workflow);
            showNotification("章节导入成功", "success");
            this.hide();
        } catch (error) {
            console.error("导入章节时出错", error);
            showNotification(`导入章节失败: ${error.message}`, "error");
        }
    }
    
    // 删除章节
    async deleteTemplate(templateId) {
        try {
            // 由于服务器可能没有实现删除API，添加检查
            const response = await api.fetchApi(`/learningcenter/chapters/${templateId}/delete`, {
                method: "POST"
            });
            
            if (response.status === 200) {
                showNotification("章节已删除", "success");
                this.hideDetails();
                this.loadTemplates();
            } else {
                console.error("删除章节失败:", await response.text());
                showNotification("删除章节失败", "error");
            }
        } catch (error) {
            console.error("删除章节时出错", error);
            showNotification("删除章节时出错", "error");
        }
    }
    
    // 显示加载状态
    showLoading() {
        // 在章节列表顶部添加加载指示器
        const loader = $el("div.learningcenter-loader", {
            style: {
                padding: "10px",
                textAlign: "center",
                color: "var(--comfy-text-color)",
                opacity: "0.7"
            }
        }, "加载中...");
        
        // 清空现有内容
        while (this.templatesContainer.firstChild) {
            this.templatesContainer.removeChild(this.templatesContainer.firstChild);
        }
        
        this.templatesContainer.appendChild(loader);
    }
    
    // 隐藏加载状态
    hideLoading() {
        const loader = this.templatesContainer.querySelector(".learningcenter-loader");
        if (loader) {
            loader.remove();
        }
    }
    
    // 显示错误信息
    showError(message) {
        const error = $el("div.learningcenter-error", {
            style: {
                padding: "10px",
                textAlign: "center",
                color: "var(--comfy-red)",
                opacity: "0.7"
            }
        }, message);
        
        // 清空现有内容
        while (this.templatesContainer.firstChild) {
            this.templatesContainer.removeChild(this.templatesContainer.firstChild);
        }
        
        this.templatesContainer.appendChild(error);
    }
    
    // 获取复杂度标签显示文本
    getComplexityLabel(difficulty) {
        // 防止空值错误
        if (!difficulty) return "未知";
        
        // 调试输出
        console.log(`[学习中心] 获取复杂度标签，原始值:"${difficulty}"`);
        
        const labels = {
            beginner: "初级",
            intermediate: "中级",
            advanced: "高级",
            difficulty: "中级" // 用于向后兼容
        };
        
        const result = labels[difficulty] || difficulty;
        console.log(`[学习中心] 复杂度标签结果: "${result}"`);
        return result;
    }
    
    // 获取模型标签显示文本
    getModelLabel(model) {
        // 防止空值错误
        if (!model) return "未知";
        
        // 调试输出
        console.log(`[学习中心] 获取模型标签，原始值:"${model}"`);
        
        const labels = {
            sd15: "SD1.5",
            sdxl: "SDXL",
            sd3: "SD3",
            stable_cascade: "Stable Cascade",
            awesome: "Awesome",
            other: "其他"
        };
        
        const result = labels[model] || model;
        console.log(`[学习中心] 模型标签结果: "${result}"`);
        return result;
    }
    
    // 标记章节为已完成
    async markAsCompleted(chapterId) {
        try {
            console.log(`[学习中心] 正在标记章节为已完成: ${chapterId}`);
            
            // 获取当前工作流数据
            const workflowData = app.graph.serialize();
            const workflowJson = JSON.stringify(workflowData);
            
            // 发送请求到后端API
            const response = await api.fetchApi(`/learningcenter/chapters/${chapterId}/complete`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    workflow: workflowJson
                })
            });
            
            if (response.status === 200) {
                const result = await response.json();
                console.log(`[学习中心] 章节标记完成结果:`, result);
                
                if (result.success) {
                    showNotification("章节已标记为已完成", "success");
                    
                    // 更新选中章节的完成状态
                    if (this.selectedTemplate) {
                        this.selectedTemplate.completed = true;
                    }
                    
                    // 更新章节列表中的对应章节
                    const templateIndex = this.templates.findIndex(t => t.id === chapterId);
                    if (templateIndex !== -1) {
                        this.templates[templateIndex].completed = true;
                        
                        // 更新DOM中的卡片
                        const card = this.templatesContainer.querySelector(`[data-id="${chapterId}"]`);
                        if (card) {
                            // 检查是否已经有完成指示器
                            if (!card.querySelector('.learningcenter-completed-indicator')) {
                                const completedIndicator = $el("div.learningcenter-completed-indicator", {
                                    style: {
                                        position: "absolute",
                                        top: "12px",
                                        right: "12px",
                                        fontSize: "12px",
                                        backgroundColor: "var(--comfy-green)",
                                        color: "white",
                                        padding: "2px 6px",
                                        borderRadius: "3px",
                                        fontWeight: "bold"
                                    }
                                }, "已完成");
                                card.appendChild(completedIndicator);
                            }
                        }
                    }
                    
                    // 重新加载章节列表和详情
                    this.loadTemplates();
                    
                    // 如果当前有选中的章节，重新加载详情
                    if (this.selectedTemplate) {
                        this.showTemplateDetails(this.selectedTemplate);
                    }
                } else {
                    showNotification(`标记失败: ${result.message}`, "error");
                }
            } else {
                const errorText = await response.text();
                console.error(`[学习中心] 标记章节完成失败:`, errorText);
                showNotification("标记章节完成失败", "error");
            }
        } catch (error) {
            console.error(`[学习中心] 标记章节完成时出错`, error);
            showNotification(`标记章节完成时出错: ${error.message}`, "error");
        }
    }
    
    // 重置用户进度
    async resetProgress() {
        // 显示确认对话框
        if (!confirm("确定要重置所有章节的完成状态吗？\n此操作不可撤销")) {
            return;
        }
        
        try {
            console.log("[学习中心] 请求重置用户进度...");
            
            // 调用后端API
            const response = await api.fetchApi("/learningcenter/reset-progress", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    confirm: true
                })
            });
            
            // 处理响应
            if (response.status === 200) {
                const result = await response.json();
                console.log("[学习中心] 重置进度结果:", result);
                
                if (result.success) {
                    showNotification("所有章节进度已重置", "success");
                    
                    // 重新加载章节列表，更新已完成状态
                    this.loadTemplates();
                    
                    // 如果当前有选中的章节，刷新详情页面
                    if (this.selectedTemplate) {
                        this.selectedTemplate.completed = false;
                        this.showTemplateDetails(this.selectedTemplate);
                    }
                } else {
                    showNotification(`重置失败: ${result.message}`, "error");
                }
            } else {
                const errorText = await response.text();
                console.error("[学习中心] 重置进度失败:", errorText);
                showNotification("重置进度失败", "error");
            }
        } catch (error) {
            console.error("[学习中心] 重置进度出错:", error);
            showNotification(`重置进度出错: ${error.message}`, "error");
        }
    }
    
    // 添加加载更多的状态显示
    showLoadingMore() {
        // 删除现有的加载更多按钮
        const existingLoadMore = this.templatesContainer.querySelector(".learningcenter-load-more");
        if (existingLoadMore) {
            existingLoadMore.innerHTML = "加载中...";
            existingLoadMore.style.cursor = "wait";
            existingLoadMore.style.pointerEvents = "none";
        }
    }
    
    // 隐藏加载更多状态
    hideLoadingMore() {
        const loadingMore = this.templatesContainer.querySelector(".learningcenter-load-more");
        if (loadingMore) {
            loadingMore.innerHTML = "加载更多章节...";
            loadingMore.style.cursor = "pointer";
            loadingMore.style.pointerEvents = "auto";
        }
    }
    
    // 添加一个方法显示"没有找到匹配的章节"提示
    showNoResults() {
        // 清空现有内容
        while (this.templatesContainer.firstChild) {
            this.templatesContainer.removeChild(this.templatesContainer.firstChild);
        }
        
        // 创建"没有找到匹配的章节"提示
        const noResults = $el("div.learningcenter-no-results", {
            style: {
                padding: "20px",
                textAlign: "center",
                color: "var(--comfy-text-color)",
                opacity: "0.7",
                fontSize: "14px"
            }
        }, "没有找到匹配的章节");
        
        // 添加重置过滤器按钮
        const resetFiltersBtn = $el("button.learningcenter-reset-filters-btn", {
            style: {
                backgroundColor: "var(--comfy-input-bg)",
                border: "1px solid var(--comfy-input-border)",
                borderRadius: "4px",
                padding: "8px 12px",
                margin: "10px auto",
                display: "block",
                cursor: "pointer",
                color: "var(--comfy-text-color)",
                fontSize: "12px",
                transition: "background-color 0.2s"
            },
            onmouseover: function() {
                this.style.backgroundColor = "var(--comfy-input-bg-hover)";
            },
            onmouseout: function() {
                this.style.backgroundColor = "var(--comfy-input-bg)";
            },
            onclick: () => this.resetFilters()
        }, "重置所有过滤条件");
        
        noResults.appendChild(resetFiltersBtn);
        this.templatesContainer.appendChild(noResults);
    }
    
    // 添加一个方法重置所有过滤器
    resetFilters() {
        console.log("[学习中心] 重置所有过滤条件");
        
        // 重置过滤条件对象
        this.currentFilter = {
            search: "",
            purpose: "",
            difficulty: "",
            model: "",
            tag: ""
        };
        
        // 重置搜索框
        const searchInput = this.searchContainer.querySelector("input");
        if (searchInput) {
            searchInput.value = "";
        }
        
        // 重置所有下拉选择框
        const selects = this.filterContainer.querySelectorAll("select");
        selects.forEach(select => {
            select.value = "";
        });
        
        // 重新加载章节
        this.loadTemplates();
    }
    
    // 静态初始化方法
    static init() {
        if (!LearningCenterPanel.instance) {
            LearningCenterPanel.instance = new LearningCenterPanel();
        }
        return LearningCenterPanel.instance;
    }
    
    // 静态切换方法
    static toggle() {
        const instance = LearningCenterPanel.init();
        instance.toggle();
        return instance;
    }
} 
