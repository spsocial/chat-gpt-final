// test-real-slip.js
// ทดสอบ ESY Slip API ด้วยสลิปจริง

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ESYSlipService = require('./esy-slip');

// Initialize ESY Slip service
const esySlip = new ESYSlipService(process.env.ESY_SLIP_API_KEY);

async function testRealSlip() {
    console.log('🧪 ทดสอบ ESY Slip API ด้วยสลิปจริง...\n');
    
    // ตรวจสอบ API Key
    if (!process.env.ESY_SLIP_API_KEY) {
        console.error('❌ ไม่พบ ESY_SLIP_API_KEY');
        return;
    }
    
    // อ่านไฟล์สลิป (วางไฟล์ slip.jpg หรือ slip.png ในโฟลเดอร์เดียวกัน)
    const slipPath = path.join(__dirname, 'slip.jpg'); // หรือ slip.png
    
    if (!fs.existsSync(slipPath)) {
        console.error('❌ ไม่พบไฟล์สลิป');
        console.log('📌 วิธีใช้:');
        console.log('1. วางไฟล์สลิปชื่อ slip.jpg หรือ slip.png ในโฟลเดอร์เดียวกับไฟล์นี้');
        console.log('2. รันคำสั่ง: node test-real-slip.js');
        return;
    }
    
    try {
        // อ่านไฟล์และแปลงเป็น base64
        const slipBuffer = fs.readFileSync(slipPath);
        const slipBase64 = slipBuffer.toString('base64');
        const mimeType = slipPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const slipData = `data:${mimeType};base64,${slipBase64}`;
        
        console.log('📄 ข้อมูลไฟล์:');
        console.log('- ขนาด:', (slipBuffer.length / 1024).toFixed(2), 'KB');
        console.log('- ประเภท:', mimeType);
        console.log('- Base64 length:', slipData.length);
        
        console.log('\n🔄 กำลังส่งไปตรวจสอบ...\n');
        
        // เรียก API
        const result = await esySlip.verifySlip(slipData);
        
        console.log('📊 ผลการตรวจสอบ:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('\n✅ อ่านสลิปสำเร็จ!');
            console.log('💰 จำนวนเงิน:', result.amount, 'บาท');
            console.log('📱 เลขอ้างอิง:', result.transactionRef);
            console.log('👤 ผู้โอน:', result.sender);
            console.log('👤 ผู้รับ:', result.receiver);
            
            // ตรวจสอบ raw data
            if (result.rawData && result.rawData.data) {
                console.log('\n📋 Raw Data Keys:', Object.keys(result.rawData.data));
                console.log('Raw Data:', JSON.stringify(result.rawData.data, null, 2));
            }
        } else {
            console.log('\n❌ อ่านสลิปไม่สำเร็จ');
            console.log('Error:', result.error);
        }
        
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาด:', error.message);
    }
}

// รันการทดสอบ
testRealSlip();