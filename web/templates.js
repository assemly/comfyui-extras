// 工作流模板库UI模板

// 模板按钮模板
export const TEMPLATE_BUTTON_TEMPLATE = (svgIcon) => `
<div class="learningcenter-icon">${svgIcon}</div>
<span>学习中心</span>
`;

// 模板图标SVG模板
export const TEMPLATE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="learningcenter-icon">
  <!-- 文件夹 -->
  <path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"></path>
  <!-- 模板网格 -->
  <rect x="6" y="12" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5"></rect>
  <rect x="14" y="12" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5"></rect>
  <rect x="10" y="8" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5"></rect>
</svg>
`;

// 模板面板头部模板
export const TEMPLATE_HEADER_TEMPLATE = `
<div class="learningcenter-header-content" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
  <div class="learningcenter-drag-handle" style="display: flex; align-items: center;">
    <span class="learningcenter-title">
      <svg class="learningcenter-header-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <!-- 文件夹 -->
        <path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"></path>
        <!-- 模板网格 -->
        <rect x="6" y="12" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5"></rect>
        <rect x="14" y="12" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5"></rect>
        <rect x="10" y="8" width="4" height="4" rx="0.5" fill="currentColor" opacity="0.5"></rect>
      </svg>
      学习中心
    </span>
  </div>
  <div class="learningcenter-controls">
    <button class="learningcenter-close-btn" title="关闭面板" style="background: none; border: none; cursor: pointer; color: var(--comfy-text-color); padding: 4px; margin-right: 4px; line-height: 1; opacity: 0.7; transition: opacity 0.2s; font-size: 14px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 6L6 18"></path>
        <path d="M6 6L18 18"></path>
      </svg>
    </button>
  </div>
</div>
`;

// 模板面板内容模板
export const TEMPLATE_CONTENT_TEMPLATE = `
<div class="learningcenter-templates-container">
  <div class="learningcenter-template-card">
    <div class="learningcenter-template-title">
      <span>模板名称</span>
      <span class="learningcenter-template-source">个人</span>
    </div>
    <div class="learningcenter-template-description">模板描述内容...</div>
    <div class="learningcenter-template-tags">
      <span class="learningcenter-tag">人像</span>
      <span class="learningcenter-tag">初级</span>
      <span class="learningcenter-tag">SD1.5</span>
    </div>
  </div>
</div>
`;

// 空状态模板
export const TEMPLATE_EMPTY_STATE_TEMPLATE = `
<div class="learningcenter-empty-state">
  暂无模板，请使用"保存为模板"节点添加模板。
</div>
`;

// 模板详情模板
export const TEMPLATE_DETAILS_TEMPLATE = `
<div class="learningcenter-details-header">
  <h3>模板详情</h3>
  <button class="learningcenter-details-close">×</button>
</div>
<div class="learningcenter-details-preview">
  <img src="" alt="预览图">
</div>
<div class="learningcenter-details-content">
  <div class="learningcenter-details-section">
    <h4>描述</h4>
    <p>模板描述内容...</p>
  </div>
  <div class="learningcenter-details-section">
    <h4>分类</h4>
    <div class="learningcenter-details-tags">
      <div class="learningcenter-details-tag">用途: 人像</div>
      <div class="learningcenter-details-tag">复杂度: 初级</div>
      <div class="learningcenter-details-tag">模型: SD1.5</div>
    </div>
  </div>
  <div class="learningcenter-details-section">
    <h4>标签</h4>
    <div class="learningcenter-details-tags">
      <div class="learningcenter-details-tag">标签1</div>
      <div class="learningcenter-details-tag">标签2</div>
    </div>
  </div>
  <div class="learningcenter-details-section">
    <div class="learningcenter-details-info">
      来源: 个人模板<br>
      创建时间: 2023-01-01 12:34
    </div>
  </div>
  <div class="learningcenter-details-actions">
    <button class="learningcenter-import-btn">导入工作流</button>
    <button class="learningcenter-delete-btn">删除</button>
  </div>
</div>
`;
