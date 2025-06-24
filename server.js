require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const multer = require('multer');
const QRCode = require('qrcode');
const generatePayload = require('promptpay-qr');
const ESYSlipService = require('./esy-slip');

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

// Import modules
const assistants = require('./assistants');
const chatAI = require('./chat-ai');
let db = null;
try {
    db = require('./database');
    console.log('✅ Database module loaded');
} catch (error) {
    console.log('⚠️  Database module not found, running without rate limiting');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Settings
const DAILY_LIMIT_THB = 5.0;  // 5 บาท/คน/วัน
const COST_PER_1K_TOKENS = 0.02; // ประมาณ 0.02 บาท/1K tokens

// Store user threads (in production, use Redis or database)
const userThreads = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Serve admin page (optional - ถ้า static ไม่ทำงาน)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
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

// Calculate cost
function calculateCost(usage) {
    const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
    return (totalTokens / 1000) * COST_PER_1K_TOKENS;
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

    // Select assistant based on mode
    let assistantId;
    if (mode === 'character') {
        assistantId = process.env.CHARACTER_ASSISTANT_ID;
        if (!assistantId) {
            return res.status(500).json({ 
                error: 'Character Assistant ID not configured'
            });
        }
    } else {
    console.log('General mode - ASSISTANT_ID:', process.env.ASSISTANT_ID);
    assistantId = process.env.ASSISTANT_ID || 'asst_p1ZxkTa5US7Yn1GgUSy8sNy9';
        if (!assistantId) {
            return res.status(500).json({ 
                error: 'Assistant ID not configured'
            });
        }
    }

    try {
        // Check daily limit if database is available
        if (db) {
            const todayUsage = await db.getTodayUsage(userId);
            
            const estimatedCost = 0.10; // เพิ่มบรรทัดนี้
const estimatedTotal = todayUsage + estimatedCost; // แก้จาก 0.05 เป็น estimatedCost

if (estimatedTotal > DAILY_LIMIT_THB) {
    // คำนวณว่าต้องใช้เครดิตเท่าไหร่ (เฉพาะส่วนที่เกิน 5 บาท)
    const creditsNeeded = estimatedTotal - DAILY_LIMIT_THB;
    const userCredits = await db.getUserCredits(userId);
    
    if (userCredits < creditsNeeded) {  // แก้จาก estimatedCost เป็น creditsNeeded
        // ไม่มีเครดิตพอ
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
            }
        });
    }
    
    // มีเครดิตพอ - จะหักเครดิตหลังจากสร้าง prompt สำเร็จ
    // ตั้ง flag ไว้ก่อน
    shouldUseCredits = true;  // ไม่ต้องมี var หรือ let
}
        }

        // แทนที่โค้ดเดิมด้วยโค้ดนี้

// Get or create thread with error handling
const threadKey = `${userId}_${mode}`;
let threadId = userThreads.get(threadKey);
let retryCount = 0;
const maxRetries = 2;

// Function to create new thread
const createNewThread = async () => {
    try {
        threadId = await assistants.createThread();
        userThreads.set(threadKey, threadId);
        console.log(`✅ New thread created for ${userId}: ${threadId}`);
        return threadId;
    } catch (err) {
        console.error('❌ Failed to create thread:', err);
        throw err;
    }
};

