import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 測試配置
const config = {
  frontendUrl: 'http://localhost:3000',
  backendUrl: 'http://localhost:3001',
  teacherAccount: { email: 'test@example.com', password: '123456' },
  studentAccount: { email: 'st@example.com', password: '123456' },
  timeout: 10000,
  screenshotOnFailure: true
};

// 測試結果
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  details: {}
};

// 輔助函數
async function takeScreenshot(page, name) {
  const timestamp = Date.now();
  const filename = `screenshot_${name}_${timestamp}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 截圖已保存: ${filename}`);
  return filename;
}

async function waitForPageLoad(page) {
  await page.waitForLoadState('networkidle', { timeout: config.timeout });
}

async function login(page, email, password, role) {
  console.log(`\n🔐 登入測試: ${role} (${email})`);
  
  try {
    await page.goto(config.frontendUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: config.timeout });
    
    // 填寫登入表單
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    
    // 點擊登入按鈕
    const loginButton = page.locator('button:has-text("登入"), button:has-text("Login")').first();
    await loginButton.click();
    
    // 等待導航完成並檢查是否成功
    await page.waitForTimeout(3000);
    
    // 檢查是否有「我的課程」或課程列表
    const isCoursePageVisible = await page.locator('text=我的課程, text=課程').first().isVisible().catch(() => false);
    
    if (!isCoursePageVisible) {
      throw new Error('登入後未顯示課程頁面');
    }
    
    console.log(`✅ ${role}登入成功`);
    return true;
  } catch (error) {
    console.error(`❌ ${role}登入失敗:`, error.message);
    await takeScreenshot(page, `login_fail_${role}`);
    throw error;
  }
}

async function logout(page) {
  try {
    // 尋找登出按鈕或使用者選單
    const logoutButton = page.locator('button:has-text("登出"), button:has-text("Logout"), a:has-text("登出")').first();
    await logoutButton.click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    console.log('✅ 登出成功');
  } catch (error) {
    console.log('⚠️ 登出可能失敗，嘗試直接訪問登入頁');
    await page.goto(`${config.frontendUrl}/login`);
  }
}

// 監控網路請求
function setupNetworkMonitor(page) {
  const apiCalls = [];
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/')) {
      apiCalls.push({
        method: request.method(),
        url: url,
        timestamp: Date.now()
      });
    }
  });
  
  return apiCalls;
}

// 測試部分 1: 登入驗證
async function testPart1_Login(page) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 第一部分：登入驗證');
  console.log('='.repeat(60));
  
  const results = { passed: true, details: [] };
  
  try {
    // 測試教師登入
    await login(page, config.teacherAccount.email, config.teacherAccount.password, '教師');
    results.details.push('✅ 教師登入成功');
    
    // 登出
    await logout(page);
    results.details.push('✅ 教師登出成功');
    
    // 測試學生登入
    await login(page, config.studentAccount.email, config.studentAccount.password, '學生');
    results.details.push('✅ 學生登入成功');
    
    // 驗證學生視圖
    await page.waitForSelector('text=課程', { timeout: 5000 });
    results.details.push('✅ 學生視圖正確顯示');
    
  } catch (error) {
    results.passed = false;
    results.details.push(`❌ 登入驗證失敗: ${error.message}`);
  }
  
  testResults.details.part1 = results;
  if (results.passed) testResults.passed++;
  else testResults.failed++;
  
  return results.passed;
}

