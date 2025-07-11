require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const multer = require('multer');
const QRCode = require('qrcode');
const generatePayload = require('promptpay-qr');
const ESYSlipService = require('./esy-slip');


// Assistant IDs mapping
const ASSISTANT_CONFIGS = {
    standard: {
        general: process.env.ASSISTANT_ID,
        character: process.env.CHARACTER_ASSISTANT_ID,
        multichar: process.env.MULTI_CHARACTER_ASSISTANT_ID,
        chat: process.env.CHAT_ASSISTANT_ID
    }
};

// Log Assistant IDs on startup for debugging
console.log('🔍 Loaded Assistant IDs:', ASSISTANT_CONFIGS.standard);

// Log config
console.log('🤖 Assistant Configuration:');
console.log('Standard (4o-mini):', ASSISTANT_CONFIGS.standard);


// Setup multer for file upload
const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Initialize ESY Slip service
const esySlip = new ESYSlipService(process.env.ESY_SLIP_API_KEY);

// เพิ่ม debug log
console.log('ENV Check:');
console.log('REPLICATE_API_TOKEN:', process.env.REPLICATE_API_TOKEN ? 'Found ✓' : 'Not found ✗');
console.log('ASSISTANT_ID:', process.env.ASSISTANT_ID);
console.log('CHARACTER_ASSISTANT_ID:', process.env.CHARACTER_ASSISTANT_ID);
console.log('MULTI_CHARACTER_ASSISTANT_ID:', process.env.MULTI_CHARACTER_ASSISTANT_ID);
console.log('Loading .env from:', path.resolve(__dirname, '.env'));
console.log('ASSISTANT_ID:', process.env.ASSISTANT_ID);
console.log('MULTI_CHARACTER_ASSISTANT_ID:', process.env.MULTI_CHARACTER_ASSISTANT_ID ? 'Found ✓' : 'Not found ✗');


// Import modules
const assistants = require('./assistants');
const { openai } = assistants; // Get openai instance from assistants module
const chatAI = require('./chat-ai');
let db = null;
try {
    db = require('./database');
    console.log('✅ Database module loaded');
    
    // Run migrations on startup
    const { runMigrations } = require('./auto-migration');
    runMigrations().catch(console.error);
    
} catch (error) {
    console.log('⚠️  Database module not found, running without rate limiting');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (for Railway and other cloud platforms)
app.set('trust proxy', true);

// Settings
const DAILY_LIMIT_THB = 5.0;  // 5 บาท/คน/วัน
const COST_PER_1K_TOKENS = 0.02; // ประมาณ 0.02 บาท/1K tokens

// Store user threads (in production, use Redis or database)
const userThreads = new Map();

// Simple memory cache for API responses (15 seconds TTL)
const apiCache = new Map();
const CACHE_TTL = 15000; // 15 seconds

function getCached(key) {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    apiCache.delete(key);
    return null;
}

function setCache(key, data) {
    apiCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // ปิด CSP ไว้ก่อน เพราะทำให้ inline scripts ไม่ทำงาน
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // เพิ่มจาก 100 เป็น 500 requests
    message: 'Too many requests from this IP, please try again later.'
});

// Stricter rate limit for usage/credits endpoints
const usageLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute (รองรับ ~100 users)
    message: 'Too many usage requests, please try again later.'
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs for sensitive endpoints
    message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Request logging middleware for Railway
app.use((req, res, next) => {
    // Skip logging for frequent endpoints
    if (req.path.includes('/credits/') || req.path.includes('/usage/')) {
        return next();
    }
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    
    // Log body for POST requests (ยกเว้น sensitive data)
    if (req.method === 'POST' && req.path.includes('/chat')) {
        const { userId, mode, model } = req.body || {};
        console.log(`📝 Chat request: user=${userId}, mode=${mode}, model=${model}`);
    }
    
    next();
});

// Apply rate limit selectively (ไม่ใช้กับ credits และ usage)
app.use('/api/', (req, res, next) => {
    // Skip rate limiting for credits and usage endpoints
    if (req.path.includes('/credits/') || req.path.includes('/usage/')) {
        return next();
    }
    limiter(req, res, next);
});

// Admin authentication middleware
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];
    
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
};

// Serve admin page (optional - ถ้า static ไม่ทำงาน)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


// ======== HEALTH CHECK ENDPOINT ========
app.get('/health', (req, res) => {
    const healthInfo = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        assistants: {
            standard: {}
        },
        database: db ? 'connected' : 'disconnected'
    };
    
    // Check each assistant ID
    for (const [mode, id] of Object.entries(ASSISTANT_CONFIGS.standard)) {
        healthInfo.assistants.standard[mode] = {
            id: id,
            valid: id && id.startsWith('asst_') && id.length > 10
        };
    }
    
    
    res.json(healthInfo);
});

