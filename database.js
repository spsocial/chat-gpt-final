// database.js
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Database connected at:', res.rows[0].now);
    }
});

// Get today's usage for a user
// เปลี่ยนจาก UTC เป็น Thailand Time
async function getTodayUsage(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        console.log(`[getTodayUsage] Checking usage for ${userId} on ${today} (UTC)`);
        
        // ⚠️ เพิ่ม FOR UPDATE เพื่อ lock row ขณะอ่าน
        const result = await pool.query(
            'SELECT total_cost_thb FROM daily_limits WHERE user_id = $1 AND date = $2',
            [userId, today]
        );
        
        const usage = parseFloat(result.rows[0]?.total_cost_thb || 0);
        console.log(`[getTodayUsage] Result: ฿${usage.toFixed(2)}`);
        
        return usage;
    } catch (error) {
        console.error('[getTodayUsage] Error:', error);
        return 0;
    }
}


// Save usage record
async function saveUsage(userId, inputTokens, outputTokens, costTHB) {
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`[saveUsage] Saving ฿${costTHB.toFixed(2)} for ${userId} on ${today} (UTC)`);
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Insert usage log
        const logResult = await client.query(
            `INSERT INTO usage_logs (user_id, input_tokens, output_tokens, cost_thb)
             VALUES ($1, $2, $3, $4)
             RETURNING id, timestamp`,
            [userId, inputTokens, outputTokens, costTHB]
        );
        
        console.log(`[saveUsage] Log inserted with ID: ${logResult.rows[0].id}`);
        
        // 2. Update daily total
        const dailyResult = await client.query(
            `INSERT INTO daily_limits (user_id, date, total_cost_thb, request_count)
             VALUES ($1, $2, $3, 1)
             ON CONFLICT (user_id, date)
             DO UPDATE SET 
                 total_cost_thb = daily_limits.total_cost_thb + $3,
                 request_count = daily_limits.request_count + 1
             RETURNING total_cost_thb, request_count`,
            [userId, today, costTHB]
        );
        
        console.log(`[saveUsage] Daily total updated: ฿${dailyResult.rows[0].total_cost_thb}`);
        
        // 3. Create user if not exists
        await client.query(
            `INSERT INTO users (user_id, name)
             VALUES ($1, $1)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId]
        );
        
        // ⚠️ Force commit และรอให้แน่ใจ
        await client.query('COMMIT');
        
        // รอ 100ms เพื่อให้แน่ใจว่า commit เสร็จ
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`[saveUsage] ✅ Transaction committed successfully`);
        
        return {
            success: true,
            logId: logResult.rows[0].id,
            timestamp: logResult.rows[0].timestamp,
            newTotal: parseFloat(dailyResult.rows[0].total_cost_thb),
            requestCount: parseInt(dailyResult.rows[0].request_count)
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[saveUsage] ❌ Error:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        client.release();
    }
}

// Get usage statistics
async function getUsageStats(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // Today's data
        const todayData = await pool.query(
            'SELECT * FROM daily_limits WHERE user_id = $1 AND date = $2',
            [userId, today]
        );
        
        // Last 7 days
        const weekData = await pool.query(
            `SELECT date, total_cost_thb, request_count 
             FROM daily_limits 
             WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
             ORDER BY date DESC`,
            [userId]
        );
        
        return {
            today: {
                used: parseFloat(todayData.rows[0]?.total_cost_thb || 0),
                requests: parseInt(todayData.rows[0]?.request_count || 0)
            },
            week: weekData.rows.map(row => ({
                date: row.date,
                cost: parseFloat(row.total_cost_thb),
                requests: parseInt(row.request_count)
            }))
        };
    } catch (error) {
        console.error('Error getting usage stats:', error);
        return {
            today: { used: 0, requests: 0 },
            week: []
        };
    }
}

// ====== CHARACTER FUNCTIONS ======

// Get all characters for a user
async function getCharacters(userId) {
    try {
        const result = await pool.query(
            `SELECT id, name, profile, preview, created_at 
             FROM characters 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [userId]
        );
        
        // Log เพื่อ debug
        if (result.rows.length > 0) {
            console.log('Character data length:', result.rows[0].profile?.length);
        }
        
        return result.rows;
    } catch (error) {
        console.error('Error getting characters:', error);
        return [];
    }
}