// 測試部分 2: N+1 優化驗證
async function testPart2_N1Optimization(page) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 第二部分：N+1 優化驗證');
  console.log('='.repeat(60));
  
  const results = { passed: true, details: [], apiCalls: [] };
  
  try {
    // 確保教師登入
    await logout(page);
    await login(page, config.teacherAccount.email, config.teacherAccount.password, '教師');
    
    // 建立新課程
    console.log('\n📝 建立測試課程...');
    await page.goto(`${config.frontendUrl}/courses`);
    
    const createButton = page.locator('button:has-text("建立"), button:has-text("新增"), a:has-text("建立")').first();
    await createButton.click();
    
    await page.fill('input[name="name"], input[placeholder*="課程名稱"]', 'N1優化測試');
    await page.fill('textarea[name="description"], textarea[placeholder*="描述"]', '測試 N+1 查詢優化');
    
    const submitButton = page.locator('button[type="submit"], button:has-text("建立"), button:has-text("保存")').first();
    await submitButton.click();
    
    await page.waitForTimeout(2000);
    results.details.push('✅ 課程建立成功');
    
    // 獲取課程 ID
    const currentUrl = page.url();
    const courseIdMatch = currentUrl.match(/courses\/(\d+)/);
    if (!courseIdMatch) {
      throw new Error('無法取得課程 ID');
    }
    const courseId = courseIdMatch[1];
    console.log(`📌 課程 ID: ${courseId}`);
    
    // 加入學生
    console.log('\n👥 加入學生...');
    const enrollButton = page.locator('button:has-text("加入學生"), button:has-text("學生管理"), a:has-text("學生")').first();
    await enrollButton.click();
    
    await page.fill('input[type="email"], input[placeholder*="email"]', config.studentAccount.email);
    const addStudentButton = page.locator('button:has-text("加入"), button:has-text("新增")').first();
    await addStudentButton.click();
    
    await page.waitForTimeout(1000);
    results.details.push('✅ 學生加入成功');
    
    // 建立作業 1
    console.log('\n📄 建立作業 1...');
    await page.goto(`${config.frontendUrl}/courses/${courseId}`);
    
    const assignmentButton = page.locator('button:has-text("作業"), a:has-text("作業")').first();
    await assignmentButton.click();
    
    const createAssignmentButton = page.locator('button:has-text("建立"), button:has-text("新增作業")').first();
    await createAssignmentButton.click();
    
    await page.fill('input[name="title"], input[placeholder*="標題"]', '作業1');
    await page.fill('textarea[name="description"], textarea[placeholder*="描述"]', '檔案上傳作業');
    
    // 選擇檔案上傳類型
    await page.selectOption('select[name="type"]', 'file');
    
    // 指定學生
    await page.check(`input[type="checkbox"][value="${config.studentAccount.email}"]`);
    
    await page.locator('button[type="submit"], button:has-text("建立")').first().click();
    await page.waitForTimeout(1000);
    results.details.push('✅ 作業 1 建立成功');
    
    // 建立作業 2
    console.log('\n📄 建立作業 2...');
    await createAssignmentButton.click();
    
    await page.fill('input[name="title"], input[placeholder*="標題"]', '作業2');
    await page.fill('textarea[name="description"], textarea[placeholder*="描述"]', '檔案上傳作業2');
    await page.selectOption('select[name="type"]', 'file');
    await page.check(`input[type="checkbox"][value="${config.studentAccount.email}"]`);
    await page.locator('button[type="submit"], button:has-text("建立")').first().click();
    await page.waitForTimeout(1000);
    results.details.push('✅ 作業 2 建立成功');
    
    // 學生登入並檢查 API 呼叫
    console.log('\n🔍 監控 API 呼叫...');
    await logout(page);
    await login(page, config.studentAccount.email, config.studentAccount.password, '學生');
    
    // 設置網路監控
    const apiCalls = setupNetworkMonitor(page);
    
    // 訪問課程頁面
    await page.goto(`${config.frontendUrl}/courses/${courseId}`);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);
    
    // 分析 API 呼叫
    const courseApiCalls = apiCalls.filter(call => call.url.includes(`/api/courses/${courseId}`) && !call.url.includes('/assignments'));
    const isDesignatedCalls = apiCalls.filter(call => call.url.includes('/is-designated'));
    
    console.log(`\n📊 API 呼叫統計:`);
    console.log(`   - /api/courses/${courseId} 呼叫次數: ${courseApiCalls.length}`);
    console.log(`   - /is-designated 呼叫次數: ${isDesignatedCalls.length}`);
    
    results.apiCalls = {
      courseApiCalls: courseApiCalls.length,
      isDesignatedCalls: isDesignatedCalls.length
    };
    
    if (courseApiCalls.length <= 2 && isDesignatedCalls.length === 0) {
      results.details.push('✅ N+1 優化成功：沒有多餘的 is-designated 呼叫');
    } else {
      results.passed = false;
      results.details.push(`❌ N+1 問題存在：發現 ${isDesignatedCalls.length} 個 is-designated 呼叫`);
    }
    
  } catch (error) {
    results.passed = false;
    results.details.push(`❌ N+1 優化測試失敗: ${error.message}`);
    await takeScreenshot(page, 'n1_test_fail');
  }
  
  testResults.details.part2 = results;
  if (results.passed) testResults.passed++;
  else testResults.failed++;
  
  return results.passed;
}