// ======== ADMIN ENDPOINTS ========
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'your-secret-admin-key-2025';

function checkAdminAuth(req, res, next) {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.post('/api/admin/add-credits', checkAdminAuth, async (req, res) => {
    const { userId, amount, note } = req.body;
    
    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }
        
        const result = await db.addCredits(
            userId,
            amount,
            'ชำระเงินผ่าน PromptPay',
            null,
            note || 'Manual credit addition'
        );
        
        if (result.success) {
            res.json({
                success: true,
                newBalance: result.newBalance,
                message: `Added ${amount} credits to ${userId}`
            });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error adding credits:', error);
        res.status(500).json({ error: 'Failed to add credits' });
    }
});

// Function to convert credits to actual payment amount in THB
function creditsToPaymentAmount(credits) {
    // Ensure credits is a number
    const creditAmount = parseFloat(credits);
    
    switch(creditAmount) {
        case 5: return 5;      // 5 บาท = 5 credits
        case 60: return 50;    // 50 บาท = 60 credits
        case 150: return 100;  // 100 บาท = 150 credits
        default: 
            // For other amounts, estimate based on base rate (1 credit = 1 baht)
            // This handles refunds or custom amounts
            return creditAmount;
    }
}

// Admin revenue dashboard endpoint
app.get('/api/admin/revenue-stats', checkAdminAuth, async (req, res) => {
    try {
        if (!db || !db.pool) {
            return res.status(500).json({ error: 'Database not available' });
        }

        // Get current date info
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
        
        // 1. Total revenue this month (convert credits to actual payment amounts)
        const monthRevenueResult = await db.pool.query(`
            SELECT amount
            FROM credit_transactions
            WHERE type = 'ADD' 
            AND created_at >= $1
            AND (description LIKE '%ชำระ%' OR description LIKE '%Payment%' OR admin_note IS NOT NULL)
        `, [firstDayOfMonth]);
        
        const monthRevenue = monthRevenueResult.rows.reduce((sum, row) => {
            return sum + creditsToPaymentAmount(parseFloat(row.amount));
        }, 0);
        
        // 2. Total revenue all time (convert credits to actual payment amounts)
        const totalRevenueResult = await db.pool.query(`
            SELECT amount
            FROM credit_transactions
            WHERE type = 'ADD'
            AND (description LIKE '%ชำระ%' OR description LIKE '%Payment%' OR admin_note IS NOT NULL)
        `);
        
        const totalRevenue = totalRevenueResult.rows.reduce((sum, row) => {
            return sum + creditsToPaymentAmount(parseFloat(row.amount));
        }, 0);
        
        // 3. Number of successful payments
        const paymentCountResult = await db.pool.query(`
            SELECT COUNT(*) as count
            FROM credit_transactions
            WHERE type = 'ADD'
            AND (description LIKE '%ชำระ%' OR description LIKE '%Payment%' OR admin_note IS NOT NULL)
        `);
        
        // 4. Top spenders (convert credits to actual payment amounts)
        const topSpendersResult = await db.pool.query(`
            SELECT 
                user_id,
                COUNT(*) as payment_count,
                MAX(created_at) as last_payment,
                array_agg(amount) as amounts
            FROM credit_transactions
            WHERE type = 'ADD'
            AND (description LIKE '%ชำระ%' OR description LIKE '%Payment%' OR admin_note IS NOT NULL)
            GROUP BY user_id
            ORDER BY user_id
        `);
        
        const topSpenders = topSpendersResult.rows.map(row => {
            const totalSpent = row.amounts.reduce((sum, amount) => {
                return sum + creditsToPaymentAmount(parseFloat(amount));
            }, 0);
            return {
                userId: row.user_id,
                paymentCount: parseInt(row.payment_count),
                totalSpent: totalSpent,
                lastPayment: row.last_payment
            };
        }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);
        
        // 5. Daily revenue for current month (convert credits to actual payment amounts)
        const dailyRevenueResult = await db.pool.query(`
            SELECT 
                DATE(created_at) as date,
                array_agg(amount) as amounts,
                COUNT(*) as transaction_count
            FROM credit_transactions
            WHERE type = 'ADD'
            AND created_at >= $1
            AND (description LIKE '%ชำระ%' OR description LIKE '%Payment%' OR admin_note IS NOT NULL)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [firstDayOfMonth]);
        
        const dailyRevenue = dailyRevenueResult.rows.map(row => {
            const revenue = row.amounts.reduce((sum, amount) => {
                return sum + creditsToPaymentAmount(parseFloat(amount));
            }, 0);
            return {
                date: row.date,
                revenue: revenue,
                transactionCount: parseInt(row.transaction_count)
            };
        });
        
        // 6. Monthly revenue for last 12 months (convert credits to actual payment amounts)
        const monthlyRevenueResult = await db.pool.query(`
            SELECT 
                TO_CHAR(created_at, 'YYYY-MM') as month,
                array_agg(amount) as amounts,
                COUNT(*) as transaction_count
            FROM credit_transactions
            WHERE type = 'ADD'
            AND created_at >= NOW() - INTERVAL '12 months'
            AND (description LIKE '%ชำระ%' OR description LIKE '%Payment%' OR admin_note IS NOT NULL)
            GROUP BY TO_CHAR(created_at, 'YYYY-MM')
            ORDER BY month ASC
        `);
        
        const monthlyRevenue = monthlyRevenueResult.rows.map(row => {
            const revenue = row.amounts.reduce((sum, amount) => {
                return sum + creditsToPaymentAmount(parseFloat(amount));
            }, 0);
            return {
                month: row.month,
                revenue: revenue,
                transactionCount: parseInt(row.transaction_count)
            };
        });
        
        // 7. Recent transactions (show both credits and actual payment amount)
        const recentTransactionsResult = await db.pool.query(`
            SELECT 
                user_id,
                amount,
                description,
                admin_note,
                created_at
            FROM credit_transactions
            WHERE type = 'ADD'
            AND (description LIKE '%ชำระ%' OR description LIKE '%Payment%' OR admin_note IS NOT NULL)
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        const recentTransactions = recentTransactionsResult.rows.map(row => ({
            userId: row.user_id,
            credits: parseFloat(row.amount),
            paymentAmount: creditsToPaymentAmount(parseFloat(row.amount)),
            description: row.description,
            adminNote: row.admin_note,
            createdAt: row.created_at
        }));

        res.json({
            success: true,
            data: {
                monthRevenue: monthRevenue,
                totalRevenue: totalRevenue,
                paymentCount: parseInt(paymentCountResult.rows[0].count),
                topSpenders: topSpenders,
                dailyRevenue: dailyRevenue,
                monthlyRevenue: monthlyRevenue,
                recentTransactions: recentTransactions
            }
        });
        
    } catch (error) {
        console.error('Error fetching revenue stats:', error);
        res.status(500).json({ error: 'Failed to fetch revenue statistics' });
    }
});

// Calculate cost (with premium for multichar mode)
function calculateCost(usage, mode = 'general') {
    const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
    let costPerThousand = COST_PER_1K_TOKENS;
    
    // Prompt Master mode ใช้ GPT-4o ราคาแพงกว่า
    if (mode === 'multichar') {
        // GPT-4o cost ~$5/1M input, $15/1M output
        // เฉลี่ยประมาณ 0.50 บาท/1K tokens + กำไร 10%
        costPerThousand = 0.02;
    }
    
    return (totalTokens / 1000) * costPerThousand;
}

// Test route
app.get('/test', (req, res) => {
    res.json({ 
        status: 'Server is working!',
        hasApiKey: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-key',
        hasAssistantId: !!process.env.ASSISTANT_ID,
        hasCharacterAssistantId: !!process.env.CHARACTER_ASSISTANT_ID,
        hasDatabase: !!db
    });
});

// ========== AI CHAT ENDPOINT ==========
// Chat endpoint using Assistants API
app.post('/api/chat', async (req, res) => {
    const { message, userId = 'guest', images = [], mode = 'general' } = req.body;
    let shouldUseCredits = false;
    

    // Check configuration
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
        return res.json({ 
            response: 'Demo Mode: กรุณาตั้งค่า OpenAI API Key ใน Railway Variables',
            isDemo: true 
        });
    }

    try {
        // ========== SELECT ASSISTANT ==========
        // Get assistant ID from config
        let assistantId = ASSISTANT_CONFIGS.standard[mode] || ASSISTANT_CONFIGS.standard.general;
        
        // Validate Assistant ID
        if (!assistantId || assistantId.length < 10) {
            console.error(`❌ Invalid Assistant ID for ${mode}: ${assistantId}`);
            console.log('Current config:', ASSISTANT_CONFIGS);
            return res.status(500).json({
                error: 'Assistant configuration error. Please contact support.'
            });
        }
        
        console.log(`📌 Using Assistant: ${assistantId} (${mode})`);
        const assistantType = 'standard'; // Always use standard now
        
        // ========== CHECK DAILY LIMIT ==========
        if (db) {
            const todayUsage = await db.getTodayUsage(userId);
            const estimatedCost = 0.10;
            const estimatedTotal = todayUsage + estimatedCost;
            
            if (estimatedTotal > DAILY_LIMIT_THB) {
                const creditsNeeded = estimatedTotal - DAILY_LIMIT_THB;
                const userCredits = await db.getUserCredits(userId);
                
                if (userCredits < creditsNeeded) {
                    return res.status(429).json({
                        error: 'Insufficient credits',
                        message: 'เครดิตไม่เพียงพอ กรุณาเติมเครดิต',
                        credits: {
                            current: userCredits.toFixed(2),
                            required: estimatedCost.toFixed(2)
                        },
                        usage: {
                            used: todayUsage.toFixed(2),
                            limit: DAILY_LIMIT_THB,
                            wouldBe: estimatedTotal.toFixed(2)
                        },
                    });
                }
                
                shouldUseCredits = true;
            }
        }

        // ========== CREATE THREAD AND RUN ==========
        const threadKey = `${userId}_${mode}_${assistantType}`;
        let threadId = userThreads.get(threadKey);
        
        // Thread management with retry logic
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount < maxRetries) {
            try {
                if (!threadId) {
                    threadId = await assistants.createThread();
                    userThreads.set(threadKey, threadId);
                    console.log(`✅ New thread created for ${userId}: ${threadId}`);
                }
                
                await assistants.addMessage(threadId, message, images);
                console.log('✅ Message added successfully');
                break;
                
            } catch (error) {
                console.error(`❌ Error (attempt ${retryCount + 1}):`, error.message);
                
                if (error.message.includes("Can't add messages") || 
                    error.status === 400 || error.status === 404) {
                    
                    userThreads.delete(threadKey);
                    
                    if (retryCount < maxRetries - 1) {
                        threadId = await assistants.createThread();
                        userThreads.set(threadKey, threadId);
                        retryCount++;
                    } else {
                        throw new Error('Failed to create valid thread after retries');
                    }
                } else {
                    throw error;
                }
            }
        }

        // Run assistant and get response
        const result = await assistants.runAssistant(threadId, assistantId);
        
        // ========== CALCULATE COST ==========
        let costTHB = 0;
        let todayTotal = 0;
        
        costTHB = calculateCost(result.usage, mode);
        todayTotal = costTHB;
        
        if (db) {
            console.log(`💰 === PROMPT GENERATION COST ===`);
            console.log(`💰 Mode: ${mode}`);
            console.log(`💰 Cost: ฿${costTHB.toFixed(2)}`);
            
            const creditResult = await db.useCreditsNew(
                userId,
                costTHB,
                `${mode} prompt generation`
            );
            
            if (creditResult.success) {
                console.log(`✅ Used ฿${costTHB.toFixed(2)}`);
                todayTotal = DAILY_LIMIT_THB - creditResult.free_remaining;
            } else {
                console.error('❌ Failed to deduct credits:', creditResult.error);
                return res.status(429).json({
                    error: 'Insufficient credits',
                    message: 'เครดิตไม่เพียงพอ',
                    credits: {
                        current: creditResult.paid_remaining || 0,
                        required: costTHB
                    },
                });
            }
        }

        // ========== SEND RESPONSE ==========
res.json({
    success: true,  // เพิ่ม field นี้
    response: result.response,
    model: 'gpt-4o-mini',  // เพิ่ม model
    cost: {
        this_request: costTHB.toFixed(2),
        today_total: todayTotal.toFixed(2),
        daily_limit: DAILY_LIMIT_THB.toFixed(2),
        remaining: (DAILY_LIMIT_THB - todayTotal).toFixed(2)
    },
    usage: {  // เก็บ usage ไว้ด้วย
        tokens: {
            input: result.usage.prompt_tokens,
            output: result.usage.completion_tokens,
            total: result.usage.total_tokens
        }
    },
});

    } catch (error) {
        console.error('❌ Chat error:', error);
        
        // Handle thread errors
        if (error.message && (error.message.includes('thread') || 
            error.message.includes('Thread') ||
            error.message.includes('assistant') ||
            error.status === 404)) {
            
            // Clear all threads for this user to ensure clean state
            const threadKeys = Array.from(userThreads.keys());
            threadKeys.forEach(key => {
                if (key.startsWith(userId)) {
                    const threadId = userThreads.get(key);
                    userThreads.delete(key);
                }
            });
            
            return res.status(500).json({ 
                error: 'Session expired. Please try again.',
                details: 'กรุณาลองส่งข้อความใหม่อีกครั้ง',
                shouldRetry: true,
                clearThread: true
            });
        }
        
        res.status(500).json({ 
    success: false,  // เพิ่ม
    error: 'Failed to generate response',
    details: error.message
});
    }
});

