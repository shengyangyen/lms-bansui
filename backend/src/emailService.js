import nodemailer from 'nodemailer';

let transporter = null;

const DEFAULT_PREFS = { graded: true, material: true, assignment: true, enrolled: true };

/** 檢查使用者是否要收該類別通知（需傳入 supabase client） */
export async function shouldSendNotification(supabase, userId, type) {
  try {
    const { data } = await supabase.from('users').select('notification_preferences').eq('id', userId).single();
    const prefs = data?.notification_preferences || DEFAULT_PREFS;
    return prefs[type] !== false;
  } catch {
    return true;
  }
}

export function initializeEmailService() {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // 587 uses STARTTLS
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    }
  });
}

export async function sendEmailVerification(email, token) {
  if (!transporter) return;
  
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: email,
    subject: '驗證您的電郵地址',
    html: `
      <h2>歡迎註冊！</h2>
      <p>請點擊以下連結驗證您的電郵：</p>
      <a href="${verificationLink}" style="display:inline-block; background:blue; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">
        驗證電郵
      </a>
      <p style="font-size:12px; color:#666;">連結 24 小時內有效</p>
    `
  });
}

export async function sendAccountApprovalEmail(email, displayName, role) {
  if (!transporter) return;
  
  const loginLink = `${process.env.FRONTEND_URL}/login`;
  
  const roleDisplay = {
    'admin': '管理者',
    'instructor': '導師',
    'flight_instructor': '飛行導師',
    'trainee': '伴飛學員',
    'study_buddy': '共學之友',
    'student': '學員'
  }[role] || role;
  
  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: email,
    subject: '帳號已批准！',
    html: `
      <h2>恭喜 ${displayName}！</h2>
      <p>您的帳號已通過審核，角色為：<strong>${roleDisplay}</strong></p>
      <p>現在您可以登入系統：</p>
      <a href="${loginLink}" style="display:inline-block; background:green; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">
        前往登入
      </a>
    `
  });
}

export async function sendAccountRejectionEmail(email, displayName, reason) {
  if (!transporter) return;
  
  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: email,
    subject: '帳號申請結果',
    html: `
      <h2>${displayName}，您好</h2>
      <p>很遺憾，您的帳號申請未被通過。</p>
      <p><strong>原因：</strong>${reason || '（未提供）'}</p>
      <p>如有疑問，請聯絡我們。</p>
    `
  });
}

export async function sendAdminNotificationEmail(adminEmail, username, email) {
  if (!transporter) return;
  
  const reviewLink = `${process.env.FRONTEND_URL}/admin`;
  
  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: adminEmail,
    subject: '新用戶待審核',
    html: `
      <h2>有新用戶等待審核</h2>
      <p><strong>用戶名：</strong>${username}</p>
      <p><strong>信箱：</strong>${email}</p>
      <p><a href="${reviewLink}">前往審核</a></p>
    `
  });
}

/**
 * 作業批改完成時通知學員
 * @param {string} studentEmail - 學員信箱
 * @param {string} studentName - 學員顯示名稱
 * @param {string} assignmentTitle - 作業標題
 * @param {string} grade - 評分（建議需調整 / 合格 / 優秀）
 * @param {string} submissionId - 提交 ID，用於產生查看連結
 */
export async function sendSubmissionGradedEmail(studentEmail, studentName, assignmentTitle, grade, submissionId) {
  if (!transporter || !studentEmail) return;

  const feedbackLink = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/assignment-feedback/${submissionId}`
    : null;

  const gradeColor = grade === '優秀' ? '#22c55e' : grade === '合格' ? '#3b82f6' : '#f59e0b';

  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: studentEmail,
    subject: `【伴飛計畫】作業已批改：${assignmentTitle}`,
    html: `
      <h2>${studentName}，您好</h2>
      <p>您的作業 <strong>${assignmentTitle}</strong> 已完成批改。</p>
      <p>評分：<strong style="color:${gradeColor}">${grade}</strong></p>
      ${feedbackLink ? `<p><a href="${feedbackLink}" style="display:inline-block; background:#609ea3; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">查看批改內容</a></p>` : ''}
      <p style="font-size:12px; color:#666;">伴飛計畫 2026</p>
    `
  });
}

/**
 * 教材上線時通知學員
 */
export async function sendMaterialPublishedEmail(studentEmail, studentName, courseTitle, materialTitle, courseId) {
  if (!transporter || !studentEmail) return;
  const courseLink = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/course/${courseId}`
    : null;
  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: studentEmail,
    subject: `【伴飛計畫】新教材上線：${courseTitle} - ${materialTitle}`,
    html: `
      <h2>${studentName}，您好</h2>
      <p>課程 <strong>${courseTitle}</strong> 有新教材上線：<strong>${materialTitle}</strong></p>
      ${courseLink ? `<p><a href="${courseLink}" style="display:inline-block; background:#609ea3; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">前往課程</a></p>` : ''}
      <p style="font-size:12px; color:#666;">伴飛計畫 2026</p>
    `
  });
}

/**
 * 作業上線時通知學員
 */
export async function sendAssignmentPublishedEmail(studentEmail, studentName, courseTitle, assignmentTitle, assignmentId) {
  if (!transporter || !studentEmail) return;
  const submitLink = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/assignments/${assignmentId}/submit`
    : null;
  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: studentEmail,
    subject: `【伴飛計畫】新作業上線：${assignmentTitle}`,
    html: `
      <h2>${studentName}，您好</h2>
      <p>課程 <strong>${courseTitle}</strong> 有新作業：<strong>${assignmentTitle}</strong></p>
      ${submitLink ? `<p><a href="${submitLink}" style="display:inline-block; background:#609ea3; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">前往提交</a></p>` : ''}
      <p style="font-size:12px; color:#666;">伴飛計畫 2026</p>
    `
  });
}

/**
 * 學員被加入課程時通知
 */
export async function sendCourseEnrolledEmail(studentEmail, studentName, courseTitle, courseId) {
  if (!transporter || !studentEmail) return;
  const courseLink = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/course/${courseId}`
    : null;
  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: studentEmail,
    subject: `【伴飛計畫】您已加入課程：${courseTitle}`,
    html: `
      <h2>${studentName}，您好</h2>
      <p>您已加入課程 <strong>${courseTitle}</strong>，可以開始學習了。</p>
      ${courseLink ? `<p><a href="${courseLink}" style="display:inline-block; background:#609ea3; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">前往課程</a></p>` : ''}
      <p style="font-size:12px; color:#666;">伴飛計畫 2026</p>
    `
  });
}
