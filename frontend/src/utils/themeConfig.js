/**
 * 設計系統配置
 * 2026 中華益師益友協會伴飛計畫
 */

export const theme = {
  // 色彩系統
  colors: {
    primary: '#609ea3',        // 主色：協會藍綠
    primaryLight: '#e8f2f4',   // 主色淡色背景
    primaryDark: '#4a7d82',    // 主色深色（hover）
    
    neutral: {
      white: '#ffffff',
      light: '#f9fafb',        // 最淡背景
      lightest: '#f5f5f5',     // 淡灰背景
      border: '#e0e0e0',       // 邊框色
      text: '#333333',         // 正文
      textSecondary: '#666666', // 次要文字
      textTertiary: '#999999',  // 三級文字
      disabled: '#cccccc',     // 禁用色
    },

    status: {
      success: '#10b981',      // 成功
      warning: '#f59e0b',      // 警告
      error: '#ef4444',        // 錯誤
      info: '#3b82f6',         // 信息
    },

    // 飛航主題漸變背景
    sky: {
      from: '#e8f2f4',         // 天空漸變 - 起始（淡藍綠）
      to: '#f0f7f8',           // 天空漸變 - 結束（更淡）
    }
  },

  // 字型系統
  fonts: {
    heading: "'Heiti TC', '黑體', 'PingFang SC', sans-serif",  // 標題：黑體
    body: "'Ming SC', '明體', 'Songti SC', '宋體', serif",      // 正文：明體/宋體
    mono: "'Monaco', 'Courier New', monospace",                // 代碼字體
  },

  // 字型大小
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },

  // 間距
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px',
  },

  // 圓角
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },

  // 陰影
  shadows: {
    none: 'none',
    light: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
};

// 便捷的樣式類生成函數
export const buttonStyles = {
  // 主按鈕（外框無填充）
  primary: `
    border-2 border-[${theme.colors.primary}]
    text-[${theme.colors.primary}]
    hover:bg-[${theme.colors.primaryLight}]
    hover:border-[${theme.colors.primaryDark}]
    active:border-[${theme.colors.primaryDark}] active:bg-[${theme.colors.primaryLight}]
    px-6 py-2 rounded-md font-semibold transition
  `,

  // 次要按鈕（淡背景）
  secondary: `
    bg-[${theme.colors.neutral.lightest}]
    border border-[${theme.colors.neutral.border}]
    text-[${theme.colors.neutral.text}]
    hover:bg-[${theme.colors.neutral.light}]
    px-6 py-2 rounded-md font-semibold transition
  `,

  // 禁用狀態
  disabled: `
    bg-[${theme.colors.neutral.lightest}]
    text-[${theme.colors.neutral.disabled}]
    cursor-not-allowed
    px-6 py-2 rounded-md
  `,
};

export const tabStyles = {
  // 未選中標籤
  inactive: `
    text-[${theme.colors.neutral.textSecondary}]
    border-b-2 border-transparent
    hover:text-[${theme.colors.neutral.text}]
    py-4 px-2 transition
  `,

  // 選中標籤（外框變色 + 擴張）
  active: `
    text-[${theme.colors.primary}]
    border-b-2 border-[${theme.colors.primary}]
    bg-[${theme.colors.primaryLight}]
    py-3 px-3 rounded-t-md transition scale-105
  `,
};