// ========== AI CHAT ALIAS ENDPOINT ==========
// Redirect /api/ai-chat to /api/chat with mode='chat'
app.post('/api/ai-chat', async (req, res, next) => {
    // Force mode to 'chat'
    req.body.mode = 'chat';
    
    // Log for debugging
    console.log('🤖 AI Chat request redirected to /api/chat');
    
    // Find the /api/chat handler
    const chatRoute = app._router.stack.find(layer => 
        layer.route && 
        layer.route.path === '/api/chat' && 
        layer.route.methods.post
    );
    
    if (chatRoute && chatRoute.route.stack[0]) {
        // Call the chat handler directly
        chatRoute.route.stack[0].handle(req, res, next);
    } else {
        console.error('❌ Cannot find /api/chat handler');
        res.status(500).json({ error: 'Chat endpoint not found' });
    }
});

// Character Library Endpoints

// Get all characters for a user
app.get('/api/characters/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        if (!db) {
            return res.json([]);
        }
        
        const characters = await db.getCharacters(userId);
        res.json(characters);
    } catch (error) {
        console.error('Error getting characters:', error);
        res.status(500).json({ error: 'Failed to get characters' });
    }
});

// Save new character
app.post('/api/characters', async (req, res) => {
    const { userId, name, profile, preview } = req.body;
    
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }
        
        const characterId = await db.saveCharacter(userId, name, profile, preview);
        res.json({ 
            success: true, 
            characterId 
        });
    } catch (error) {
        console.error('Error saving character:', error);
        res.status(500).json({ error: 'Failed to save character' });
    }
});

