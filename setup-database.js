// setup-database.js
require('dotenv').config();
const { Pool } = require('pg');

// Create connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function setupDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting database setup...\n');

        // 1. Create users table
        console.log('Creating users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Users table created\n');

        // 2. Create usage_logs table
        console.log('Creating usage_logs table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS usage_logs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                input_tokens INTEGER,
                output_tokens INTEGER,
                cost_thb DECIMAL(10, 2),
                timestamp TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Usage_logs table created\n');

        // 3. Create daily_limits table
        console.log('Creating daily_limits table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_limits (
                user_id VARCHAR(255),
                date DATE,
                total_cost_thb DECIMAL(10, 2) DEFAULT 0,
                request_count INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, date)
            )
        `);
        console.log('✅ Daily_limits table created\n');

        // 4. Create characters table (UPDATED!)
        console.log('Creating characters table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS characters (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                profile TEXT NOT NULL,  -- TEXT type สามารถเก็บข้อมูลได้มาก
                preview VARCHAR(500),   -- เพิ่มขนาดเป็น 500 ตัวอักษร
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('Creating prompt_ratings table...');
await client.query(`
    CREATE TABLE IF NOT EXISTS prompt_ratings (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        prompt_id VARCHAR(255) NOT NULL,
        prompt_text TEXT NOT NULL,
        response_text TEXT NOT NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        feedback TEXT,
        mode VARCHAR(50) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT NOW()
    )
`);
        console.log('✅ Characters table created\n');

        // 5. Create indexes for better performance
        console.log('Creating indexes...');
        
        // Existing indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_usage_logs_user_timestamp 
            ON usage_logs(user_id, timestamp DESC)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_daily_limits_date 
            ON daily_limits(date DESC)
        `);
        
        // New indexes for characters
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_characters_user_id 
            ON characters(user_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_characters_created_at 
            ON characters(created_at DESC)
        `);
        
        console.log('✅ Indexes created\n');

        // 6. Verify tables
        console.log('Verifying tables...');
        const tables = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        `);
        
        console.log('📋 Database tables:');
        tables.rows.forEach(row => {
            console.log(`   - ${row.tablename}`);
        });

        // 7. Check if we need to migrate existing data
        console.log('\n🔍 Checking for existing data...');
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        const characterCount = await client.query('SELECT COUNT(*) FROM characters');
        
        console.log(`   - Users: ${userCount.rows[0].count}`);
        console.log(`   - Characters: ${characterCount.rows[0].count}`);

        console.log('\n🎉 Database setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run setup
setupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));