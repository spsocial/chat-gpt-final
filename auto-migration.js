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
        
        // Add BYOK columns if not exists
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS openai_api_key TEXT,
            ADD COLUMN IF NOT EXISTS is_byok BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS byok_enabled_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS byok_usage_count INTEGER DEFAULT 0
        `);
        
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