// Delete character
app.delete('/api/characters/:characterId', async (req, res) => {
    const { characterId } = req.params;
    
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }
        
        await db.deleteCharacter(characterId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting character:', error);
        res.status(500).json({ error: 'Failed to delete character' });
    }
});

// Save rating endpoint
// ========== RATING ENDPOINTS ==========
app.post('/api/ratings', async (req, res) => {
    const { userId, promptId, promptText, responseText, rating, feedback, mode } = req.body;
    
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database not available' });
        }
        
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Invalid rating' });
        }
        
        await db.saveRating(userId, promptId, promptText, responseText, rating, feedback, mode);
        const avgRating = await db.getUserAverageRating(userId);
        
        res.json({ 
            success: true,
            averageRating: avgRating
        });
    } catch (error) {
        console.error('Error saving rating:', error);
        res.status(500).json({ error: 'Failed to save rating' });
    }
});

app.get('/api/ratings/:userId', async (req, res) => {
    const { userId } = req.params;
    const { limit = 10 } = req.query;
    
    try {
        if (!db) {
            return res.json({ ratings: [], stats: {} });
        }
        
        const ratings = await db.getUserRatings(userId, limit);
        const stats = await db.getRatingStats(userId);
        
        res.json({ ratings, stats });
    } catch (error) {
        console.error('Error getting ratings:', error);
        res.status(500).json({ error: 'Failed to get ratings' });
    }
});

