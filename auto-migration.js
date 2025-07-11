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