// Save new character
async function saveCharacter(userId, name, profile, preview) {
    try {
        const result = await pool.query(
            `INSERT INTO characters (user_id, name, profile, preview)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [userId, name, profile, preview]
        );
        
        return result.rows[0].id;
    } catch (error) {
        console.error('Error saving character:', error);
        throw error;
    }
}

// Get single character
async function getCharacter(characterId) {
    try {
        const result = await pool.query(
            'SELECT * FROM characters WHERE id = $1',
            [characterId]
        );
        
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting character:', error);
        return null;
    }
}

// Delete character
async function deleteCharacter(characterId) {
    try {
        await pool.query(
            'DELETE FROM characters WHERE id = $1',
            [characterId]
        );
        
        return true;
    } catch (error) {
        console.error('Error deleting character:', error);
        throw error;
    }
}

// ======== CREDIT SYSTEM FUNCTIONS ========

// ฟังก์ชันจัดการเครดิต
async function getUserCredits(userId) {
    try {
        const result = await pool.query(
            'SELECT credits FROM user_credits WHERE user_id = $1',
            [userId]
        );
        
        return parseFloat(result.rows[0]?.credits || 0);
    } catch (error) {
        console.error('Error getting user credits:', error);
        return 0;
    }
}

async function addCredits(userId, amount, description, reference = null, adminNote = null) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. ดึงเครดิตปัจจุบัน
        const currentCredits = await getUserCredits(userId);
        const newBalance = currentCredits + amount;
        
        // 2. บันทึก transaction
        await client.query(
            `INSERT INTO credit_transactions 
             (user_id, type, amount, balance_after, description, reference_id, admin_note, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, 'ADD', amount, newBalance, description, reference, adminNote, 'system']
        );
        
        // 3. อัพเดทเครดิต
        await client.query(
            `INSERT INTO user_credits (user_id, credits, total_purchased, last_updated)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (user_id) 
             DO UPDATE SET 
                 credits = user_credits.credits + $2,
                 total_purchased = user_credits.total_purchased + $3,
                 last_updated = NOW()`,
            [userId, amount, amount]
        );
        
        await client.query('COMMIT');
        return { success: true, newBalance };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding credits:', error);
        return { success: false, error: error.message };
    } finally {
        client.release();
    }
}

async function useCredits(userId, amount, description, referenceId = null) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. ตรวจสอบเครดิตพอไหม (WITH LOCK)
        const creditResult = await client.query(
            'SELECT credits FROM user_credits WHERE user_id = $1 FOR UPDATE',
            [userId]
        );
        
        const currentCredits = parseFloat(creditResult.rows[0]?.credits || 0);
        console.log(`[useCredits] Current credits: ${currentCredits}, deducting: ${amount}`);
        
        if (currentCredits < amount) {
            throw new Error('Insufficient credits');
        }
        
        const newBalance = currentCredits - amount;
        
        // 2. บันทึก transaction
        const transResult = await client.query(
            `INSERT INTO credit_transactions 
             (user_id, type, amount, balance_after, description, reference_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, created_at`,
            [userId, 'USE', amount, newBalance, description, referenceId]
        );
        
        // 3. อัพเดทเครดิต
        await client.query(
            `UPDATE user_credits 
             SET credits = credits - $2,
                 total_used = total_used + $2,
                 last_updated = NOW()
             WHERE user_id = $1`,
            [userId, amount]
        );
        
         // Force commit
        await client.query('COMMIT');
        
        // รอให้แน่ใจ
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`[useCredits] ✅ Deducted ${amount} credits, new balance: ${newBalance}`);
        
        return {
            success: true,
            newBalance: newBalance,
            transactionId: transResult.rows[0].id,
            timestamp: transResult.rows[0].created_at
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[useCredits] ❌ Error:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        client.release();
    }
}