// Reset thread endpoint (optional)
app.post('/api/reset/:userId', (req, res) => {
    const { userId } = req.params;
    const { mode = 'general' } = req.body;
    
    const threadKey = `${userId}_${mode}`;
    if (userThreads.has(threadKey)) {
        const threadId = userThreads.get(threadKey);
        assistants.deleteThread(threadId); // Clean up old thread
        userThreads.delete(threadKey);
    }
    
    res.json({ message: 'Thread reset successfully' });
});

// Get usage stats
app.get('/api/usage/:userId', usageLimiter, async (req, res) => {
    const { userId } = req.params;
    const cacheKey = `usage_${userId}`;
    
    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json(cached);
    }
    
    try {
        if (!db) {
            return res.json({
                userId,
                today: {
                    used: 0,
                    limit: DAILY_LIMIT_THB,
                    remaining: DAILY_LIMIT_THB,
                    requests: 0,
                    percentUsed: 0
                },
                history: []
            });
        }

        // ดึงเครดิตฟรีคงเหลือจากระบบใหม่
        const freeCredits = await db.getFreeCredits(userId);
        const usedToday = DAILY_LIMIT_THB - freeCredits; // คำนวณว่าใช้ไปเท่าไหร่
        
        // ดึงข้อมูลเก่าสำหรับ history
        const stats = await db.getUsageStats(userId);
        
        const result = {
            userId,
            today: {
                used: usedToday.toFixed(2),
                limit: DAILY_LIMIT_THB.toFixed(2),
                remaining: freeCredits.toFixed(2), // เครดิตฟรีที่เหลือ
                requests: stats.today.requests || 0,
                percentUsed: ((usedToday / DAILY_LIMIT_THB) * 100).toFixed(0)
            },
            history: stats.week
        };
        
        // Cache the result
        setCache(cacheKey, result);
        
        res.json(result);
    } catch (error) {
        console.error('Error getting usage:', error);
        res.status(500).json({ error: 'Failed to get usage data' });
    }
});