// Try to use existing thread or create new one
while (retryCount < maxRetries) {
    try {
        if (!threadId) {
            console.log('📌 No thread found, creating new one...');
            threadId = await createNewThread();
        }

        // Try to add message
        console.log('📨 Adding message to thread...');
        await assistants.addMessage(threadId, message, images);
        
        // If successful, break the loop
        console.log('✅ Message added successfully');
        break;

    } catch (error) {
        console.error(`❌ Error adding message (attempt ${retryCount + 1}):`, error.message);
        
        // If thread is expired or invalid
        if (error.message.includes("Can't add messages to thread") || 
            error.message.includes("No thread found") ||
            error.message.includes("No assistant found") ||
            error.status === 400 || 
            error.status === 404) {
            
            console.log('🔄 Thread expired or invalid, creating new thread...');
            
            // Delete old thread reference
            userThreads.delete(threadKey);
            
            // Create new thread
            if (retryCount < maxRetries - 1) {
                threadId = await createNewThread();
                retryCount++;
            } else {
                throw new Error('Failed to create valid thread after retries');
            }
        } else {
            // Other errors, don't retry
            throw error;
        }
    }
}

        // Add message to thread
        await assistants.addMessage(threadId, message, images);

        // Run assistant and get response
        const result = await assistants.runAssistant(threadId, assistantId);

        // Calculate cost
        const costTHB = calculateCost(result.usage);
        let todayTotal = costTHB;

        // Save usage if database is available
        if (db) {
    console.log(`💰 === PROMPT GENERATION COST ===`);
    console.log(`💰 Mode: ${mode}`);
    console.log(`💰 Cost: ฿${costTHB.toFixed(2)}`);
    
    // ใช้ระบบเครดิตใหม่
    const creditResult = await db.useCreditsNew(
        userId,
        costTHB,
        `${mode} prompt generation`
    );
    
    if (creditResult.success) {
        console.log(`✅ Used ฿${costTHB.toFixed(2)}:`);
        console.log(`   - From free: ฿${creditResult.used_from_free.toFixed(2)}`);
        console.log(`   - From paid: ฿${creditResult.used_from_paid.toFixed(2)}`);
        console.log(`   - Free remaining: ฿${creditResult.free_remaining.toFixed(2)}`);
        console.log(`   - Paid remaining: ฿${creditResult.paid_remaining.toFixed(2)}`);
        
        // เก็บค่าสำหรับแสดงผล
        todayTotal = DAILY_LIMIT_THB - creditResult.free_remaining;
    } else {
        console.error('❌ Failed to deduct credits:', creditResult.error);
        // ถ้าหักเครดิตไม่สำเร็จ ให้หยุดทำงาน
        return res.status(429).json({
            error: 'Insufficient credits',
            message: 'เครดิตไม่เพียงพอ',
            credits: {
                current: creditResult.paid_remaining || 0,
                required: costTHB
            }
        });
    }
}

        // Send response
        res.json({
            response: result.response,
            mode: mode,
            usage: {
                tokens: {
                    input: result.usage.prompt_tokens,
                    output: result.usage.completion_tokens,
                    total: result.usage.total_tokens
                },
                cost: {
                    this_request: costTHB.toFixed(2),
                    today_total: todayTotal.toFixed(2),
                    daily_limit: DAILY_LIMIT_THB.toFixed(2),
                    remaining: (DAILY_LIMIT_THB - todayTotal).toFixed(2)
                }
            }
        });

    } catch (error) {
    console.error('❌ Chat error:', error);
    
    // Special handling for thread errors
    if (error.message.includes('thread') || 
        error.message.includes('Thread') ||
        error.message.includes('assistant')) {
        
        // Clear the thread for this user
        const threadKey = `${userId}_${mode}`;
        userThreads.delete(threadKey);
        
        console.log('🔄 Cleared expired thread for user:', userId);
        
        return res.status(500).json({ 
            error: 'Session expired. Please try again.',
            details: 'กรุณาลองส่งข้อความใหม่อีกครั้ง',
            shouldRetry: true,
            clearThread: true
        });
    }
    
    // Handle other errors
    res.status(500).json({ 
        error: 'Failed to generate response',
        details: error.message 
    });
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
app.get('/api/usage/:userId', async (req, res) => {
    const { userId } = req.params;
    
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
        
        res.json({
            userId,
            today: {
                used: usedToday.toFixed(2),
                limit: DAILY_LIMIT_THB.toFixed(2),
                remaining: freeCredits.toFixed(2), // เครดิตฟรีที่เหลือ
                requests: stats.today.requests || 0,
                percentUsed: ((usedToday / DAILY_LIMIT_THB) * 100).toFixed(0)
            },
            history: stats.week
        });
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

// ========== AI CHAT ENDPOINT ==========
app.post('/api/ai-chat', async (req, res) => {
    const { message, userId = 'guest', model = 'gpt-3.5-turbo', images = [], history = [] } = req.body;
    
    console.log('🤖 AI Chat request:', { userId, model, hasImages: images.length > 0 });
    
    // Validate input
    if (!message && images.length === 0) {
        return res.status(400).json({ 
            error: 'Message or image is required' 
        });
    }
    
    try {
        // 1. ตรวจสอบเครดิต
        if (db) {
            // ประมาณการใช้ tokens (คร่าวๆ)
            const estimatedTokens = 500; // ประมาณ 500 tokens ต่อครั้ง
            const estimatedCost = chatAI.calculateCostTHB(
                estimatedTokens / 2,  // input
                estimatedTokens / 2,  // output
                model
            );
            
            console.log(`💰 Estimated cost: ฿${estimatedCost.toFixed(2)}`);
            
            // ใช้ระบบเครดิตใหม่
            const creditCheck = await db.getUserCredits(userId);
            const freeCredits = await db.getFreeCredits(userId);
            const totalAvailable = creditCheck + freeCredits;
            
            if (totalAvailable < estimatedCost) {
                return res.status(429).json({
                    error: 'Insufficient credits',
                    message: 'เครดิตไม่เพียงพอ',
                    credits: {
                        current: totalAvailable.toFixed(2),
                        required: estimatedCost.toFixed(2)
                    }
                });
            }
        }
        
        // 2. เตรียม messages array
        const messages = [
            {
                role: 'system',
                content: 'You are a helpful AI assistant. คุณเป็น AI ผู้ช่วยที่พูดภาษาไทยได้ ตอบคำถามแบบเป็นกันเอง'
            }
        ];
        
        // เพิ่ม history (ถ้ามี)
        if (history.length > 0) {
            // เอาแค่ 10 ข้อความล่าสุด
            const recentHistory = history.slice(-10);
            messages.push(...recentHistory);
        }
        
        // เพิ่ม message ปัจจุบัน
        messages.push({
            role: 'user',
            content: message || 'วิเคราะห์รูปนี้ให้หน่อย'
        });
        
        // 3. เรียกใช้ AI
        console.log('📨 Sending to AI...');
        const result = await chatAI.chat(model, messages, images);
        
        // 4. หักเครดิต
        if (db) {
            const actualCost = result.costTHB;
            console.log(`💰 Actual cost: ฿${actualCost.toFixed(4)}`);
            
            // ใช้ระบบเครดิตใหม่
            const creditResult = await db.useCreditsNew(
                userId,
                actualCost,
                `AI Chat - ${model}`
            );
            
            if (!creditResult.success) {
                console.error('Failed to deduct credits:', creditResult.error);
            }
        }
        
        // 5. ส่งผลลัพธ์กลับ
        res.json({
            success: true,
            response: result.content,
            model: result.model,
            usage: result.usage,
            cost: result.costTHB
        });
        
    } catch (error) {
        console.error('AI Chat error:', error);
        res.status(500).json({ 
            error: 'Failed to process chat',
            details: error.message 
        });
    }
});

// ========== IMAGE GENERATION ENDPOINT ==========
app.post('/api/generate-image', async (req, res) => {
    const { prompt, userId, model = 'flux-schnell', aspectRatio = '1:1' } = req.body;
    
    // Check if Replicate API key exists
    if (!process.env.REPLICATE_API_TOKEN) {
        return res.status(500).json({ 
            error: 'Replicate API key not configured' 
        });
    }
    
    // Model pricing
    const modelPricing = {
        'flux-schnell': 0.15,
        'flux-dev': 0.20,
        'sdxl-lightning': 0.50
    };
    
    const cost = modelPricing[model] || 0.15;
    
    try {
        // Check daily limit and credits
        if (db) {
            const todayUsage = await db.getTodayUsage(userId);
            const dailyRemaining = Math.max(0, 5 - todayUsage);
            
            if (dailyRemaining >= cost) {
                // Use daily limit
                console.log('Using daily limit');
            } else {
                // Need to use credits
                const creditsNeeded = cost - dailyRemaining;
                const userCredits = await db.getUserCredits(userId);
                
                if (userCredits < creditsNeeded) {
                    return res.status(429).json({
                        error: 'Insufficient credits',
                        message: 'เครดิตไม่เพียงพอ',
                        credits: {
                            current: userCredits.toFixed(2),
                            required: creditsNeeded.toFixed(2)
                        }
                    });
                }
            }
        }
        
        try {
    // สร้าง prediction แทนการ run โดยตรง
    const Replicate = require('replicate');
    const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN
    });
    
    // กำหนด model version ตาม model ที่เลือก
    let modelVersion = '';
    if (model === 'flux-schnell') {
        modelVersion = 'black-forest-labs/flux-schnell';
    } else if (model === 'flux-dev') {
        modelVersion = 'black-forest-labs/flux-dev';
    } else {
        modelVersion = 'playgroundai/playground-v2.5-1024px-aesthetic:42fe626e41cc811eaf02c94b892774839268ce1994ea778eba97103fe1ef51b8';
}
    
    console.log('Creating prediction for:', modelVersion);
    
    // สร้าง prediction
    const prediction = await replicate.predictions.create({
        model: modelVersion,
        input: {
            prompt: prompt,
            aspect_ratio: aspectRatio || '1:1',
            output_format: 'webp',
            output_quality: 90
        }
    });
    
    console.log('Prediction created:', prediction.id);
    
    // รอผลลัพธ์
    let result = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // รอ 1 วินาที
        result = await replicate.predictions.get(prediction.id);
        console.log('Status:', result.status);
    }
    
    if (result.status === 'succeeded') {
        const imageUrl = result.output[0] || result.output;
        console.log('Image URL:', imageUrl);
        
        // Save usage และหักเครดิต
if (db) {
    console.log(`💰 === NEW CREDIT SYSTEM ===`);
    console.log(`💰 Image cost: ฿${cost}`);
    
    // ใช้ระบบใหม่
    const creditResult = await db.useCreditsNew(
        userId,
        cost,
        `Image generation - ${model}`
    );
    
    if (creditResult.success) {
        console.log(`✅ Used ฿${cost}:`);
        console.log(`   - From free: ฿${creditResult.used_from_free.toFixed(2)}`);
        console.log(`   - From paid: ฿${creditResult.used_from_paid.toFixed(2)}`);
        console.log(`   - Free remaining: ฿${creditResult.free_remaining.toFixed(2)}`);
        console.log(`   - Paid remaining: ฿${creditResult.paid_remaining.toFixed(2)}`);
    } else {
        console.error('❌ Failed to deduct credits:', creditResult.error);
    }
}
        
        res.json({
            success: true,
            imageUrl: imageUrl,
            model: model,
            cost: cost
        });
    } else {
        throw new Error('Image generation failed');
    }
    
} catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ 
        error: 'Failed to generate image',
        details: error.message 
    });
}
        
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate image',
            details: error.message 
        });
    }
});

