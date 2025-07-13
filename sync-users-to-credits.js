require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function syncUsersToCredits() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting user sync...\n');

        // 1. Check users in both tables
        const usersInUsersTable = await client.query('SELECT COUNT(*) FROM users');
        const usersInCreditsTable = await client.query('SELECT COUNT(*) FROM user_credits');
        
        console.log(`📊 Users in 'users' table: ${usersInUsersTable.rows[0].count}`);
        console.log(`📊 Users in 'user_credits' table: ${usersInCreditsTable.rows[0].count}\n`);

        // 2. Find users that exist in users table but not in user_credits
        const missingUsers = await client.query(`
            SELECT u.user_id, u.created_at
            FROM users u
            LEFT JOIN user_credits uc ON u.user_id = uc.user_id
            WHERE uc.user_id IS NULL
        `);

        console.log(`🔍 Found ${missingUsers.rows.length} users missing from user_credits table\n`);

        if (missingUsers.rows.length > 0) {
            // 3. Create user_credits records for missing users
            console.log('📝 Creating credit records for missing users...');
            
            for (const user of missingUsers.rows) {
                await client.query(`
                    INSERT INTO user_credits (user_id, credits, total_purchased, total_used, last_updated)
                    VALUES ($1, 5, 0, 0, $2)
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.user_id, user.created_at || new Date()]);
                
                console.log(`   ✅ Created credit record for: ${user.user_id}`);
            }
            
            console.log(`\n✨ Successfully synced ${missingUsers.rows.length} users!`);
        } else {
            console.log('✅ All users already have credit records!');
        }

        // 4. Final count check
        const finalCount = await client.query('SELECT COUNT(*) FROM user_credits');
        console.log(`\n📊 Final user count in user_credits: ${finalCount.rows[0].count}`);

        // 5. Check unique users from usage_logs
        const uniqueUsersInLogs = await client.query(`
            SELECT COUNT(DISTINCT user_id) FROM usage_logs
        `);
        console.log(`📊 Unique users in usage_logs: ${uniqueUsersInLogs.rows[0].count}`);

        // 6. Sync users from usage_logs that might not exist in user_credits
        const missingFromLogs = await client.query(`
            SELECT DISTINCT ul.user_id
            FROM usage_logs ul
            LEFT JOIN user_credits uc ON ul.user_id = uc.user_id
            WHERE uc.user_id IS NULL
        `);

        if (missingFromLogs.rows.length > 0) {
            console.log(`\n🔍 Found ${missingFromLogs.rows.length} users from usage_logs missing in user_credits`);
            
            for (const user of missingFromLogs.rows) {
                await client.query(`
                    INSERT INTO user_credits (user_id, credits, total_purchased, total_used, last_updated)
                    VALUES ($1, 0, 0, 0, NOW())
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.user_id]);
                
                console.log(`   ✅ Created credit record for: ${user.user_id}`);
            }
        }

        // 7. Final summary
        const finalUsersCount = await client.query('SELECT COUNT(*) FROM user_credits');
        console.log(`\n🎉 Sync completed! Total users in user_credits: ${finalUsersCount.rows[0].count}`);
        
    } catch (error) {
        console.error('❌ Error during sync:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the sync
syncUsersToCredits();