// ========== ENHANCE PROMPT ENDPOINT ==========
app.post('/api/enhance-prompt', async (req, res) => {
    const { prompt, userId = 'guest' } = req.body;
    const assistantId = process.env.IMAGE_ENHANCE_ASSISTANT_ID || 'asst_fTpI5G9WTb9hUS165JsyDP94';
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Check API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
        return res.json({ 
            enhancedPrompt: prompt + ' (Demo mode - no enhancement)',
            isDemo: true 
        });
    }
    
    try {
        // Check daily limit
        let shouldUseCredits = false;
        const estimatedCost = 0.05;
        
        if (db) {
            const todayUsage = await db.getTodayUsage(userId);
            const estimatedTotal = todayUsage + estimatedCost;
            
            if (estimatedTotal > DAILY_LIMIT_THB) {
                const creditsNeeded = estimatedTotal - DAILY_LIMIT_THB;
                const userCredits = await db.getUserCredits(userId);
                
                if (userCredits < creditsNeeded) {
                    return res.status(429).json({
                        error: 'Insufficient credits',
                        message: 'เครดิตไม่เพียงพอ',
                        credits: {
                            current: userCredits.toFixed(2),
                            required: estimatedCost.toFixed(2)
                        }
                    });
                }
                shouldUseCredits = true;
            }
        }
        
        // Create thread and run assistant
        const threadId = await assistants.createThread();
        await assistants.addMessage(threadId, prompt, []);
        const result = await assistants.runAssistant(threadId, assistantId);
        
        // Clean up thread
        await assistants.deleteThread(threadId);
        
        // Calculate cost and save usage
        const costTHB = calculateCost(result.usage);
        
        if (db) {
            await db.saveUsage(userId, result.usage.prompt_tokens, result.usage.completion_tokens, costTHB);
            
            // หักเครดิตถ้าใช้เกิน daily limit
            // ⚠️ ไม่ใช้ตัวแปร mode ที่ไม่มี
            if (shouldUseCredits) {
                const latestUsage = await db.getTodayUsage(userId);
                const overLimitAmount = Math.max(0, latestUsage - DAILY_LIMIT_THB);
                
                if (overLimitAmount > 0) {
                    await db.useCredits(
                        userId, 
                        overLimitAmount, 
                        'Enhance prompt - exceeded daily limit'  // ← แก้ตรงนี้
                    );
                }
            }
        }
        
        // Send response
        res.json({
            enhancedPrompt: result.response,
            usage: {
                tokens: result.usage.total_tokens,
                cost: costTHB.toFixed(2)
            }
        });
        
    } catch (error) {
        console.error('Enhance prompt error:', error);
        res.status(500).json({ 
            error: 'Failed to enhance prompt',
            details: error.message 
        });
    }
});

// ======== CREDIT SYSTEM ENDPOINTS ========

// Endpoint ดูข้อมูลเครดิตรวม (ใช้งาน + เติม)
app.get('/api/user-credits-info/:userId', usageLimiter, async (req, res) => {
    const { userId } = req.params;
    
    try {
        const creditsInfo = await db.getUserCreditsInfo(userId);
        res.json({
            success: true,
            ...creditsInfo
        });
    } catch (error) {
        console.error('Error getting user credits info:', error);
        res.status(500).json({ error: 'Failed to get credits info' });
    }
});

// Endpoint ดูเครดิตและประวัติ
app.get('/api/credits/:userId', usageLimiter, async (req, res) => {
    const { userId } = req.params;
    const cacheKey = `credits_${userId}`;
    
    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json(cached);
    }
    
    try {
        const credits = await db.getUserCredits(userId);
        const history = await db.getCreditHistory(userId);
        
        const result = {
            currentCredits: credits,
            history: history
        };
        
        // Cache the result
        setCache(cacheKey, result);
        
        res.json(result);
    } catch (error) {
        console.error('Error getting credits:', error);
        res.status(500).json({ error: 'Failed to get credits' });
    }
});

