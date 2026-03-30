import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import assignmentRoutes, { initializeSupabase } from './assignments.js';
import { isDriveEnabled, uploadToDrive, downloadFromDrive, getDriveFileMetadata, getLastDriveError } from './driveService.js';
import { initializeEmailService, isEmailEnabled, sendTestEmail, sendEmailVerification, sendAccountApprovalEmail, sendAccountRejectionEmail, sendAdminNotificationEmail, sendMaterialPublishedEmail, sendCourseEnrolledEmail, shouldSendNotification } from './emailService.js';
import { initializeExperienceService, getUserLevel, adminAddUserExp, getUserActivities, createActivityNotification, createActivityNotificationBulk, getAdminUserActivities } from './experienceService.js';
import { initializeBadgeService, getUserBadges, getAdminAwardableBadges, awardBadge, onAdminApproveStudent, onExpChanged, onCommentPosted } from './badgeService.js';
import { initializeLeaderboardService, getLeaderboardData, getLeaderboardVisibility, setLeaderboardVisible } from './leaderboardService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 初始化服務
initializeSupabase(supabase);
initializeExperienceService(supabase);
initializeBadgeService(supabase);
initializeLeaderboardService(supabase);
initializeEmailService();

// 簡單的內存速率限制
const rateLimitStore = new Map();
const rateLimit = (maxRequests = 1000, windowMs = 15 * 60 * 1000, skipLocalhost = true) => {
  return (req, res, next) => {
    // 開發環境跳過 localhost
    if (skipLocalhost && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.includes('localhost'))) {
      return next();
    }
    
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const key = ip;
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }
    
    const requests = rateLimitStore.get(key);
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({ error: '請求過於頻繁，請稍後再試' });
    }
    
    recentRequests.push(now);
    rateLimitStore.set(key, recentRequests);
    next();
  };
};

// 中間件
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());
// 開發環境：localhost 跳過限制；生產環境：每15分鐘1000個請求
app.use(rateLimit(1000, 15 * 60 * 1000, process.env.NODE_ENV !== 'production'));
app.use(express.static(path.join(__dirname, '../public')));

