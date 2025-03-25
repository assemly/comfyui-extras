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