-- ========================================
-- 徽章系統 Phase B
-- ========================================

-- 1. 徽章定義表
CREATE TABLE IF NOT EXISTS badges (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  image VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50),
  description TEXT,
  exp_amount INT NOT NULL DEFAULT 1
);

-- 2. 學員已獲得徽章
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id VARCHAR(100) NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_by UUID REFERENCES users(id),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);

ALTER TABLE badges DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges DISABLE ROW LEVEL SECURITY;

-- 3. 種子資料（徽章定義）
INSERT INTO badges (id, name, image, trigger_type, description, exp_amount) VALUES
  ('enrollment', '入學勳章', '入學勳章.png', 'admin_approve_student', '歡迎來到伴飛計畫，帶著這個勳章，追尋廣闊的天空吧！', 3),
  ('stage1', '一階結業勳章', '一階結業勳章.png', NULL, '恭喜完成了規畫個人軌道的階段訓練，你找到屬於你的課程靈魂了嗎？', 10),
  ('stage2', '二階結業勳章', '二階結業勳章.png', NULL, '恭喜完成了享受自在節奏的階段訓練，期待你在課程中精采的輸出。', 15),
  ('stage3', '三階結業勳章', '三階結業勳章.png', NULL, '恭喜完成了淬鍊持續進階的階段訓練，你還在等什麼？快開課吧！', 20),
  ('rank5', '五等勳章', '五等勳章.png', 'level_5', '恭喜達到等級5，是否如自己期待般成長著呢？', 7),
  ('six-arts', '六藝勳章', '六藝勳章.png', 'badges_6', '真了不起，有六個勳章了，這個就送你當紀念吧。', 3),
  ('perfect', '完美勳章', '完美勳章.png', NULL, '真是了不起的演練，不但完成，還很完美。', 25),
  ('collaboration', '協作勳章', '協作勳章.png', 'comments_8', '同儕的學習是決定品質很重要的一環，謝謝你的付出。', 35),
  ('excellent5', '特等勳章', '特等勳章.png', 'excellent_5', '能夠完成這麼多次優良，相信你一定會成為講究品質的老師。', 20),
  ('coach', '教練勳章', '教練勳章.png', NULL, '教練覺得你很棒，繼續前進吧！', 10),
  ('stage', '登台勳章', '登台勳章.png', NULL, '能夠上台展現，需要很大的勇氣，恭喜你往前邁進了一大步。', 40),
  ('graduation', '結業勳章', '結業勳章.png', NULL, '這一段歷程是否如你的期待呢？謝謝妳和我們走了這麼長的一段路。', 35),
  ('diligent', '勤奮勳章', '勤奮勳章.png', 'revision_3', '好課需要一磨再磨，這段經驗會奠定你的厚實功力', 30),
  ('glory', '榮耀勳章', '榮耀勳章.png', 'level_12', '回過頭來看看當初的自己，是不是很有信心了些？你還可以更好的。', 12),
  ('excellent1', '優良勳章', '優良勳章.png', 'first_excellent', '這樣的水準內容，肯定會帶給你很大的幫助。讚！', 20)
ON CONFLICT (id) DO NOTHING;
