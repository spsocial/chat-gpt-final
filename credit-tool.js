// credit-tool.js - ใช้ได้ทั้งเพิ่มและลด
require('dotenv').config();
const db = require('./database');

async function creditTool() {
    const [userId, action, amount] = process.argv.slice(2);
    
    if (!userId || !action || !amount) {
        console.log(`
📋 วิธีใช้:
  node credit-tool.js [userId] add [จำนวน]    - เติมเครดิต
  node credit-tool.js [userId] use [จำนวน]    - หักเครดิต
  node credit-tool.js [userId] check          - เช็คยอด

ตัวอย่าง:
  node credit-tool.js user_123 add 60    # เติม 60
  node credit-tool.js user_123 use 55    # หัก 55
  node credit-tool.js user_123 check     # ดูยอด
        `);
        return;
    }
    
    try {
        switch(action) {
            case 'add':
                await db.addCredits(userId, parseFloat(amount), 
                    'เติมเครดิตโดย Admin', null, 'Manual add');
                break;
                
            case 'use':
                await db.useCredits(userId, parseFloat(amount), {
                    requestCost: parseFloat(amount),
                    description: 'ปรับลดเครดิตโดย Admin'
                });
                break;
                
            case 'check':
                const balance = await db.getUserCredits(userId);
                console.log(`💰 เครดิต: ${balance}`);
                return;
        }
        
        // แสดงยอดใหม่
        const newBalance = await db.getUserCredits(userId);
        console.log(`✅ สำเร็จ! เครดิตปัจจุบัน: ${newBalance}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await db.pool.end();
    }
}

creditTool();