// Multer配置 (內存存儲，不寫入磁盤) - 帶有中文檔名修正
const uploadStorage = multer.memoryStorage();
const upload = multer({ 
  storage: uploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB 限制
  fileFilter: (req, file, cb) => {
    // 修正中文檔名編碼問題
    if (file.originalname) {
      try {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch (e) {
        // 如果轉換失敗，保留原值
      }
    }
    cb(null, true);
  }
});

// ============ 認證相關 ============

// 註冊
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName, realName } = req.body;
    
    if (!email || !password || !displayName || !realName) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
    
    // 檢查信箱是否已存在
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email);
    
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: '信箱已被使用' });
    }
    
    const hashedPassword = await bcryptjs.hash(password, 10);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: hashedPassword,
        full_name: realName,
        display_name: displayName,
        real_name: realName,
        status: 'pending',
        email_verified: false,
        email_verification_token: emailVerificationToken,
        user_role: 'student'
      })
      .select();
    
    if (error) throw error;
    
    // 寄驗證信
    try {
      await sendEmailVerification(email, emailVerificationToken);
    } catch (emailError) {
      console.error('發送驗證信失敗:', emailError);
    }
    
    res.status(201).json({ 
      message: '註冊成功，請檢查信箱驗證電郵', 
      userId: data[0].id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 根路徑（Render 健康檢查用）
app.get('/', (req, res) => res.redirect('/api/health'));
// 健康檢查（用於確認 proxy 連線）
// 測試寄信（除錯用，GET 帶 ?to=你的信箱 會寄一封測試信）
app.get('/api/email-test', async (req, res) => {
  const to = req.query.to;
  if (!to) {
    return res.status(400).json({ error: '請加 ?to=你的信箱@gmail.com' });
  }
  if (!isEmailEnabled()) {
    return res.status(400).json({ error: 'SMTP 未設定' });
  }
  try {
    await sendTestEmail(to);
    res.json({ ok: true, message: `已寄送測試信至 ${to}，請檢查垃圾郵件` });
  } catch (e) {
    console.error('[email-test] 失敗:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 通知信狀態（除錯用）
app.get('/api/email-status', (req, res) => {
  res.json({
    emailEnabled: isEmailEnabled(),
    hasSmtpHost: !!process.env.SMTP_HOST,
    hasSmtpEmail: !!process.env.SMTP_EMAIL,
    hasSmtpPassword: !!process.env.SMTP_PASSWORD,
    hint: isEmailEnabled() ? 'SMTP 已設定' : '請在 Render 設定 SMTP_HOST、SMTP_EMAIL、SMTP_PASSWORD'
  });
});

// Drive 狀態（除錯用，確認是否啟用）
app.get('/api/drive-status', (req, res) => {
  const hasCreds = !!process.env.GOOGLE_DRIVE_CREDENTIALS_JSON;
  const hasFolder = !!process.env.GOOGLE_DRIVE_FOLDER_ID;
  const enabled = isDriveEnabled();
  res.json({
    driveEnabled: enabled,
    hasCredentials: hasCreds,
    hasFolderId: hasFolder,
    hint: !enabled ? (hasCreds && hasFolder ? '憑證或資料夾 ID 可能有誤，請檢查 Render Logs' : '請設定 GOOGLE_DRIVE_CREDENTIALS_JSON 與 GOOGLE_DRIVE_FOLDER_ID') : 'Drive 已啟用'
  });
});

// 測試 Drive 上傳（除錯用）
app.get('/api/drive-test-upload', async (req, res) => {
  if (!isDriveEnabled()) {
    return res.status(400).json({ ok: false, error: 'Drive 未啟用' });
  }
  try {
    const testContent = Buffer.from('LMS Drive 測試 ' + new Date().toISOString());
    const fileId = await uploadToDrive(testContent, 'lms-test-upload.txt', 'text/plain');
    if (fileId) {
      res.json({ ok: true, fileId, message: '上傳成功，請到 Drive 資料夾檢查是否有 lms-test-upload.txt' });
    } else {
      const lastErr = getLastDriveError();
      res.status(500).json({ ok: false, error: '上傳失敗', detail: lastErr || '無錯誤紀錄（可能為 JSON 解析或憑證問題）' });
    }
  } catch (e) {
    const errDetail = e.response?.data || e.message;
    console.error('[drive-test] 錯誤:', errDetail);
    res.status(500).json({ ok: false, error: String(errDetail) });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// 登入
app.post('/api/auth/login', async (req, res) => {
  console.log('[POST /api/auth/login] 收到請求');
  try {
    const { email, password } = req.body;
    
    console.log('[POST /api/auth/login] 查詢用戶:', email);
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    console.log('[POST /api/auth/login] Supabase 回傳, error:', !!error, 'users:', users?.length);

    if (error || !users.length) {
      return res.status(401).json({ error: '使用者不存在' });
    }
    
    const user = users[0];
    
    // 檢查帳號狀態
    if (user.status === 'pending') {
      return res.status(403).json({ error: '帳號待審核，請稍候' });
    }
    
    if (user.status === 'rejected') {
      return res.status(403).json({ error: '帳號申請已被拒絕' });
    }
    
    const passwordMatch = await bcryptjs.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: '密碼錯誤' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.user_role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('[POST /api/auth/login] 登入成功:', user.email);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        real_name: user.real_name,
        user_role: user.user_role
      }
    });
  } catch (error) {
    console.error('[POST /api/auth/login] 錯誤:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// ============ 中間件：驗證JWT ============
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: '需要認證' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '無效的token' });
    req.user = user;
    next();
  });
};

// ============ Messages 路由（直接定義，避免被 assignment 攔截） ============
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    console.log('[POST /api/messages] userId:', req.user?.userId);
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: '請填寫訊息內容' });
    }
    const { data, error } = await supabase
      .from('contact_messages')
      .insert({ from_user_id: req.user.userId, content: content.trim() })
      .select('id, content, created_at')
      .single();
    if (error) {
      console.error('[POST /api/messages] Supabase error:', error);
      throw error;
    }
    console.log('[POST /api/messages] OK, id:', data?.id);
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/messages/me', authenticateToken, async (req, res) => {
  try {
    console.log('[GET /api/messages/me] userId:', req.user?.userId);
    const { data, error } = await supabase
      .from('contact_messages')
      .select('id, content, created_at, read_at, reply_content, reply_at')
      .eq('from_user_id', req.user.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[GET /api/messages/me] Supabase error:', error);
      throw error;
    }
    console.log('[GET /api/messages/me] OK, count:', (data || []).length);
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 管理員：取得學員私訊、回覆（直接定義，避免被 assignment 攔截）
app.get('/api/admin/contact-messages', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const { data, error } = await supabase
      .from('contact_messages')
      .select('id, from_user_id, content, created_at, read_at, reply_content, reply_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const userIds = [...new Set((data || []).map(m => m.from_user_id))];
    let userMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, display_name, real_name, full_name, email').in('id', userIds);
      userMap = Object.fromEntries((users || []).map(u => [u.id, u.display_name || u.real_name || u.full_name || u.email || '-']));
    }
    const result = (data || []).map(m => ({ ...m, from_name: userMap[m.from_user_id] || '-' }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.patch('/api/admin/contact-messages/:messageId/reply', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const { messageId } = req.params;
    const { reply } = req.body;
    if (!reply || typeof reply !== 'string' || reply.trim() === '') {
      return res.status(400).json({ error: '請填寫回覆內容' });
    }
    const { data, error } = await supabase
      .from('contact_messages')
      .update({
        reply_content: reply.trim(),
        reply_at: new Date().toISOString(),
        reply_by: req.user.userId
      })
      .eq('id', messageId)
      .select()
      .single();
    if (error) {
      console.error('回覆私訊 DB 錯誤:', error);
      throw error;
    }
    if (!data) return res.status(404).json({ error: '訊息不存在' });
    res.json(data);
  } catch (error) {
    console.error('回覆私訊失敗:', error);
    res.status(500).json({ error: error.message || '回覆失敗' });
  }
});

// ============ 激勵系統 ============

// 取得當前學員等級與經驗值
app.get('/api/users/me/level', authenticateToken, async (req, res) => {
  try {
    const levelData = await getUserLevel(req.user.userId);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(levelData);
  } catch (error) {
    console.error('取得等級失敗:', error);
    res.status(500).json({ error: '取得等級失敗' });
  }
});

// 取得當前學員最近動態
app.get('/api/users/me/activities', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const activities = await getUserActivities(req.user.userId, limit);
    res.json(activities);
  } catch (error) {
    console.error('取得動態失敗:', error);
    res.status(500).json({ error: '取得動態失敗' });
  }
});

// 管理員：取得可頒發的徽章列表
app.get('/api/admin/badges', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const badges = await getAdminAwardableBadges();
    res.json(badges);
  } catch (error) {
    console.error('取得徽章列表失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

// 管理員：頒發徽章給學員
app.post('/api/admin/badges/award', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const { userId, badgeId } = req.body;
    if (!userId || !badgeId) {
      return res.status(400).json({ error: '請提供 userId 與 badgeId' });
    }
    const result = await awardBadge(userId, badgeId, req.user.userId);
    if (result.alreadyHas) {
      return res.status(400).json({ error: '該學員已獲得此勳章，不會重複頒贈，也不會獲得經驗值' });
    }
    if (!result.awarded) {
      return res.status(400).json({ error: '頒發失敗或徽章不存在' });
    }
    res.status(201).json({ message: '徽章已頒發', expAdded: result.expAdded });
  } catch (error) {
    console.error('頒發徽章失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

// 排行榜：取得可見狀態（公開，登入後可查）
app.get('/api/leaderboard/visible', authenticateToken, async (req, res) => {
  try {
    const visible = await getLeaderboardVisibility();
    res.json({ visible });
  } catch (error) {
    res.status(500).json({ error: '取得排行榜狀態失敗' });
  }
});

// 排行榜：取得資料（visible 時回傳，否則 403；DB 異常時以記憶體為準）
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
  try {
    const visible = await getLeaderboardVisibility();
    if (!visible) {
      return res.status(403).json({ error: '排行榜目前未開放，請由管理員在管理面板開啟' });
    }
    const data = await getLeaderboardData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: '取得排行榜失敗' });
  }
});

// 管理員：取得排行榜狀態與即時資料（不受 visible 限制）
app.get('/api/admin/leaderboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const [visible, data] = await Promise.all([
      getLeaderboardVisibility(),
      getLeaderboardData()
    ]);
    res.json({ visible, data });
  } catch (error) {
    res.status(500).json({ error: '取得排行榜失敗' });
  }
});

