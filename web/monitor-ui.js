// 监控界面创建与更新
import { 
  MONITOR_BUTTON_TEMPLATE, 
  MONITOR_ICON_SVG, 
  MONITOR_HEADER_TEMPLATE, 
  MONITOR_CONTENT_TEMPLATE 
} from "./templates.js";

import {
  loadPanelPosition,
  initDraggable,
  prepareElementForDragging
} from "./utils.js";

// 创建监控按钮和面板
export function createMonitorUI() {
  // 创建容器元素，用于放置按钮
  const containerElement = document.createElement('div');
  containerElement.className = 'monitor-container';
  containerElement.style.display = 'flex';
  containerElement.style.alignItems = 'center';
  containerElement.style.marginRight = '8px';
  
  // 创建监控按钮
  const monitorButton = document.createElement('button');
  monitorButton.className = 'monitor-btn';
  monitorButton.title = '系统资源监控';
  monitorButton.innerHTML = MONITOR_BUTTON_TEMPLATE(MONITOR_ICON_SVG);
  
  // 将按钮添加到容器中
  containerElement.appendChild(monitorButton);
  
  // 创建监控面板
  const monitorPanel = document.createElement('div');
  monitorPanel.className = 'monitor-panel';
  
  // 创建标题栏（用于拖动）
  const headerDiv = document.createElement('div');
  headerDiv.className = 'monitor-header';
  headerDiv.innerHTML = MONITOR_HEADER_TEMPLATE;
  
  // 创建内容区域
  const contentDiv = document.createElement('div');
  contentDiv.className = 'monitor-content';
  contentDiv.innerHTML = MONITOR_CONTENT_TEMPLATE;
  
  // 组装面板
  monitorPanel.appendChild(headerDiv);
  monitorPanel.appendChild(contentDiv);
  document.body.appendChild(monitorPanel);
  
  // 从localStorage加载面板位置
  loadPanelPosition(monitorPanel);
  
  // 是否已固定面板位置
  let isPinned = localStorage.getItem('monitor_panel_pinned') === 'true';
  
  // 如果已固定，添加锁定样式到面板
  if (isPinned) {
    monitorPanel.classList.add('locked');
  }
  
  // 初始化面板拖动功能
  const dragHandlers = initDraggable(monitorPanel, headerDiv, isPinned);
  
  // 更新固定按钮状态
  updatePinButton(isPinned);
  
  // 固定按钮点击事件
  const pinButton = headerDiv.querySelector('.monitor-pin-btn');
  pinButton.addEventListener('click', (e) => {
    e.stopPropagation();
    isPinned = !isPinned;
    localStorage.setItem('monitor_panel_pinned', isPinned.toString());
    updatePinButton(isPinned);
    
    // 根据固定状态启用或禁用拖动功能
    if (isPinned) {
      dragHandlers.disable();
      headerDiv.classList.add('locked');
      monitorPanel.classList.add('locked');
    } else {
      dragHandlers.enable();
      headerDiv.classList.remove('locked');
      monitorPanel.classList.remove('locked');
    }
  });
  
  // 关闭按钮点击事件
  const closeButton = headerDiv.querySelector('.monitor-close-btn');
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    monitorPanel.style.display = 'none';
    isPanelVisible = false;
    stopMonitoring();
  });
  
  // 更新固定按钮状态
  function updatePinButton(pinned) {
    const pinButton = headerDiv.querySelector('.monitor-pin-btn');
    if (pinned) {
      pinButton.classList.add('active');
      pinButton.title = '取消固定';
      headerDiv.classList.add('locked');
      monitorPanel.classList.add('locked');
    } else {
      pinButton.classList.remove('active');
      pinButton.title = '固定位置';
      headerDiv.classList.remove('locked');
      monitorPanel.classList.remove('locked');
    }
  }
  
  // 切换监控面板显示/隐藏
  let monitorInterval = null;
  let isPanelVisible = localStorage.getItem('monitor_panel_visible') === 'true';
  
  // 如果上次是显示状态，则立即显示面板
  if (isPanelVisible) {
    monitorPanel.style.display = 'block';
    startMonitoring();
  }
  
  monitorButton.addEventListener('click', () => {
    isPanelVisible = !isPanelVisible;
    localStorage.setItem('monitor_panel_visible', isPanelVisible.toString());
    monitorPanel.style.display = isPanelVisible ? 'block' : 'none';
    
    if (isPanelVisible) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  });
  
  function startMonitoring() {
    // 每2秒获取一次系统资源信息
    monitorInterval = setInterval(fetchResourceInfo, 2000);
    fetchResourceInfo(); // 立即获取一次
  }
  
  function stopMonitoring() {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
  }
  
  function fetchResourceInfo() {
    // 从后端API获取系统资源信息
    fetch('/monitor/resource_info')
      .then(response => response.json())
      .then(data => {
        updateMonitorPanel(data);
      })
      .catch(error => {
        console.error('获取系统资源信息失败:', error);
      });
  }
  
  function updateMonitorPanel(data) {
    // 更新CPU信息
    const cpuUsage = document.getElementById('cpu-usage');
    const cpuBar = document.getElementById('cpu-bar');
    cpuUsage.textContent = `${data.cpu.usage.toFixed(1)}%`;
    cpuBar.style.width = `${data.cpu.usage}%`;
    
    // 更新内存信息
    const ramUsage = document.getElementById('ram-usage');
    const ramBar = document.getElementById('ram-bar');
    const usedRam = (data.memory.used / 1024).toFixed(1);
    const totalRam = (data.memory.total / 1024).toFixed(1);
    const ramPercent = data.memory.percent.toFixed(1);
    ramUsage.textContent = `${usedRam}/${totalRam}GB (${ramPercent}%)`;
    ramBar.style.width = `${data.memory.percent}%`;
    
    // 更新GPU信息
    const gpuUsage = document.getElementById('gpu-usage');
    const gpuBar = document.getElementById('gpu-bar');
    gpuUsage.textContent = `${data.gpu.usage.toFixed(1)}%`;
    gpuBar.style.width = `${data.gpu.usage}%`;
    
    // 更新GPU温度信息
    if (data.gpu.temperature !== undefined) {
      const gpuTemp = document.getElementById('gpu-temp');
      const gpuTempBar = document.getElementById('gpu-temp-bar');
      gpuTemp.textContent = `${data.gpu.temperature}°C`;
      
      // 计算温度百分比（假设0-100°C范围）
      const tempPercent = Math.min(100, Math.max(0, data.gpu.temperature));
      gpuTempBar.style.width = `${tempPercent}%`;
      
      // 根据温度设置颜色
      if (data.gpu.temperature < 50) {
        gpuTempBar.style.backgroundColor = '#4CAF50'; // 绿色
      } else if (data.gpu.temperature < 70) {
        gpuTempBar.style.backgroundColor = '#FF9800'; // 橙色
      } else {
        gpuTempBar.style.backgroundColor = '#F44336'; // 红色
      }
    }
    
    // 更新GPU内存信息
    const gpuMemory = document.getElementById('gpu-memory');
    const gpuMemoryBar = document.getElementById('gpu-memory-bar');
    const usedGpuMem = (data.gpu.memory.used / 1024).toFixed(1);
    const totalGpuMem = (data.gpu.memory.total / 1024).toFixed(1);
    const gpuMemPercent = data.gpu.memory.percent.toFixed(1);
    gpuMemory.textContent = `${usedGpuMem}/${totalGpuMem}GB (${gpuMemPercent}%)`;
    gpuMemoryBar.style.width = `${data.gpu.memory.percent}%`;
  }
  
  // 返回容器元素，而不是按钮
  return containerElement;
} 