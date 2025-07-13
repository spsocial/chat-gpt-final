-- Create user_accounts table for Google Sign-In
CREATE TABLE IF NOT EXISTS user_accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    local_user_id VARCHAR(255),
    name VARCHAR(255),
    picture TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_local_user_id ON user_accounts(local_user_id);

-- Add google_id column to user_credits if needed
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_credits' 
                   AND column_name = 'email') THEN
        ALTER TABLE user_credits ADD COLUMN email VARCHAR(255);
    END IF;
END $$;