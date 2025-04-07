// 通用工具函数

/**
 * 保存面板位置到localStorage
 * @param {HTMLElement} panel - 面板元素
 */
export function savePanelPosition(panel) {
  const position = {
    top: panel.style.top,
    left: panel.style.left
  };
  localStorage.setItem('monitor_panel_position', JSON.stringify(position));
}

/**
 * 从localStorage加载面板位置
 * @param {HTMLElement} panel - 面板元素
 */
export function loadPanelPosition(panel) {
  const savedPosition = localStorage.getItem('monitor_panel_position');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      if (position.top && position.left) {
        // 设置为绝对定位以支持拖动
        panel.style.position = 'absolute';
        panel.style.top = position.top;
        panel.style.left = position.left;
        // 确保设置好宽度
        panel.style.width = '240px';
        // 清除right属性，防止与left冲突
        panel.style.right = '';
        return;
      }
    } catch (e) {
      console.error('解析保存的面板位置出错:', e);
    }
  }
  
  // 如果没有保存的位置或解析出错，设置默认位置
  // 这里使用fixed定位和right属性，因为这是初始状态
  panel.style.position = 'fixed';
  panel.style.top = '40px';
  panel.style.right = '10px';
  panel.style.left = '';  // 确保没有设置left
  panel.style.width = '240px'; // 设置固定宽度
}

/**
 * 准备元素以支持拖动
 * @param {HTMLElement} element - 要准备的元素
 */
export function prepareElementForDragging(element) {
  // 首先确保元素有固定宽度
  if (!element.style.width) {
    element.style.width = '240px';
  }
  
  // 确保元素使用绝对定位
  element.style.position = 'absolute';
  
  // 清除right属性，只使用left定位
  element.style.right = '';
  
  // 如果没有设置left属性，根据当前位置计算初始left值
  if (!element.style.left || element.style.left === '') {
    const rect = element.getBoundingClientRect();
    element.style.left = `${rect.left}px`;
  }
  
  // 如果没有设置top属性，根据当前位置计算初始top值
  if (!element.style.top || element.style.top === '') {
    const rect = element.getBoundingClientRect();
    element.style.top = `${rect.top}px`;
  }
  
  // 确保没有其他可能影响布局的样式
  element.style.transform = '';
  element.style.margin = '';
  element.style.maxWidth = '';
}

/**
 * 实现元素的拖动功能
 * @param {HTMLElement} element - 要拖动的元素
 * @param {HTMLElement} handle - 拖动的手柄元素
 * @param {boolean} initiallyPinned - 是否初始固定
 * @returns {Object} 拖动控制器
 */
export function initDraggable(element, handle, initiallyPinned) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let enabled = !initiallyPinned;  // 初始状态根据固定状态决定
  
  // 如果已固定，添加锁定样式
  if (initiallyPinned) {
    handle.classList.add('locked');
    element.classList.add('locked');
  }
  
  function dragMouseDown(e) {
    // 如果拖动被禁用，直接返回
    if (!enabled) return;
    
    e = e || window.event;
    e.preventDefault();
    
    // 在开始拖动前，确保正确设置定位模式并清除right属性
    prepareElementForDragging(element);
    
    // 获取鼠标初始位置
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // 当鼠标移动时调用elementDrag函数
    document.onmousemove = elementDrag;
    
    // 添加拖动状态类
    element.classList.add('dragging');
  }
  
  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    
    // 计算鼠标新位置
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // 设置元素新位置
    const newTop = element.offsetTop - pos2;
    const newLeft = element.offsetLeft - pos1;
    
    // 确保不会拖出屏幕
    const maxLeft = window.innerWidth - element.offsetWidth;
    const maxTop = window.innerHeight - element.offsetHeight;
    
    element.style.top = `${Math.min(Math.max(0, newTop), maxTop)}px`;
    element.style.left = `${Math.min(Math.max(0, newLeft), maxLeft)}px`;
  }
  
  function closeDragElement() {
    // 停止移动
    document.onmouseup = null;
    document.onmousemove = null;
    
    // 移除拖动状态类
    element.classList.remove('dragging');
    
    // 保存面板位置
    savePanelPosition(element);
  }
  
  // 启用拖动
  function enableDrag() {
    enabled = true;
    handle.onmousedown = dragMouseDown;
  }
  
  // 禁用拖动
  function disableDrag() {
    enabled = false;
    handle.onmousedown = null;
  }
  
  // 根据初始状态设置拖动功能
  if (enabled) {
    enableDrag();
  } else {
    disableDrag();
  }
  
  // 返回控制器，允许外部启用/禁用拖动
  return {
    enable: enableDrag,
    disable: disableDrag
  };
}

