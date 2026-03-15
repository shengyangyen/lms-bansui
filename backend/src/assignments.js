import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { awardAssignmentExp } from './experienceService.js';
import { onExcellentGrade, onExpChanged, onRevisionCount } from './badgeService.js';
import { sendSubmissionGradedEmail, sendAssignmentPublishedEmail, shouldSendNotification } from './emailService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
let supabase;

// 自定義存儲以正確處理中文檔名
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB 限制
  fileFilter: (req, file, cb) => {
    // 確保檔名使用 UTF-8 編碼
    if (file.originalname) {
      // multer 在某些情況下會錯誤編碼檔名，這裡嘗試修正
      try {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch (e) {
        // 如果轉換失敗，保留原值
      }
    }
    cb(null, true);
  }
});

const getPdfFontPath = () => {
  const candidates = [
    'C:/Windows/Fonts/NotoSansTC-VF.ttf',
    'C:/Windows/Fonts/NotoSansHK-VF.ttf',
    'C:/Windows/Fonts/kaiu.ttf',
    'C:/Windows/Fonts/simsunb.ttf',
    'C:/Windows/Fonts/SimsunExtG.ttf',
    'C:/Windows/Fonts/simsun.ttc',
    'C:/Windows/Fonts/arialuni.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttf'
  ];
  return candidates.find((p) => fs.existsSync(p));
};

