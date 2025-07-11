// Alternative approach - use a separate table for API keys
async function saveUserApiKeyAlternative(userId, encryptedApiKey) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_api_keys (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) UNIQUE NOT NULL,
                api_key TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Insert or update
        await client.query(`
            INSERT INTO user_api_keys (user_id, api_key, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                api_key = $2,
                updated_at = NOW()
        `, [userId, encryptedApiKey]);
        
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