// 管理員：開關排行榜可見
app.patch('/api/admin/leaderboard/visible', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const { visible } = req.body;
    if (typeof visible !== 'boolean') {
      return res.status(400).json({ error: '請提供 visible: true 或 false' });
    }
    await setLeaderboardVisible(visible);
    res.json({ visible });
  } catch (error) {
    res.status(500).json({ error: '更新排行榜狀態失敗' });
  }
});

// 取得當前學員徽章
app.get('/api/users/me/badges', authenticateToken, async (req, res) => {
  try {
    const badges = await getUserBadges(req.user.userId);
    res.json(badges);
  } catch (error) {
    console.error('取得徽章失敗:', error);
    res.json([]);
  }
});

// 用戶修改自己的密碼
app.patch('/api/users/me/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '請提供目前密碼，且新密碼至少 6 個字' });
    }
    const { data: user } = await supabase.from('users').select('password_hash').eq('id', req.user.userId).single();
    if (!user) return res.status(404).json({ error: '用戶不存在' });
    const match = await bcryptjs.compare(currentPassword, user.password_hash);
    if (!match) return res.status(400).json({ error: '目前密碼錯誤' });
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    const { error } = await supabase.from('users').update({ password_hash: hashedPassword }).eq('id', req.user.userId);
    if (error) throw error;
    res.json({ message: '密碼已更新' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 取得自己的通知偏好
const DEFAULT_NOTIFICATION_PREFS = { graded: true, material: true, assignment: true, enrolled: true };
app.get('/api/users/me/notification-preferences', authenticateToken, async (req, res) => {
  try {
    const { data } = await supabase.from('users').select('notification_preferences').eq('id', req.user.userId).single();
    const prefs = data?.notification_preferences || DEFAULT_NOTIFICATION_PREFS;
    res.json({ ...DEFAULT_NOTIFICATION_PREFS, ...prefs });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 更新自己的通知偏好（可傳完整物件 { graded, material, assignment, enrolled }）
app.patch('/api/users/me/notification-preferences', authenticateToken, async (req, res) => {
  try {
    const { graded, material, assignment, enrolled } = req.body;
    const updates = {};
    if (typeof graded === 'boolean') updates.graded = graded;
    if (typeof material === 'boolean') updates.material = material;
    if (typeof assignment === 'boolean') updates.assignment = assignment;
    if (typeof enrolled === 'boolean') updates.enrolled = enrolled;
    const { data: current } = await supabase.from('users').select('notification_preferences').eq('id', req.user.userId).single();
    const merged = { ...DEFAULT_NOTIFICATION_PREFS, ...(current?.notification_preferences || {}), ...updates };
    const { error } = await supabase.from('users').update({ notification_preferences: merged }).eq('id', req.user.userId);
    if (error) throw error;
    res.json(merged);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 管理員：取得所有用戶等級（含經驗值）
app.get('/api/admin/experience-levels', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    // 與用戶管理相同邏輯，相容 display_name/real_name 或 full_name/role
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, real_name, full_name, email, user_role, role')
      .eq('status', 'approved');
    if (usersError) {
      console.error('取得用戶等級失敗(users):', usersError);
      return res.status(500).json({ error: '取得用戶等級失敗' });
    }
    const { data: levels, error: levelsError } = await supabase.from('user_levels').select('user_id, total_exp');
    if (levelsError) console.error('取得 user_levels 失敗:', levelsError);
    const levelMap = Object.fromEntries((levels || []).map(l => [l.user_id, l.total_exp ?? 0]));
    const result = (users || []).map(u => ({
      id: u.id,
      display_name: u.display_name ?? u.full_name ?? '-',
      real_name: u.real_name ?? u.full_name ?? '-',
      email: u.email,
      user_role: u.user_role ?? u.role ?? 'student',
      total_exp: levelMap[u.id] ?? 0,
      level: Math.floor((levelMap[u.id] ?? 0) / 100) + 1
    }));
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(result);
  } catch (error) {
    console.error('取得用戶等級失敗:', error);
    res.status(500).json({ error: '取得用戶等級失敗' });
  }
});

// 管理員：增加用戶經驗值（只加不減）
app.patch('/api/admin/experience/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const { userId } = req.params;
    const { addExp } = req.body;
    const levelData = await adminAddUserExp(userId, addExp);
    if (levelData?.added > 0) {
      onExpChanged(userId).catch((e) => console.error('徽章等級檢查失敗:', e));
    }
    res.json(levelData);
  } catch (error) {
    console.error('增加經驗值失敗:', error);
    res.status(500).json({ error: error.message || '增加經驗值失敗' });
  }
});

// 管理員：發送動態通知（可選加經驗值）
// 支援：userId（單一）、userIds（陣列）、target: 'all_students'（群發給學員+伴飛學員，不含共學之友）
app.post('/api/admin/activity-notifications', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const { userId, userIds, target, message, addExp } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: '請提供 message' });
    }
    const trimmedMessage = message.trim();
    const expAmount = parseInt(addExp, 10) || 0;

    let ids = [];
    if (target === 'all_students') {
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('status', 'approved')
        .in('user_role', ['student', 'trainee']);
      ids = (users || []).map((u) => u.id);
    } else if (Array.isArray(userIds) && userIds.length > 0) {
      ids = userIds.filter((id) => typeof id === 'string' && id.length > 0);
    } else if (userId) {
      ids = [userId];
    }
    if (ids.length === 0) {
      return res.status(400).json({ error: '請選擇至少一位學員，或使用 target: "all_students" 群發' });
    }

    if (ids.length === 1) {
      const result = await createActivityNotification(ids[0], trimmedMessage, expAmount, req.user.userId);
      if (expAmount > 0) {
        onExpChanged(ids[0]).catch((e) => console.error('徽章等級檢查失敗:', e));
      }
      return res.status(201).json(result);
    }
    const result = await createActivityNotificationBulk(ids, trimmedMessage, expAmount, req.user.userId);
    if (expAmount > 0) {
      ids.forEach((id) => onExpChanged(id).catch((e) => console.error('徽章等級檢查失敗:', e)));
    }
    return res.status(201).json(result);
  } catch (error) {
    console.error('發送動態通知失敗:', error);
    res.status(500).json({ error: error.message || '發送失敗' });
  }
});

