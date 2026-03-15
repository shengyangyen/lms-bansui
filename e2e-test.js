import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import http from 'http';

const BASE_URL = 'http://localhost:3000';

async function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3000/api/health', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json?.ok === true);
        } catch {
          resolve(false);
        }
      });
    });
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}
const results = [];
let testCount = 0;
let passCount = 0;
let failCount = 0;

// 測試帳號
const accounts = {
  teacher: { email: 'test@example.com', password: 'password123' },
  teacher2: { email: 'teacher@test.com', password: 'password123' },
  student1: { email: 'st@example.com', password: 'password123' },
  student2: { email: 'student1@test.com', password: 'password123' },
  student3: { email: 'student2@test.com', password: 'password123' },
  newUser: { email: `testuser_${Date.now()}@example.com`, password: 'Test123456' }
};

function log(emoji, status, title, details = '') {
  testCount++;
  if (status === '✅') passCount++;
  if (status === '❌') failCount++;
  
  const result = {
    status,
    title,
    details,
    timestamp: new Date().toISOString()
  };
  results.push(result);
  console.log(`${emoji} ${status} ${title}`);
  if (details) console.log(`   原因: ${details}`);
}

async function takeScreenshot(page, name) {
  const filename = `screenshot_${name}_${Date.now()}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`   📸 截圖已保存: ${filename}`);
  return filename;
}

async function waitForNetworkIdle(page, timeout = 3000) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
}

async function testLogin(page, email, password, expectSuccess = true) {
  try {
    await page.goto(BASE_URL);
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    const hasError = await page.locator('text=/錯誤|失敗|不存在|密碼錯誤/i').count() > 0;
    
    if (expectSuccess) {
      if (!hasError && !currentUrl.includes('/login')) {
        log('🔐', '✅', `登入測試 - ${email}`, '成功登入');
        return true;
      } else {
        log('🔐', '❌', `登入測試 - ${email}`, '登入失敗或帳號不存在');
        await takeScreenshot(page, `login_fail_${email.split('@')[0]}`);
        return false;
      }
    } else {
      if (hasError || currentUrl.includes('/login')) {
        log('🔐', '✅', `登入失敗測試 - ${email}`, '正確拒絕無效登入');
        return true;
      } else {
        log('🔐', '❌', `登入失敗測試 - ${email}`, '應該拒絕但卻登入成功');
        return false;
      }
    }
  } catch (error) {
    log('🔐', '❌', `登入測試 - ${email}`, error.message);
    return false;
  }
}

async function testRegistration(page, email, password) {
  try {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[name="displayName"], input[placeholder*="顯示名稱"]', 'Test User');
    await page.fill('input[name="realName"], input[placeholder*="真實姓名"]', '測試用戶');
    await page.fill('input[type="password"]', password);
    
    // 選擇角色
    const roleSelect = await page.locator('select[name="role"], select[name="userRole"]').first();
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption('student');
    }
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    const hasPending = await page.locator('text=/待審核|pending|等待/i').count() > 0;
    const hasSuccess = await page.locator('text=/成功|註冊完成|已註冊/i').count() > 0;
    
    if (hasPending || hasSuccess) {
      log('📝', '✅', '註冊測試', '成功建立帳號（進入 pending 狀態）');
      await takeScreenshot(page, 'registration_success');
      return true;
    } else {
      log('📝', '❌', '註冊測試', '註冊流程失敗');
      await takeScreenshot(page, 'registration_fail');
      return false;
    }
  } catch (error) {
    log('📝', '❌', '註冊測試', error.message);
    return false;
  }
}

async function testCourseManagement(page, teacherEmail, teacherPassword) {
  try {
    // 登入教師帳號
    const loginSuccess = await testLogin(page, teacherEmail, teacherPassword);
    if (!loginSuccess) {
      log('📚', '❌', '課程管理測試', '無法登入教師帳號');
      return null;
    }
    
    // 進入課程列表
    await page.goto(`${BASE_URL}/courses`);
    await page.waitForTimeout(2000);
    
    // 建立新課程
    const createButton = await page.locator('button:has-text("建立"), button:has-text("新增"), a:has-text("建立")').first();
    if (await createButton.count() === 0) {
      log('📚', '❌', '課程建立測試', '找不到建立課程按鈕');
      await takeScreenshot(page, 'course_create_button_missing');
      return null;
    }
    
    await createButton.click();
    await page.waitForTimeout(1000);
    
    const courseName = `自動化測試課程_${Date.now()}`;
    await page.fill('input[name="name"], input[placeholder*="課程名稱"]', courseName);
    await page.fill('textarea[name="description"], textarea[placeholder*="描述"]', '這是一個自動化測試課程');
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // 檢查是否建立成功
    const hasCourse = await page.locator(`text="${courseName}"`).count() > 0;
    if (hasCourse) {
      log('📚', '✅', '課程建立測試', `成功建立課程: ${courseName}`);
      await takeScreenshot(page, 'course_created');
      
      // 進入課程
      await page.click(`text="${courseName}"`);
      await page.waitForTimeout(2000);
      
      const courseUrl = page.url();
      const courseId = courseUrl.match(/courses\/([a-f0-9-]+)/)?.[1];
      
      log('📚', '✅', '課程進入測試', `成功進入課程，ID: ${courseId}`);
      
      return { courseId, courseName };
    } else {
      log('📚', '❌', '課程建立測試', '課程建立後未出現在列表');
      await takeScreenshot(page, 'course_not_found');
      return null;
    }
  } catch (error) {
    log('📚', '❌', '課程管理測試', error.message);
    await takeScreenshot(page, 'course_management_error');
    return null;
  }
}

async function testAddStudentsToCourse(page, courseId) {
  try {
    await page.goto(`${BASE_URL}/courses/${courseId}`);
    await page.waitForTimeout(2000);
    
    // 尋找學生管理按鈕
    const manageStudentBtn = await page.locator('button:has-text("學生"), button:has-text("成員"), a:has-text("學生")').first();
    if (await manageStudentBtn.count() > 0) {
      await manageStudentBtn.click();
      await page.waitForTimeout(1000);
      
      // 嘗試加入學生
      const addBtn = await page.locator('button:has-text("加入"), button:has-text("添加")').first();
      if (await addBtn.count() > 0) {
        await addBtn.click();
        await page.waitForTimeout(1000);
        
        // 選擇學生（這裡根據實際 UI 調整）
        const studentCheckboxes = await page.locator('input[type="checkbox"]').all();
        if (studentCheckboxes.length >= 2) {
          await studentCheckboxes[0].check();
          await studentCheckboxes[1].check();
          
          await page.click('button:has-text("確認"), button:has-text("保存")');
          await page.waitForTimeout(2000);
          
          log('👥', '✅', '加入學生測試', '成功加入 2 個學生');
          return true;
        }
      }
    }
    
    log('👥', '⚠️', '加入學生測試', '無法找到學生管理功能或學生列表');
    await takeScreenshot(page, 'add_students_ui_missing');
    return false;
  } catch (error) {
    log('👥', '❌', '加入學生測試', error.message);
    return false;
  }
}

async function testAssignmentCreation(page, courseId, assignToStudentEmail = null) {
  try {
    await page.goto(`${BASE_URL}/courses/${courseId}`);
    await page.waitForTimeout(2000);
    
    // 建立作業按鈕
    const createAssignmentBtn = await page.locator('button:has-text("作業"), button:has-text("建立作業"), a[href*="assignment"]').first();
    if (await createAssignmentBtn.count() === 0) {
      log('📝', '❌', '作業建立測試', '找不到建立作業按鈕');
      await takeScreenshot(page, 'assignment_button_missing');
      return null;
    }
    
    await createAssignmentBtn.click();
    await page.waitForTimeout(1000);
    
    const assignmentTitle = `檔案上傳測試_${Date.now()}`;
    await page.fill('input[name="title"], input[placeholder*="標題"]', assignmentTitle);
    await page.fill('textarea[name="description"], textarea[placeholder*="描述"]', '請上傳測試檔案');
    
    // 選擇作業類型：檔案上傳
    const typeSelect = await page.locator('select[name="type"], input[value="file"]').first();
    if (await typeSelect.count() > 0) {
      await typeSelect.selectOption?.('file') || await typeSelect.click();
    }
    
    // 指定學生
    if (assignToStudentEmail) {
      const designateCheckbox = await page.locator(`text="${assignToStudentEmail}"`).locator('..').locator('input[type="checkbox"]').first();
      if (await designateCheckbox.count() > 0) {
        await designateCheckbox.check();
        log('🎯', '✅', '指定學生測試', `成功指定給: ${assignToStudentEmail}`);
      }
    }
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // 驗證作業建立成功
    const hasAssignment = await page.locator(`text="${assignmentTitle}"`).count() > 0;
    if (hasAssignment) {
      log('📝', '✅', '作業建立測試（檔案上傳）', `成功建立: ${assignmentTitle}`);
      await takeScreenshot(page, 'assignment_created');
      
      const assignmentUrl = page.url();
      const assignmentId = assignmentUrl.match(/assignments\/([a-f0-9-]+)/)?.[1];
      
      return { assignmentId, assignmentTitle };
    } else {
      log('📝', '❌', '作業建立測試', '作業未出現在列表');
      await takeScreenshot(page, 'assignment_not_found');
      return null;
    }
  } catch (error) {
    log('📝', '❌', '作業建立測試', error.message);
    return null;
  }
}

async function testN1Query(page, courseId, studentEmail, studentPassword) {
  try {
    // 登入學生帳號
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', studentPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // 開啟 Network 監控
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });
    
    // 進入課程頁面
    await page.goto(`${BASE_URL}/courses/${courseId}`);
    await waitForNetworkIdle(page);
    
    // 分析 API 呼叫
    const courseApiCalls = requests.filter(r => r.url.includes(`/courses/${courseId}`));
    const assignmentApiCalls = requests.filter(r => r.url.includes('/assignments/') && r.url.includes('/is-designated'));
    
    log('🔍', '📊', 'N+1 查詢測試', `
      課程 API 呼叫: ${courseApiCalls.length}
      作業指定查詢: ${assignmentApiCalls.length}
      ${assignmentApiCalls.length === 0 ? '✅ 無 N+1 問題' : '❌ 可能有 N+1 問題'}
    `);
    
    if (assignmentApiCalls.length === 0) {
      log('🔍', '✅', 'N+1 優化驗證', '沒有多餘的 is-designated 查詢');
      return true;
    } else {
      log('🔍', '❌', 'N+1 問題', `發現 ${assignmentApiCalls.length} 個額外查詢`);
      console.log('   API 呼叫列表:', assignmentApiCalls.map(r => r.url));
      return false;
    }
  } catch (error) {
    log('🔍', '❌', 'N+1 查詢測試', error.message);
    return false;
  }
}

async function testFileUpload(page, courseId, assignmentId, studentEmail, studentPassword) {
  try {
    // 登入學生
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', studentEmail);
    await page.fill('input[type="password"]', studentPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // 進入作業
    await page.goto(`${BASE_URL}/courses/${courseId}/assignments/${assignmentId}`);
    await page.waitForTimeout(2000);
    
    // 建立測試檔案
    const testFileName = `測試檔案_2026年_${Date.now()}.txt`;
    const testFileContent = '這是一個測試檔案\n包含中文內容\n測試檔名編碼';
    
    // 找到檔案上傳輸入
    const fileInput = await page.locator('input[type="file"]').first();
    if (await fileInput.count() === 0) {
      log('📎', '❌', '檔案上傳測試', '找不到檔案上傳輸入框');
      await takeScreenshot(page, 'file_input_missing');
      return false;
    }
    
    // 使用 setInputFiles
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from(testFileContent)
    });
    
    await page.waitForTimeout(1000);
    
    // 點擊提交
    await page.click('button:has-text("提交"), button:has-text("上傳")');
    await page.waitForTimeout(3000);
    
    // 檢查檔名顯示
    const fileNameDisplayed = await page.locator(`text="${testFileName}"`).count() > 0;
    const hasGarbled = await page.locator('text=/\\?\\?|�|%[0-9A-F]{2}/').count() > 0;
    
    if (fileNameDisplayed) {
      log('📎', '✅', '檔案上傳測試', `檔名正確顯示: ${testFileName}`);
      log('🔤', '✅', '中文檔名編碼測試', '中文檔名無亂碼');
      await takeScreenshot(page, 'file_uploaded_success');
      return true;
    } else if (hasGarbled) {
      log('📎', '⚠️', '檔案上傳測試', '檔案已上傳但檔名出現亂碼');
      log('🔤', '❌', '中文檔名編碼測試', '檔名顯示為亂碼');
      await takeScreenshot(page, 'file_name_garbled');
      return false;
    } else {
      log('📎', '❌', '檔案上傳測試', '無法確認檔案是否上傳成功');
      await takeScreenshot(page, 'file_upload_unclear');
      return false;
    }
  } catch (error) {
    log('📎', '❌', '檔案上傳測試', error.message);
    return false;
  }
}

async function testVersionControl(page, courseId, assignmentId) {
  try {
    await page.goto(`${BASE_URL}/courses/${courseId}/assignments/${assignmentId}`);
    await page.waitForTimeout(2000);
    
    // 查看提交歷史
    const historyBtn = await page.locator('button:has-text("歷史"), button:has-text("版本"), a:has-text("提交記錄")').first();
    if (await historyBtn.count() > 0) {
      await historyBtn.click();
      await page.waitForTimeout(1000);
      
      // 檢查版本列表
      const versionItems = await page.locator('[class*="version"], [class*="submission"]').count();
      if (versionItems >= 1) {
        log('📜', '✅', '版本歷史測試', `找到 ${versionItems} 個版本`);
        await takeScreenshot(page, 'version_history');
        return true;
      } else {
        log('📜', '❌', '版本歷史測試', '沒有找到版本記錄');
        return false;
      }
    } else {
      log('📜', '⚠️', '版本歷史測試', '找不到查看歷史按鈕');
      return false;
    }
  } catch (error) {
    log('📜', '❌', '版本歷史測試', error.message);
    return false;
  }
}

async function testGrading(page, courseId, assignmentId, teacherEmail, teacherPassword) {
  try {
    // 登入教師
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', teacherEmail);
    await page.fill('input[type="password"]', teacherPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // 進入作業批改頁面
    await page.goto(`${BASE_URL}/courses/${courseId}/assignments/${assignmentId}/submissions`);
    await page.waitForTimeout(2000);
    
    // 選擇第一個學生的提交
    const submissionLink = await page.locator('a[href*="submission"], button:has-text("查看")').first();
    if (await submissionLink.count() === 0) {
      log('✏️', '⚠️', '批改測試', '沒有找到學生提交');
      await takeScreenshot(page, 'no_submissions');
      return false;
    }
    
    await submissionLink.click();
    await page.waitForTimeout(2000);
    
    // 輸入分數和評語
    await page.fill('input[name="score"], input[placeholder*="分數"]', '85');
    await page.fill('textarea[name="feedback"], textarea[placeholder*="評語"]', '做得不錯，下次注意細節');
    
    await page.click('button:has-text("保存"), button:has-text("提交")');
    await page.waitForTimeout(2000);
    
    // 驗證批改是否保存
    const hasScore = await page.locator('text="85"').count() > 0;
    const hasFeedback = await page.locator('text="做得不錯"').count() > 0;
    
    if (hasScore && hasFeedback) {
      log('✏️', '✅', '批改保存測試', '分數和評語正確保存');
      await takeScreenshot(page, 'grading_saved');
      return true;
    } else {
      log('✏️', '❌', '批改保存測試', '批改未正確保存');
      await takeScreenshot(page, 'grading_not_saved');
      return false;
    }
  } catch (error) {
    log('✏️', '❌', '批改測試', error.message);
    return false;
  }
}

async function testFillInBlankAssignment(page, courseId, teacherEmail, teacherPassword) {
  try {
    // 登入教師
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', teacherEmail);
    await page.fill('input[type="password"]', teacherPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // 建立填空題作業
    await page.goto(`${BASE_URL}/courses/${courseId}/assignments/new`);
    await page.waitForTimeout(2000);
    
    const assignmentTitle = `填空題測試_${Date.now()}`;
    await page.fill('input[name="title"]', assignmentTitle);
    
    // 選擇填空題類型
    const typeSelect = await page.locator('select[name="type"]').first();
    if (await typeSelect.count() > 0) {
      await typeSelect.selectOption('form');
    }
    
    // 添加題目
    await page.fill('textarea[name="questions[0]"], input[placeholder*="第一題"]', '你好吗？');
    
    // 嘗試添加第二題
    const addQuestionBtn = await page.locator('button:has-text("添加"), button:has-text("新增題目")').first();
    if (await addQuestionBtn.count() > 0) {
      await addQuestionBtn.click();
      await page.waitForTimeout(500);
      await page.fill('textarea[name="questions[1]"], input[placeholder*="第二題"]', '今天天氣怎樣？');
    }
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    const hasAssignment = await page.locator(`text="${assignmentTitle}"`).count() > 0;
    if (hasAssignment) {
      log('📋', '✅', '填空題作業建立', `成功建立: ${assignmentTitle}`);
      await takeScreenshot(page, 'fillinblank_created');
      return assignmentTitle;
    } else {
      log('📋', '❌', '填空題作業建立', '作業未出現');
      return null;
    }
  } catch (error) {
    log('📋', '❌', '填空題作業測試', error.message);
    return null;
  }
}

async function generateReport() {
  const passRate = ((passCount / testCount) * 100).toFixed(2);
  
  let report = `# LMS 系統完整端到端測試報告\n\n`;
  report += `**測試日期**: ${new Date().toLocaleDateString('zh-TW')}\n`;
  report += `**測試時間**: ${new Date().toLocaleTimeString('zh-TW')}\n`;
  report += `**測試環境**: Windows 10, Chromium\n\n`;
  report += `---\n\n`;
  report += `## 📊 測試統計\n\n`;
  report += `| 指標 | 數值 |\n`;
  report += `|------|------|\n`;
  report += `| 總測試數 | ${testCount} |\n`;
  report += `| 通過測試 | ${passCount} |\n`;
  report += `| 失敗測試 | ${failCount} |\n`;
  report += `| 通過率 | **${passRate}%** |\n\n`;
  report += `---\n\n`;
  report += `## 詳細測試結果\n\n`;
  
  results.forEach((result, index) => {
    report += `### ${index + 1}. ${result.status} ${result.title}\n`;
    if (result.details) {
      report += `${result.details}\n`;
    }
    report += `\n`;
  });
  
  report += `---\n\n`;
  report += `## 🎯 總結\n\n`;
  report += `- ✅ 通過項目: ${passCount}\n`;
  report += `- ❌ 失敗項目: ${failCount}\n`;
  report += `- 通過率: ${passRate}%\n\n`;
  
  if (failCount > 0) {
    report += `### 主要問題\n\n`;
    results.filter(r => r.status === '❌').forEach(r => {
      report += `- ${r.title}: ${r.details}\n`;
    });
  }
  
  report += `\n---\n\n`;
  report += `**報告生成時間**: ${new Date().toISOString()}\n`;
  
  writeFileSync('端到端測試報告.md', report, 'utf-8');
  console.log('\n✅ 測試報告已生成: 端到端測試報告.md');
}

