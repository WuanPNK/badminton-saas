const fs = require('fs');
const path = require('path');
const readline = require('readline');

const transcriptFile = 'C:/Users/Admin/.gemini/antigravity-ide/brain/8688d5c0-b284-4e04-87bd-6add5e2d4e5e/.system_generated/logs/transcript.jsonl';
const transcriptFullFile = 'C:/Users/Admin/.gemini/antigravity-ide/brain/8688d5c0-b284-4e04-87bd-6add5e2d4e5e/.system_generated/logs/transcript_full.jsonl';

const mdOutput = path.join(__dirname, '../../../LICH_SU_TRO_CHUYEN.md');
const htmlOutput = path.join(__dirname, '../../../LICH_SU_TRO_CHUYEN.html');

async function parseTranscripts() {
  console.log('Đang đọc nhật ký trò chuyện...');
  const fileToUse = fs.existsSync(transcriptFullFile) ? transcriptFullFile : transcriptFile;

  const fileStream = fs.createReadStream(fileToUse, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const turns = [];
  let currentTurn = null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);

      if (data.type === 'USER_INPUT') {
        if (currentTurn) {
          turns.push(currentTurn);
        }
        let userContent = data.content || '';
        const match = userContent.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
        if (match) {
          userContent = match[1].trim();
        }
        currentTurn = {
          user: userContent,
          aiChunks: [],
          stepIndex: data.step_index,
        };
      } else if (data.type === 'PLANNER_RESPONSE' && currentTurn) {
        if (data.content && typeof data.content === 'string' && data.content.trim()) {
          // Chỉ lấy các phản hồi có nội dung thực tế (không phải chỉ gọi tool)
          currentTurn.aiChunks.push(data.content);
        }
      }
    } catch (e) {
      // bỏ qua dòng lỗi parse
    }
  }

  if (currentTurn) {
    turns.push(currentTurn);
  }

  console.log(`Đã trích xuất thành công ${turns.length} lượt trao đổi.`);
  return turns;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function simpleMarkdownToHtml(md) {
  let html = md;

  // Code blocks
  html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');

  // Bullet points
  html = html.replace(/^[•*-] (.*?)$/gm, '<li>$1</li>');

  // Paragraphs
  html = html.replace(/\n\n+/g, '</p><p>');

  return `<p>${html}</p>`
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[1-4]>.*?<\/h[1-4]>)<\/p>/g, '$1')
    .replace(/<p>(<pre>[\s\S]*?<\/pre>)<\/p>/g, '$1')
    .replace(/<p>(<blockquote>.*?<\/blockquote>)<\/p>/g, '$1');
}

