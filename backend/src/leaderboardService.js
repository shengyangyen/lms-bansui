/**
 * 排行榜服務
 * 統計學員：經驗值、徽章數、優良作業數、討論回饋數
 * 同分並列顯示
 */

let supabase;

// 記憶體備援：DB 失敗時仍可運作（重啟後重置）
let _leaderboardVisibleMemory = null;

export function initializeLeaderboardService(supabaseClient) {
  supabase = supabaseClient;
}

const STUDENT_ROLES = ['student', 'trainee', 'study_buddy'];

async function getLeaderboardVisible() {
  if (process.env.LEADERBOARD_ALWAYS_VISIBLE === 'true') return true;
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'leaderboard_visible')
      .maybeSingle();
    if (error) {
      console.warn('[leaderboard] DB 讀取失敗，使用記憶體:', error.message);
      return _leaderboardVisibleMemory === true;
    }
    const v = data?.value;
    const visible = v === true || v === 'true' || String(v).toLowerCase() === 'true';
    _leaderboardVisibleMemory = visible;
    return visible;
  } catch (e) {
    console.warn('[leaderboard] 讀取異常:', e.message);
    return _leaderboardVisibleMemory === true;
  }
}

export async function setLeaderboardVisible(visible) {
  _leaderboardVisibleMemory = !!visible;
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert(
        { key: 'leaderboard_visible', value: visible, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    if (error) {
      console.warn('[leaderboard] DB 寫入失敗，已更新記憶體:', error.message);
    }
    return true;
  } catch (e) {
    console.warn('[leaderboard] 寫入異常，已更新記憶體:', e.message);
    return true;
  }
}

export async function getLeaderboardVisibility() {
  return getLeaderboardVisible();
}

/**
 * 取得學員的優良作業數（每筆提交取最新 feedback 的 grade='優秀'）
 */
async function getExcellentCountsByUser() {
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, student_id')
    .eq('is_latest', true);
  const subIds = (submissions || []).map((s) => s.id);
  if (subIds.length === 0) return {};

  const { data: feedbackList } = await supabase
    .from('feedback')
    .select('submission_id, grade, created_at')
    .in('submission_id', subIds)
    .order('created_at', { ascending: false });

  const latestBySub = {};
  (feedbackList || []).forEach((f) => {
    if (!latestBySub[f.submission_id]) latestBySub[f.submission_id] = f;
  });

  const excellentByUser = {};
  submissions.forEach((s) => {
    const latest = latestBySub[s.id];
    if (latest?.grade === '優秀') {
      excellentByUser[s.student_id] = (excellentByUser[s.student_id] || 0) + 1;
    }
  });
  return excellentByUser;
}

/**
 * 取得排行榜資料（四項指標）
 * 僅統計學員（student, trainee, study_buddy）
 */
export async function getLeaderboardData() {
  if (!supabase) return null;

  const { data: students } = await supabase
    .from('users')
    .select('id, display_name, real_name, full_name')
    .in('user_role', STUDENT_ROLES);

  if (!students?.length) {
    return {
      exp: [],
      badges: [],
      excellent: [],
      comments: []
    };
  }

  const userIds = students.map((s) => s.id);
  const userMap = Object.fromEntries(students.map((s) => [s.id, { id: s.id, name: (s.display_name || s.real_name || s.full_name || '匿名').trim() || '匿名' }]));

  // 1. 經驗值
  const { data: levels } = await supabase
    .from('user_levels')
    .select('user_id, total_exp')
    .in('user_id', userIds);
  const expByUser = Object.fromEntries((levels || []).map((l) => [l.user_id, l.total_exp || 0]));

  // 2. 徽章數
  const { data: badgeCounts } = await supabase
    .from('user_badges')
    .select('user_id')
    .in('user_id', userIds);
  const badgesByUser = {};
  (badgeCounts || []).forEach((b) => {
    badgesByUser[b.user_id] = (badgesByUser[b.user_id] || 0) + 1;
  });

  // 3. 優良作業數
  const excellentByUser = await getExcellentCountsByUser();

  // 4. 討論回饋數（comments）
  const { data: commentCounts } = await supabase
    .from('comments')
    .select('user_id')
    .in('user_id', userIds);
  const commentsByUser = {};
  (commentCounts || []).forEach((c) => {
    commentsByUser[c.user_id] = (commentsByUser[c.user_id] || 0) + 1;
  });

  // 建立排名（同分並列）
  function buildRankedList(getValue, label) {
    const items = userIds
      .map((uid) => ({
        user_id: uid,
        name: userMap[uid]?.name || '匿名',
        value: getValue(uid) || 0
      }))
      .filter((x) => x.value > 0 || label === 'exp') // 經驗值可為 0 也顯示
      .sort((a, b) => b.value - a.value);

    if (items.length === 0) return [];

    const result = [];
    let rank = 1;
    let prevValue = null;
    let sameRankStart = 0;

    items.forEach((item, idx) => {
      if (prevValue !== null && item.value < prevValue) {
        rank = idx + 1;
      }
      prevValue = item.value;
      result.push({ rank, ...item });
    });

    return result;
  }

  return {
    exp: buildRankedList((uid) => expByUser[uid] ?? 0, 'exp'),
    badges: buildRankedList((uid) => badgesByUser[uid] ?? 0, 'badges'),
    excellent: buildRankedList((uid) => excellentByUser[uid] ?? 0, 'excellent'),
    comments: buildRankedList((uid) => commentsByUser[uid] ?? 0, 'comments')
  };
}
