// esy-slip.js
const axios = require('axios');

class ESYSlipService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        // แก้ URL ให้ถูกต้องตามเอกสาร
        this.apiUrl = 'https://developer.easyslip.com/api/v1/verify';
    }

    async verifySlip(slipData) {
        try {
            console.log('🔍 Verifying slip with ESY API...');
            
            // เรียก API ตามรูปแบบที่ถูกต้อง
            const response = await axios.post(this.apiUrl, {
                image: slipData  // ส่งเป็น image แทน data
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,  // ใช้ Bearer token
                    'Content-Type': 'application/json'
                }
            });

            console.log('📋 ESY Response:', response.data);
            
            // ตรวจสอบผลลัพธ์ตาม response structure จริง
            if (response.data && response.data.data) {
    const data = response.data.data;
    
    // แก้ปัญหา amount เป็น object
    let amount = 0;
    if (data.amount && typeof data.amount === 'object') {
        amount = parseFloat(data.amount.amount) || 0;
    } else {
        amount = parseFloat(data.amount) || 0;
    }
    
    return {
        success: true,
        amount: amount,
        transactionRef: data.transRef || data.transactionId || data.ref,
        sender: data.sender?.displayName || data.sender?.name || 'Unknown',
        receiver: data.receiver?.displayName || data.receiver?.name || 'Unknown',
        date: data.date,
        time: data.time,
        rawData: response.data
    };
} else {
    return {
        success: false,
        error: response.data?.message || 'Verification failed'
    };
}
            
        } catch (error) {
            console.error('❌ ESY Slip Error:', error.message);
            
            // ถ้าเป็น axios error ให้แสดงรายละเอียดเพิ่ม
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
                
                return {
                    success: false,
                    error: error.response.data?.message || `API Error: ${error.response.status}`
                };
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ตรวจสอบว่าเป็นการโอนมาที่เราหรือไม่
    validateReceiver(slipData, expectedReceiver) {
    // ถ้าอ่านผู้รับไม่ได้ ให้ผ่าน
    if (!slipData.receiver || slipData.receiver === 'Unknown') {
        console.log('⚠️ Cannot read receiver - skipping validation');
        return true;  // ให้ผ่าน
    }
    
    const cleanReceiver = (slipData.receiver || '').replace(/-|\s/g, '');
    const cleanExpected = expectedReceiver.replace(/-|\s/g, '');
    
    return cleanReceiver === cleanExpected;
}
}

module.exports = ESYSlipService;