// Endpoint ดูแพ็คเกจ
app.get('/api/credit-packages', async (req, res) => {
    try {
        const packages = await db.getCreditPackages();
        res.json(packages);
    } catch (error) {
        console.error('Error getting packages:', error);
        res.status(500).json({ error: 'Failed to get packages' });
    }
});

// Endpoint เติมเครดิต (Manual - สำหรับ Admin)
app.post('/api/credits/manual-add', adminAuth, async (req, res) => {
    const { userId, amount, note } = req.body;
    
    try {
        const result = await db.addCredits(
            userId, 
            amount, 
            'Manual credit adjustment',
            null,
            note
        );
        
        if (result.success) {
            res.json({
                success: true,
                newBalance: result.newBalance
            });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error adding credits:', error);
        res.status(500).json({ error: 'Failed to add credits' });
    }
});

// ========== SLIP VERIFICATION ENDPOINT ==========
// แทนที่โค้ดเดิมทั้งหมดของ endpoint นี้ (บรรทัด 1193-1318)
app.post('/api/verify-slip', strictLimiter, upload.single('slip'), async (req, res) => {
    console.log('📤 Slip verification request received');
    
    // Debug: ตรวจสอบ API Key
    console.log('🔑 ESY API Key exists:', !!process.env.ESY_SLIP_API_KEY);
    console.log('🔑 ESY API Key length:', process.env.ESY_SLIP_API_KEY?.length);
    console.log('🔑 ESY API Key first 10 chars:', process.env.ESY_SLIP_API_KEY?.substring(0, 10) + '...');
    
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ 
                error: 'กรุณาอัพโหลดไฟล์สลิป' 
            });
        }
        
        const { userId, packageId, expectedAmount } = req.body;
        
        // Validate inputs
        if (!userId || !packageId || !expectedAmount) {
            return res.status(400).json({ 
                error: 'ข้อมูลไม่ครบถ้วน' 
            });
        }
        
        console.log('📋 Verification details:', {
            userId,
            packageId,
            expectedAmount,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
            fileName: req.file.originalname
        });
        
        // Convert file to base64
        const slipData = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        
        console.log('📄 Base64 data info:', {
            length: slipData.length,
            firstChars: slipData.substring(0, 50) + '...',
            isValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(slipData)
        });
        
        // Verify with ESY Slip
        console.log('🔄 Calling ESY Slip API...');
        const verificationResult = await esySlip.verifySlip(slipData);
        
        console.log('📊 ESY Full Response:', JSON.stringify(verificationResult, null, 2));
console.log('💰 Raw amount:', verificationResult.amount, typeof verificationResult.amount);
console.log('📱 Raw data:', verificationResult.rawData);
        
        if (!verificationResult.success) {
            console.log('❌ ESY verification failed:', verificationResult.error);
            return res.status(400).json({ 
                error: verificationResult.error || 'ไม่สามารถตรวจสอบสลิปได้',
                details: 'กรุณาตรวจสอบว่าเป็นสลิปที่ถูกต้องและชัดเจน',
                debug: {
                    apiKeyExists: !!process.env.ESY_SLIP_API_KEY,
                    fileSize: req.file.size,
                    fileType: req.file.mimetype
                }
            });
        }
        
        console.log('✅ ESY verification success:', {
            amount: verificationResult.amount,
            ref: verificationResult.transactionRef,
            receiver: verificationResult.receiver,
            sender: verificationResult.sender
        });
        
        // Check if amount matches
        const tolerance = 1; // Allow 1 baht difference
        if (Math.abs(verificationResult.amount - parseFloat(expectedAmount)) > tolerance) {
            console.log('❌ Amount mismatch:', {
                expected: expectedAmount,
                received: verificationResult.amount
            });
            return res.status(400).json({ 
                error: `จำนวนเงินไม่ตรงกัน (ต้องการ ${expectedAmount} บาท, แต่โอนมา ${verificationResult.amount} บาท)` 
            });
        }
        
        // Check if receiver is correct
        console.log('🔍 Validating receiver:', {
            slipReceiver: verificationResult.receiver,
            expectedReceiver: process.env.PROMPTPAY_ID
        });
        
        // ปิดการตรวจสอบผู้รับชั่วคราว เพราะ ESY API อ่านไม่ได้
