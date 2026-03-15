-- 管理員發送的動態通知（可選加經驗值）
CREATE TABLE IF NOT EXISTS activity_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  exp_amount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_activity_notifications_user ON activity_notifications(user_id);
ALTER TABLE activity_notifications DISABLE ROW LEVEL SECURITY;
