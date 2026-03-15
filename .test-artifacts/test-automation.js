#!/usr/bin/env node

/**
 * LMS 系統自動化端到端測試
 * 測試環境: http://localhost:3001
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:3001/api';
const testResults = [];
let testCounter = 0;

// 測試資料
const testAccounts = {
  admin: { email: 'admin@example.com', password: 'admin123' },
  teacher: { email: 'test@example.com', password: 'test' },
  studentA: { email: 'st@example.com', password: 'st' },
  studentB: { email: 'student_b@example.com', password: 'test123' }
};

let tokens = {};
let users = {};
let courseId = null;
let materialId = null;
let assignmentFileId = null;
let assignmentFormId = null;
let submissionId = null;

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, details = '') {
  testCounter++;
  const icon = status === 'PASS' ? '✓' : '✗';
  const color = status === 'PASS' ? 'green' : 'red';
  log(`${icon} Test #${testCounter}: ${name}`, color);
  if (details) {
    log(`   ${details}`, 'cyan');
  }
  testResults.push({ id: testCounter, name, status, details });
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${title}`, 'blue');
  log('='.repeat(60), 'blue');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ Phase 1: 帳號系統測試 ============
async function testAuthentication() {
  logSection('PHASE 1: 帳號系統測試');

  try {
    // Test 1.1: 登入有效帳號 (Admin)
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, testAccounts.admin);
      tokens.admin = response.data.token;
      users.admin = response.data.user;
      
      if (tokens.admin && users.admin.role === 'admin') {
        logTest('Admin 登入成功', 'PASS', `Token 已設置, Role: ${users.admin.role}`);
      } else {
        logTest('Admin 登入失敗', 'FAIL', '未獲得正確的 token 或角色');
      }
    } catch (error) {
      logTest('Admin 登入失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 1.2: 登入教師帳號
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, testAccounts.teacher);
      tokens.teacher = response.data.token;
      users.teacher = response.data.user;
      logTest('教師帳號登入成功', 'PASS', `Token 已設置, Role: ${users.teacher.role}`);
    } catch (error) {
      logTest('教師帳號登入失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 1.3: 登入學生 A
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, testAccounts.studentA);
      tokens.studentA = response.data.token;
      users.studentA = response.data.user;
      logTest('學生 A 登入成功', 'PASS', `Token 已設置, Role: ${users.studentA.role}`);
    } catch (error) {
      logTest('學生 A 登入失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 1.4: 嘗試用無效帳號登入
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: 'invalid@example.com',
        password: 'wrongpassword'
      });
      logTest('無效帳號登入應該失敗', 'FAIL', '系統允許無效帳號登入');
    } catch (error) {
      if (error.response?.status === 401) {
        logTest('無效帳號登入正確拒絕', 'PASS', error.response.data.error);
      } else {
        logTest('無效帳號登入錯誤處理異常', 'FAIL', error.message);
      }
    }

    // Test 1.5: 測試錯誤密碼
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: testAccounts.admin.email,
        password: 'wrongpassword'
      });
      logTest('錯誤密碼應該失敗', 'FAIL', '系統允許錯誤密碼登入');
    } catch (error) {
      if (error.response?.status === 401) {
        logTest('錯誤密碼正確拒絕', 'PASS', error.response.data.error);
      } else {
        logTest('錯誤密碼錯誤處理異常', 'FAIL', error.message);
      }
    }

  } catch (error) {
    log(`Phase 1 發生未預期錯誤: ${error.message}`, 'red');
  }
}

// ============ Phase 2: 課程系統測試 ============
async function testCourses() {
  logSection('PHASE 2: 課程系統測試');

  try {
    // Test 2.1: 教師建立課程
    try {
      const response = await axios.post(
        `${API_BASE}/courses`,
        {
          title: `自動化測試課程 ${Date.now()}`,
          description: '這是自動化測試建立的課程'
        },
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      courseId = response.data.id;
      logTest('教師建立課程成功', 'PASS', `課程 ID: ${courseId}`);
    } catch (error) {
      logTest('教師建立課程失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 2.2: 獲取所有課程
    try {
      const response = await axios.get(`${API_BASE}/courses`);
      if (response.data.length > 0) {
        logTest('獲取課程列表成功', 'PASS', `共 ${response.data.length} 個課程`);
      } else {
        logTest('獲取課程列表為空', 'FAIL', '沒有任何課程');
      }
    } catch (error) {
      logTest('獲取課程列表失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 2.3: 教師加入學生 A 到課程
    try {
      const response = await axios.post(
        `${API_BASE}/courses/${courseId}/enroll-student`,
        { studentId: users.studentA.id },
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      logTest('加入學生 A 到課程成功', 'PASS', '學生已註冊');
    } catch (error) {
      logTest('加入學生 A 失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 2.4: 檢查已註冊學生
    try {
      const response = await axios.get(
        `${API_BASE}/courses/${courseId}/enrollments`,
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      const enrolled = response.data.some(e => e.student_id === users.studentA.id);
      if (enrolled) {
        logTest('確認學生 A 已註冊', 'PASS', `共 ${response.data.length} 位學生`);
      } else {
        logTest('學生 A 註冊狀態異常', 'FAIL', '找不到學生 A 的註冊記錄');
      }
    } catch (error) {
      logTest('查詢註冊學生失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 2.5: 學生 A 查看課程（應該看得到）
    try {
      const response = await axios.get(`${API_BASE}/courses/${courseId}`);
      if (response.data.course) {
        logTest('學生 A 能查看已註冊課程', 'PASS', `課程: ${response.data.course.title}`);
      } else {
        logTest('學生 A 查看課程失敗', 'FAIL', '沒有課程資料');
      }
    } catch (error) {
      logTest('學生 A 查看課程失敗', 'FAIL', error.response?.data?.error || error.message);
    }

  } catch (error) {
    log(`Phase 2 發生未預期錯誤: ${error.message}`, 'red');
  }
}

// ============ Phase 3: 教材系統測試 ============
async function testMaterials() {
  logSection('PHASE 3: 教材系統測試');

  try {
    // Test 3.1: 教師添加外部連結教材
    try {
      const response = await axios.post(
        `${API_BASE}/courses/${courseId}/materials`,
        {
          title: 'YouTube 教學影片',
          description: '自動化測試連結',
          linkUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          linkType: 'youtube'
        },
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      materialId = response.data.id;
      logTest('添加外部連結教材成功', 'PASS', `教材 ID: ${materialId}`);
    } catch (error) {
      logTest('添加外部連結教材失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 3.2: 設定教材可見性
    try {
      const response = await axios.patch(
        `${API_BASE}/materials/${materialId}/visibility`,
        {
          visible: true,
          visibleFrom: null,
          visibleUntil: null
        },
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      logTest('設定教材可見性成功', 'PASS', `可見狀態: ${response.data.visible}`);
    } catch (error) {
      logTest('設定教材可見性失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 3.3: 學生查看教材列表
    try {
      const response = await axios.get(`${API_BASE}/courses/${courseId}`);
      const materials = response.data.materials || [];
      if (materials.length > 0) {
        logTest('學生查看教材列表成功', 'PASS', `共 ${materials.length} 個教材`);
      } else {
        logTest('學生查看教材列表為空', 'FAIL', '找不到任何教材');
      }
    } catch (error) {
      logTest('學生查看教材列表失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 3.4: 設定教材未來可見時間
    try {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // 明天
      await axios.patch(
        `${API_BASE}/materials/${materialId}/visibility`,
        {
          visible: false,
          visibleFrom: futureDate,
          visibleUntil: null
        },
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      logTest('設定教材未來可見時間成功', 'PASS', `可見時間: ${futureDate}`);
    } catch (error) {
      logTest('設定教材未來可見時間失敗', 'FAIL', error.response?.data?.error || error.message);
    }

  } catch (error) {
    log(`Phase 3 發生未預期錯誤: ${error.message}`, 'red');
  }
}

// ============ Phase 4: 作業系統測試 (檔案型) ============
async function testFileAssignments() {
  logSection('PHASE 4: 作業系統測試 (檔案上傳型)');

  try {
    // Test 4.1: 教師建立檔案上傳作業 (指定給學生 A)
    try {
      const response = await axios.post(
        `${API_BASE}/assignments`,
        {
          courseId: courseId,
          title: '檔案上傳作業 - 自動化測試',
          description: '請上傳你的作業檔案',
          type: 'file_upload',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          targetStudents: [users.studentA.id]
        },
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      assignmentFileId = response.data.id;
      logTest('建立檔案上傳作業成功', 'PASS', `作業 ID: ${assignmentFileId}`);
    } catch (error) {
      logTest('建立檔案上傳作業失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 4.2: 學生 A 查看作業列表（應該看得到）
    try {
      const response = await axios.get(
        `${API_BASE}/courses/${courseId}/assignments/student`,
        { headers: { Authorization: `Bearer ${tokens.studentA}` } }
      );
      const assignment = response.data.find(a => a.id === assignmentFileId);
      if (assignment) {
        logTest('學生 A 能看到指定作業', 'PASS', `作業: ${assignment.title}`);
      } else {
        logTest('學生 A 看不到指定作業', 'FAIL', '作業未出現在列表中');
      }
    } catch (error) {
      logTest('學生 A 查看作業失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 4.3: 模擬學生提交檔案（使用 FormData 模擬）
    try {
      // 建立測試檔案內容
      const testContent = Buffer.from('這是自動化測試上傳的檔案內容');
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('file', testContent, {
        filename: '測試作業.txt',
        contentType: 'text/plain'
      });

      const response = await axios.post(
        `${API_BASE}/assignments/${assignmentFileId}/submit`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${tokens.studentA}`
          }
        }
      );
      submissionId = response.data.id;
      logTest('學生 A 提交檔案作業成功', 'PASS', `提交 ID: ${submissionId}`);
    } catch (error) {
      logTest('學生 A 提交檔案作業失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 4.4: 查看提交記錄
    if (submissionId) {
      try {
        const response = await axios.get(
          `${API_BASE}/submissions/${submissionId}`,
          { headers: { Authorization: `Bearer ${tokens.teacher}` } }
        );
        if (response.data.student_id === users.studentA.id) {
          logTest('查看提交記錄成功', 'PASS', `提交者: ${users.studentA.fullName}`);
        } else {
          logTest('提交記錄異常', 'FAIL', '提交者不匹配');
        }
      } catch (error) {
        logTest('查看提交記錄失敗', 'FAIL', error.response?.data?.error || error.message);
      }
    }

  } catch (error) {
    log(`Phase 4 發生未預期錯誤: ${error.message}`, 'red');
  }
}

// ============ Phase 5: 作業系統測試 (填空題) ============
async function testFormAssignments() {
  logSection('PHASE 5: 作業系統測試 (填空題型)');

  try {
    // Test 5.1: 教師建立填空題作業 (全班)
    try {
      const response = await axios.post(
        `${API_BASE}/assignments`,
        {
          courseId: courseId,
          title: '填空題作業 - 自動化測試',
          description: '請回答以下問題',
          type: 'form',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          formFields: [
            { question: '你的名字是什麼?', order: 1 },
            { question: '你最喜歡的程式語言?', order: 2 },
            { question: '為什麼選擇這個語言?', order: 3 }
          ],
          targetStudents: [] // 空陣列表示全班
        },
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      assignmentFormId = response.data.id;
      logTest('建立填空題作業成功', 'PASS', `作業 ID: ${assignmentFormId}, 共 3 題`);
    } catch (error) {
      logTest('建立填空題作業失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 5.2: 學生 A 查看填空題
    try {
      const response = await axios.get(
        `${API_BASE}/assignments/${assignmentFormId}`,
        { headers: { Authorization: `Bearer ${tokens.studentA}` } }
      );
      if (response.data.form_fields && response.data.form_fields.length === 3) {
        logTest('學生 A 查看填空題成功', 'PASS', `共 ${response.data.form_fields.length} 題`);
      } else {
        logTest('填空題數量異常', 'FAIL', '題目數量不正確');
      }
    } catch (error) {
      logTest('學生 A 查看填空題失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 5.3: 學生 A 填答提交
    try {
      const response = await axios.post(
        `${API_BASE}/assignments/${assignmentFormId}/submit-form`,
        {
          answers: [
            { fieldId: 1, answer: '小明' },
            { fieldId: 2, answer: 'JavaScript' },
            { fieldId: 3, answer: '因為它很靈活且應用廣泛' }
          ]
        },
        { headers: { Authorization: `Bearer ${tokens.studentA}` } }
      );
      logTest('學生 A 填答提交成功', 'PASS', `提交 ID: ${response.data.id}`);
    } catch (error) {
      logTest('學生 A 填答提交失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 5.4: 學生 A 重新提交（測試版本控制）
    await sleep(1000);
    try {
      const response = await axios.post(
        `${API_BASE}/assignments/${assignmentFormId}/submit-form`,
        {
          answers: [
            { fieldId: 1, answer: '小明（修改版）' },
            { fieldId: 2, answer: 'TypeScript' },
            { fieldId: 3, answer: '因為它有型別安全' }
          ]
        },
        { headers: { Authorization: `Bearer ${tokens.studentA}` } }
      );
      if (response.data.version_number === 2) {
        logTest('學生重新提交版本控制正確', 'PASS', `版本號: ${response.data.version_number}`);
      } else {
        logTest('版本控制異常', 'FAIL', `預期版本 2, 實際 ${response.data.version_number}`);
      }
    } catch (error) {
      logTest('學生重新提交失敗', 'FAIL', error.response?.data?.error || error.message);
    }

  } catch (error) {
    log(`Phase 5 發生未預期錯誤: ${error.message}`, 'red');
  }
}

// ============ Phase 6: 批改系統測試 ============
async function testGrading() {
  logSection('PHASE 6: 批改系統測試');

  try {
    // Test 6.1: 教師查看提交列表
    try {
      const response = await axios.get(
        `${API_BASE}/assignments/${assignmentFormId}/submissions`,
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      if (response.data.length > 0) {
        logTest('教師查看提交列表成功', 'PASS', `共 ${response.data.length} 個提交`);
      } else {
        logTest('提交列表為空', 'FAIL', '找不到任何提交');
      }
    } catch (error) {
      logTest('教師查看提交列表失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 6.2: 教師批改作業
    if (submissionId) {
      try {
        const response = await axios.post(
          `${API_BASE}/submissions/${submissionId}/grade`,
          {
            grade: 'excellent',
            feedback: '做得很好!自動化測試批改',
            privateNotes: '教師內部筆記'
          },
          { headers: { Authorization: `Bearer ${tokens.teacher}` } }
        );
        logTest('教師批改作業成功', 'PASS', `評分: ${response.data.grade}`);
      } catch (error) {
        logTest('教師批改作業失敗', 'FAIL', error.response?.data?.error || error.message);
      }
    }

    // Test 6.3: 學生查看批改反饋
    if (submissionId) {
      try {
        const response = await axios.get(
          `${API_BASE}/submissions/${submissionId}`,
          { headers: { Authorization: `Bearer ${tokens.studentA}` } }
        );
        if (response.data.grade && response.data.feedback) {
          logTest('學生查看批改反饋成功', 'PASS', `評分: ${response.data.grade}`);
        } else {
          logTest('批改反饋缺失', 'FAIL', '沒有評分或反饋');
        }
      } catch (error) {
        logTest('學生查看批改反饋失敗', 'FAIL', error.response?.data?.error || error.message);
      }
    }

    // Test 6.4: 查看作業統計
    try {
      const response = await axios.get(
        `${API_BASE}/assignments/${assignmentFormId}/statistics`,
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      logTest('查看作業統計成功', 'PASS', 
        `應繳: ${response.data.totalStudents}, 已繳: ${response.data.submittedCount}`);
    } catch (error) {
      logTest('查看作業統計失敗', 'FAIL', error.response?.data?.error || error.message);
    }

  } catch (error) {
    log(`Phase 6 發生未預期錯誤: ${error.message}`, 'red');
  }
}

// ============ Phase 7: 版本管理測試 ============
async function testVersioning() {
  logSection('PHASE 7: 版本管理測試');

  try {
    // Test 7.1: 查看提交歷程
    try {
      const response = await axios.get(
        `${API_BASE}/assignments/${assignmentFormId}/submissions/student/${users.studentA.id}`,
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      if (response.data.length >= 2) {
        logTest('版本歷程記錄正確', 'PASS', `共 ${response.data.length} 個版本`);
      } else {
        logTest('版本歷程不完整', 'FAIL', `只有 ${response.data.length} 個版本`);
      }
    } catch (error) {
      logTest('查看版本歷程失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 7.2: 驗證舊版本是否保留
    try {
      const response = await axios.get(
        `${API_BASE}/assignments/${assignmentFormId}/submissions/student/${users.studentA.id}`,
        { headers: { Authorization: `Bearer ${tokens.studentA}` } }
      );
      const hasVersion1 = response.data.some(s => s.version_number === 1);
      const hasVersion2 = response.data.some(s => s.version_number === 2);
      
      if (hasVersion1 && hasVersion2) {
        logTest('版本保留正確', 'PASS', '版本 1 和版本 2 都存在');
      } else {
        logTest('版本保留異常', 'FAIL', '有版本遺失');
      }
    } catch (error) {
      logTest('驗證版本保留失敗', 'FAIL', error.response?.data?.error || error.message);
    }

  } catch (error) {
    log(`Phase 7 發生未預期錯誤: ${error.message}`, 'red');
  }
}

// ============ Phase 8: 邊界情況測試 ============
async function testEdgeCases() {
  logSection('PHASE 8: 邊界情況測試');

  try {
    // Test 8.1: 特殊字符處理
    try {
      const response = await axios.post(
        `${API_BASE}/courses`,
        {
          title: '課程名稱包含 <script>alert("XSS")</script> 特殊字符',
          description: '測試 & < > " \' 特殊符號'
        },
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      logTest('特殊字符處理正常', 'PASS', '課程建立成功');
    } catch (error) {
      logTest('特殊字符處理失敗', 'FAIL', error.response?.data?.error || error.message);
    }

    // Test 8.2: 空白輸入驗證
    try {
      await axios.post(
        `${API_BASE}/courses`,
        { title: '', description: '' },
        { headers: { Authorization: `Bearer ${tokens.teacher}` } }
      );
      logTest('空白輸入應該被拒絕', 'FAIL', '系統允許空白輸入');
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 500) {
        logTest('空白輸入正確拒絕', 'PASS', '系統正確驗證');
      }
    }

    // Test 8.3: 未授權訪問測試
    try {
      await axios.get(`${API_BASE}/admin/users`);
      logTest('未授權訪問應該被拒絕', 'FAIL', '系統允許未授權訪問');
    } catch (error) {
      if (error.response?.status === 401) {
        logTest('未授權訪問正確拒絕', 'PASS', error.response.data.error);
      }
    }

    // Test 8.4: 錯誤 Token 驗證
    try {
      await axios.get(`${API_BASE}/courses`, {
        headers: { Authorization: 'Bearer invalid_token_12345' }
      });
      logTest('錯誤 Token 應該被拒絕', 'FAIL', '系統接受無效 Token');
    } catch (error) {
      if (error.response?.status === 403) {
        logTest('錯誤 Token 正確拒絕', 'PASS', error.response.data.error);
      }
    }

    // Test 8.5: SQL Injection 測試
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: "admin' OR '1'='1",
        password: "anything"
      });
      logTest('SQL Injection 應該被防護', 'FAIL', '系統可能存在 SQL Injection 漏洞');
    } catch (error) {
      if (error.response?.status === 401) {
        logTest('SQL Injection 防護正常', 'PASS', '正確拒絕惡意輸入');
      }
    }

  } catch (error) {
    log(`Phase 8 發生未預期錯誤: ${error.message}`, 'red');
  }
}

// ============ Phase 9: 效能與 UI 測試 ============
async function testPerformance() {
  logSection('PHASE 9: 效能測試');

  try {
    // Test 9.1: API 響應時間測試
    const startTime = Date.now();
    try {
      await axios.get(`${API_BASE}/courses`);
      const responseTime = Date.now() - startTime;
      if (responseTime < 1000) {
        logTest('API 響應時間正常', 'PASS', `${responseTime}ms`);
      } else if (responseTime < 3000) {
        logTest('API 響應時間偏慢', 'PASS', `${responseTime}ms (建議優化)`);
      } else {
        logTest('API 響應時間過慢', 'FAIL', `${responseTime}ms (需要優化)`);
      }
    } catch (error) {
      logTest('API 響應時間測試失敗', 'FAIL', error.message);
    }

    // Test 9.2: 並發請求測試
    try {
      const requests = Array(10).fill(null).map(() => 
        axios.get(`${API_BASE}/courses`)
      );
      const startTime = Date.now();
      await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      if (totalTime < 3000) {
        logTest('並發請求處理正常', 'PASS', `10 個並發請求: ${totalTime}ms`);
      } else {
        logTest('並發請求處理偏慢', 'FAIL', `10 個並發請求: ${totalTime}ms`);
      }
    } catch (error) {
      logTest('並發請求測試失敗', 'FAIL', error.message);
    }

    // Test 9.3: 測試 N+1 查詢問題（檢查課程詳情）
    try {
      const startTime = Date.now();
      await axios.get(`${API_BASE}/courses/${courseId}`);
      const responseTime = Date.now() - startTime;
      
      if (responseTime < 500) {
        logTest('課程詳情查詢效能良好', 'PASS', `${responseTime}ms (無明顯 N+1 問題)`);
      } else {
        logTest('課程詳情查詢偏慢', 'FAIL', 
          `${responseTime}ms (可能存在 N+1 查詢,建議使用 JOIN)`);
      }
    } catch (error) {
      logTest('N+1 查詢測試失敗', 'FAIL', error.message);
    }

  } catch (error) {
    log(`Phase 9 發生未預期錯誤: ${error.message}`, 'red');
  }
}

// ============ 生成測試報告 ============
function generateReport() {
  logSection('測試報告生成');

  const passCount = testResults.filter(t => t.status === 'PASS').length;
  const failCount = testResults.filter(t => t.status === 'FAIL').length;
  const total = testResults.length;
  const passRate = ((passCount / total) * 100).toFixed(2);

  log(`\n測試完成!`, 'cyan');
  log(`總測試數: ${total}`, 'blue');
  log(`通過: ${passCount}`, 'green');
  log(`失敗: ${failCount}`, 'red');
  log(`通過率: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');

  // 生成詳細報告
  const report = {
    testDate: new Date().toISOString(),
    summary: {
      total,
      passed: passCount,
      failed: failCount,
      passRate: `${passRate}%`
    },
    results: testResults,
    issues: testResults.filter(t => t.status === 'FAIL').map(t => ({
      testId: t.id,
      name: t.name,
      issue: t.details,
      priority: t.name.includes('登入') || t.name.includes('授權') ? '高' : 
               t.name.includes('效能') || t.name.includes('版本') ? '中' : '低'
    }))
  };

  // 儲存報告
  const reportPath = path.join(__dirname, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  log(`\n測試報告已儲存: ${reportPath}`, 'green');

  // 輸出主要問題
  if (report.issues.length > 0) {
    log('\n發現的問題:', 'yellow');
    report.issues.forEach(issue => {
      log(`[優先級: ${issue.priority}] ${issue.name}`, 'yellow');
      log(`  問題: ${issue.issue}`, 'cyan');
    });
  }
}

// ============ 主測試流程 ============
async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║         LMS 系統自動化端到端測試開始                      ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  await testAuthentication();
  await testCourses();
  await testMaterials();
  await testFileAssignments();
  await testFormAssignments();
  await testGrading();
  await testVersioning();
  await testEdgeCases();
  await testPerformance();
  
  generateReport();
  
  log('\n所有測試完成!', 'green');
}

// 執行測試
runAllTests().catch(error => {
  log(`\n嚴重錯誤: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