// 管理員：下載學員動態彙整 PDF
app.get('/api/admin/users/:userId/activities/export/pdf', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const { userId } = req.params;
    const { data: user } = await supabase.from('users').select('display_name, real_name, full_name, email').eq('id', userId).single();
    const activities = await getAdminUserActivities(userId);
    const displayName = user?.display_name || user?.real_name || user?.full_name || user?.email || '學員';

    const fontCandidates = [
      'C:/Windows/Fonts/NotoSansTC-VF.ttf', 'C:/Windows/Fonts/kaiu.ttf', 'C:/Windows/Fonts/simsun.ttc',
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf'
    ];
    const fontPath = fontCandidates.find((p) => fs.existsSync(p));

    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    if (fontPath) {
      try {
        doc.registerFont('CJK', fontPath);
        doc.font('CJK');
      } catch (e) {
        console.warn('PDF 字型載入失敗:', e.message);
      }
    }

    const filename = `學員動態-${displayName}-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    doc.pipe(res);

    doc.fontSize(18).text(`學員動態彙整：${displayName}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`匯出時間：${new Date().toLocaleString('zh-TW')}`, { align: 'right' });
    doc.moveDown(2);

    if (activities.length === 0) {
      doc.text('尚無動態紀錄。');
    } else {
      activities.forEach((a, i) => {
        const dateStr = a.date ? new Date(a.date).toLocaleString('zh-TW') : '';
        doc.fontSize(11).text(`${i + 1}. ${a.message}`, { continued: false });
        doc.fontSize(9).fillColor('#666').text(`   ${dateStr}`, { indent: 10 });
        doc.moveDown(0.5);
      });
    }

    doc.end();
  } catch (error) {
    console.error('PDF 匯出失敗:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// 管理員：下載學員動態彙整 Excel
app.get('/api/admin/users/:userId/activities/export/excel', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ error: '無權限' });
    }
    const { userId } = req.params;
    const { data: user } = await supabase.from('users').select('display_name, real_name, full_name, email').eq('id', userId).single();
    const activities = await getAdminUserActivities(userId);
    const displayName = user?.display_name || user?.real_name || user?.full_name || user?.email || '學員';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('學員動態');
    sheet.columns = [
      { header: '序號', key: 'index', width: 8 },
      { header: '動態內容', key: 'message', width: 60 },
      { header: '時間', key: 'date', width: 22 }
    ];
    sheet.getRow(1).font = { bold: true };
    activities.forEach((a, i) => {
      sheet.addRow({
        index: i + 1,
        message: a.message,
        date: a.date ? new Date(a.date).toLocaleString('zh-TW') : ''
      });
    });
    const filename = `學員動態-${displayName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel 匯出失敗:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// ============ 帳號審核 ============

// 獲取待審核的帳號
app.get('/api/admin/pending-users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name, real_name, status, email_verified, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 批准帳號並設定角色
app.post('/api/admin/approve-user/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { userId } = req.params;
    const { userRole } = req.body;
    
    // 驗證角色
    const validRoles = ['student', 'instructor', 'flight_instructor', 'trainee', 'study_buddy', 'admin'];
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: '無效的角色' });
    }
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, display_name')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    
    const { error } = await supabase
      .from('users')
      .update({
        status: 'approved',
        user_role: userRole
      })
      .eq('id', userId);
    
    if (error) throw error;

    try {
      await onAdminApproveStudent(userId, userRole);
    } catch (badgeErr) {
      console.error('頒發入學勳章失敗:', badgeErr);
    }

    try {
      await sendAccountApprovalEmail(userData.email, userData.display_name, userRole);
    } catch (emailError) {
      console.error('發送批准信失敗:', emailError);
    }
    res.json({ message: '帳號已批准' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 拒絕帳號
app.post('/api/admin/reject-user/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { userId } = req.params;
    const { reason } = req.body;
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, display_name')
      .eq('id', userId)
      .single();
    
    if (userError) throw userError;
    
    const { error } = await supabase
      .from('users')
      .update({
        status: 'rejected'
      })
      .eq('id', userId);
    
    if (error) throw error;
    
    // 寄拒絕信
    try {
      await sendAccountRejectionEmail(userData.email, userData.display_name, reason);
    } catch (emailError) {
      console.error('發送拒絕信失敗:', emailError);
    }
    
    res.json({ message: '帳號已拒絕' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 獲取所有已批准的用戶
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name, real_name, user_role, status, email_verified, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 修改用戶資料（角色、信箱等）
app.patch('/api/admin/users/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { userId } = req.params;
    const { user_role, email, display_name, real_name } = req.body;
    
    const updateData = {};
    if (user_role) updateData.user_role = user_role;
    if (email) updateData.email = email;
    if (display_name) updateData.display_name = display_name;
    if (real_name) {
      updateData.real_name = real_name;
      updateData.full_name = real_name;
    }
    
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 重設用戶密碼（產生臨時密碼）
app.post('/api/admin/users/:userId/reset-password', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { userId } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '新密碼至少 6 個字' });
    }
    
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    
    const { error } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', userId);
    
    if (error) throw error;
    res.json({ message: '密碼已重設' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ 課程相關 ============

// 獲取所有課程（需登入）
app.get('/api/courses', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 獲取課程詳細資訊（需登入，且為該課程學員或教師）
app.get('/api/courses/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const currentUserId = req.user.userId;
    
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();
    
    if (courseError) throw courseError;
    if (!course) return res.status(404).json({ error: '課程不存在' });

    // 權限：教師、admin 或已 enroll 學員
    const isInstructor = course.instructor_id === currentUserId;
    const isAdmin = req.user.role === 'admin';
    if (!isInstructor && !isAdmin) {
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', currentUserId)
        .single();
      if (!enrollment) return res.status(403).json({ error: '無權限存取此課程' });
    }

    const { data: materials } = await supabase
      .from('course_materials')
      .select('*')
      .eq('course_id', courseId);
    
    const { data: assignments } = await supabase
      .from('assignments')
      .select('*')
      .eq('course_id', courseId);
    
    // 一次查詢所有作業指定，避免 N+1
    // 邏輯：
    // 1. 如果作業沒有任何指定記錄 → 對全班開放 → true
    // 2. 如果有指定記錄，檢查該學生是否在其中
    let designatedMap = {};
    let hasDesignationsMap = {}; // 追蹤哪些作業有指定記錄
    
    if (assignments && assignments.length > 0) {
      const assignmentIds = assignments.map(a => a.id);
      
      // 先查詢所有有指定記錄的作業
      const { data: allDesignations } = await supabase
        .from('assignment_designations')
        .select('assignment_id')
        .in('assignment_id', assignmentIds);
      
      if (allDesignations && allDesignations.length > 0) {
        // 記錄哪些作業有指定記錄
        allDesignations.forEach(d => {
          hasDesignationsMap[d.assignment_id] = true;
        });
      }
      
      // 如果有 userId，查詢該學生被指定的作業
      if (currentUserId) {
        const { data: studentDesignations } = await supabase
          .from('assignment_designations')
          .select('assignment_id')
          .in('assignment_id', assignmentIds)
          .eq('student_id', currentUserId);
        
        if (studentDesignations) {
          studentDesignations.forEach(d => {
            designatedMap[d.assignment_id] = true;
          });
        }
      }
    }
    
    const { data: comments } = await supabase
      .from('comments')
      .select('*, users(full_name)')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });
    
    res.json({
      course,
      materials,
      assignments: assignments?.map(a => {
        // 判斷學生是否能看到該作業
        const hasDesignations = hasDesignationsMap[a.id];
        
        if (!hasDesignations) {
          // 作業沒有指定任何學生 → 全班都能看
          return { ...a, isDesignatedForUser: true };
        } else if (designatedMap[a.id]) {
          // 作業有指定記錄，且該學生被指定
          return { ...a, isDesignatedForUser: true };
        } else {
          // 作業有指定記錄，但該學生未被指定
          return { ...a, isDesignatedForUser: false };
        }
      }) || [],
      comments
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 建立課程
app.post('/api/courses', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { title, description } = req.body;
    
    const { data, error } = await supabase
      .from('courses')
      .insert({
        title,
        description,
        instructor_id: req.user.userId
      })
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 刪除課程（含教材、作業、提交等關聯；admin 或該課程負責教師）
app.delete('/api/courses/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, instructor_id')
      .eq('id', courseId)
      .single();

    if (courseErr || !course) {
      return res.status(404).json({ error: '課程不存在' });
    }
    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { data: assigns } = await supabase.from('assignments').select('id').eq('course_id', courseId);
    const assignmentIds = (assigns || []).map((a) => a.id);

    if (assignmentIds.length > 0) {
      const { error: shwErr } = await supabase.from('showcase_submissions').delete().in('assignment_id', assignmentIds);
      if (shwErr) throw shwErr;
    }

    const { error: featErr } = await supabase.from('featured_notes').delete().eq('course_id', courseId);
    if (featErr) throw featErr;

    await supabase.from('experience_logs').delete().eq('source_type', 'course').eq('source_id', courseId);
    if (assignmentIds.length > 0) {
      await supabase.from('experience_logs').delete().eq('source_type', 'assignment').in('source_id', assignmentIds);
    }

    // 教材可能引用本作業當解鎖條件，需先解除，否則刪除 assignments 可能違反 FK
    await supabase.from('course_materials').update({ required_assignment_id: null }).eq('course_id', courseId);

    const { error: delErr } = await supabase.from('courses').delete().eq('id', courseId);
    if (delErr) throw delErr;

    res.json({ message: '課程已刪除' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 獲取所有用戶（供教師選擇）
app.get('/api/users/list', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, user_role, status')
      .in('user_role', ['student', 'trainee', 'study_buddy'])  // 學員、伴飛學員、共學之友
      .eq('status', 'approved');  // 只查已批准的帳號
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 獲取課程的已註冊學生
app.get('/api/courses/:courseId/enrollments', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const { data, error } = await supabase
      .from('course_enrollments')
      .select('*, users(id, email, full_name, status)')
      .eq('course_id', courseId);
    
    if (error) throw error;
    
    // 過濾掉被拒絕或待審核的帳號，只保留已批准的
    const filteredData = data.filter(enrollment => 
      enrollment.users?.status === 'approved'
    );
    
    res.json(filteredData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 新增學生到課程
app.post('/api/courses/:courseId/enroll-student', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { studentId } = req.body;
    
    // 驗證教師權限
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();
    
    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    // 檢查是否已註冊
    const { data: existing } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_id', studentId);
    
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: '學生已在課程中' });
    }
    
    // 新增註冊
    const { data, error } = await supabase
      .from('course_enrollments')
      .insert({ course_id: courseId, student_id: studentId })
      .select();

    if (error) throw error;

    // 學員加入課程時寄信通知
    const { data: courseInfo } = await supabase.from('courses').select('title').eq('id', courseId).single();
    const { data: student } = await supabase.from('users').select('email, display_name, real_name, status').eq('id', studentId).single();
    if (student?.email && student?.status === 'approved' && courseInfo?.title) {
      const ok = await shouldSendNotification(supabase, studentId, 'enrolled');
      if (ok) sendCourseEnrolledEmail(student.email, student.display_name || student.real_name || '學員', courseInfo.title, courseId)
        .catch(err => console.error('加入課程通知信失敗:', err));
    }

    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 從課程移除學生
app.delete('/api/courses/:courseId/enroll-student/:studentId', authenticateToken, async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    
    // 驗證教師權限
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();
    
    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { error } = await supabase
      .from('course_enrollments')
      .delete()
      .eq('course_id', courseId)
      .eq('student_id', studentId);
    
    if (error) throw error;
    res.json({ message: '學生已移除' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ 課程教材 ============

// 上傳課程教材或添加連結
app.post('/api/courses/:courseId/materials', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, linkUrl, linkType, visibleFrom, visibleUntil } = req.body;
    
    // 檢查是否為檔案或連結
    const isFile = req.file !== undefined;
    const isLink = linkUrl !== undefined;

    if (!isFile && !isLink) {
      return res.status(400).json({ error: '請選擇檔案或輸入連結' });
    }

    if (isFile && isLink) {
      return res.status(400).json({ error: '不能同時上傳檔案和連結' });
    }
    
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();
    
    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    let insertData = {
      course_id: courseId,
      title,
      description: description || null,
      visible: false,
      visible_from: visibleFrom || null,
      visible_until: visibleUntil || null
    };

    if (isFile) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const extName = ext.substring(1) || 'file';
      const mimeTypes = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'zip': 'application/zip'
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      if (isDriveEnabled()) {
        const driveFileId = await uploadToDrive(req.file.buffer, req.file.originalname, mimeType);
        if (driveFileId) {
          insertData.drive_file_id = driveFileId;
          insertData.file_url = null; // Drive 模式不存本機路徑
        }
      }
      if (!insertData.drive_file_id) {
        // 本機備援或 Drive 未啟用
        const uploadsPath = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + ext;
        const filepath = path.join(uploadsPath, filename);
        fs.writeFileSync(filepath, req.file.buffer);
        if (!fs.existsSync(filepath)) return res.status(500).json({ error: '檔案保存失敗' });
        insertData.file_url = `/uploads/${filename}`;
      }
      insertData.file_type = extName;
      insertData.file_name = req.file.originalname;
    } else {
      // 處理連結
      insertData.link_url = linkUrl;
      insertData.link_type = linkType;
    }

    // 保存到資料庫
    const { data, error } = await supabase
      .from('course_materials')
      .insert(insertData)
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('上傳錯誤:', error);
    res.status(400).json({ error: error.message });
  }
});

// 設定教材可見性（需為該課程教師或 admin）
app.patch('/api/materials/:materialId/visibility', authenticateToken, async (req, res) => {
  try {
    const { materialId } = req.params;
    const { visible, visibleFrom, visibleUntil } = req.body;

    const { data: material } = await supabase
      .from('course_materials')
      .select('course_id, title, visible')
      .eq('id', materialId)
      .single();
    if (!material) return res.status(404).json({ error: '教材不存在' });

    const { data: course } = await supabase.from('courses').select('instructor_id').eq('id', material.course_id).single();
    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { data, error } = await supabase
      .from('course_materials')
      .update({
        visible,
        visible_from: visibleFrom,
        visible_until: visibleUntil
      })
      .eq('id', materialId)
      .select();

    if (error) throw error;

    // 教材上線（visible 改為 true）時通知已 enroll 學員
    if (visible === true && material.visible !== true) {
      const { data: course } = await supabase.from('courses').select('title').eq('id', material.course_id).single();
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('users(id, email, display_name, real_name, status)')
        .eq('course_id', material.course_id);
      const students = (enrollments || []).filter(e => e.users?.status === 'approved').map(e => e.users);
      for (const u of students) {
        if (u?.email) {
          const ok = await shouldSendNotification(supabase, u.id, 'material');
          if (ok) sendMaterialPublishedEmail(u.email, u.display_name || u.real_name || '學員', course?.title || '課程', material.title, material.course_id)
            .catch(err => console.error('教材上線通知信失敗:', err));
        }
      }
    }

    res.json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 刪除教材（需為該課程教師或 admin）
app.delete('/api/materials/:materialId', authenticateToken, async (req, res) => {
  try {
    const { materialId } = req.params;

    const { data: material } = await supabase.from('course_materials').select('course_id').eq('id', materialId).single();
    if (!material) return res.status(404).json({ error: '教材不存在' });
    const { data: course } = await supabase.from('courses').select('instructor_id').eq('id', material.course_id).single();
    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { error } = await supabase
      .from('course_materials')
      .delete()
      .eq('id', materialId);
    
    if (error) throw error;
    res.json({ message: '教材已刪除' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 下載教材檔案（需登入，且為該課程學員或教師）
app.get('/api/materials/:materialId/download', authenticateToken, async (req, res) => {
  try {
    const { materialId } = req.params;

    const { data: material } = await supabase
      .from('course_materials')
      .select('*, drive_file_id')
      .eq('id', materialId)
      .single();

    if (!material) return res.status(404).json({ error: '教材不存在' });
    if (!material.file_url && !material.drive_file_id) return res.status(404).json({ error: '此教材為連結類型，無檔案可下載' });

    const { data: course } = await supabase.from('courses').select('instructor_id').eq('id', material.course_id).single();
    const isInstructor = course?.instructor_id === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isInstructor && !isAdmin) {
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', material.course_id)
        .eq('student_id', req.user.userId)
        .single();
      if (!enrollment) return res.status(403).json({ error: '無權限下載此教材' });
    }

    const mimeTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'zip': 'application/zip'
    };
    const ext = material.file_type?.toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    const downloadFilename = material.file_name || `${material.title}.${ext || 'file'}`;
    const encoded = encodeURI(downloadFilename);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    res.setHeader('Content-Type', mimeType);

    if (material.drive_file_id) {
      const buf = await downloadFromDrive(material.drive_file_id);
      if (!buf) return res.status(404).json({ error: '檔案不存在或無法取得' });
      return res.send(buf);
    }
    const filename = material.file_url.split('/').pop();
    const filepath = path.join(__dirname, '../public/uploads', filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: '檔案不存在或已被刪除' });
    res.sendFile(filepath);
  } catch (error) {
    console.error('下載錯誤:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ 作業系統路由 ============
app.use('/api', assignmentRoutes);

// ============ 討論留言 ============

// 添加課程留言（需為該課程學員或教師）
app.post('/api/courses/:courseId/comments', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { content, parentCommentId } = req.body;

    const { data: course } = await supabase.from('courses').select('instructor_id').eq('id', courseId).single();
    if (!course) return res.status(404).json({ error: '課程不存在' });
    const isInstructor = course.instructor_id === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isInstructor && !isAdmin) {
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', req.user.userId)
        .single();
      if (!enrollment) return res.status(403).json({ error: '無權限在此課程留言' });
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        course_id: courseId,
        user_id: req.user.userId,
        content,
        parent_comment_id: parentCommentId || null
      })
      .select();
    
    if (error) throw error;
    try {
      await onCommentPosted(req.user.userId);
    } catch (badgeErr) {
      console.error('頒發協作勳章檢查失敗:', badgeErr);
    }
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '伺服器錯誤' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`✓ 後端運行於 port ${PORT}`));
