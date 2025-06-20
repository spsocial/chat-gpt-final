// setup-credit-system.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function setupCreditSystem() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting credit system setup...\n');

        // 1. Create user_credits table
        console.log('Creating user_credits table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_credits (
                user_id VARCHAR(255) PRIMARY KEY,
                credits DECIMAL(10, 2) DEFAULT 0,
                total_purchased DECIMAL(10, 2) DEFAULT 0,
                total_used DECIMAL(10, 2) DEFAULT 0,
                last_updated TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ user_credits table created\n');

        // 2. Create credit_transactions table
        console.log('Creating credit_transactions table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS credit_transactions (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                balance_after DECIMAL(10, 2) NOT NULL,
                description TEXT,
                reference_id VARCHAR(255),
                admin_note TEXT,
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ credit_transactions table created\n');

        // 3. Create credit_packages table
        console.log('Creating credit_packages table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS credit_packages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                credits DECIMAL(10, 2) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                bonus_credits DECIMAL(10, 2) DEFAULT 0,
                description TEXT,
                is_popular BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0
            )
        `);
        console.log('✅ credit_packages table created\n');

        // 4. Create payment_logs table
        console.log('Creating payment_logs table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS payment_logs (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                package_id INTEGER REFERENCES credit_packages(id),
                amount DECIMAL(10, 2) NOT NULL,
                credits_received DECIMAL(10, 2) NOT NULL,
                payment_method VARCHAR(50),
                payment_status VARCHAR(50) DEFAULT 'pending',
                payment_reference VARCHAR(255),
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ payment_logs table created\n');

        // 5. Create indexes
        console.log('Creating indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_credit_trans_user 
            ON credit_transactions(user_id);
            
            CREATE INDEX IF NOT EXISTS idx_credit_trans_created 
            ON credit_transactions(created_at DESC);
            
            CREATE INDEX IF NOT EXISTS idx_payment_logs_user 
            ON payment_logs(user_id);
            
            CREATE INDEX IF NOT EXISTS idx_payment_logs_status 
            ON payment_logs(payment_status);
        `);
        console.log('✅ Indexes created\n');

        // 6. Insert default packages
        console.log('Checking for existing packages...');
        const packageCheck = await client.query('SELECT COUNT(*) FROM credit_packages');
        
        if (packageCheck.rows[0].count == 0) {
            console.log('Inserting default packages...');
            await client.query(`
                INSERT INTO credit_packages (name, credits, price, bonus_credits, description, is_popular, sort_order) VALUES
                ('Starter Pack', 50, 50, 0, 'เหมาะสำหรับทดลองใช้', FALSE, 1),
                ('Popular Pack', 200, 150, 0, 'คุ้มที่สุด! ประหยัด 25%', TRUE, 2),
                ('Pro Pack', 500, 300, 50, 'รับโบนัส 50 เครดิต!', FALSE, 3),
                ('Ultimate Pack', 1000, 500, 200, 'รับโบนัส 200 เครดิต! สุดคุ้ม', FALSE, 4)
            `);
            console.log('✅ Default packages inserted\n');
        } else {
            console.log('✅ Packages already exist\n');
        }

        // 7. Migrate existing users to credit system
        console.log('Migrating existing users...');
        await client.query(`
            INSERT INTO user_credits (user_id, credits)
            SELECT DISTINCT user_id, 0
            FROM users
            WHERE user_id NOT IN (SELECT user_id FROM user_credits)
        `);
        
        const migrationResult = await client.query(`
            SELECT COUNT(*) FROM user_credits
        `);
        console.log(`✅ Total users in credit system: ${migrationResult.rows[0].count}\n`);

        // 8. Summary
        console.log('📊 Credit System Setup Summary:');
        console.log('=====================================');
        
        const tables = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('user_credits', 'credit_transactions', 'credit_packages', 'payment_logs')
            ORDER BY tablename
        `);
        
        console.log('Tables created:');
        tables.rows.forEach(row => {
            console.log(`   ✓ ${row.tablename}`);
        });
        
        console.log('\n🎉 Credit system setup completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('1. Update your .env with payment provider keys');
        console.log('2. Configure PromptPay QR code or payment gateway');
        console.log('3. Test manual credit adjustment using SQL commands');
        
    } catch (error) {
        console.error('❌ Error setting up credit system:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run setup
setupCreditSystem()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));