const resolveFormAnswers = async (assignmentId, answers) => {
  const { data: questions, error } = await supabase
    .from('assignment_questions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('question_number', { ascending: true });
  if (error) throw error;

  const map = answers || {};
  return (questions || []).map((q) => ({
    question_number: q.question_number,
    title: q.title,
    description: q.description || '',
    answer: map[String(q.id)] ?? map[q.question_number] ?? ''
  }));
};

// 初始化 Supabase
export function initializeSupabase(supabaseClient) {
  supabase = supabaseClient;
}

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

// ============ 作業基本CRUD ============

// 建立作業
router.post('/courses/:courseId/assignments', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, assignmentType = 'upload', questions = [], designatedStudentIds = [] } = req.body;
    const effectiveType =
      Array.isArray(questions) && questions.length > 0 ? 'form' : assignmentType;
    
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();
    
    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        course_id: courseId,
        title,
        description,
        assignment_type: effectiveType,
        created_by: req.user.userId
      })
      .select();
    
    if (error) throw error;

    const createdAssignment = data[0];
    
    // 新增題目（如果是填空題）
    if (effectiveType === 'form' && Array.isArray(questions) && questions.length > 0) {
      const payload = questions.map((q, idx) => ({
        assignment_id: createdAssignment.id,
        question_number: idx + 1,
        title: q.title || `問題 ${idx + 1}`,
        description: q.description || null,
        question_type: q.question_type || 'textarea',
        required: q.required !== false
      }));

      const { error: questionError } = await supabase
        .from('assignment_questions')
        .insert(payload);

      if (questionError) throw questionError;
    }

    // 如果指定了特定學生，新增指定記錄
    if (Array.isArray(designatedStudentIds) && designatedStudentIds.length > 0) {
      const designations = designatedStudentIds.map(studentId => ({
        assignment_id: createdAssignment.id,
        student_id: studentId
      }));

      const { error: designationError } = await supabase
        .from('assignment_designations')
        .insert(designations);

      if (designationError) throw designationError;
    }

    // 作業上線時通知學員（非同步）
    (async () => {
      try {
        const { data: course } = await supabase.from('courses').select('title').eq('id', courseId).single();
        let studentIds = designatedStudentIds;
        if (!Array.isArray(studentIds) || studentIds.length === 0) {
          const { data: enrollments } = await supabase
            .from('course_enrollments')
            .select('student_id')
            .eq('course_id', courseId);
          studentIds = (enrollments || []).map(e => e.student_id);
        }
        const { data: users } = await supabase.from('users').select('id, email, display_name, real_name, status').in('id', studentIds);
        const toNotify = (users || []).filter(u => u.status === 'approved' && u.email);
        for (const u of toNotify) {
          const ok = await shouldSendNotification(supabase, u.id, 'assignment');
          if (ok) await sendAssignmentPublishedEmail(u.email, u.display_name || u.real_name || '學員', course?.title || '課程', title, createdAssignment.id);
        }
      } catch (e) {
        console.error('作業上線通知信失敗:', e);
      }
    })();

    res.status(201).json(createdAssignment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 獲取課程所有作業（含提交計數）
router.get('/courses/:courseId/assignments', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // 驗證用戶是否被 enroll 到此課程或是教師
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();
    
    if (!course) {
      return res.status(404).json({ error: '課程不存在' });
    }
    
    // 檢查：是教師、管理員或已 enroll 的學生
    const isTeacher = course.instructor_id === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    
    if (!isTeacher && !isAdmin) {
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', req.user.userId)
        .single();
      
      if (!enrollment) {
        return res.status(403).json({ error: '無權訪問此課程' });
      }
    }
    
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // 為每個作業計算提交數
    const assignmentsWithCounts = await Promise.all(
      data.map(async (assignment) => {
        const { data: submissions } = await supabase
          .from('submissions')
          .select('id', { count: 'exact' })
          .eq('assignment_id', assignment.id)
          .eq('is_latest', true);
        
        return {
          ...assignment,
          submission_count: submissions?.length || 0
        };
      })
    );
    
    res.json(assignmentsWithCounts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 獲取單個作業詳情
router.get('/assignments/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    
    const { data: assignment, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();
    
    if (error) throw error;

    // 檢查權限：教師、管理員或被指定的學生
    const isTeacher = assignment.created_by === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    
    if (!isTeacher && !isAdmin) {
      // 檢查學生是否被指定該作業
      const { data: isDesignated } = await supabase
        .from('assignment_designations')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('student_id', req.user.userId)
        .single();
      
      // 如果有指定記錄但學生不在其中，或有指定記錄但這個學生沒被指定
      const { data: anyDesignations } = await supabase
        .from('assignment_designations')
        .select('id', { count: 'exact' })
        .eq('assignment_id', assignmentId);
      
      if (anyDesignations && anyDesignations.length > 0 && !isDesignated) {
        return res.status(403).json({ error: '無權訪問此作業' });
      }
    }

    let questions = [];
    if (assignment.assignment_type === 'form') {
      const { data: questionData, error: questionError } = await supabase
        .from('assignment_questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('question_number', { ascending: true });

      if (questionError) throw questionError;
      questions = questionData || [];
    }

    res.json({ ...assignment, questions });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 編輯作業
router.patch('/assignments/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { title, description, designatedStudentIds } = req.body;
    
    const { data: assignment } = await supabase
      .from('assignments')
      .select('created_by')
      .eq('id', assignmentId)
      .single();
    
    if (assignment.created_by !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { data, error } = await supabase
      .from('assignments')
      .update({ title, description })
      .eq('id', assignmentId)
      .select();
    
    if (error) throw error;

    // 如果指定了學生，更新指定記錄
    if (Array.isArray(designatedStudentIds)) {
      // 先刪除現有的指定記錄
      await supabase
        .from('assignment_designations')
        .delete()
        .eq('assignment_id', assignmentId);

      // 如果有新的指定學生，新增
      if (designatedStudentIds.length > 0) {
        const designations = designatedStudentIds.map(studentId => ({
          assignment_id: assignmentId,
          student_id: studentId
        }));

        const { error: designationError } = await supabase
          .from('assignment_designations')
          .insert(designations);

        if (designationError) throw designationError;
      }
    }
    
    res.json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 刪除作業
router.delete('/assignments/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    
    const { data: assignment } = await supabase
      .from('assignments')
      .select('created_by')
      .eq('id', assignmentId)
      .single();
    
    if (assignment.created_by !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }
    
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId);
    
    if (error) throw error;
    res.json({ message: '作業已刪除' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ 提交作業（版本管理） ============

// 學生提交作業
router.post('/assignments/:assignmentId/submit', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: '請上傳檔案' });
    }

    // 保存檔案到磁盤
    const uploadsPath = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = uniqueSuffix + ext;
    const filepath = path.join(uploadsPath, filename);
    
    // 保存原始檔名用於 Content-Disposition（改為 UTF-8 編碼）
    const originalFileName = req.file.originalname;
    
    fs.writeFileSync(filepath, req.file.buffer);

    // 檢查是否有最新的提交版本（只取最新一筆，避免多筆 is_latest=true 造成歧義）
    const { data: latestSubmissions, error: queryError } = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .eq('is_latest', true)
      .order('submitted_at', { ascending: false })
      .limit(1);

    if (queryError) throw queryError;

    if (latestSubmissions.length > 0) {
      const latestSubmission = latestSubmissions[0];
      
      // 檢查是否已有反饋（已批改）
      const { data: feedbackList, error: feedbackError } = await supabase
        .from('feedback')
        .select('id, grade')
        .eq('submission_id', latestSubmission.id);

      if (feedbackError) {
        console.error('查詢 feedback 失敗:', feedbackError);
      }

      const hasGrading = feedbackList && feedbackList.length > 0;
      console.log(`提交 ${latestSubmission.id} - 已批改: ${hasGrading}`);

      if (hasGrading) {
        // ✅ 已批改：舊版本保留，新提交作為新版本
        const { data: allSubmissions } = await supabase
          .from('submissions')
          .select('version_number')
          .eq('assignment_id', assignmentId)
          .eq('student_id', studentId)
          .order('version_number', { ascending: false })
          .limit(1);

        const nextVersion = (allSubmissions?.[0]?.version_number || 0) + 1;
        console.log(`建立新版本: ${nextVersion}`);

        const { data, error } = await supabase
          .from('submissions')
          .insert({
            assignment_id: assignmentId,
            student_id: studentId,
            file_url: `/uploads/${filename}`,
            file_name: originalFileName,
            version_number: nextVersion,
            is_latest: true
          })
          .select();

        if (error) throw error;

        onRevisionCount(studentId, assignmentId).catch((e) => console.error('勤奮勳章檢查失敗:', e));

        // 舊提交標記為非最新
        await supabase
          .from('submissions')
          .update({ is_latest: false })
          .eq('id', latestSubmission.id);

        return res.status(201).json({
          ...data[0],
          previous_submission_id: latestSubmission.id
        });
      } else {
        // ❌ 未批改：直接覆蓋舊版本（保留相同的 version_number）
        console.log(`覆蓋未批改版本: ${latestSubmission.version_number}`);
        
        await supabase
          .from('submissions')
          .update({
            file_url: `/uploads/${filename}`,
            file_name: originalFileName,
            submitted_at: new Date().toISOString()
          })
          .eq('id', latestSubmission.id);

        const { data } = await supabase
          .from('submissions')
          .select('*')
          .eq('id', latestSubmission.id)
          .single();

        return res.json({
          ...data,
          previous_submission_id: latestSubmission.id
        });
      }
    }

    // 第一次提交
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        file_url: `/uploads/${filename}`,
        file_name: originalFileName,
        version_number: 1,
        is_latest: true
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('提交錯誤:', error);
    res.status(400).json({ error: error.message });
  }
});

// 學生提交填空題作業
router.post('/assignments/:assignmentId/form-submit', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.userId;
    const { answers } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'answers 格式錯誤' });
    }

    const { data: questions, error: questionError } = await supabase
      .from('assignment_questions')
      .select('id, title, required')
      .eq('assignment_id', assignmentId)
      .order('question_number', { ascending: true });
    if (questionError) throw questionError;

    const missingRequired = (questions || []).find((q) => {
      if (!q.required) return false;
      const raw = answers[String(q.id)];
      return raw === undefined || raw === null || String(raw).trim() === '';
    });
    if (missingRequired) {
      return res.status(400).json({ error: `請填寫必答題：${missingRequired.title}` });
    }

    const { data: latestRows, error: latestError } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .eq('is_latest', true)
      .order('submitted_at', { ascending: false })
      .limit(1);
    if (latestError) throw latestError;

    if (latestRows.length > 0) {
      const latest = latestRows[0];

      const { data: latestLinkedSubmission } = await supabase
        .from('submissions')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .eq('version_number', latest.version_number)
        .eq('is_latest', true)
        .limit(1);

      let hasGrading = false;
      if (latestLinkedSubmission && latestLinkedSubmission.length > 0) {
        const { data: feedbackRows } = await supabase
          .from('feedback')
          .select('id')
          .eq('submission_id', latestLinkedSubmission[0].id)
          .limit(1);
        hasGrading = !!(feedbackRows && feedbackRows.length > 0);
      }

      if (hasGrading) {
        const { data: maxRows } = await supabase
          .from('form_submissions')
          .select('version_number')
          .eq('assignment_id', assignmentId)
          .eq('student_id', studentId)
          .order('version_number', { ascending: false })
          .limit(1);
        const nextVersion = (maxRows?.[0]?.version_number || 0) + 1;

        const { data, error } = await supabase
          .from('form_submissions')
          .insert({
            assignment_id: assignmentId,
            student_id: studentId,
            answers,
            version_number: nextVersion,
            is_latest: true
          })
          .select();
        if (error) throw error;

        await supabase
          .from('form_submissions')
          .update({ is_latest: false })
          .eq('id', latest.id);

        // 建立一筆 submissions 對應批改流程（只存文本題占位）
        await supabase
          .from('submissions')
          .update({ is_latest: false })
          .eq('assignment_id', assignmentId)
          .eq('student_id', studentId)
          .eq('is_latest', true);

        const { data: linkedSubmission } = await supabase
          .from('submissions')
          .insert({
            assignment_id: assignmentId,
            student_id: studentId,
            file_url: null,
            file_name: `form-v${nextVersion}.json`,
            version_number: nextVersion,
            is_latest: true
          })
          .select()
          .single();

        onRevisionCount(studentId, assignmentId).catch((e) => console.error('勤奮勳章檢查失敗:', e));

        return res.status(201).json({
          ...data[0],
          linked_submission_id: linkedSubmission?.id || null
        });
      }

      // 未批改，覆蓋同版本
      const { data, error } = await supabase
        .from('form_submissions')
        .update({
          answers,
          submitted_at: new Date().toISOString()
        })
        .eq('id', latest.id)
        .select()
        .single();
      if (error) throw error;
      return res.json(data);
    }

    // 第一次提交
    const { data, error } = await supabase
      .from('form_submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        answers,
        version_number: 1,
        is_latest: true
      })
      .select()
      .single();
    if (error) throw error;

    const { data: linkedSubmission } = await supabase
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        file_url: null,
        file_name: 'form-v1.json',
        version_number: 1,
        is_latest: true
      })
      .select()
      .single();

    res.status(201).json({
      ...data,
      linked_submission_id: linkedSubmission?.id || null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 獲取作業的所有提交（教師端）
router.get('/assignments/:assignmentId/submissions', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    
    // 確認是教師或管理員
    const { data: assignment } = await supabase
      .from('assignments')
      .select('created_by, course_id')
      .eq('id', assignmentId)
      .single();

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', assignment.course_id)
      .single();

    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { data, error } = await supabase
      .from('submissions')
      .select('*, users(full_name, email), feedback(*)')
      .eq('assignment_id', assignmentId)
      .eq('is_latest', true)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 學生查看自己的提交狀態
router.get('/assignments/:assignmentId/my-submission', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.userId;

    const { data, error } = await supabase
      .from('submissions')
      .select('*, feedback(*)')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .eq('is_latest', true)
      .order('version_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    res.json(data?.[0] || null);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 學生查看自己的完整提交歷程
router.get('/assignments/:assignmentId/my-submissions-history', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.userId;

    const { data, error } = await supabase
      .from('submissions')
      .select('*, feedback(*)')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .order('version_number', { ascending: false })
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 學生查看自己的填空題提交狀態（最新）
router.get('/assignments/:assignmentId/my-form-submission', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.userId;

    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .eq('is_latest', true)
      .order('version_number', { ascending: false })
      .limit(1);
    if (error) throw error;

    const latest = data?.[0];
    if (!latest) {
      return res.json(null);
    }

    const { data: linkedSubmission } = await supabase
      .from('submissions')
      .select('id, feedback(*)')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .eq('version_number', latest.version_number)
      .limit(1);

    res.json({
      ...latest,
      linked_submission_id: linkedSubmission?.[0]?.id || null,
      feedback: linkedSubmission?.[0]?.feedback || []
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 學生查看自己的填空題完整歷程
router.get('/assignments/:assignmentId/my-form-submissions-history', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.userId;

    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .order('version_number', { ascending: false })
      .order('submitted_at', { ascending: false });
    if (error) throw error;

    const historyWithFeedback = await Promise.all(
      (data || []).map(async (row) => {
        const { data: linkedSubmission } = await supabase
          .from('submissions')
          .select('id, feedback(*)')
          .eq('assignment_id', assignmentId)
          .eq('student_id', studentId)
          .eq('version_number', row.version_number)
          .limit(1);
        return {
          ...row,
          linked_submission_id: linkedSubmission?.[0]?.id || null,
          feedback: linkedSubmission?.[0]?.feedback || []
        };
      })
    );

    res.json(historyWithFeedback);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 教師查看填空題作業最新提交
router.get('/assignments/:assignmentId/form-submissions', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', assignmentId)
      .single();
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', assignment.course_id)
      .single();
    if (course?.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { data, error } = await supabase
      .from('form_submissions')
      .select('*, users(full_name, email)')
      .eq('assignment_id', assignmentId)
      .eq('is_latest', true)
      .order('submitted_at', { ascending: false });
    if (error) throw error;

    const submissionsWithFeedback = await Promise.all(
      (data || []).map(async (row) => {
        const { data: linkedSubmission } = await supabase
          .from('submissions')
          .select('id, feedback(*)')
          .eq('assignment_id', assignmentId)
          .eq('student_id', row.student_id)
          .eq('version_number', row.version_number)
          .limit(1);
        const resolved_answers = await resolveFormAnswers(assignmentId, row.answers);
        return {
          ...row,
          linked_submission_id: linkedSubmission?.[0]?.id || null,
          feedback: linkedSubmission?.[0]?.feedback || [],
          resolved_answers
        };
      })
    );

    res.json(submissionsWithFeedback);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 教師查看指定學生的填空題歷程
router.get('/assignments/:assignmentId/students/:studentId/form-submissions-history', authenticateToken, async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;

    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', assignmentId)
      .single();
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', assignment.course_id)
      .single();
    if (course?.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .order('version_number', { ascending: false })
      .order('submitted_at', { ascending: false });
    if (error) throw error;

    const historyWithFeedback = await Promise.all(
      (data || []).map(async (row) => {
        const { data: linkedSubmission } = await supabase
          .from('submissions')
          .select('id, feedback(*)')
          .eq('assignment_id', assignmentId)
          .eq('student_id', studentId)
          .eq('version_number', row.version_number)
          .limit(1);
        const resolved_answers = await resolveFormAnswers(assignmentId, row.answers);
        return {
          ...row,
          linked_submission_id: linkedSubmission?.[0]?.id || null,
          feedback: linkedSubmission?.[0]?.feedback || [],
          resolved_answers
        };
      })
    );

    res.json(historyWithFeedback);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 教師/管理員查看單筆提交詳情（批改頁使用）；學員可觀摩優秀作品
router.get('/submissions/:submissionId', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;

    const { data: submission, error } = await supabase
      .from('submissions')
      .select('*, users(full_name, email, display_name), assignments(id, title, course_id, assignment_type), feedback(*)')
      .eq('id', submissionId)
      .single();

    if (error) throw error;

    if (!submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    // 權限：學員只能看自己的提交，或標記為優秀的作品（觀摩用）
    if (req.user.role === 'student') {
      if (submission.student_id !== req.user.userId && !submission.is_featured) {
        return res.status(403).json({ error: '無權限' });
      }
      if (submission.student_id === req.user.userId) {
        return res.json(submission);
      }
      // 學員觀摩他人優秀作品，繼續往下取得 form 作答內容
    }

    const courseId = submission.assignments?.course_id;
    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', courseId)
      .single();

    if (course?.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    let form_submission = null;
    let resolved_answers = [];
    if (submission.assignments?.id) {
      const { data: assignmentMeta } = await supabase
        .from('assignments')
        .select('assignment_type')
        .eq('id', submission.assignments.id)
        .single();

      if (assignmentMeta?.assignment_type === 'form') {
        const { data: formSubmission } = await supabase
          .from('form_submissions')
          .select('*')
          .eq('assignment_id', submission.assignment_id)
          .eq('student_id', submission.student_id)
          .eq('version_number', submission.version_number)
          .limit(1)
          .maybeSingle();

        if (formSubmission) {
          form_submission = formSubmission;
          resolved_answers = await resolveFormAnswers(submission.assignment_id, formSubmission.answers);
        }
      }
    }

    res.json({
      ...submission,
      form_submission,
      resolved_answers
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 教師查看同一學生在同一作業的完整版本歷程
router.get('/assignments/:assignmentId/students/:studentId/submissions-history', authenticateToken, async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;

    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', assignmentId)
      .single();

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', assignment.course_id)
      .single();

    if (course?.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { data, error } = await supabase
      .from('submissions')
      .select('*, feedback(*)')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .order('version_number', { ascending: false })
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ 批改與回饋 ============

// 添加回饋與評分
router.post('/submissions/:submissionId/feedback', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { comment, grade } = req.body;

    if (!grade || !['建議需調整', '合格', '優秀'].includes(grade)) {
      return res.status(400).json({ error: '評分等級無效' });
    }

    // 驗證教師身份並取得學員與作業
    const { data: submission } = await supabase
      .from('submissions')
      .select('assignment_id, student_id')
      .eq('id', submissionId)
      .single();

    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', submission.assignment_id)
      .single();

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', assignment.course_id)
      .single();

    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    let feedbackFileUrl = null;
    let feedbackImageUrl = null;

    // 如果有上傳反饋檔案
    if (req.file) {
      const uploadsPath = path.join(__dirname, '../public/uploads');
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(req.file.originalname).toLowerCase();
      const filename = uniqueSuffix + ext;
      const filepath = path.join(uploadsPath, filename);

      fs.writeFileSync(filepath, req.file.buffer);

      // 判斷是圖片還是檔案
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        feedbackImageUrl = `/uploads/${filename}`;
      } else {
        feedbackFileUrl = `/uploads/${filename}`;
      }
    }

    const { data, error } = await supabase
      .from('feedback')
      .insert({
        submission_id: submissionId,
        instructor_id: req.user.userId,
        comment: comment || null,
        grade,
        feedback_file_url: feedbackFileUrl,
        feedback_image_url: feedbackImageUrl
      })
      .select();

    if (error) throw error;

    try {
      await awardAssignmentExp(submission.student_id, submission.assignment_id, grade);
    } catch (expErr) {
      console.error('經驗值發放失敗（不影響批改）:', expErr);
    }
    try {
      if (grade === '優秀') await onExcellentGrade(submission.student_id);
      await onExpChanged(submission.student_id);
    } catch (badgeErr) {
      console.error('徽章檢查失敗:', badgeErr);
    }

    // 先回傳，避免 SMTP 延遲導致 proxy timeout（5s）觸發前端「提交失敗」
    res.status(201).json(data[0]);

    // 寄信通知學員（非同步，不阻塞回應）
    (async () => {
      try {
        const ok = await shouldSendNotification(supabase, submission.student_id, 'graded');
        if (!ok) return;
        const { data: student } = await supabase
          .from('users')
          .select('email, display_name, real_name')
          .eq('id', submission.student_id)
          .single();
        const { data: asg } = await supabase
          .from('assignments')
          .select('title')
          .eq('id', submission.assignment_id)
          .single();
        if (student?.email && asg?.title) {
          await sendSubmissionGradedEmail(
            student.email,
            student.display_name || student.real_name || '學員',
            asg.title,
            grade,
            submissionId
          );
        }
      } catch (emailErr) {
        console.error('批改完成通知信寄送失敗（不影響批改）:', emailErr);
      }
    })();
  } catch (error) {
    console.error('回饋錯誤:', error);
    res.status(400).json({ error: error.message });
  }
});

// 獲取提交的所有回饋記錄
router.get('/submissions/:submissionId/feedback-history', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;

    // 先驗證提交是否存在且取得提交者資訊
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('student_id, assignment_id')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    // 檢查權限：提交學生、教師或管理員
    const isStudent = submission.student_id === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    
    if (!isStudent && !isAdmin) {
      // 檢查是否為該作業的教師
      const { data: assignment } = await supabase
        .from('assignments')
        .select('created_by')
        .eq('id', submission.assignment_id)
        .single();
      
      const isTeacher = assignment?.created_by === req.user.userId;
      if (!isTeacher) {
        return res.status(403).json({ error: '無權訪問此批改記錄' });
      }
    }

    const { data, error } = await supabase
      .from('feedback')
      .select('*, users(full_name)')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ 統計相關 ============

// 獲取作業統計（教師端）
router.get('/assignments/:assignmentId/statistics', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // 驗證教師身份
    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', assignmentId)
      .single();

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', assignment.course_id)
      .single();

    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    // 檢查是否有指定學生
    const { data: designations } = await supabase
      .from('assignment_designations')
      .select('student_id')
      .eq('assignment_id', assignmentId);

    let totalStudents = 0;
    if (designations && designations.length > 0) {
      // 有指定學生，則只計被指定的學生
      totalStudents = designations.length;
    } else {
      // 沒有指定學生，則計該課程的全部註冊學生
      const { data: enrolledStudents } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .eq('course_id', assignment.course_id);
      totalStudents = enrolledStudents?.length || 0;
    }

    // 獲取有效提交（is_latest = true）
    const { data: submissions } = await supabase
      .from('submissions')
      .select('*, feedback(*)')
      .eq('assignment_id', assignmentId)
      .eq('is_latest', true);

    // 統計各狀態
    const stats = {
      total: totalStudents,
      submitted: submissions?.length || 0,
      graded: 0,
      needs_revision: 0,
      pass: 0,
      excellent: 0,
      not_submitted: totalStudents - (submissions?.length || 0)
    };

    // 按等級統計
    submissions?.forEach(sub => {
      if (sub.feedback && sub.feedback.length > 0) {
        const latestFeedback = sub.feedback[sub.feedback.length - 1];
        stats.graded++;

        switch (latestFeedback.grade) {
          case '建議需調整':
            stats.needs_revision++;
            break;
          case '合格':
            stats.pass++;
            break;
          case '優秀':
            stats.excellent++;
            break;
        }
      }
    });

    res.json(stats);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 獲取統計分類的詳細提交
router.get('/assignments/:assignmentId/submissions-by-status/:status', authenticateToken, async (req, res) => {
  try {
    const { assignmentId, status } = req.params;

    // 驗證教師身份
    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', assignmentId)
      .single();

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', assignment.course_id)
      .single();

    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    let query = supabase
      .from('submissions')
      .select('*, users(full_name, email), feedback(*)')
      .eq('assignment_id', assignmentId)
      .eq('is_latest', true);

    if (status === 'not_submitted') {
      // 獲取未提交的學生（需要反向查詢）
      const { data: submitted } = await supabase
        .from('submissions')
        .select('student_id')
        .eq('assignment_id', assignmentId)
        .eq('is_latest', true);

      const submittedIds = submitted?.map(s => s.student_id) || [];

      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'student')
        .filter('id', 'not.in', submittedIds ? `(${submittedIds.join(',')})` : '(null)');

      if (error) throw error;
      return res.json(data?.map(u => ({ ...u, status: 'not_submitted' })) || []);
    } else if (status === 'not_graded') {
      query = query.filter('feedback', 'is', null);
    } else {
      // 已批改的按等級篩選
      query = query.filter('feedback', 'neq', null);
    }

    const { data, error } = await query.order('submitted_at', { ascending: false });
    
    if (error) throw error;

    // 過濾已批改的提交
    const filtered = data?.filter(sub => {
      if (status === 'not_graded') {
        return !sub.feedback || sub.feedback.length === 0;
      } else if (status === 'excellent') {
        return sub.feedback?.some(f => f.grade === '優秀');
      } else if (status === 'pass') {
        return sub.feedback?.some(f => f.grade === '合格');
      } else if (status === 'needs_revision') {
        return sub.feedback?.some(f => f.grade === '建議需調整');
      }
      return true;
    }) || [];

    res.json(filtered);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ 下載相關 ============

router.get('/form-submissions/:formSubmissionId/export/pdf', async (req, res) => {
  try {
    const { formSubmissionId } = req.params;
    const { data: formSubmission, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('id', formSubmissionId)
      .single();
    if (error) throw error;
    if (!formSubmission) return res.status(404).json({ error: '填空提交不存在' });

    const { data: assignment } = await supabase
      .from('assignments')
      .select('title, course_id')
      .eq('id', formSubmission.assignment_id)
      .single();

    const resolved = await resolveFormAnswers(formSubmission.assignment_id, formSubmission.answers);

    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const filename = `form-submission-v${formSubmission.version_number}.pdf`;
    const fontPath = getPdfFontPath();
    if (fontPath) {
      try {
        doc.registerFont('CJK', fontPath);
        doc.font('CJK');
      } catch (fontError) {
        console.warn('PDF 字型載入失敗，改用預設字型:', fontError.message);
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    doc.on('error', (streamError) => {
      console.error('PDF 串流錯誤:', streamError);
      try {
        if (!res.writableEnded) res.end();
      } catch {
        // ignore
      }
    });
    doc.pipe(res);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colA = Math.floor(pageWidth * 0.22);
    const colB = pageWidth - colA;
    let cursorY = doc.page.margins.top;
    const startX = doc.page.margins.left;

    const drawRow = (label, value) => {
      const safeValue = value || '';
      const rowPadding = 6;
      const labelHeight = doc.heightOfString(label, { width: colA - rowPadding * 2 });
      const valueHeight = doc.heightOfString(safeValue, { width: colB - rowPadding * 2 });
      const rowHeight = Math.max(labelHeight, valueHeight) + rowPadding * 2;

      if (cursorY + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
        if (fontPath) {
          try {
            doc.font('CJK');
          } catch {
            // ignore font errors on new page
          }
        }
        cursorY = doc.page.margins.top;
      }

      doc.rect(startX, cursorY, colA, rowHeight).stroke();
      doc.rect(startX + colA, cursorY, colB, rowHeight).stroke();
      doc.fontSize(11).text(label, startX + rowPadding, cursorY + rowPadding, {
        width: colA - rowPadding * 2
      });
      doc.fontSize(11).text(safeValue, startX + colA + rowPadding, cursorY + rowPadding, {
        width: colB - rowPadding * 2
      });
      cursorY += rowHeight;
    };

    drawRow('標題', assignment?.title || formSubmission.assignment_id);
    drawRow('版本', String(formSubmission.version_number));
    drawRow('提交時間', new Date(formSubmission.submitted_at).toISOString());
    resolved.forEach((row) => {
      drawRow(`題目${row.question_number}名稱`, row.title);
      drawRow(`題目${row.question_number}描述`, row.description || '(無)');
      drawRow(`題目${row.question_number}答案`, row.answer || '(空白)');
    });

    doc.end();
  } catch (error) {
    console.error('PDF 匯出錯誤:', error);
    if (res.headersSent) return;
    res.status(400).json({ error: error.message });
  }
});

router.get('/form-submissions/:formSubmissionId/export/excel', async (req, res) => {
  try {
    const { formSubmissionId } = req.params;
    const { data: formSubmission, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('id', formSubmissionId)
      .single();
    if (error) throw error;
    if (!formSubmission) return res.status(404).json({ error: '填空提交不存在' });

    const { data: assignment } = await supabase
      .from('assignments')
      .select('title, course_id')
      .eq('id', formSubmission.assignment_id)
      .single();

    const resolved = await resolveFormAnswers(formSubmission.assignment_id, formSubmission.answers);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('submission');
    sheet.columns = [
      { header: '欄位', key: 'field', width: 30 },
      { header: '內容', key: 'value', width: 100 }
    ];
    sheet.addRow({ field: '標題', value: assignment?.title || formSubmission.assignment_id });
    sheet.addRow({ field: '版本', value: String(formSubmission.version_number) });
    sheet.addRow({ field: '提交時間', value: new Date(formSubmission.submitted_at).toISOString() });
    resolved.forEach((row) => {
      sheet.addRow({ field: `題目${row.question_number}名稱`, value: row.title });
      sheet.addRow({ field: `題目${row.question_number}描述`, value: row.description || '(無)' });
      sheet.addRow({ field: `題目${row.question_number}答案`, value: row.answer || '(空白)' });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.eachRow((r) => {
      r.alignment = { vertical: 'top', wrapText: true };
    });

    const filename = `form-submission-v${formSubmission.version_number}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel 匯出錯誤:', error);
    if (res.headersSent) {
      try {
        res.end();
      } catch {
        // ignore
      }
      return;
    }
    res.status(400).json({ error: error.message });
  }
});

// 下載學生提交的作業（需為該學員本人或該課程教師）
router.get('/submissions/:submissionId/download', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;

    const { data: submission } = await supabase
      .from('submissions')
      .select('file_url, file_name, student_id, assignment_id')
      .eq('id', submissionId)
      .single();

    if (!submission) return res.status(404).json({ error: '提交不存在' });

    const isStudent = submission.student_id === req.user.userId;
    if (!isStudent) {
      const { data: assignment } = await supabase.from('assignments').select('course_id, created_by').eq('id', submission.assignment_id).single();
      const { data: course } = await supabase.from('courses').select('instructor_id').eq('id', assignment?.course_id).single();
      const isInstructor = course?.instructor_id === req.user.userId || assignment?.created_by === req.user.userId;
      const isAdmin = req.user.role === 'admin';
      if (!isInstructor && !isAdmin) return res.status(403).json({ error: '無權限下載' });
    }

    const filename = submission.file_url.split('/').pop();
    const filepath = path.join(__dirname, '../public/uploads', filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: '檔案不存在或已被刪除' });
    }

    const downloadFilename = submission.file_name || `submission-${submissionId}`;
    // Windows 和 Chrome 相容的中文檔名編碼
    // 用 RFC 2231 格式：filename*=charset'lang'encoded-value
    const encoded = encodeURI(downloadFilename);  // 使用 encodeURI 而不是 encodeURIComponent
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    res.setHeader('Content-Type', 'application/octet-stream');  // 確保瀏覽器下載而非預覽
    res.sendFile(filepath);
  } catch (error) {
    console.error('下載錯誤:', error);
    res.status(400).json({ error: error.message });
  }
});

// 下載批改回饋檔案（需為該提交的學員或該課程教師）
router.get('/feedback/:feedbackId/download', authenticateToken, async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const { data: feedback } = await supabase
      .from('feedback')
      .select('feedback_file_url, feedback_image_url, submission_id')
      .eq('id', feedbackId)
      .single();

    if (!feedback || (!feedback.feedback_file_url && !feedback.feedback_image_url)) {
      return res.status(404).json({ error: '檔案不存在' });
    }

    const { data: submission } = await supabase.from('submissions').select('student_id, assignment_id').eq('id', feedback.submission_id).single();
    const isStudent = submission?.student_id === req.user.userId;
    if (!isStudent) {
      const { data: assignment } = await supabase.from('assignments').select('course_id, created_by').eq('id', submission?.assignment_id).single();
      const { data: course } = await supabase.from('courses').select('instructor_id').eq('id', assignment?.course_id).single();
      const isInstructor = course?.instructor_id === req.user.userId || assignment?.created_by === req.user.userId;
      const isAdmin = req.user.role === 'admin';
      if (!isInstructor && !isAdmin) return res.status(403).json({ error: '無權限下載' });
    }

    const fileUrl = feedback.feedback_file_url || feedback.feedback_image_url;
    const filename = fileUrl.split('/').pop();
    const filepath = path.join(__dirname, '../public/uploads', filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: '檔案不存在或已被刪除' });
    }

    // Windows 和 Chrome 相容的中文檔名編碼
    const encoded = encodeURI(filename);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(filepath);
  } catch (error) {
    console.error('下載錯誤:', error);
    res.status(400).json({ error: error.message });
  }
});

// [DEBUG] 檢查指定提交的檔名儲存狀態
router.get('/submissions/:submissionId/debug', async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { data: submission } = await supabase
      .from('submissions')
      .select('id, file_name, file_url')
      .eq('id', submissionId)
      .single();
    
    res.json({
      submissionId,
      file_name: submission?.file_name,
      file_name_length: submission?.file_name?.length,
      file_name_hex: submission?.file_name ? Buffer.from(submission.file_name).toString('hex') : null,
      file_url: submission?.file_url
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 檢查學生是否被指定該作業
router.get('/assignments/:assignmentId/is-designated', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.userId;

    // 先檢查是否有指定任何學生
    const { data: designations } = await supabase
      .from('assignment_designations')
      .select('student_id')
      .eq('assignment_id', assignmentId);

    // 如果沒有指定任何學生，表示對全班開放
    if (!designations || designations.length === 0) {
      return res.json({ isDesignated: true });
    }

    // 如果有指定，檢查該學生是否在列表中
    const isDesignated = designations.some(d => d.student_id === studentId);
    res.json({ isDesignated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 獲取作業的指定學生清單
router.get('/assignments/:assignmentId/designations', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // 驗證教師權限
    const { data: assignment } = await supabase
      .from('assignments')
      .select('created_by, course_id')
      .eq('id', assignmentId)
      .single();

    const { data: course } = await supabase
      .from('courses')
      .select('instructor_id')
      .eq('id', assignment.course_id)
      .single();

    if (course.instructor_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { data, error } = await supabase
      .from('assignment_designations')
      .select('*')
      .eq('assignment_id', assignmentId);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ 優秀作品系統 ============

// 標記/取消標記優秀作品
router.patch('/submissions/:submissionId/featured', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { isFeatured } = req.body;

    // 查詢提交並驗證權限
    const { data: submission } = await supabase
      .from('submissions')
      .select('id, assignment_id, student_id')
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    // 查詢作業以確認是否是教師
    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id, created_by')
      .eq('id', submission.assignment_id)
      .single();

    if (!assignment || (assignment.created_by !== req.user.userId && req.user.role !== 'admin')) {
      return res.status(403).json({ error: '無權限' });
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({
        is_featured: isFeatured,
        featured_at: isFeatured ? new Date().toISOString() : null
      })
      .eq('id', submissionId)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('標記優秀作品失敗:', error);
    res.status(400).json({ error: error.message });
  }
});

// 取得課程的優秀作品列表（填空題含作答內容供學員觀摩）
router.get('/courses/:courseId/featured-submissions', async (req, res) => {
  try {
    const { courseId } = req.params;

    const { data: rows, error } = await supabase
      .from('submissions')
      .select(`
        id,
        file_name,
        file_url,
        version_number,
        submitted_at,
        is_latest,
        is_featured,
        featured_at,
        student_id,
        assignment_id,
        users:student_id (id, display_name, email),
        assignments:assignment_id (id, title, description, assignment_type)
      `)
      .eq('assignments.course_id', courseId)
      .eq('is_featured', true)
      .order('featured_at', { ascending: false })
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    const result = await Promise.all(
      (rows || []).map(async (sub) => {
        if (sub.assignments?.assignment_type !== 'form') return sub;
        const { data: formSub } = await supabase
          .from('form_submissions')
          .select('answers')
          .eq('assignment_id', sub.assignment_id)
          .eq('student_id', sub.student_id)
          .eq('version_number', sub.version_number)
          .maybeSingle();
        const resolved_answers = formSub
          ? await resolveFormAnswers(sub.assignment_id, formSub.answers)
          : [];
        return { ...sub, resolved_answers };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('取得優秀作品失敗:', error);
    res.status(400).json({ error: error.message });
  }
});

// 新增優秀作品批註
router.post('/submissions/:submissionId/featured-notes', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '批註內容不能為空' });
    }

    // 查詢提交並驗證
    const { data: submission } = await supabase
      .from('submissions')
      .select('id, assignment_id')
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return res.status(404).json({ error: '提交不存在' });
    }

    // 查詢作業以確認是否是教師
    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id, created_by')
      .eq('id', submission.assignment_id)
      .single();

    if (!assignment || (assignment.created_by !== req.user.userId && req.user.role !== 'admin')) {
      return res.status(403).json({ error: '無權限' });
    }

    const { data, error } = await supabase
      .from('featured_notes')
      .insert({
        submission_id: submissionId,
        teacher_id: req.user.userId,
        content: content.trim()
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('新增批註失敗:', error);
    res.status(400).json({ error: error.message });
  }
});

// 取得優秀作品的批註
router.get('/submissions/:submissionId/featured-notes', async (req, res) => {
  try {
    const { submissionId } = req.params;

    const { data, error } = await supabase
      .from('featured_notes')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        users:teacher_id (id, display_name, email)
      `)
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('取得批註失敗:', error);
    res.status(400).json({ error: error.message });
  }
});

// 編輯優秀作品批註
router.patch('/featured-notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const { noteId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: '批註內容不能為空' });
    }

    // 查詢批註並驗證權限
    const { data: note } = await supabase
      .from('featured_notes')
      .select('id, teacher_id')
      .eq('id', noteId)
      .single();

    if (!note) {
      return res.status(404).json({ error: '批註不存在' });
    }

    if (note.teacher_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { data, error } = await supabase
      .from('featured_notes')
      .update({ content: content.trim() })
      .eq('id', noteId)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('編輯批註失敗:', error);
    res.status(400).json({ error: error.message });
  }
});

// 刪除優秀作品批註
router.delete('/featured-notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const { noteId } = req.params;

    // 查詢批註並驗證權限
    const { data: note } = await supabase
      .from('featured_notes')
      .select('id, teacher_id')
      .eq('id', noteId)
      .single();

    if (!note) {
      return res.status(404).json({ error: '批註不存在' });
    }

    if (note.teacher_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: '無權限' });
    }

    const { error } = await supabase
      .from('featured_notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;
    res.json({ message: '批註已刪除' });
  } catch (error) {
    console.error('刪除批註失敗:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
