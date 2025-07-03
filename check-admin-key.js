// check-admin-key.js
require('dotenv').config();

console.log('🔍 ตรวจสอบ Admin Secret Key...\n');

// แสดง key แบบซ่อนบางส่วน
const key = process.env.ADMIN_SECRET_KEY;
if (key) {
    const masked = key.substring(0, 3) + '***' + key.substring(key.length - 3);
    console.log('✅ พบ Admin Secret Key:', masked);
    console.log('📏 ความยาว:', key.length, 'ตัวอักษร');
    console.log('🔤 ขึ้นต้นด้วย:', key.substring(0, 3));
    console.log('🔤 ลงท้ายด้วย:', key.substring(key.length - 3));
} else {
    console.log('❌ ไม่พบ Admin Secret Key!');
}

// ตรวจสอบ environment
console.log('\n📍 Environment:', process.env.NODE_ENV || 'development');
console.log('🌐 Database URL:', process.env.DATABASE_URL ? 'พบ' : 'ไม่พบ');