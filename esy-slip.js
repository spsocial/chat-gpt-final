// esy-slip.js
const axios = require('axios');

class ESYSlipService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.apiUrl = 'https://api.easyslip.com/v1/verify';
    }

    async verifySlip(slipData) {
        try {
            console.log('🔍 Verifying slip with ESY API...');
            
            // เรียก API
            const response = await axios.post(this.apiUrl, {
                data: slipData,
                key: this.apiKey
            });

            console.log('📋 ESY Response:', response.data);
            
            // ตรวจสอบผลลัพธ์
            if (response.data.success) {
                return {
                    success: true,
                    amount: parseFloat(response.data.amount),
                    transactionRef: response.data.transaction_ref,
                    sender: response.data.sender,
                    receiver: response.data.receiver,
                    date: response.data.date,
                    time: response.data.time,
                    rawData: response.data
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Verification failed'
                };
            }
            
        } catch (error) {
            console.error('❌ ESY Slip Error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ตรวจสอบว่าเป็นการโอนมาที่เราหรือไม่
    validateReceiver(slipData, expectedReceiver) {
        // ลบขีดและช่องว่างออก
        const cleanReceiver = slipData.receiver.replace(/-|\s/g, '');
        const cleanExpected = expectedReceiver.replace(/-|\s/g, '');
        
        return cleanReceiver === cleanExpected;
    }
}

module.exports = ESYSlipService;