async function main() {
  console.log('🚀 開始 LMS 系統端到端測試...\n');

  const healthy = await checkHealth();
  if (!healthy) {
    console.error('❌ /api/health 連線失敗，請確認 backend 與 frontend 皆已啟動');
    console.error('   backend: cd backend && npm run dev');
    console.error('   frontend: cd frontend && npm run dev');
    process.exit(1);
  }
  console.log('✅ Health check 通過\n');

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-TW'
  });
  const page = await context.newPage();
  
  try {
    console.log('\n=== 第一部分：帳號與登入測試 ===\n');
    
    // 測試登入
    const teacher1Success = await testLogin(page, accounts.teacher.email, accounts.teacher.password);
    if (!teacher1Success) {
      await testLogin(page, accounts.teacher2.email, accounts.teacher2.password);
    }
    
    const student1Success = await testLogin(page, accounts.student1.email, accounts.student1.password);
    if (!student1Success) {
      await testLogin(page, accounts.student2.email, accounts.student2.password);
    }
    
    // 測試錯誤登入
    await testLogin(page, 'wrong@example.com', 'wrongpassword', false);
    
    // 測試註冊
    await testRegistration(page, accounts.newUser.email, accounts.newUser.password);
    
    console.log('\n=== 第二部分：課程管理測試 ===\n');
    
    const teacherEmail = teacher1Success ? accounts.teacher.email : accounts.teacher2.email;
    const teacherPassword = teacher1Success ? accounts.teacher.password : accounts.teacher2.password;
    
    const courseInfo = await testCourseManagement(page, teacherEmail, teacherPassword);
    
    if (courseInfo) {
      await testAddStudentsToCourse(page, courseInfo.courseId);
      
      console.log('\n=== 第三部分：作業系統測試 ===\n');
      
      const assignmentInfo = await testAssignmentCreation(
        page, 
        courseInfo.courseId,
        student1Success ? accounts.student1.email : accounts.student2.email
      );
      
      if (assignmentInfo) {
        console.log('\n=== 第四部分：N+1 查詢優化測試 ===\n');
        
        const studentEmail = student1Success ? accounts.student1.email : accounts.student2.email;
        const studentPassword = student1Success ? accounts.student1.password : accounts.student2.password;
        
        await testN1Query(page, courseInfo.courseId, studentEmail, studentPassword);
        
        console.log('\n=== 第五部分：檔案上傳測試 ===\n');
        
        await testFileUpload(page, courseInfo.courseId, assignmentInfo.assignmentId, studentEmail, studentPassword);
        
        console.log('\n=== 第六部分：版本管理測試 ===\n');
        
        await testVersionControl(page, courseInfo.courseId, assignmentInfo.assignmentId);
        
        console.log('\n=== 第七部分：批改流程測試 ===\n');
        
        await testGrading(page, courseInfo.courseId, assignmentInfo.assignmentId, teacherEmail, teacherPassword);
        
        console.log('\n=== 第八部分：填空題作業測試 ===\n');
        
        await testFillInBlankAssignment(page, courseInfo.courseId, teacherEmail, teacherPassword);
      }
    }
    
    console.log('\n=== 生成測試報告 ===\n');
    await generateReport();
    
    console.log('\n✅ 所有測試完成！');
    console.log(`\n📊 測試統計:`);
    console.log(`   總測試數: ${testCount}`);
    console.log(`   通過: ${passCount}`);
    console.log(`   失敗: ${failCount}`);
    console.log(`   通過率: ${((passCount / testCount) * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error('❌ 測試執行錯誤:', error);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

main();
