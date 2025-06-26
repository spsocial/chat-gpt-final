-- เพิ่ม columns สำหรับ BYOK system
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS openai_api_key TEXT,
ADD COLUMN IF NOT EXISTS is_byok BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS byok_enabled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS byok_usage_count INTEGER DEFAULT 0;

-- สร้าง index สำหรับ query ที่เร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_users_byok ON users(is_byok) WHERE is_byok = true;