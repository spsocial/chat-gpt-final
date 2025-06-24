// test-esy-slip.js
// ไฟล์ทดสอบ ESY Slip API Key

require('dotenv').config();
const axios = require('axios');

async function testESYSlipAPI() {
    console.log('🧪 ทดสอบ ESY Slip API...\n');
    
    // 1. ตรวจสอบ Environment Variables
    console.log('📋 ตรวจสอบ Environment Variables:');
    console.log('ESY_SLIP_API_KEY:', process.env.ESY_SLIP_API_KEY ? '✅ พบ' : '❌ ไม่พบ');
    
    if (process.env.ESY_SLIP_API_KEY) {
        console.log('API Key length:', process.env.ESY_SLIP_API_KEY.length, 'ตัวอักษร');
        console.log('API Key preview:', process.env.ESY_SLIP_API_KEY.substring(0, 20) + '...');
    }
    
    console.log('\n-------------------\n');
    
    // 2. ทดสอบเรียก API โดยตรง
    if (!process.env.ESY_SLIP_API_KEY) {
        console.error('❌ ไม่พบ ESY_SLIP_API_KEY ใน environment variables');
        console.log('📌 วิธีแก้ไข:');
        console.log('1. สร้างไฟล์ .env ในโฟลเดอร์เดียวกับ server.js');
        console.log('2. เพิ่มบรรทัดนี้: ESY_SLIP_API_KEY=your-api-key-here');
        console.log('3. แทนที่ your-api-key-here ด้วย API Key จาก https://developer.easyslip.com');
        return;
    }
    
    console.log('🔄 กำลังทดสอบเรียก ESY Slip API...\n');
    
    try {
        // 1. ทดสอบเรียก API เพื่อดูข้อมูล account (ถ้ามี endpoint นี้)
        console.log('📊 ตรวจสอบข้อมูล Account...');
        try {
            const meResponse = await axios.get('https://developer.easyslip.com/api/v1/me', {
                headers: {
                    'Authorization': `Bearer ${process.env.ESY_SLIP_API_KEY}`
                }
            });
            console.log('✅ Account Info:', JSON.stringify(meResponse.data, null, 2));
        } catch (meError) {
            console.log('⚠️  ไม่สามารถดึงข้อมูล account (อาจไม่มี endpoint /me)');
        }
        
        console.log('\n-------------------\n');
        
        // 2. ทดสอบด้วยรูปตัวอย่าง (base64 ของรูปขนาดเล็ก)
        const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
        
        console.log('📤 กำลังส่ง request ไปที่ /verify...');
        const response = await axios.post('https://developer.easyslip.com/api/v1/verify', {
            image: testImage
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.ESY_SLIP_API_KEY}`,
                'Content-Type': 'application/json'
            },
            validateStatus: function (status) {
                return status < 500; // ให้ axios ไม่ throw error ถ้า status < 500
            }
        });
        
        console.log('\n📨 Response Status:', response.status);
        console.log('📋 Response Headers:', response.headers);
        console.log('📄 Response Data:', JSON.stringify(response.data, null, 2));
        
        if (response.status === 200) {
            console.log('\n✅ API Key ใช้งานได้!');
        } else if (response.status === 403) {
            console.log('\n❌ Error 403: Access Denied');
            console.log('\n⚠️  สาเหตุที่เป็นไปได้:');
            console.log('1. ❌ ยังไม่ได้เติมเครดิต - ต้องเติมเครดิตก่อนใช้งาน');
            console.log('2. ❌ Account ยังไม่ได้ยืนยันอีเมล');
            console.log('3. ❌ API Key ถูกระงับ');
            console.log('\n📌 วิธีแก้ไข:');
            console.log('1. ไปที่ https://developer.easyslip.com');
            console.log('2. ตรวจสอบ remainingQuota และ currentCredit');
            console.log('3. ถ้าเป็น 0 ให้เติมเครดิต (เมนู "เติมเงิน")');
            console.log('4. ถ้ายังไม่ได้ยืนยันอีเมล ให้ไปยืนยนก่อน');
        } else if (response.status === 401) {
            console.log('\n❌ Error 401: Unauthorized');
            console.log('API Key ไม่ถูกต้องหรือ format ผิด');
        } else if (response.status === 400) {
            console.log('\n⚠️  Error 400: Bad Request');
            console.log('รูปภาพไม่ถูกต้อง (ซึ่งเป็นปกติสำหรับรูปทดสอบ)');
            console.log('✅ แต่ API Key ของคุณใช้งานได้!');
        }
        
    } catch (error) {
        console.error('\n❌ เกิดข้อผิดพลาด:');
        
        if (error.code === 'ENOTFOUND') {
            console.error('ไม่สามารถเชื่อมต่อกับ ESY Slip API');
            console.error('ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        } else {
            console.error('Error:', error.message);
            console.error('Full error:', error);
        }
    }
    
    console.log('\n📝 หมายเหตุ:');
    console.log('- ตรวจสอบให้แน่ใจว่าไฟล์ .env มี ESY_SLIP_API_KEY');
    console.log('- Format: ESY_SLIP_API_KEY=your-api-key-here');
    console.log('- ไม่ต้องใส่เครื่องหมายคำพูด');
}

// รันการทดสอบ
testESYSlipAPI();