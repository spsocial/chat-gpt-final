// admin-add-credits.js
// ใช้สำหรับเติมเครดิตให้ user หลังจากได้รับสลิปแล้ว
// Usage: node admin-add-credits.js <userId> <amount> <note>
// Example: node admin-add-credits.js user_abc123 60 "Payment 50 THB - TxID 12345"

require('dotenv').config();
const db = require('./database');

async function addCreditsManual() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('❌ Usage: node admin-add-credits.js <userId> <amount> [note]');
        console.log('Example: node admin-add-credits.js user_abc123 60 "Payment received"');
        process.exit(1);
    }
    
    const userId = args[0];
    const amount = parseFloat(args[1]);
    const note = args[2] || 'Manual credit addition';
    
    if (isNaN(amount) || amount <= 0) {
        console.log('❌ Amount must be a positive number');
        process.exit(1);
    }
    
    try {
        console.log(`\n💰 Adding ${amount} credits to ${userId}...`);
        
        // เช็คเครดิตก่อนเติม
        const beforeCredits = await db.getUserCredits(userId);
        console.log(`   Current credits: ${beforeCredits}`);
        
        // เติมเครดิต
        const result = await db.addCredits(
            userId,
            amount,
            'ชำระเงินผ่าน PromptPay',
            null,
            note
        );
        
        if (result.success) {
            console.log(`✅ Success! New balance: ${result.newBalance} credits`);
            console.log(`   (Added ${amount} credits)`);
            
            // แสดงประวัติล่าสุด
            const history = await db.getCreditHistory(userId, 1);
            if (history.length > 0) {
                console.log('\n📝 Transaction details:');
                console.log(`   ID: ${history[0].id}`);
                console.log(`   Time: ${new Date(history[0].created_at).toLocaleString('th-TH')}`);
                console.log(`   Note: ${history[0].admin_note || '-'}`);
            }
        } else {
            console.log(`❌ Failed: ${result.error}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await db.pool.end();
    }
}

// Run
addCreditsManual();