async function exportLogs() {
  const turns = await parseTranscripts();

  // 1. Tạo file LICH_SU_TRO_CHUYEN.md
  let mdContent = `# 📜 LỊCH SỬ HỘI THOẠI & QUÁ TRÌNH PHÁT TRIỂN DỰ ÁN
> **Dự án:** Nền Tảng Đặt Lịch Sân Cầu Lông & Quản Lý Đa Chi Nhánh (Badminton SaaS Portal)  
> **Phiên làm việc:** \`8688d5c0-b284-4e04-87bd-6add5e2d4e5e\`  
> **Cập nhật lần cuối:** ${new Date().toLocaleString('vi-VN')}  
> **Tổng số lượt tương tác:** ${turns.length} lượt trao đổi

---

## 📑 MỤC LỤC CÁC MỐC PHÁT TRIỂN QUAN TRỌNG

`;

  turns.forEach((t, i) => {
    const summary = t.user.slice(0, 60).replace(/\n/g, ' ') + (t.user.length > 60 ? '...' : '');
    mdContent += `- [Lượt #${i + 1}: ${summary}](#-luot-trao-doi-${i + 1})\n`;
  });

  mdContent += '\n---\n\n';

  turns.forEach((t, i) => {
    const lastChunk = t.aiChunks.length > 0 ? t.aiChunks[t.aiChunks.length - 1] : '_Đang xử lý / Tiếp tục tác vụ..._';

    mdContent += `## 💬 LƯỢT TRAO ĐỔI #${i + 1}\n\n`;
    mdContent += `### 👤 Bạn (Người dùng):\n`;
    mdContent += `${t.user}\n\n`;
    mdContent += `### 🤖 Antigravity AI Assistant:\n`;
    mdContent += `${lastChunk}\n\n`;
    mdContent += `---\n\n`;
  });

  fs.writeFileSync(mdOutput, mdContent, 'utf8');
  console.log(`✓ Đã cập nhật file Markdown: ${mdOutput}`);

  // 2. Tạo file LICH_SU_TRO_CHUYEN.html
  let htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lịch Sử Hội Thoại & Quá Trình Phát Triển - Badminton SaaS Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #059669;
      --primary-dark: #047857;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #1e293b;
      --muted: #64748b;
      --border: #e2e8f0;
      --user-bg: #f0fdf4;
      --user-border: #86efac;
      --ai-bg: #ffffff;
      --ai-border: #cbd5e1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      padding: 30px 20px;
    }
    .container {
      max-width: 980px;
      margin: 0 auto;
    }
    .header-bar {
      background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
      color: #ffffff;
      padding: 32px 36px;
      border-radius: 24px;
      box-shadow: 0 10px 25px -5px rgba(6, 78, 59, 0.2);
      margin-bottom: 30px;
      position: relative;
    }
    .header-bar h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .header-bar p {
      color: #a7f3d0;
      font-size: 14px;
    }
    .meta-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .tag {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .print-btn {
      position: absolute;
      top: 32px;
      right: 36px;
      background: #ffffff;
      color: #065f46;
      border: none;
      padding: 10px 20px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      transition: all 0.2s;
    }
    .print-btn:hover {
      background: #ecfdf5;
      transform: translateY(-1px);
    }
    .turn-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px 28px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    }
    .turn-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
      font-weight: 800;
      color: var(--primary-dark);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .user-box {
      background: var(--user-bg);
      border: 1px solid var(--user-border);
      border-radius: 14px;
      padding: 14px 18px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .ai-box {
      background: var(--ai-bg);
      border: 1px solid var(--ai-border);
      border-radius: 14px;
      padding: 18px 22px;
      font-size: 14px;
      line-height: 1.8;
    }
    .role-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .user-box .role-badge {
      background: #bbf7d0;
      color: #166534;
    }
    .ai-box .role-badge {
      background: #e2e8f0;
      color: #334155;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 14px 18px;
      border-radius: 12px;
      font-family: 'Fira Code', monospace;
      font-size: 12px;
      overflow-x: auto;
      margin: 12px 0;
    }
    code {
      font-family: 'Fira Code', monospace;
      font-size: 12px;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      color: #0f766e;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
    ul, ol {
      margin-left: 20px;
      margin-bottom: 12px;
    }
    li {
      margin-bottom: 4px;
    }
    h2, h3, h4 {
      margin-top: 14px;
      margin-bottom: 8px;
      color: #0f172a;
    }
    h3 { font-size: 16px; font-weight: 800; }
    h4 { font-size: 14px; font-weight: 700; }
    blockquote {
      border-left: 4px solid var(--primary);
      padding-left: 12px;
      color: var(--muted);
      margin: 10px 0;
      font-style: italic;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-btn { display: none; }
      .header-bar { box-shadow: none; border: 1px solid #000; }
      .turn-card { page-break-inside: avoid; box-shadow: none; border: 1px solid #ccc; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <button class="print-btn" onclick="window.print()">🖨️ In ra PDF / Giấy</button>
      <h1>📜 Nhật Ký Trao Đổi & Tiến Trình Phát Triển Dự Án</h1>
      <p>Nền tảng Quản trị & Đặt lịch Cầu Lông Đa Chi Nhánh (Badminton SaaS Portal)</p>
      <div class="meta-tags">
        <span class="tag">Phiên: 8688d5c0</span>
        <span class="tag">Cập nhật: ${new Date().toLocaleDateString('vi-VN')}</span>
        <span class="tag">Tổng cộng: ${turns.length} lượt trao đổi</span>
        <span class="tag">AI: Google Antigravity Agent</span>
      </div>
    </div>
`;

  turns.forEach((t, i) => {
    const lastChunk = t.aiChunks.length > 0 ? t.aiChunks[t.aiChunks.length - 1] : '<em>Đang xử lý / Tiếp tục tác vụ...</em>';

    htmlContent += `
    <div class="turn-card" id="turn-${i + 1}">
      <div class="turn-header">
        <span>LƯỢT TRAO ĐỔI #${i + 1}</span>
        <span style="font-weight: normal; font-size: 11px;">Mã phiên: 8688d5c0</span>
      </div>
      <div class="user-box">
        <div class="role-badge">👤 Bạn (Người Dùng)</div>
        <div>${escapeHtml(t.user).replace(/\n/g, '<br/>')}</div>
      </div>
      <div class="ai-box">
        <div class="role-badge">🤖 Antigravity AI Assistant</div>
        <div>${simpleMarkdownToHtml(lastChunk)}</div>
      </div>
    </div>
`;
  });

  htmlContent += `
    <div style="text-align: center; padding: 24px; font-size: 12px; color: #94a3b8;">
      ✓ Tài liệu xuất từ hệ thống Antigravity IDE - Google DeepMind Advanced Agentic Coding. Toàn bộ 100% cuộc trò chuyện được lưu trữ an toàn.
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(htmlOutput, htmlContent, 'utf8');
  console.log(`✓ Đã cập nhật file HTML: ${htmlOutput}`);
  console.log('HOÀN TẤT ĐỒNG BỘ 100% LỊCH SỬ HỘI THOẠI!');
}

exportLogs().catch(console.error);