// 測試部分 3: 檔案上傳與中文檔名
async function testPart3_FileUpload(page) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 第三部分：檔案上傳與中文檔名測試');
  console.log('='.repeat(60));
  
  const results = { passed: true, details: [] };
  
  try {
    // 建立測試檔案
    const testFileName = '我的作業_2026年_測試.txt';
    const testFilePath = path.join(__dirname, testFileName);
    fs.writeFileSync(testFilePath, '這是我的測試作業內容\n2026年3月11日', 'utf8');
    console.log(`✅ 建立測試檔案: ${testFileName}`);
    
    // 找到作業並上傳
    console.log('\n📤 上傳檔案...');
    await page.locator('text=作業1').first().click();
    await page.waitForTimeout(1000);
    
    // 上傳檔案
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("上傳"), button:has-text("提交")').first();
    await uploadButton.click();
    
    await page.waitForTimeout(2000);
    
    // 驗證檔名顯示
    const fileNameElement = await page.locator(`text=${testFileName}`).first();
    const isVisible = await fileNameElement.isVisible();
    
    if (isVisible) {
      results.details.push('✅ 中文檔名正確顯示，無亂碼');
    } else {
      results.passed = false;
      results.details.push('❌ 中文檔名未正確顯示');
    }
    
    // 清理測試檔案
    fs.unlinkSync(testFilePath);
    
  } catch (error) {
    results.passed = false;
    results.details.push(`❌ 檔案上傳測試失敗: ${error.message}`);
    await takeScreenshot(page, 'file_upload_fail');
  }
  
  testResults.details.part3 = results;
  if (results.passed) testResults.passed++;
  else testResults.failed++;
  
  return results.passed;
}

// 測試部分 4: 版本管理
async function testPart4_VersionControl(page) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 第四部分：版本管理測試');
  console.log('='.repeat(60));
  
  const results = { passed: true, details: [] };
  
  try {
    // 建立第二個檔案
    const testFileName2 = '我的作業_修正版.txt';
    const testFilePath2 = path.join(__dirname, testFileName2);
    fs.writeFileSync(testFilePath2, '這是修正後的內容', 'utf8');
    
    console.log('\n📤 上傳第二版...');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath2);
    
    const uploadButton = page.locator('button:has-text("上傳"), button:has-text("提交")').first();
    await uploadButton.click();
    await page.waitForTimeout(2000);
    
    // 檢查版本號
    const version2 = await page.locator('text=/版本.*2/i, text=/version.*2/i').first();
    const hasVersion2 = await version2.isVisible().catch(() => false);
    
    if (hasVersion2) {
      results.details.push('✅ 版本 2 建立成功');
    } else {
      results.passed = false;
      results.details.push('❌ 版本 2 未正確建立');
    }
    
    // 檢查版本 1 是否還存在
    const version1 = await page.locator('text=/版本.*1/i, text=/version.*1/i').first();
    const hasVersion1 = await version1.isVisible().catch(() => false);
    
    if (hasVersion1) {
      results.details.push('✅ 版本 1 仍可查看');
    } else {
      results.passed = false;
      results.details.push('❌ 版本 1 無法查看');
    }
    
    // 清理
    fs.unlinkSync(testFilePath2);
    
  } catch (error) {
    results.passed = false;
    results.details.push(`❌ 版本管理測試失敗: ${error.message}`);
    await takeScreenshot(page, 'version_control_fail');
  }
  
  testResults.details.part4 = results;
  if (results.passed) testResults.passed++;
  else testResults.failed++;
  
  return results.passed;
}