// ======== CREDIT SYSTEM ENDPOINTS ========

// Endpoint ดูเครดิตและประวัติ
app.get('/api/credits/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const credits = await db.getUserCredits(userId);
        const history = await db.getCreditHistory(userId);
        
        res.json({
            currentCredits: credits,
            history: history
        });
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
app.post('/api/credits/manual-add', async (req, res) => {
    const { userId, amount, note } = req.body;
    
    // TODO: เพิ่มการตรวจสอบสิทธิ์ admin
    
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
app.post('/api/verify-slip', upload.single('slip'), async (req, res) => {
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

// ======== ADMIN ENDPOINTS ========

// Middleware ตรวจสอบ admin key
function checkAdminAuth(req, res, next) {
    const adminKey = req.headers['x-admin-key'];
    
    if (!adminKey || adminKey !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
}

// Admin endpoint เติมเครดิต
app.post('/api/admin/add-credits', checkAdminAuth, async (req, res) => {
    const { userId, amount, note } = req.body;
    
    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ 
            error: 'Invalid parameters' 
        });
    }
    
    try {
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
            res.status(400).json({ 
                error: result.error 
            });
        }
    } catch (error) {
        console.error('Error adding credits:', error);
        res.status(500).json({ 
            error: 'Failed to add credits' 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
        
╔═══════════════════════════════════════╗
║     Veo 3 Prompt Generator Server     ║
║        with Character Support         ║
╚═══════════════════════════════════════╝

✅ Server running on port ${PORT}
📌 API Key: ${process.env.OPENAI_API_KEY ? 'Configured ✓' : 'Not configured ✗'}
📌 General Assistant: ${process.env.ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}
📌 Character Assistant: ${process.env.CHARACTER_ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}
📌 Database: ${db ? 'Connected ✓' : 'Not connected ✗'}
💰 Daily Limit: ${DAILY_LIMIT_THB} THB per user
📱 PromptPay: ${process.env.PROMPTPAY_ID || 'Not configured'}
💳 ESY Slip API: ${process.env.ESY_SLIP_API_KEY ? 'Configured ✓' : 'Not configured ✗'}
🌐 URL: http://localhost:${PORT}


Available Modes:
- General Prompt Generator
- Character Creator
- Character Library
- Auto Payment Verification ✨ NEW!
    `);
});