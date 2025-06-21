require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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
            const currentUsage = await db.getTodayUsage(userId);
            todayTotal = currentUsage + costTHB;
            await db.saveUsage(
                userId, 
                result.usage.prompt_tokens, 
                result.usage.completion_tokens, 
                costTHB
            );
        }

// หักเครดิตถ้าใช้เกิน daily limit
if (db) {  // ลบ shouldUseCredits ออก เช็คทุกครั้ง
    // ดึงการใช้งานล่าสุดหลังบันทึก
    const latestUsage = await db.getTodayUsage(userId);
    
    console.log(`💳 === CREDIT CHECK ===`);
    console.log(`💳 Today's usage: ฿${latestUsage.toFixed(2)}`);
    console.log(`💳 Daily limit: ฿${DAILY_LIMIT_THB}`);
    console.log(`💳 User credits: ${await db.getUserCredits(userId)}`);
    
    // ถ้าใช้เกิน 5 บาท
    if (latestUsage > DAILY_LIMIT_THB) {
        // คำนวณส่วนที่เกิน
        const overLimitAmount = latestUsage - DAILY_LIMIT_THB;
        console.log(`💳 Over limit by: ฿${overLimitAmount.toFixed(2)}`);
        
        // ตรวจสอบเครดิต
        const userCredits = await db.getUserCredits(userId);
        console.log(`💳 User has credits: ฿${userCredits.toFixed(2)}`);
        
        if (userCredits >= overLimitAmount) {
            // มีเครดิตพอ - หักเครดิต
            const deductResult = await db.useCredits(
                userId,
                overLimitAmount,
                `${mode} prompt - exceeded daily limit by ฿${overLimitAmount.toFixed(2)}`
            );
            
            if (deductResult.success) {
                console.log(`✅ CREDIT DEDUCTED: ฿${overLimitAmount.toFixed(2)}`);
                console.log(`💰 New balance: ฿${deductResult.newBalance.toFixed(2)}`);
            } else {
                console.error(`❌ CREDIT DEDUCTION FAILED:`, deductResult.error);
            }
        } else {
            console.log(`⚠️ Insufficient credits: has ${userCredits}, needs ${overLimitAmount}`);
        }
    } else {
        console.log(`✅ Within daily limit, no credit deduction needed`);
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

        const stats = await db.getUsageStats(userId);
        
        res.json({
            userId,
            today: {
                used: stats.today.used.toFixed(2),
                limit: DAILY_LIMIT_THB.toFixed(2),
                remaining: (DAILY_LIMIT_THB - stats.today.used).toFixed(2),
                requests: stats.today.requests,
                percentUsed: ((stats.today.used / DAILY_LIMIT_THB) * 100).toFixed(0)
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
    const assistantId = process.env.ASSISTANT_ID || 'asst_p1ZxkTa5US7Yn1GgUSy8sNy9';
    
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
        
        // Save usage
        if (db) {
            await db.saveUsage(userId, 0, 0, cost);
            
            const todayUsage = await db.getTodayUsage(userId);
            if (todayUsage > 5) {
                const creditsToUse = todayUsage - 5;
                await db.useCredits(userId, creditsToUse, `Image generation - ${model}`);
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
🌐 URL: http://localhost:${PORT}

Available Modes:
• General Prompt Generator
• Character Creator
• Character Library
    `);
});