require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigrations() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Running database migrations...');
        
        // Create user_accounts table for Google Sign-In
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_accounts (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                google_id VARCHAR(255) UNIQUE,
                local_user_id VARCHAR(255),
                name VARCHAR(255),
                picture TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_user_accounts_local_user_id ON user_accounts(local_user_id)
        `);
        
        // Add email column to user_credits if needed
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'user_credits' 
                               AND column_name = 'email') THEN
                    ALTER TABLE user_credits ADD COLUMN email VARCHAR(255);
                END IF;
            END $$
        `);
        
        console.log('✅ Google auth tables created/updated');
        
        // Migration completed
        
        console.log('✅ Migrations completed successfully');
        
    } catch (error) {
        console.error('❌ Migration error:', error);
        // Don't crash the app if migration fails
    } finally {
        client.release();
    }
}

// Export for use in server.js
module.exports = { runMigrations };