// เพิ่มฟังก์ชันใหม่: Force refresh data
async function forceRefreshUserData(userId) {
    try {
        // Query ข้อมูลใหม่โดยตรง
        const today = new Date().toISOString().split('T')[0];
        
        const [usageResult, creditResult] = await Promise.all([
            pool.query(
                'SELECT total_cost_thb FROM daily_limits WHERE user_id = $1 AND date = $2',
                [userId, today]
            ),
            pool.query(
                'SELECT credits FROM user_credits WHERE user_id = $1',
                [userId]
            )
        ]);
        
        return {
            todayUsage: parseFloat(usageResult.rows[0]?.total_cost_thb || 0),
            credits: parseFloat(creditResult.rows[0]?.credits || 0)
        };
        
    } catch (error) {
        console.error('[forceRefreshUserData] Error:', error);
        return null;
    }
}

async function getCreditPackages() {
    try {
        const result = await pool.query(
            `SELECT * FROM credit_packages 
             WHERE is_active = true 
             ORDER BY sort_order ASC`
        );
        
        return result.rows;
    } catch (error) {
        console.error('Error getting credit packages:', error);
        return [];
    }
}

async function getCreditHistory(userId, limit = 10) {
    try {
        const result = await pool.query(
            `SELECT * FROM credit_transactions 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2`,
            [userId, limit]
        );
        
        return result.rows;
    } catch (error) {
        console.error('Error getting credit history:', error);
        return [];
    }
}

// เพิ่มก่อน module.exports
async function saveRating(userId, promptId, promptText, responseText, rating, feedback, mode) {
    try {
        await pool.query(
            `INSERT INTO prompt_ratings 
             (user_id, prompt_id, prompt_text, response_text, rating, feedback, mode)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, promptId, promptText, responseText, rating, feedback, mode]
        );
        return true;
    } catch (error) {
        console.error('Error saving rating:', error);
        throw error;
    }
}

async function getUserRatings(userId, limit = 10) {
    try {
        const result = await pool.query(
            `SELECT * FROM prompt_ratings 
             WHERE user_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    } catch (error) {
        console.error('Error getting user ratings:', error);
        return [];
    }
}

async function getUserAverageRating(userId) {
    try {
        const result = await pool.query(
            `SELECT AVG(rating)::FLOAT as average 
             FROM prompt_ratings 
             WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0]?.average || 0;
    } catch (error) {
        console.error('Error getting average rating:', error);
        return 0;
    }
}

async function getRatingStats(userId) {
    try {
        const result = await pool.query(
            `SELECT 
                COUNT(*)::INT as total_ratings,
                AVG(rating)::FLOAT as average_rating,
                COUNT(CASE WHEN rating = 5 THEN 1 END)::INT as five_stars,
                COUNT(CASE WHEN rating = 4 THEN 1 END)::INT as four_stars,
                COUNT(CASE WHEN rating = 3 THEN 1 END)::INT as three_stars,
                COUNT(CASE WHEN rating = 2 THEN 1 END)::INT as two_stars,
                COUNT(CASE WHEN rating = 1 THEN 1 END)::INT as one_star
             FROM prompt_ratings 
             WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0] || {};
    } catch (error) {
        console.error('Error getting rating stats:', error);
        return {};
    }
}

// ========== FREE CREDITS FUNCTIONS ==========
// เพิ่มโค้ดนี้ก่อน module.exports ในไฟล์ database.js

// ดึงเครดิตฟรีคงเหลือ
async function getFreeCredits(userId) {
    try {
        const result = await pool.query(
            'SELECT * FROM get_or_create_daily_credits($1)',
            [userId]
        );
        return parseFloat(result.rows[0].get_or_create_daily_credits || 0);
    } catch (error) {
        console.error('Error getting free credits:', error);
        return 0;
    }
}

// ========== FREE CREDITS FUNCTIONS ==========
// ดึงเครดิตฟรีคงเหลือ
async function getFreeCredits(userId) {
    try {
        const result = await pool.query(
            'SELECT * FROM get_or_create_daily_credits($1)',
            [userId]
        );
        return parseFloat(result.rows[0].get_or_create_daily_credits || 0);
    } catch (error) {
        console.error('Error getting free credits:', error);
        return 0;
    }
}

// ใช้เครดิต (ฟรีก่อน แล้วค่อยหักจากที่เติม)
async function useCreditsNew(userId, amount, description) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. เรียกใช้ function หักเครดิตฟรี
        const freeResult = await client.query(
            'SELECT * FROM use_free_credits($1, $2)',
            [userId, amount]
        );
        
        const creditUsage = freeResult.rows[0].use_free_credits;
        console.log('💰 Credit usage:', creditUsage);
        
        // 2. ถ้าต้องหักจากเครดิตที่เติม
        if (creditUsage.used_from_paid > 0) {
            const paidResult = await useCredits(
                userId, 
                creditUsage.used_from_paid, 
                description
            );
            
            if (!paidResult.success) {
                throw new Error('Insufficient paid credits');
            }
        }
        
        await client.query('COMMIT');
        
        // 3. ดึงข้อมูลล่าสุด
        const freeRemaining = await getFreeCredits(userId);
        const paidRemaining = await getUserCredits(userId);
        
        return {
            success: true,
            used_from_free: creditUsage.used_from_free,
            used_from_paid: creditUsage.used_from_paid,
            free_remaining: freeRemaining,
            paid_remaining: paidRemaining
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error using credits:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        client.release();
    }
}

