/**
 * 將評論內容中的 URL 轉換為可點擊的連結
 * 支援格式：
 * - 直接 URL：https://example.com
 * - Markdown 連結：[文字](https://example.com)
 */

export function parseLinks(text) {
  if (!text) return text;

  // Markdown 連結正規表達式：[文字](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  // 直接 URL 正規表達式
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // 先處理 Markdown 連結，避免與直接 URL 重複
  let result = text.replace(markdownLinkRegex, (match, text, url) => {
    // 標記 Markdown 連結，防止被再次處理
    return `__MARKDOWN_LINK__${text}__URL__${url}__END__`;
  });

  // 處理直接 URL
  result = result.replace(urlRegex, (url) => {
    return `__URL_LINK__${url}__END__`;
  });

  // 還原成 JSX/HTML
  // 注意：在 React 中需要使用 dangerouslySetInnerHTML 或手動渲染
  return result;
}

/**
 * 將解析結果轉換為 React 元素
 */
export function renderLinksAsReact(text) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;

  // 合併 Markdown 和直接 URL 的正規表達式
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // 同時處理兩種類型的連結
  const combinedRegex = /\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)/g;
  let match;
  let index = 0;

  while ((match = combinedRegex.exec(text)) !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // 判斷是 Markdown 連結還是直接 URL
    if (match[2]) {
      // Markdown 連結
      parts.push({
        type: 'link',
        text: match[1],
        url: match[2],
        key: index++
      });
    } else if (match[3]) {
      // 直接 URL
      parts.push({
        type: 'link',
        text: match[3],
        url: match[3],
        key: index++
      });
    }

    lastIndex = combinedRegex.lastIndex;
  }

  // 添加剩餘文本
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}