/*
if (!esySlip.validateReceiver(verificationResult, process.env.PROMPTPAY_ID)) {
    console.log('❌ Invalid receiver');
    return res.status(400).json({ 
        error: 'ผู้รับเงินไม่ถูกต้อง' 
    });
}
*/
console.log('Warning: Skipping receiver validation - ESY cannot read receiver info');
        
        // Check duplicate payment
        console.log('🔍 Checking duplicate payment...');
        const isDuplicate = await db.checkDuplicatePayment(verificationResult.transactionRef);
        if (isDuplicate) {
            console.log('⚠️ Duplicate payment detected');
            // Get existing payment info
            const existingPayment = await db.getPaymentByRef(verificationResult.transactionRef);
            if (existingPayment) {
                return res.json({
                    success: true,
                    isDuplicate: true,
                    message: 'สลิปนี้ถูกใช้แล้ว',
                    transactionRef: verificationResult.transactionRef,
                    newBalance: existingPayment.current_balance,
                    verifiedAt: existingPayment.verified_at
                });
            }
        }
        
        // Get package info
        console.log('📦 Getting package info...');
        const packages = await db.getCreditPackages();
        const selectedPackage = packages.find(p => p.id === parseInt(packageId));
        
        if (!selectedPackage) {
            console.log('❌ Package not found:', packageId);
            return res.status(400).json({ 
                error: 'ไม่พบแพ็คเกจที่เลือก' 
            });
        }
        
        // Calculate credits (including bonus)
        const baseCredits = parseFloat(selectedPackage.credits) || 0;
const bonusCredits = parseFloat(selectedPackage.bonus_credits) || 0;
const totalCredits = baseCredits + bonusCredits;
        console.log('💰 Credits to add:', {
    base: baseCredits,      // ใช้ตัวที่แปลงแล้ว
    bonus: bonusCredits,    // ใช้ตัวที่แปลงแล้ว
    total: totalCredits
});
        
        // Save payment and add credits
        console.log('💾 Saving payment verification...');
        const result = await db.savePaymentVerification(
            userId,
            verificationResult.transactionRef,
            totalCredits,
            packageId,
            verificationResult.rawData
        );
        
        if (result.success) {
            console.log('💰 Credits added successfully:', {
                userId,
                credits: totalCredits,
                newBalance: result.newBalance
            });
            
            res.json({
                success: true,
                message: 'ยืนยันการชำระเงินสำเร็จ',
                transactionRef: verificationResult.transactionRef,
                creditsAdded: totalCredits,
                newBalance: result.newBalance,
                packageName: selectedPackage.name
            });
        } else {
            throw new Error('Failed to save payment');
        }
        
    } catch (error) {
        console.error('❌ Slip verification error:', error);
        console.error('Error stack:', error.stack);
        
        res.status(500).json({ 
            error: 'เกิดข้อผิดพลาดในการตรวจสอบ กรุณาลองใหม่',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ========== QR CODE GENERATION ENDPOINT ==========
app.post('/api/generate-qr', async (req, res) => {
    try {
        const { amount, promptpayId } = req.body;
        
        if (!amount || !promptpayId) {
            return res.status(400).json({ 
                error: 'Missing required parameters' 
            });
        }
        
        // Format PromptPay ID (remove dashes and spaces)
        const cleanId = promptpayId.replace(/-|\s/g, '');
        
        // Generate PromptPay payload using promptpay-qr library
        const payload = generatePayload(cleanId, { amount: parseFloat(amount) });
        
        // Generate QR Code image from payload
        const qrCodeDataUrl = await QRCode.toDataURL(payload, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        
        console.log('✅ QR Code generated for amount:', amount);
        
        res.json({
            success: true,
            qrCode: qrCodeDataUrl,
            amount: amount,
            promptpayId: cleanId
        });
        
    } catch (error) {
        console.error('QR Code generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate QR code' 
        });
    }
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
        
╔═══════════════════════════════════════╗
║     Veo 3 Prompt Generator Server     ║
╚═══════════════════════════════════════╝

✅ Server running on port ${PORT}
📌 API Key: ${process.env.OPENAI_API_KEY ? 'Configured ✓' : 'Not configured ✗'}

Assistants (GPT-4o-mini):
📌 General: ${process.env.ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}
📌 Character: ${process.env.CHARACTER_ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}
📌 Multichar: ${process.env.MULTI_CHARACTER_ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}
💬 Chat: ${process.env.CHAT_ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}

📌 Database: ${db ? 'Connected ✓' : 'Not connected ✗'}
💰 Daily Limit: ${DAILY_LIMIT_THB} THB per user
🌐 URL: http://localhost:${PORT}

Available Features:
- GPT-4o-mini with credits system
- Auto Payment Verification
- Multiple prompt modes
    `);
});