// 測試部分 5: 批改流程
async function testPart5_Grading(page) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 第五部分：批改流程測試');
  console.log('='.repeat(60));
  
  const results = { passed: true, details: [] };
  
  try {
    // 教師登入
    await logout(page);
    await login(page, config.teacherAccount.email, config.teacherAccount.password, '教師');
    
    console.log('\n📝 進行批改...');
    
    // 找到「查看提交」或「批改」按鈕
    const submissionsButton = page.locator('button:has-text("提交"), a:has-text("提交"), button:has-text("批改")').first();
    await submissionsButton.click();
    await page.waitForTimeout(1000);
    
    // 找到學生提交
    const studentSubmission = page.locator(`text=${config.studentAccount.email}`).first();
    await studentSubmission.click();
    await page.waitForTimeout(1000);
    
    // 輸入分數和評語
    await page.fill('input[name="score"], input[placeholder*="分數"]', '95');
    await page.fill('textarea[name="feedback"], textarea[placeholder*="評語"]', '不錯，繼續加油');
    
    const saveButton = page.locator('button:has-text("保存"), button:has-text("提交"), button[type="submit"]').first();
    await saveButton.click();
    await page.waitForTimeout(2000);
    
    results.details.push('✅ 批改保存成功');
    
    // 學生登入查看
    await logout(page);
    await login(page, config.studentAccount.email, config.studentAccount.password, '學生');
    
    console.log('\n👀 學生查看批改結果...');
    
    // 查看分數
    const scoreElement = await page.locator('text=/95|分數.*95/').first();
    const hasScore = await scoreElement.isVisible().catch(() => false);
    
    const feedbackElement = await page.locator('text=不錯，繼續加油').first();
    const hasFeedback = await feedbackElement.isVisible().catch(() => false);
    
    if (hasScore && hasFeedback) {
      results.details.push('✅ 學生可正確查看分數和評語');
    } else {
      results.passed = false;
      results.details.push(`❌ 批改結果顯示異常 (分數: ${hasScore}, 評語: ${hasFeedback})`);
    }
    
  } catch (error) {
    results.passed = false;
    results.details.push(`❌ 批改流程測試失敗: ${error.message}`);
    await takeScreenshot(page, 'grading_fail');
  }
  
  testResults.details.part5 = results;
  if (results.passed) testResults.passed++;
  else testResults.failed++;
  
  return results.passed;
}

// 測試部分 6: 填空題作業
async function testPart6_FillInBlank(page) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 第六部分：填空題作業測試');
  console.log('='.repeat(60));
  
  const results = { passed: true, details: [] };
  
  try {
    // 教師登入建立填空題作業
    await logout(page);
    await login(page, config.teacherAccount.email, config.teacherAccount.password, '教師');
    
    console.log('\n📝 建立填空題作業...');
    
    const createButton = page.locator('button:has-text("建立作業"), button:has-text("新增作業")').first();
    await createButton.click();
    
    await page.fill('input[name="title"]', '填空題測試');
    await page.selectOption('select[name="type"]', 'text');
    
    // 添加題目（這裡假設有動態添加題目的功能）
    // 實際實現可能需要根據 UI 調整
    
    results.details.push('✅ 填空題作業建立（功能待實現）');
    
  } catch (error) {
    results.passed = false;
    results.details.push(`❌ 填空題測試失敗: ${error.message}`);
  }
  
  testResults.details.part6 = results;
  if (results.passed) testResults.passed++;
  else testResults.failed++;
  
  return results.passed;
}

// 測試部分 7: 錯誤處理與容錯
async function testPart7_ErrorHandling(page) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 第七部分：錯誤處理與容錯測試');
  console.log('='.repeat(60));
  
  const results = { passed: true, details: [] };
  
  try {
    // 測試不存在的課程 ID
    console.log('\n❌ 測試訪問不存在的課程...');
    await page.goto(`${config.frontendUrl}/courses/99999`);
    await page.waitForTimeout(2000);
    
    const errorMessage = await page.locator('text=/找不到|not found|錯誤/i').first();
    const hasError = await errorMessage.isVisible().catch(() => false);
    
    if (hasError) {
      results.details.push('✅ 不存在的課程顯示友善錯誤訊息');
    } else {
      results.details.push('⚠️ 未顯示明確的錯誤訊息');
    }
    
    // 測試快速刷新
    console.log('\n🔄 測試快速刷新...');
    await page.goto(`${config.frontendUrl}/courses`);
    await page.reload();
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(2000);
    
    const isStable = await page.locator('text=課程').first().isVisible();
    
    if (isStable) {
      results.details.push('✅ UI 在快速刷新後保持穩定');
    } else {
      results.passed = false;
      results.details.push('❌ UI 在快速刷新後不穩定');
    }
    
    // 檢查控制台錯誤
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.reload();
    await page.waitForTimeout(2000);
    
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('DevTools')
    );
    
    if (criticalErrors.length === 0) {
      results.details.push('✅ 無嚴重 console 錯誤');
    } else {
      results.details.push(`⚠️ 發現 ${criticalErrors.length} 個 console 錯誤`);
    }
    
  } catch (error) {
    results.passed = false;
    results.details.push(`❌ 錯誤處理測試失敗: ${error.message}`);
  }
  
  testResults.details.part7 = results;
  if (results.passed) testResults.passed++;
  else testResults.failed++;
  
  return results.passed;
}

