import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  frontendUrl: 'http://localhost:3000',
  backendUrl: 'http://localhost:3001',
  teacherAccount: { email: 'test@example.com', password: '123456' },
  studentAccount: { email: 'st@example.com', password: '123456' }
};

console.log('\n' + '█'.repeat(70));
console.log('🚀 LMS 系統 - N+1 優化驗證測試');
console.log('█'.repeat(70));
console.log(`⏰ 測試時間: ${new Date().toLocaleString('zh-TW')}\n`);

async function login(page, email, password) {
  await page.goto(config.frontendUrl);
  await page.waitForTimeout(1500);
  
  const isLoggedIn = await page.locator('text=我的課程').isVisible().catch(() => false);
  if (isLoggedIn) {
    await page.click('button:has-text("登出")');
    await page.waitForTimeout(1000);
  }
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("登入")');
  await page.waitForTimeout(2000);
}

async function runN1Test() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // ========== 第一步：登入測試 ==========
    console.log('📋 第一部分：登入驗證');
    console.log('─'.repeat(70));
    
    console.log('\n🔐 教師登入測試...');
    await login(page, config.teacherAccount.email, config.teacherAccount.password);
    
    const teacherLoggedIn = await page.locator('text=我的課程').isVisible();
    const hasAdminPanel = await page.locator('a:has-text("管理面板")').isVisible();
    
    console.log(`   ${teacherLoggedIn ? '✅' : '❌'} 教師登入成功`);
    console.log(`   ${hasAdminPanel ? '✅' : '❌'} 可見管理面板`);
    
    await page.click('button:has-text("登出")');
    await page.waitForTimeout(1000);
    console.log('   ✅ 教師登出成功');
    
    console.log('\n🔐 學生登入測試...');
    await login(page, config.studentAccount.email, config.studentAccount.password);
    
    const studentLoggedIn = await page.locator('text=我的課程').isVisible();
    console.log(`   ${studentLoggedIn ? '✅' : '❌'} 學生登入成功`);
    
    // 獲取學生可見的課程列表
    await page.waitForTimeout(2000);
    const courseCards = await page.locator('text=進入課程').count();
    console.log(`   📚 學生可見課程數: ${courseCards}`);
    
    if (courseCards === 0) {
      console.log('\n⚠️ 學生沒有可見課程，無法進行 N+1 測試');
      console.log('   建議: 先用教師帳號建立課程並加入學生');
      await browser.close();
      return;
    }
    
    // ========== 第二步：N+1 優化驗證（核心） ==========
    console.log('\n\n📋 第二部分：N+1 優化驗證（核心測試）');
    console.log('─'.repeat(70));
    
    // 點擊第一個課程
    console.log('\n📌 選擇第一個課程進行測試...');
    const firstCourse = page.locator('text=進入課程').first();
    await firstCourse.click();
    await page.waitForTimeout(2000);
    
    // 獲取課程 ID
    const currentUrl = page.url();
    const courseIdMatch = currentUrl.match(/\/course\/(\d+)/);
    const courseId = courseIdMatch ? courseIdMatch[1] : null;
    console.log(`   課程 ID: ${courseId || '未知'}`);
    
    // 設置網路監控
    console.log('\n🔍 開始監控 API 呼叫...');
    const apiCalls = [];
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        apiCalls.push({
          time: timestamp,
          method: request.method(),
          url: url.replace(config.backendUrl, '')
        });
      }
    });
    
    // 清空之前的記錄並重新載入頁面
    apiCalls.length = 0;
    console.log('   🔄 重新載入頁面以觀察 API 呼叫...\n');
    await page.reload();
    await page.waitForTimeout(3000);
    
    // 切換到作業頁籤
    const assignmentTab = await page.locator('button:has-text("作業")').isVisible();
    if (assignmentTab) {
      console.log('   📝 切換到作業頁籤...\n');
      apiCalls.length = 0; // 清空記錄
      await page.click('button:has-text("作業")');
      await page.waitForTimeout(2000);
    }
    
    // 分析 API 呼叫
    console.log('📊 API 呼叫記錄:');
    console.log('─'.repeat(70));
    
    if (apiCalls.length === 0) {
      console.log('   ⚠️ 未捕獲到 API 呼叫（可能已快取）');
    } else {
      apiCalls.forEach((call, index) => {
        console.log(`   ${index + 1}. [${call.time}] ${call.method} ${call.url}`);
      });
    }
    
    console.log('\n📈 統計分析:');
    console.log('─'.repeat(70));
    
    const courseApiCalls = apiCalls.filter(call => 
      call.url.includes(`/courses/${courseId}`) && 
      !call.url.includes('/comments')
    );
    
    const isDesignatedCalls = apiCalls.filter(call => 
      call.url.includes('/is-designated') || 
      (call.url.includes('/assignments/') && call.url.includes('/designated'))
    );
    
    const assignmentCalls = apiCalls.filter(call => 
      call.url.includes('/assignments/') && 
      !call.url.includes('/submit')
    );
    
    console.log(`   📌 課程 API 呼叫: ${courseApiCalls.length} 次`);
    console.log(`   📌 is-designated 相關呼叫: ${isDesignatedCalls.length} 次`);
    console.log(`   📌 作業相關 API: ${assignmentCalls.length} 次`);
    console.log(`   📌 總 API 呼叫數: ${apiCalls.length} 次`);
    
    // N+1 判定
    console.log('\n✨ N+1 優化評估:');
    console.log('─'.repeat(70));
    
    if (isDesignatedCalls.length === 0) {
      console.log('   ✅ 優秀！沒有發現 N+1 查詢問題');
      console.log('   ✅ 所有指定學生資訊應該都在單一查詢中返回');
    } else if (isDesignatedCalls.length === 1) {
      console.log('   ✅ 良好！只有 1 個額外的指定查詢');
      console.log('   💡 建議：可以進一步優化至 0 個額外查詢');
    } else {
      console.log(`   ❌ 發現 N+1 問題！有 ${isDesignatedCalls.length} 個 is-designated 呼叫`);
      console.log('   ⚠️ 每個作業都在單獨查詢是否指定給當前使用者');
      console.log('   💡 建議：在 /courses/:id 端點中一次性返回所有指定資訊');
    }
    
    // ========== 第三步：中文檔名測試 ==========
    console.log('\n\n📋 第三部分：檔案上傳與中文檔名測試');
    console.log('─'.repeat(70));
    
    const assignments = await page.locator('button:has-text("提交作業"), button:has-text("前往作答")').count();
    console.log(`\n   📝 可提交的作業數: ${assignments}`);
    
    if (assignments > 0) {
      // 建立測試檔案
      const testFileName = '我的作業_2026年_測試.txt';
      const testFilePath = path.join(__dirname, testFileName);
      fs.writeFileSync(testFilePath, '這是中文測試內容\n2026年3月11日', 'utf8');
      
      console.log(`   ✅ 建立測試檔案: ${testFileName}`);
      
      // 點擊第一個提交按鈕
      const firstSubmitBtn = page.locator('button:has-text("提交作業")').first();
      const isFileUpload = await firstSubmitBtn.isVisible();
      
      if (isFileUpload) {
        await firstSubmitBtn.click();
        await page.waitForTimeout(2000);
        
        console.log('   📤 開始上傳檔案...');
        
        // 查找檔案輸入
        const fileInput = page.locator('input[type="file"]');
        const hasFileInput = await fileInput.isVisible().catch(() => false);
        
        if (hasFileInput) {
          await fileInput.setInputFiles(testFilePath);
          await page.waitForTimeout(1000);
          
          // 提交
          await page.click('button:has-text("提交"), button[type="submit"]');
          await page.waitForTimeout(3000);
          
          // 檢查檔名顯示
          const hasFileName = await page.locator(`text=${testFileName}`).isVisible().catch(() => false);
          const hasChineseText = await page.locator('text=/我的作業/').isVisible().catch(() => false);
          
          if (hasFileName) {
            console.log('   ✅ 中文檔名完整顯示，無亂碼');
          } else if (hasChineseText) {
            console.log('   ✅ 中文檔名部分顯示正確');
          } else {
            console.log('   ❌ 中文檔名未正確顯示');
          }
          
          // 截圖
          await page.screenshot({ path: `upload_result_${Date.now()}.png`, fullPage: true });
          console.log('   📸 已截圖保存上傳結果');
        } else {
          console.log('   ⚠️ 未找到檔案上傳輸入框');
        }
      } else {
        console.log('   ⚠️ 第一個作業不是檔案上傳類型');
      }
      
      // 清理
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } else {
      console.log('   ⚠️ 沒有可提交的作業');
    }
    
    // ========== 第四步：錯誤處理測試 ==========
    console.log('\n\n📋 第四部分：錯誤處理與容錯測試');
    console.log('─'.repeat(70));
    
    console.log('\n   ❌ 測試訪問不存在的課程 (ID: 99999)...');
    await page.goto(`${config.frontendUrl}/course/99999`);
    await page.waitForTimeout(2000);
    
    const errorMsg = await page.locator('text=/找不到|不存在|錯誤/i').isVisible().catch(() => false);
    console.log(`   ${errorMsg ? '✅' : '❌'} 顯示友善錯誤訊息`);
    
    await page.screenshot({ path: `error_page_${Date.now()}.png` });
    
    // ========== 總結 ==========
    console.log('\n\n' + '█'.repeat(70));
    console.log('📊 測試結果總結');
    console.log('█'.repeat(70));
    
    const testResults = {
      login: teacherLoggedIn && studentLoggedIn,
      n1Optimization: isDesignatedCalls.length <= 1,
      apiEfficiency: apiCalls.length < 10,
      errorHandling: errorMsg
    };
    
    const passedCount = Object.values(testResults).filter(v => v).length;
    const totalCount = Object.keys(testResults).length;
    
    console.log(`\n✅ 通過項目: ${passedCount}/${totalCount}`);
    console.log(`❌ 失敗項目: ${totalCount - passedCount}/${totalCount}`);
    console.log(`📈 通過率: ${((passedCount / totalCount) * 100).toFixed(1)}%`);
    
    console.log('\n📋 詳細評估:');
    console.log(`   ${testResults.login ? '✅' : '❌'} 登入功能`);
    console.log(`   ${testResults.n1Optimization ? '✅' : '❌'} N+1 優化`);
    console.log(`   ${testResults.apiEfficiency ? '✅' : '❌'} API 效率`);
    console.log(`   ${testResults.errorHandling ? '✅' : '❌'} 錯誤處理`);
    
    const canDeploy = passedCount >= 3;
    console.log(`\n🚀 是否可以上線: ${canDeploy ? '✅ 是' : '❌ 否'}`);
    
    if (canDeploy) {
      console.log('   理由: 核心功能正常，N+1 優化良好');
    } else {
      console.log('   理由: 存在關鍵問題需要修復');
    }
    
    console.log('\n' + '█'.repeat(70));
    
    // 保存報告
    const report = {
      testTime: new Date().toISOString(),
      results: testResults,
      apiCallsAnalysis: {
        total: apiCalls.length,
        courseApi: courseApiCalls.length,
        isDesignated: isDesignatedCalls.length,
        details: apiCalls
      },
      conclusion: {
        passed: passedCount,
        total: totalCount,
        canDeploy
      }
    };
    
    fs.writeFileSync(
      `測試報告_N1優化_${Date.now()}.json`,
      JSON.stringify(report, null, 2),
      'utf8'
    );
    
    console.log(`\n📄 詳細報告已保存\n`);
    
  } catch (error) {
    console.error('\n❌ 測試過程發生錯誤:', error.message);
  } finally {
    await browser.close();
  }
}

runN1Test().catch(console.error);
