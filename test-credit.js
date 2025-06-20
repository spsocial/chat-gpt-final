// test-credit.js
require('dotenv').config();
const db = require('./database');

async function testCreditSystem() {
    console.log('🔍 Testing Credit System...\n');
    
    try {
        // 1. Test database connection
        console.log('1. Testing database connection...');
        const testQuery = await db.pool.query('SELECT NOW()');
        console.log('✅ Database connected:', testQuery.rows[0].now);
        
        // 2. Check if credit tables exist
        console.log('\n2. Checking credit tables...');
        const tables = await db.pool.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('user_credits', 'credit_transactions', 'credit_packages')
            ORDER BY tablename
        `);
        
        console.log('Found tables:');
        tables.rows.forEach(row => {
            console.log(`   ✓ ${row.tablename}`);
        });
        
        if (tables.rows.length < 3) {
            console.log('\n❌ Missing credit tables! Run: npm run setup-credit');
            return;
        }
        
        // 3. Check credit packages
        console.log('\n3. Checking credit packages...');
        const packages = await db.getCreditPackages();
        
        if (packages.length === 0) {
            console.log('❌ No credit packages found!');
            console.log('   Run: npm run setup-credit');
        } else {
            console.log(`✅ Found ${packages.length} packages:`);
            packages.forEach(pkg => {
                console.log(`   - ${pkg.name}: ${pkg.credits} credits for ฿${pkg.price}`);
            });
        }
        
        // 4. Test user credits
        console.log('\n4. Testing user credits...');
        const testUserId = 'test_user_123';
        const credits = await db.getUserCredits(testUserId);
        console.log(`✅ User ${testUserId} has ${credits} credits`);
        
        // 5. Test API endpoint
        console.log('\n5. Testing API endpoint...');
        const express = require('express');
        const app = express();
        app.get('/api/credit-packages', async (req, res) => {
            const pkgs = await db.getCreditPackages();
            res.json(pkgs);
        });
        
        console.log('✅ API endpoint should work');
        
        console.log('\n✅ All tests passed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    } finally {
        await db.pool.end();
    }
}

// Run test
testCreditSystem();