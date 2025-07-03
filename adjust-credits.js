// adjust-credits.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function adjustCredits() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('❌ Usage: node adjust-credits.js <userId> <action> <amount>');
        console.log('Actions: set, add, subtract');
        console.log('\nExamples:');
        console.log('  node adjust-credits.js user_123 set 5      # ตั้งค่าให้เหลือ 5 เครดิต');
        console.log('  node adjust-credits.js user_123 subtract 55 # ลด 55 เครดิต');
        console.log('  node adjust-credits.js user_123 add 10     # เพิ่ม 10 เครดิต');
        process.exit(1);
    }
    
    const userId = args[0];
    const action = args[1].toLowerCase();
    const amount = parseFloat(args[2]);
    
    try {
        // ดูเครดิตปัจจุบัน
        const current = await pool.query(
            'SELECT balance FROM user_credits WHERE user_id = $1',
            [userId]
        );
        
        const currentBalance = current.rows[0]?.balance || 0;
        console.log(`\n💰 เครดิตปัจจุบัน: ${currentBalance}`);
        
        let newBalance;
        let description;
        
        switch(action) {
            case 'set':
                // ตั้งค่าเครดิตใหม่
                newBalance = amount;
                description = `ปรับเครดิตเป็น ${amount} (จาก ${currentBalance})`;
                break;
                
            case 'subtract':
            case 'remove':
                // ลดเครดิต
                newBalance = currentBalance - amount;
                description = `ลดเครดิต ${amount} บาท`;
                break;
                
            case 'add':
                // เพิ่มเครดิต
                newBalance = currentBalance + amount;
                description = `เพิ่มเครดิต ${amount} บาท`;
                break;
                
            default:
                console.log('❌ Action ไม่ถูกต้อง ใช้: set, add, subtract');
                process.exit(1);
        }
        
        if (newBalance < 0) {
            console.log('⚠️  เครดิตจะติดลบ! ต้องการดำเนินการต่อหรือไม่? (y/n)');
            // ในที่นี้จะ set เป็น 0 แทน
            newBalance = 0;
            console.log('   → ปรับเป็น 0 แทน');
        }
        
        await pool.query('BEGIN');
        
        // บันทึก transaction
        const adjustment = currentBalance - newBalance;
        await pool.query(`
            INSERT INTO credit_transactions 
            (user_id, type, amount, description, payment_method, admin_note)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            userId,
            adjustment > 0 ? 'USE' : 'ADD',
            Math.abs(adjustment),
            description,
            'manual',
            `Admin adjustment: ${action} ${amount}`
        ]);
        
        // อัพเดทยอดใหม่
        await pool.query(`
            UPDATE user_credits 
            SET balance = $2, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
        `, [userId, newBalance]);
        
        await pool.query('COMMIT');
        
        console.log(`\n✅ สำเร็จ!`);
        console.log(`   เครดิตเดิม: ${currentBalance}`);
        console.log(`   เครดิตใหม่: ${newBalance}`);
        console.log(`   ${adjustment > 0 ? 'ลด' : 'เพิ่ม'}: ${Math.abs(adjustment)}`);
        
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

adjustCredits();