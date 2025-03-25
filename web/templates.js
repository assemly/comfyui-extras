 // 系统监控UI模板

// 监控按钮模板
export const MONITOR_BUTTON_TEMPLATE = (svgIcon) => `
<div class="monitor-icon">${svgIcon}</div>
<span>监控</span>
`;

// 监控图标SVG模板
export const MONITOR_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
  <line x1="8" y1="21" x2="16" y2="21"></line>
  <line x1="12" y1="17" x2="12" y2="21"></line>
  <polyline points="10 8 12 10 14 8"></polyline>
  <line x1="12" y1="5" x2="12" y2="10"></line>
</svg>
`;

// 监控面板头部模板
export const MONITOR_HEADER_TEMPLATE = `
<div class="monitor-drag-handle">
  <span class="monitor-title">
    <span class="monitor-lock-icon">🔒</span>
    系统资源监控
  </span>
</div>
<div class="monitor-controls">
  <button class="monitor-pin-btn" title="固定位置">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2L12 22"></path>
      <path d="M5 12H22"></path>
    </svg>
  </button>
  <button class="monitor-close-btn" title="关闭面板">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 6L6 18"></path>
      <path d="M6 6L18 18"></path>
    </svg>
  </button>
</div>
`;

// 监控面板内容模板
export const MONITOR_CONTENT_TEMPLATE = `
<div class="monitor-item">
  <span>CPU:</span>
  <span class="monitor-value" id="cpu-usage">0%</span>
</div>
<div class="progress-bar">
  <div class="progress-bar-fill" id="cpu-bar" style="width: 0%"></div>
</div>
<div class="monitor-item">
  <span>内存:</span>
  <span class="monitor-value" id="ram-usage">0/0GB (0%)</span>
</div>
<div class="progress-bar">
  <div class="progress-bar-fill" id="ram-bar" style="width: 0%"></div>
</div>
<div class="monitor-item">
  <span>GPU:</span>
  <span class="monitor-value" id="gpu-usage">0%</span>
</div>
<div class="progress-bar">
  <div class="progress-bar-fill" id="gpu-bar" style="width: 0%"></div>
</div>
<div class="monitor-item">
  <span>GPU温度:</span>
  <span class="monitor-value" id="gpu-temp">0°C</span>
</div>
<div class="progress-bar">
  <div class="progress-bar-fill" id="gpu-temp-bar" style="width: 0%"></div>
</div>
<div class="monitor-item">
  <span>GPU内存:</span>
  <span class="monitor-value" id="gpu-memory">0/0GB (0%)</span>
</div>
<div class="progress-bar">
  <div class="progress-bar-fill" id="gpu-memory-bar" style="width: 0%"></div>
</div>
`;