/**
 * 工具函数库 - WorkflowHub插件
 */

/**
 * 创建DOM元素的辅助函数
 * @param {string} tag - 元素标签和类名，例如 "div.class1.class2"
 * @param {object} options - 元素属性和事件处理
 * @param {Array|string} content - 子元素或文本内容
 * @returns {HTMLElement} - 创建的DOM元素
 */
export function $el(tag, options = {}, content = null) {
    // 如果第一个参数为false或undefined，则返回null
    if (!tag) return null;
    
    // 解析标签和类名
    const parts = tag.split(".");
    const tagName = parts[0] || "div";
    const classes = parts.slice(1);
    
    // 创建元素
    const element = document.createElement(tagName);
    
    // 添加类名
    if (classes.length > 0) {
        element.classList.add(...classes);
    }
    
    // 设置属性和事件
    for (const key in options) {
        if (key === "parent" && options.parent) {
            // 特殊处理父元素
            options.parent.appendChild(element);
        } else if (key === "dataset") {
            // 处理dataset属性
            for (const dataKey in options.dataset) {
                element.dataset[dataKey] = options.dataset[dataKey];
            }
        } else if (key === "style") {
            // 处理样式
            for (const styleKey in options.style) {
                element.style[styleKey] = options.style[styleKey];
            }
        } else if (key.startsWith("on") && typeof options[key] === "function") {
            // 处理事件
            const eventName = key.slice(2).toLowerCase();
            element.addEventListener(eventName, options[key]);
        } else {
            // 普通属性
            element[key] = options[key];
        }
    }
    
    // 添加内容
    if (content !== null) {
        if (Array.isArray(content)) {
            // 添加多个子元素，过滤掉null和undefined
            for (const child of content) {
                if (child === null || child === undefined) continue;
                
                if (child instanceof Element) {
                    element.appendChild(child);
                } else {
                    element.appendChild(document.createTextNode(String(child)));
                }
            }
        } else if (content instanceof Element) {
            // 添加单个子元素
            element.appendChild(content);
        } else if (content !== null && content !== undefined) {
            // 添加文本内容
            element.textContent = String(content);
        }
    }
    
    return element;
}

/**
 * 防抖函数，用于限制函数调用频率
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} - 防抖处理后的函数
 */
export function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn.apply(this, args);
            timer = null;
        }, delay);
    };
}

/**
 * 格式化日期时间
 * @param {number} timestamp - 时间戳（秒）
 * @returns {string} - 格式化后的日期时间字符串
 */
export function formatDateTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 创建通知提示
 * @param {string} message - 提示信息
 * @param {string} type - 提示类型 (success, error, info)
 * @param {number} duration - 显示时间（毫秒）
 */
export function showNotification(message, type = "info", duration = 3000) {
    // 创建通知元素
    const notification = $el("div.workflowhub-notification", {
        className: `workflowhub-notification-${type}`,
        style: {
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "10px 15px",
            borderRadius: "4px",
            color: "#fff",
            zIndex: "9999",
            opacity: "0",
            transition: "opacity 0.3s ease",
            backgroundColor: type === "success" ? "#4caf50" : type === "error" ? "#f44336" : "#2196f3",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)"
        }
    }, message);
    
    // 添加到文档
    document.body.appendChild(notification);
    
    // 显示通知
    setTimeout(() => {
        notification.style.opacity = "1";
    }, 10);
    
    // 自动隐藏和移除
    setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, duration);
}

/**
 * 从查询字符串解析URL参数
 * @param {string} queryString - URL查询字符串
 * @returns {object} - 解析后的参数对象
 */
export function parseQueryParams(queryString) {
    const params = {};
    const searchParams = new URLSearchParams(queryString.startsWith("?") ? queryString.slice(1) : queryString);
    
    for (const [key, value] of searchParams.entries()) {
        params[key] = value;
    }
    
    return params;
}

/**
 * 深度克隆对象
 * @param {object} obj - 要克隆的对象
 * @returns {object} - 克隆后的对象
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * 截断文本并添加省略号
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} - 截断后的文本
 */
export function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength) + "...";
}

/**
 * 安全获取对象属性值，避免空引用错误
 * @param {object} obj - 对象
 * @param {string} path - 属性路径，例如 "user.profile.name"
 * @param {*} defaultValue - 默认值
 * @returns {*} - 属性值或默认值
 */
export function safeGet(obj, path, defaultValue = undefined) {
    if (!obj || !path) {
        return defaultValue;
    }
    
    const keys = path.split(".");
    let result = obj;
    
    for (const key of keys) {
        if (result === null || result === undefined || typeof result !== "object") {
            return defaultValue;
        }
        result = result[key];
    }
    
    return result === undefined ? defaultValue : result;
} 