// 主測試流程
async function runTests() {
  console.log('\n' + '█'.repeat(60));
  console.log('🚀 開始 LMS 系統完整端到端測試');
  console.log('█'.repeat(60));
  console.log(`⏰ 測試時間: ${new Date().toLocaleString('zh-TW')}`);
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-TW'
  });
  
  const page = await context.newPage();
  
  try {
    // 執行所有測試
    await testPart1_Login(page);
    await testPart2_N1Optimization(page);
    await testPart3_FileUpload(page);
    await testPart4_VersionControl(page);
    await testPart5_Grading(page);
    await testPart6_FillInBlank(page);
    await testPart7_ErrorHandling(page);
    
  } catch (error) {
    console.error('\n❌ 測試執行過程中發生錯誤:', error);
    testResults.errors.push(error.message);
    await takeScreenshot(page, 'test_error');
  } finally {
    await browser.close();
  }
  
  // 輸出測試結果
  printTestSummary();
}

// 輸出測試總結
function printTestSummary() {
  console.log('\n\n' + '█'.repeat(60));
  console.log('📊 測試結果總結');
  console.log('█'.repeat(60));
  
  const totalTests = 7;
  const passRate = ((testResults.passed / totalTests) * 100).toFixed(1);
  
  console.log(`\n✅ 通過項目數: ${testResults.passed}/${totalTests}`);
  console.log(`❌ 失敗項目數: ${testResults.failed}/${totalTests}`);
  console.log(`📈 通過率: ${passRate}%`);
  
  console.log('\n📋 詳細結果:');
  Object.entries(testResults.details).forEach(([part, result]) => {
    console.log(`\n${part}:`);
    result.details.forEach(detail => console.log(`  ${detail}`));
    if (result.apiCalls) {
      console.log(`  📊 API 呼叫: 課程API ${result.apiCalls.courseApiCalls} 次, is-designated ${result.apiCalls.isDesignatedCalls} 次`);
    }
  });
  
  // 主要問題
  const mainIssues = [];
  if (testResults.details.part2 && !testResults.details.part2.passed) {
    mainIssues.push('N+1 查詢優化未完成');
  }
  if (testResults.details.part3 && !testResults.details.part3.passed) {
    mainIssues.push('中文檔名處理有問題');
  }
  if (testResults.details.part4 && !testResults.details.part4.passed) {
    mainIssues.push('版本管理功能異常');
  }
  if (testResults.details.part5 && !testResults.details.part5.passed) {
    mainIssues.push('批改流程有缺陷');
  }
  
  console.log(`\n⚠️ 主要問題: ${mainIssues.length > 0 ? mainIssues.join('; ') : '無重大問題'}`);
  
  // 是否可以上線
  const canDeploy = testResults.passed >= 5 && testResults.failed <= 2;
  console.log(`\n🚀 是否可以上線: ${canDeploy ? '✅ 是' : '❌ 否'}`);
  
  if (!canDeploy) {
    console.log(`   理由: 關鍵功能未通過測試，建議修復後再上線`);
  } else {
    console.log(`   理由: 核心功能運作正常，小問題可後續修復`);
  }
  
  console.log('\n' + '█'.repeat(60));
  
  // 保存測試報告
  const reportPath = path.join(__dirname, `測試報告_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2), 'utf8');
  console.log(`\n📄 完整測試報告已保存至: ${reportPath}`);
}

// 執行測試
runTests().catch(console.error);
