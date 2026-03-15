/**
 * 激勵系統 - 經驗值與等級
 * 評比對應：建議需調整=20, 合格=60, 優秀=75
 */

let supabase;

const GRADE_TO_EXP = {
  '建議需調整': 20,
  '合格': 60,
  '優秀': 75
};

const EXP_PER_LEVEL = 100;

export function initializeExperienceService(supabaseClient) {
  supabase = supabaseClient;
}

/**
 * 計算等級與當前經驗進度
 * totalExp: 總經驗值
 * 回傳 { level, currentExp, expToNextLevel }
 */
export function calcLevel(totalExp) {
  const level = Math.floor(totalExp / EXP_PER_LEVEL) + 1;
  const currentExp = totalExp % EXP_PER_LEVEL; // 當前等級內的經驗
  const expToNextLevel = EXP_PER_LEVEL - currentExp;
  return { level, currentExp, expToNextLevel, totalExp };
}

/**
 * 作業批改後發放經驗值
 * 同一作業只取最高，若新評比更高則補差額
 */
export async function awardAssignmentExp(studentId, assignmentId, grade) {
  if (!supabase) throw new Error('Experience service not initialized');
  const expAmount = GRADE_TO_EXP[grade];
  if (expAmount == null) return { added: 0 };

  const { data: existing } = await supabase
    .from('experience_logs')
    .select('id, exp_amount')
    .eq('user_id', studentId)
    .eq('source_type', 'assignment')
    .eq('source_id', assignmentId)
    .maybeSingle();

  let added = 0;
  if (!existing) {
    added = expAmount;
    await supabase.from('experience_logs').upsert({
      user_id: studentId,
      source_type: 'assignment',
      source_id: assignmentId,
      grade,
      exp_amount: expAmount
    }, { onConflict: 'user_id,source_type,source_id' });
  } else if (expAmount > existing.exp_amount) {
    added = expAmount - existing.exp_amount;
    await supabase.from('experience_logs').update({
      grade,
      exp_amount: expAmount
    }).eq('id', existing.id);
  }

  if (added > 0) {
    const { data: row } = await supabase
      .from('user_levels')
      .select('id, total_exp')
      .eq('user_id', studentId)
      .maybeSingle();

    const newTotal = (row?.total_exp || 0) + added;
    await supabase.from('user_levels').upsert({
      user_id: studentId,
      total_exp: newTotal,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  }

  return { added };
}

/**
 * 取得學員等級與經驗值
 */
export async function getUserLevel(userId) {
  if (!supabase) throw new Error('Experience service not initialized');
  const { data } = await supabase
    .from('user_levels')
    .select('total_exp')
    .eq('user_id', userId)
    .maybeSingle();
  const totalExp = data?.total_exp ?? 0;
  return { ...calcLevel(totalExp) };
}

/**
 * 管理員增加學員經驗值（只加不減）
 * @param {string} userId - 學員 ID
 * @param {number} addExp - 要增加的經驗值（正整數）
 */
export async function adminAddUserExp(userId, addExp) {
  if (!supabase) throw new Error('Experience service not initialized');
  const amount = Math.max(0, parseInt(addExp, 10) || 0);
  if (amount <= 0) return { added: 0, ...(await getUserLevel(userId)) };

  const { data: row, error: selectErr } = await supabase
    .from('user_levels')
    .select('id, total_exp')
    .eq('user_id', userId)
    .maybeSingle();
  if (selectErr) throw selectErr;

  const currentTotal = row?.total_exp ?? 0;
  const newTotal = currentTotal + amount;

  const { error: upsertErr } = await supabase
    .from('user_levels')
    .upsert({
      user_id: userId,
      total_exp: newTotal,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  if (upsertErr) throw upsertErr;

  return { added: amount, ...calcLevel(newTotal) };
}

/**
 * 管理員發送動態通知（可選加經驗值）
 */
export async function createActivityNotification(userId, message, addExp = 0, createdBy) {
  if (!supabase) throw new Error('Experience service not initialized');
  const expAmount = Math.max(0, parseInt(addExp, 10) || 0);

  const { data: notif, error } = await supabase
    .from('activity_notifications')
    .insert({
      user_id: userId,
      message,
      exp_amount: expAmount,
      created_by: createdBy || null
    })
    .select()
    .single();
  if (error) throw error;

  if (expAmount > 0) {
    const { data: row } = await supabase
      .from('user_levels')
      .select('id, total_exp')
      .eq('user_id', userId)
      .maybeSingle();
    const currentTotal = row?.total_exp ?? 0;
    const newTotal = currentTotal + expAmount;
    await supabase.from('user_levels').upsert({
      user_id: userId,
      total_exp: newTotal,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  }

  return { id: notif.id, message, exp_amount: expAmount };
}

/**
 * 群發動態通知（可選加經驗值）
 * @param {string[]} userIds - 學員 ID 陣列
 * @param {string} message - 通知內容
 * @param {number} addExp - 每人增加的經驗值
 * @param {string} createdBy - 發送者 ID
 * @returns {{ success: number, failed: number, results: Array }}
 */
export async function createActivityNotificationBulk(userIds, message, addExp = 0, createdBy) {
  if (!supabase) throw new Error('Experience service not initialized');
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { success: 0, failed: 0, results: [] };
  }
  const expAmount = Math.max(0, parseInt(addExp, 10) || 0);
  const results = [];
  let success = 0;
  let failed = 0;
  for (const userId of userIds) {
    try {
      const r = await createActivityNotification(userId, message, expAmount, createdBy);
      results.push({ userId, ...r });
      success++;
    } catch (err) {
      results.push({ userId, error: err.message });
      failed++;
    }
  }
  return { success, failed, results };
}

/**
 * 取得學員動態（含 experience_logs + activity_notifications，合併後依時間排序）
 */
async function fetchAllActivities(userId, limit = null) {
  const logsRes = await supabase.from('experience_logs')
    .select('id, source_type, source_id, grade, exp_amount, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const logs = logsRes.data || [];

  let notifs = [];
  try {
    const notifsRes = await supabase.from('activity_notifications')
      .select('id, message, exp_amount, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    notifs = notifsRes.data || [];
  } catch {
    // activity_notifications 表可能尚未建立
  }

  const assignmentIds = [...new Set(logs.filter(r => r.source_type === 'assignment').map(r => r.source_id))];
  let assignmentMap = {};
  if (assignmentIds.length > 0) {
    const { data: assignments } = await supabase.from('assignments').select('id, title').in('id', assignmentIds);
    assignmentMap = Object.fromEntries((assignments || []).map(a => [a.id, a.title]));
  }

  const items = [
    ...logs.map((row) => ({
      id: `log-${row.id}`,
      rowId: row.id,
      source: 'log',
      message: row.source_type === 'assignment'
        ? `完成作業《${assignmentMap[row.source_id] || '作業'}》獲得 ${row.exp_amount} 經驗值`
        : `獲得 ${row.exp_amount} 經驗值`,
      date: row.created_at
    })),
    ...notifs.map((row) => ({
      id: `notif-${row.id}`,
      rowId: row.id,
      source: 'notif',
      message: row.exp_amount > 0 ? `${row.message}（+${row.exp_amount} 經驗值）` : row.message,
      date: row.created_at
    }))
  ];

  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return limit ? items.slice(0, limit) : items;
}

/**
 * 取得學員最近動態（經驗值取得紀錄 + 管理員通知）
 */
export async function getUserActivities(userId, limit = 10) {
  if (!supabase) throw new Error('Experience service not initialized');
  return fetchAllActivities(userId, limit);
}

/**
 * 管理員：取得學員全部動態（供 PDF 匯出）
 */
export async function getAdminUserActivities(userId) {
  if (!supabase) throw new Error('Experience service not initialized');
  return fetchAllActivities(userId, null);
}
