// check-user-credits.js
// ใช้สำหรับเช็คเครดิตของ user
// Usage: node check-user-credits.js <userId>

require('dotenv').config();
const db = require('./database');

async function checkUserCredits() {
    const userId = process.argv[2];
    
    if (!userId) {
        console.log('❌ Usage: node check-user-credits.js <userId>');
        console.log('Example: node check-user-credits.js user_abc123');
        process.exit(1);
    }
    
    try {
        console.log(`\n🔍 Checking credits for: ${userId}\n`);
        
        // ดูเครดิตปัจจุบัน
        const credits = await db.getUserCredits(userId);
        console.log(`💰 Current Credits: ${credits} credits`);
        
        // ดูการใช้งานวันนี้
        const todayUsage = await db.getTodayUsage(userId);
        console.log(`📊 Today's Usage: ฿${todayUsage.toFixed(2)}/5.00`);
        
        // ดูประวัติเครดิต
        const history = await db.getCreditHistory(userId, 5);
        
        if (history.length > 0) {
            console.log('\n📝 Recent Credit History:');
            console.log('─'.repeat(60));
            
            history.forEach(tx => {
                const date = new Date(tx.created_at).toLocaleString('th-TH');
                const type = tx.type === 'ADD' ? '➕' : '➖';
                const color = tx.type === 'ADD' ? '\x1b[32m' : '\x1b[31m';
                const reset = '\x1b[0m';
                
                console.log(`${type} ${date}`);
                console.log(`   ${color}${tx.type === 'ADD' ? '+' : '-'}${tx.amount} credits${reset}`);
                console.log(`   ${tx.description}`);
                if (tx.admin_note) {
                    console.log(`   Note: ${tx.admin_note}`);
                }
                console.log(`   Balance after: ${tx.balance_after} credits`);
                console.log('─'.repeat(60));
            });
        } else {
            console.log('\n📝 No credit history found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await db.pool.end();
    }
}

// Run
checkUserCredits();