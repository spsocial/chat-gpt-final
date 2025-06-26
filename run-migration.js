// run-migration.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting BYOK migration...\n');
        
        // อ่านไฟล์ SQL
        const sqlPath = path.join(__dirname, 'add-byok-columns.sql');
        const sqlContent = await fs.readFile(sqlPath, 'utf8');
        
        console.log('📄 Running SQL migration...');
        console.log(sqlContent);
        
        // รันคำสั่ง SQL
        await client.query(sqlContent);
        
        console.log('\n✅ Migration completed successfully!');
        
        // ตรวจสอบผลลัพธ์
        const checkResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('openai_api_key', 'is_byok', 'byok_enabled_at', 'byok_usage_count')
        `);
        
        console.log('\n📋 New columns added:');
        checkResult.rows.forEach(row => {
            console.log(`   - ${row.column_name} (${row.data_type})`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// รันทันที
runMigration()
    .then(() => {
        console.log('\n🎉 Database migration completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Migration error:', error);
        process.exit(1);
    });