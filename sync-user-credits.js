// sync-user-credits.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function syncUserCredits() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting user credit synchronization...\n');

        // 1. Check users in both tables
        console.log('Checking user counts...');
        const usersCount = await client.query('SELECT COUNT(*) FROM users');
        const creditsCount = await client.query('SELECT COUNT(*) FROM user_credits');
        
        console.log(`Users table: ${usersCount.rows[0].count} users`);
        console.log(`User credits table: ${creditsCount.rows[0].count} users\n`);

        // 2. Find missing users
        console.log('Finding users not in credit system...');
        const missingUsers = await client.query(`
            SELECT user_id FROM users 
            WHERE user_id NOT IN (SELECT user_id FROM user_credits)
        `);
        
        console.log(`Found ${missingUsers.rows.length} users missing from credit system\n`);

        // 3. Add missing users to credit system
        if (missingUsers.rows.length > 0) {
            console.log('Adding missing users to credit system...');
            for (const user of missingUsers.rows) {
                await client.query(`
                    INSERT INTO user_credits (user_id, credits, total_purchased, total_used)
                    VALUES ($1, 0, 0, 0)
                    ON CONFLICT (user_id) DO NOTHING
                `, [user.user_id]);
                console.log(`  ✓ Added user: ${user.user_id}`);
            }
            console.log('\n✅ All missing users added to credit system');
        } else {
            console.log('✅ All users already in credit system');
        }

        // 4. Check for orphaned credit records
        console.log('\nChecking for orphaned credit records...');
        const orphanedCredits = await client.query(`
            SELECT user_id FROM user_credits 
            WHERE user_id NOT IN (SELECT user_id FROM users)
        `);
        
        if (orphanedCredits.rows.length > 0) {
            console.log(`⚠️  Found ${orphanedCredits.rows.length} orphaned credit records:`);
            orphanedCredits.rows.forEach(row => {
                console.log(`   - ${row.user_id}`);
            });
            console.log('\nThese are credit records for users that don\'t exist in the users table.');
        } else {
            console.log('✅ No orphaned credit records found');
        }

        // 5. Final verification
        console.log('\n📊 Final Status:');
        const finalUsersCount = await client.query('SELECT COUNT(*) FROM users');
        const finalCreditsCount = await client.query('SELECT COUNT(*) FROM user_credits');
        const activeUsersCount = await client.query('SELECT COUNT(DISTINCT user_id) FROM usage_logs');
        
        console.log(`Total users (users table): ${finalUsersCount.rows[0].count}`);
        console.log(`Total users (user_credits table): ${finalCreditsCount.rows[0].count}`);
        console.log(`Active users (with usage logs): ${activeUsersCount.rows[0].count}`);

        console.log('\n🎉 User credit synchronization completed!');
        
    } catch (error) {
        console.error('❌ Error syncing user credits:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run sync
syncUserCredits()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));