// update-packages.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function updatePackages() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Updating credit packages...\n');
        
        // 1. Clear existing packages
        console.log('Clearing old packages...');
        await client.query('DELETE FROM credit_packages');
        
        // 2. Insert new packages
        console.log('Inserting new packages...');
        await client.query(`
            INSERT INTO credit_packages (name, credits, price, bonus_credits, description, is_popular, sort_order) VALUES
            ('แพ็กเริ่มต้น', 5, 5, 0, 'ทดลองใช้งาน', FALSE, 1),
            ('แพ็กคุ้ม', 60, 50, 0, 'ประหยัด 16%!', TRUE, 2),
            ('แพ็กพิเศษ', 150, 100, 0, 'ประหยัด 33%!', FALSE, 3)
        `);
        
        // 3. Verify new packages
        const result = await client.query('SELECT * FROM credit_packages ORDER BY sort_order');
        
        console.log('\n✅ Updated packages:');
        result.rows.forEach(pkg => {
            console.log(`   - ${pkg.name}: ${pkg.credits} เครดิต = ${pkg.price} บาท`);
        });
        
        console.log('\n✅ Packages updated successfully!');
        
    } catch (error) {
        console.error('❌ Error updating packages:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run update
updatePackages()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));