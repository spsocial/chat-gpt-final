// add-free-credits.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function addFreeCreditsTable() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Creating free credits system...');
        
        // 1. สร้างตาราง daily_free_credits
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_free_credits (
                user_id VARCHAR(50) NOT NULL,
                date DATE NOT NULL,
                free_credits_remaining DECIMAL(10,2) DEFAULT 5.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, date)
            )
        `);
        
        console.log('✅ Table daily_free_credits created');
        
        // 2. เพิ่ม function สำหรับ reset เครดิตฟรีทุกวัน
        await client.query(`
            CREATE OR REPLACE FUNCTION get_or_create_daily_credits(p_user_id VARCHAR)
            RETURNS DECIMAL AS $$
            DECLARE
                v_credits DECIMAL;
            BEGIN
                -- ถ้าไม่มีข้อมูลวันนี้ ให้สร้างใหม่
                INSERT INTO daily_free_credits (user_id, date, free_credits_remaining)
                VALUES (p_user_id, CURRENT_DATE, 5.00)
                ON CONFLICT (user_id, date) DO NOTHING;
                
                -- ดึงเครดิตคงเหลือ
                SELECT free_credits_remaining INTO v_credits
                FROM daily_free_credits
                WHERE user_id = p_user_id AND date = CURRENT_DATE;
                
                RETURN v_credits;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        console.log('✅ Function get_or_create_daily_credits created');
        
        // 3. สร้าง function หักเครดิตฟรี
        await client.query(`
            CREATE OR REPLACE FUNCTION use_free_credits(
                p_user_id VARCHAR,
                p_amount DECIMAL
            ) RETURNS JSON AS $$
            DECLARE
                v_free_credits DECIMAL;
                v_used_from_free DECIMAL;
                v_used_from_paid DECIMAL;
                v_result JSON;
            BEGIN
                -- ดึงเครดิตฟรีวันนี้
                v_free_credits := get_or_create_daily_credits(p_user_id);
                
                IF v_free_credits >= p_amount THEN
                    -- มีเครดิตฟรีพอ
                    v_used_from_free := p_amount;
                    v_used_from_paid := 0;
                    
                    -- หักเครดิตฟรี
                    UPDATE daily_free_credits
                    SET free_credits_remaining = free_credits_remaining - p_amount,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = p_user_id AND date = CURRENT_DATE;
                ELSE
                    -- เครดิตฟรีไม่พอ
                    v_used_from_free := v_free_credits;
                    v_used_from_paid := p_amount - v_free_credits;
                    
                    -- หักเครดิตฟรีให้หมด
                    UPDATE daily_free_credits
                    SET free_credits_remaining = 0,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = p_user_id AND date = CURRENT_DATE;
                END IF;
                
                v_result := json_build_object(
                    'used_from_free', v_used_from_free,
                    'used_from_paid', v_used_from_paid,
                    'free_remaining', GREATEST(0, v_free_credits - p_amount)
                );
                
                RETURN v_result;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        console.log('✅ Function use_free_credits created');
        
        console.log('\n✅ Free credits system setup complete!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

addFreeCreditsTable();