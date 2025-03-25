// 系统资源监控插件前端代码

import { app } from "../../scripts/app.js";
import { createMonitorUI } from "./monitor-ui.js";

// 添加CSS样式
function loadCSS() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/extensions/comfyui-extras/monitor.css';
  document.head.appendChild(link);
}

// 在ComfyUI初始化完成后添加监控按钮
app.registerExtension({
  name: "Monitor",
  async setup() {
    // 加载CSS
    loadCSS();
    
    try {
      // 获取ComfyUI右侧菜单
      const rightMenu = document.querySelector('.comfyui-menu-right');
      if (rightMenu) {
        const monitorButton = createMonitorUI();
        
        // 将按钮插入到右侧菜单的左侧
        rightMenu.parentNode.insertBefore(monitorButton, rightMenu);
        console.log("系统监控：按钮已添加到右侧菜单左侧");
      } else {
        // 获取ComfyUI菜单
        const menuElement = document.querySelector('.comfyui-menu.flex.items-center');
        if (menuElement) {
          const monitorButton = createMonitorUI();
          // 将按钮添加到菜单中的适当位置
          menuElement.appendChild(monitorButton);
          console.log("系统监控：按钮已添加到菜单中");
        } else {
          // 如果找不到新的UI元素，尝试旧的工具栏
          const toolbarElement = document.querySelector('.comfy-menu .comfy-tool-bar');
          if (toolbarElement) {
            const monitorButton = createMonitorUI();
            toolbarElement.appendChild(monitorButton);
            console.log("系统监控：按钮已添加到旧版工具栏");
          } else {
            console.warn("系统监控：无法找到合适的位置添加按钮");
          }
        }
      }
    } catch (error) {
      console.error("系统监控：初始化失败", error);
    }
  }
}); 