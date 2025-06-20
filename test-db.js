require('dotenv').config();

console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('First 20 chars:', process.env.DATABASE_URL?.substring(0, 20));

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Connection failed:', err.message);
    } else {
        console.log('✅ Connected to database at:', res.rows[0].now);
    }
    pool.end();
});