// ========== PAYMENT VERIFICATION FUNCTIONS ==========

// บันทึกการยืนยันการชำระเงิน
async function savePaymentVerification(userId, transactionRef, amount, packageId, slipData) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. บันทึกข้อมูลการยืนยัน
        const verifyResult = await client.query(
            `INSERT INTO payment_verifications 
             (user_id, transaction_ref, amount, package_id, slip_data, status, verified_at)
             VALUES ($1, $2, $3, $4, $5, 'verified', NOW())
             RETURNING id`,
            [userId, transactionRef, amount, packageId, JSON.stringify(slipData)]
        );
        
        // 2. เติมเครดิต
        const creditResult = await addCredits(
            userId,
            amount,
            `ชำระผ่าน PromptPay - Ref: ${transactionRef}`,
            verifyResult.rows[0].id,
            'Auto-verified by ESY Slip'
        );
        
        // 3. อัพเดท payment_logs
        await client.query(
            `INSERT INTO payment_logs 
             (user_id, package_id, amount, credits_received, payment_method, payment_status, payment_reference, transaction_ref, processed_at)
             VALUES ($1, $2, $3, $4, 'promptpay', 'completed', $5, $6, NOW())`,
            [userId, packageId, amount, amount, `SLIP-${verifyResult.rows[0].id}`, transactionRef]
        );
        
        await client.query('COMMIT');
        
        return {
            success: true,
            verificationId: verifyResult.rows[0].id,
            newBalance: creditResult.newBalance
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving payment verification:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ตรวจสอบว่ามี transaction ref นี้แล้วหรือยัง
async function checkDuplicatePayment(transactionRef) {
    try {
        const result = await pool.query(
            'SELECT id FROM payment_verifications WHERE transaction_ref = $1',
            [transactionRef]
        );
        
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking duplicate:', error);
        return false;
    }
}

// ดึงข้อมูลการชำระเงินจาก ref
async function getPaymentByRef(transactionRef) {
    try {
        const result = await pool.query(
            `SELECT pv.*, uc.credits as current_balance
             FROM payment_verifications pv
             JOIN user_credits uc ON pv.user_id = uc.user_id
             WHERE pv.transaction_ref = $1`,
            [transactionRef]
        );
        
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error getting payment:', error);
        return null;
    }
}

// ========== BYOK (Bring Your Own Key) FUNCTIONS ==========

// บันทึก API Key ของ user
async function saveUserApiKey(userId, encryptedApiKey) {
    const client = await pool.connect();
    
    try {
        // Debug: Check table structure
        const tableInfo = await client.query(`
            SELECT column_name, data_type, table_schema
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        console.log('📊 Users table info:', {
            rowCount: tableInfo.rowCount,
            columns: tableInfo.rows
        });
        
        // Also check if table exists
        const tableExists = await client.query(`
            SELECT table_name, table_schema
            FROM information_schema.tables 
            WHERE table_name = 'users'
        `);
        console.log('📊 Users table exists:', tableExists.rows);
        
        await client.query('BEGIN');
        
        // ตรวจสอบว่า user มีอยู่แล้วหรือไม่
        const checkUser = await client.query(
            'SELECT user_id FROM users WHERE user_id = $1',
            [userId]
        );
        
        console.log(`🔍 Checking user ${userId}:`, checkUser.rows.length > 0 ? 'exists' : 'not found');
        
        if (checkUser.rows.length > 0) {
            // UPDATE ถ้ามี user อยู่แล้ว
            await client.query(
                `UPDATE users 
                 SET openai_api_key = $2,
                     is_byok = true,
                     byok_enabled_at = NOW(),
                     byok_usage_count = COALESCE(byok_usage_count, 0)
                 WHERE user_id = $1`,
                [userId, encryptedApiKey]
            );
        } else {
            // INSERT user ใหม่พร้อมข้อมูลพื้นฐาน
            await client.query(
                `INSERT INTO users (user_id, name, openai_api_key, is_byok, byok_enabled_at, byok_usage_count, created_at)
                 VALUES ($1, $2, $3, true, NOW(), 0, NOW())`,
                [userId, userId, encryptedApiKey]
            );
        }
        
        await client.query('COMMIT');
        
        console.log(`✅ API Key saved for user: ${userId}`);
        return { success: true };
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving API key:', error);
        return { success: false, error: error.message };
    } finally {
        client.release();
    }
}

// ดึง API Key ของ user (ถ้ามี)
async function getUserApiKey(userId) {
    try {
        const result = await pool.query(
            'SELECT openai_api_key, is_byok FROM users WHERE user_id = $1',
            [userId]
        );
        
        if (result.rows.length > 0 && result.rows[0].is_byok) {
            return {
                apiKey: result.rows[0].openai_api_key,
                isByok: true
            };
        }
        
        return { apiKey: null, isByok: false };
        
    } catch (error) {
        console.error('Error getting user API key:', error);
        return { apiKey: null, isByok: false };
    }
}

// ลบ API Key
async function removeUserApiKey(userId) {
    try {
        await pool.query(
            `UPDATE users 
             SET openai_api_key = NULL,
                 is_byok = false,
                 byok_usage_count = 0
             WHERE user_id = $1`,
            [userId]
        );
        
        console.log(`✅ API Key removed for user: ${userId}`);
        return { success: true };
        
    } catch (error) {
        console.error('Error removing API key:', error);
        return { success: false, error: error.message };
    }
}

// เพิ่มการนับการใช้งาน BYOK
async function incrementByokUsage(userId) {
    try {
        await pool.query(
            `UPDATE users 
             SET byok_usage_count = COALESCE(byok_usage_count, 0) + 1
             WHERE user_id = $1`,
            [userId]
        );
    } catch (error) {
        console.error('Error incrementing BYOK usage:', error);
    }
}

// อย่าลืม export!
module.exports = {
    pool,
    getTodayUsage,
    saveUsage,
    getUsageStats,
    getCharacters,
    saveCharacter,
    getCharacter,
    deleteCharacter,
    saveRating,
    getUserRatings,
    getUserAverageRating,
    getRatingStats,
    // เพิ่มฟังก์ชันใหม่
    getUserCredits,
    addCredits,
    useCredits,
    getCreditPackages,
    getCreditHistory,
    forceRefreshUserData,
    getFreeCredits,
    useCreditsNew,
    // เพิ่ม payment verification functions
    savePaymentVerification,
    checkDuplicatePayment,
    getPaymentByRef,
    saveUserApiKey,
    getUserApiKey,
    removeUserApiKey,
    incrementByokUsage
};