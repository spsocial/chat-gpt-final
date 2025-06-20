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
    // ใช้ timezone ของไทย
    const bangkokTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"});
    const today = new Date(bangkokTime).toISOString().split('T')[0];
    
    try {
        const result = await pool.query(
            'SELECT total_cost_thb FROM daily_limits WHERE user_id = $1 AND date = $2',
            [userId, today]
        );
        
        return parseFloat(result.rows[0]?.total_cost_thb || 0);
    } catch (error) {
        console.error('Error getting today usage:', error);
        return 0;
    }
}

// Save usage record
async function saveUsage(userId, inputTokens, outputTokens, costTHB) {
    const today = new Date().toISOString().split('T')[0];
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Insert usage log
        await client.query(
            `INSERT INTO usage_logs (user_id, input_tokens, output_tokens, cost_thb)
             VALUES ($1, $2, $3, $4)`,
            [userId, inputTokens, outputTokens, costTHB]
        );
        
        // 2. Update daily total
        await client.query(
            `INSERT INTO daily_limits (user_id, date, total_cost_thb, request_count)
             VALUES ($1, $2, $3, 1)
             ON CONFLICT (user_id, date)
             DO UPDATE SET 
                 total_cost_thb = daily_limits.total_cost_thb + $3,
                 request_count = daily_limits.request_count + 1`,
            [userId, today, costTHB]
        );
        
        // 3. Create user if not exists
        await client.query(
            `INSERT INTO users (user_id, name)
             VALUES ($1, $1)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId]
        );
        
        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving usage:', error);
        return false;
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
        
        // 1. ตรวจสอบเครดิตพอไหม
        const currentCredits = await getUserCredits(userId);
        if (currentCredits < amount) {
            throw new Error('Insufficient credits');
        }
        
        const newBalance = currentCredits - amount;
        
        // 2. บันทึก transaction
        await client.query(
            `INSERT INTO credit_transactions 
             (user_id, type, amount, balance_after, description, reference_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
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
        
        await client.query('COMMIT');
        return { success: true, newBalance };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error using credits:', error);
        return { success: false, error: error.message };
    } finally {
        client.release();
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
    getCreditHistory
};