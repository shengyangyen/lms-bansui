/**
 * 徽章系統
 * 頒發徽章、觸發檢查、經驗值發放
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let supabase;

export function initializeBadgeService(supabaseClient) {
  supabase = supabaseClient;
}

function getBadgeConfig() {
  try {
    const configPath = path.join(__dirname, '../../docs/badges-config.json');
    const raw = readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { badges: [] };
  }
}

/**
 * 頒發徽章給學員
 * @param {string} userId
 * @param {string} badgeId
 * @param {string|null} awardedBy - 管理員 ID，自動觸發時為 null
 * @returns {{ awarded: boolean, expAdded?: number, alreadyHas?: boolean }}
 */
export async function awardBadge(userId, badgeId, awardedBy = null) {
  if (!supabase) throw new Error('Badge service not initialized');
  const config = getBadgeConfig();
  const badge = config.badges?.find((b) => b.id === badgeId);
  if (!badge) return { awarded: false };

  const { data: existing } = await supabase
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_id', badgeId)
    .maybeSingle();
  if (existing) return { awarded: false, alreadyHas: true };

  const { error } = await supabase
    .from('user_badges')
    .insert({ user_id: userId, badge_id: badgeId, awarded_by: awardedBy });
  if (error) return { awarded: false };

  const expAmount = badge.exp_amount || 0;
  if (expAmount > 0) {
    const { data: row } = await supabase
      .from('user_levels')
      .select('id, total_exp')
      .eq('user_id', userId)
      .maybeSingle();
    const currentTotal = row?.total_exp ?? 0;
    const newTotal = currentTotal + expAmount;
    await supabase
      .from('user_levels')
      .upsert(
        { user_id: userId, total_exp: newTotal, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    await supabase.from('activity_notifications').insert({
      user_id: userId,
      message: `獲得徽章《${badge.name}》`,
      exp_amount: expAmount,
      created_by: awardedBy
    });
  }

  return { awarded: true, expAdded: expAmount };
}

/**
 * 檢查「獲得6個勳章」觸發六藝勳章（第 6 個時觸發，非第 7 個）
 */
async function checkBadgesCount6(userId) {
  const { count } = await supabase
    .from('user_badges')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) < 5) return [];
  const { data: hasSixArts } = await supabase
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_id', 'six-arts')
    .maybeSingle();
  if (hasSixArts) return [];
  const result = await awardBadge(userId, 'six-arts', null);
  return result.awarded ? ['six-arts'] : [];
}

/**
 * 檢查並頒發符合條件的自動徽章
 * @param {string} userId
 * @param {string} triggerType
 * @returns {Promise<string[]>} 新頒發的 badge ids
 */
export async function checkAndAwardBadges(userId, triggerType) {
  if (!supabase) return [];
  const awarded = [];
  if (triggerType === 'badges_6') {
    return checkBadgesCount6(userId);
  }
  const config = getBadgeConfig();
  const badgesToCheck = config.badges?.filter((b) => b.trigger_type === triggerType) || [];
  for (const badge of badgesToCheck) {
    const { data: existing } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_id', badge.id)
      .maybeSingle();
    if (!existing) {
      const result = await awardBadge(userId, badge.id, null);
      if (result.awarded) {
        awarded.push(badge.id);
        const sixArts = await checkBadgesCount6(userId);
        awarded.push(...sixArts);
      }
    }
  }
  return awarded;
}

/**
 * 帳號批准為學員時：頒發入學勳章
 */
export async function onAdminApproveStudent(userId, userRole) {
  if (!['student', 'trainee'].includes(userRole)) return [];
  return checkAndAwardBadges(userId, 'admin_approve_student');
}

/**
 * 經驗值變動後：檢查等級徽章 (level_5, level_12)
 */
export async function onExpChanged(userId) {
  const { data } = await supabase
    .from('user_levels')
    .select('total_exp')
    .eq('user_id', userId)
    .maybeSingle();
  const totalExp = data?.total_exp ?? 0;
  const level = Math.floor(totalExp / 100) + 1;
  const awarded = [];
  if (level >= 12) {
    const r = await checkAndAwardBadges(userId, 'level_12');
    awarded.push(...r);
  }
  if (level >= 5) {
    const r = await checkAndAwardBadges(userId, 'level_5');
    awarded.push(...r);
  }
  return awarded;
}

/**
 * 留言後：檢查協作勳章 (comments_8)
 */
export async function onCommentPosted(userId) {
  const { count } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) >= 8) {
    return checkAndAwardBadges(userId, 'comments_8');
  }
  return [];
}

/**
 * 取得學員累計優秀評級次數（每筆提交取最新 feedback 的 grade）
 */
async function getExcellentGradeCount(userId) {
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id')
    .eq('student_id', userId)
    .eq('is_latest', true);
  const subIds = (submissions || []).map((s) => s.id);
  if (subIds.length === 0) return 0;

  const { data: feedbackList } = await supabase
    .from('feedback')
    .select('submission_id, grade, created_at')
    .in('submission_id', subIds)
    .order('created_at', { ascending: false });

  const latestBySub = {};
  (feedbackList || []).forEach((f) => {
    if (!latestBySub[f.submission_id]) latestBySub[f.submission_id] = f;
  });
  return Object.values(latestBySub).filter((f) => f.grade === '優秀').length;
}

/**
 * 作業批改為優秀後：檢查優良勳章、特等勳章
 * 優良勳章：第 1 次優秀；特等勳章：累計 5 次優秀
 */
export async function onExcellentGrade(userId) {
  const awarded = [];
  const excellentCount = await getExcellentGradeCount(userId);

  if (excellentCount >= 1) {
    const r1 = await checkAndAwardBadges(userId, 'first_excellent');
    awarded.push(...r1);
  }
  if (excellentCount >= 5) {
    const r2 = await checkAndAwardBadges(userId, 'excellent_5');
    awarded.push(...r2);
  }
  return awarded;
}

/**
 * 同一作業繳交 3 次以上：檢查勤奮勳章
 */
export async function onRevisionCount(userId, assignmentId) {
  const { count: fileCount } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', userId)
    .eq('assignment_id', assignmentId);
  const { count: formCount } = await supabase
    .from('form_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', userId)
    .eq('assignment_id', assignmentId);
  const total = (fileCount ?? 0) + (formCount ?? 0);
  if (total >= 3) {
    return checkAndAwardBadges(userId, 'revision_3');
  }
  return [];
}

/**
 * 取得學員已獲得徽章
 */
export async function getUserBadges(userId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('user_badges')
    .select('badge_id, awarded_at')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });
  const config = getBadgeConfig();
  const badgeMap = Object.fromEntries((config.badges || []).map((b) => [b.id, b]));
  return (data || []).map((ub) => ({
    id: ub.badge_id,
    name: badgeMap[ub.badge_id]?.name || ub.badge_id,
    image: badgeMap[ub.badge_id]?.image || `${ub.badge_id}.png`,
    description: badgeMap[ub.badge_id]?.description || '',
    awarded_at: ub.awarded_at
  }));
}

/**
 * 取得所有可手動頒發的徽章（管理員派發用）
 */
export async function getAdminAwardableBadges() {
  const config = getBadgeConfig();
  return (config.badges || []).filter((b) => b.trigger === 'admin' || !b.trigger_type);
}
