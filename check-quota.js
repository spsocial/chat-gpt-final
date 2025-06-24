// check-quota.js
// ตรวจสอบโควต้าและเครดิตที่เหลือ

require('dotenv').config();
const axios = require('axios');

async function checkQuota() {
    console.log('🔍 ตรวจสอบโควต้า ESY Slip...\n');
    
    if (!process.env.ESY_SLIP_API_KEY) {
        console.error('❌ ไม่พบ ESY_SLIP_API_KEY');
        return;
    }
    
    // ลองหลายวิธีในการตรวจสอบโควต้า
    
    // วิธีที่ 1: ลองเรียก endpoint /me
    try {
        console.log('📊 ลองเรียก /me endpoint...');
        const response = await axios.get('https://developer.easyslip.com/api/v1/me', {
            headers: {
                'Authorization': `Bearer ${process.env.ESY_SLIP_API_KEY}`
            }
        });
        
        console.log('✅ ข้อมูล Account:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        if (error.response?.status === 404) {
            console.log('❌ ไม่มี endpoint /me');
        } else if (error.response?.status === 403) {
            console.log('❌ Access Denied - ต้องเติมเครดิตก่อน');
        } else {
            console.log('❌ Error:', error.response?.status, error.response?.data);
        }
    }
    
    console.log('\n-------------------\n');
    
    // วิธีที่ 2: ลองเรียก endpoint /quota
    try {
        console.log('📊 ลองเรียก /quota endpoint...');
        const response = await axios.get('https://developer.easyslip.com/api/v1/quota', {
            headers: {
                'Authorization': `Bearer ${process.env.ESY_SLIP_API_KEY}`
            }
        });
        
        console.log('✅ ข้อมูลโควต้า:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        if (error.response?.status === 404) {
            console.log('❌ ไม่มี endpoint /quota');
        } else if (error.response?.status === 403) {
            console.log('❌ Access Denied - ต้องเติมเครดิตก่อน');
        } else {
            console.log('❌ Error:', error.response?.status, error.response?.data);
        }
    }
    
    console.log('\n-------------------\n');
    
    // วิธีที่ 3: ลองเรียก endpoint /account
    try {
        console.log('📊 ลองเรียก /account endpoint...');
        const response = await axios.get('https://developer.easyslip.com/api/v1/account', {
            headers: {
                'Authorization': `Bearer ${process.env.ESY_SLIP_API_KEY}`
            }
        });
        
        console.log('✅ ข้อมูล Account:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        if (error.response?.status === 404) {
            console.log('❌ ไม่มี endpoint /account');
        } else if (error.response?.status === 403) {
            console.log('❌ Access Denied - ต้องเติมเครดิตก่อน');
        } else {
            console.log('❌ Error:', error.response?.status, error.response?.data);
        }
    }
    
    console.log('\n📌 สรุป:');
    console.log('ถ้าได้ Error 403 ทุก endpoint แสดงว่า:');
    console.log('1. API Key ถูกต้อง แต่ยังไม่ได้เติมเครดิต');
    console.log('2. ต้องไปเติมเครดิตที่ https://developer.easyslip.com');
    console.log('3. หลังเติมเครดิตแล้ว ระบบจะใช้งานได้ทันที');
}

checkQuota();