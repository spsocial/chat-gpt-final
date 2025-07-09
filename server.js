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

// เพิ่มหลัง require อื่นๆ
const crypto = require('crypto');

// Encryption settings สำหรับ API keys
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

// Assistant IDs mapping
const ASSISTANT_CONFIGS = {
    standard: {
        general: process.env.ASSISTANT_ID,
        character: process.env.CHARACTER_ASSISTANT_ID,
        multichar: process.env.MULTI_CHARACTER_ASSISTANT_ID,
        chat: process.env.CHAT_ASSISTANT_ID
    },
    byok: {
        general: process.env.ASSISTANT_ID_4O,
        character: process.env.CHARACTER_ASSISTANT_ID_4O, 
        multichar: process.env.MULTI_CHARACTER_ASSISTANT_ID_4O,
        chat: process.env.CHAT_ASSISTANT_ID_4O
    }
};

// Log config
console.log('🤖 Assistant Configuration:');
console.log('Standard (4o-mini):', ASSISTANT_CONFIGS.standard);
console.log('BYOK (4o):', ASSISTANT_CONFIGS.byok);


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

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs for sensitive endpoints
    message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

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

// ========== ENCRYPTION FUNCTIONS ==========
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(ENCRYPTION_KEY),
        iv
    );
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            Buffer.from(ENCRYPTION_KEY),
            iv
        );
        
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

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
    let isUsingByok = false;
    let userOpenAI = null;
    

    // Check configuration
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
        return res.json({ 
            response: 'Demo Mode: กรุณาตั้งค่า OpenAI API Key ใน Railway Variables',
            isDemo: true 
        });
    }

    try {
        // ========== CHECK BYOK FIRST ==========
        const userApiData = await db.getUserApiKey(userId);
        
        if (userApiData.isByok && userApiData.apiKey) {
            // User has BYOK - decrypt and use their key
            const decryptedKey = decrypt(userApiData.apiKey);
            
            if (decryptedKey) {
                console.log(`🔑 Using BYOK for user: ${userId}`);
                isUsingByok = true;
                
                // สร้าง OpenAI instance ใหม่ด้วย user's key
                const OpenAI = require('openai');
                userOpenAI = new OpenAI({ apiKey: decryptedKey });
                
                // Increment BYOK usage counter
                await db.incrementByokUsage(userId);
            } else {
                console.error('Failed to decrypt user API key');
            }
        }
        
        // ========== SELECT ASSISTANT BASED ON USER TYPE ==========
        let assistantId;
        const assistantType = isUsingByok ? 'byok' : 'standard';
        
        // เลือก Assistant ID ตาม mode และ type
        if (isUsingByok) {
    switch(mode) {
        case 'character':
            assistantId = process.env.CHARACTER_ASSISTANT_ID_4O;
            break;
        case 'multichar':
            assistantId = process.env.MULTI_CHARACTER_ASSISTANT_ID_4O;
            break;
        case 'chat':  // เพิ่ม case นี้
            assistantId = process.env.CHAT_ASSISTANT_ID_4O;
            break;
        default:
            assistantId = process.env.ASSISTANT_ID_4O;
    }
} else {
    switch(mode) {
        case 'character':
            assistantId = process.env.CHARACTER_ASSISTANT_ID;
            break;
        case 'multichar':
            assistantId = process.env.MULTI_CHARACTER_ASSISTANT_ID;
            break;
        case 'chat':  // เพิ่ม case นี้
            assistantId = process.env.CHAT_ASSISTANT_ID;
            break;
        default:
            assistantId = process.env.ASSISTANT_ID;
    }
}
        
        // Verify assistant ID exists
        if (!assistantId) {
            return res.status(500).json({ 
                error: `${mode} Assistant ID not configured for ${assistantType} user` 
            });
        }
        
        console.log(`📌 Mode: ${mode}, Type: ${assistantType}, Assistant: ${assistantId}`);
        
        // ========== CHECK DAILY LIMIT (ONLY FOR NON-BYOK) ==========
        if (!isUsingByok && db) {
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
                        suggestByok: true
                    });
                }
                
                shouldUseCredits = true;
            }
        }

        // ========== CREATE THREAD AND RUN ==========
        const threadKey = `${userId}_${mode}_${assistantType}`;
        let threadId = userThreads.get(threadKey);
        
        // Create assistant instance (use user's or default)
        const openaiInstance = userOpenAI || assistants.openai;
        
        // Temporarily replace global assistants module functions
        const originalFunctions = {
            createThread: assistants.createThread,
            addMessage: assistants.addMessage,
            runAssistant: assistants.runAssistant,
            deleteThread: assistants.deleteThread
        };
        
        if (isUsingByok) {
            // Override with user's OpenAI instance
            assistants.createThread = async () => {
                const thread = await userOpenAI.beta.threads.create();
                return thread.id;
            };
            
            assistants.addMessage = async (threadId, content, images) => {
                let messageContent = content;
                if (images.length > 0) {
                    messageContent = [
                        { type: "text", text: content || "ช่วยสร้าง prompt จากรูปนี้" }
                    ];
                    for (const img of images) {
                        if (img.url) {
                            messageContent.push({
                                type: "image_url",
                                image_url: { url: img.url }
                            });
                        }
                    }
                }
                
                const message = await userOpenAI.beta.threads.messages.create(
                    threadId,
                    { role: "user", content: messageContent }
                );
                return message.id;
            };
            
            assistants.runAssistant = async (threadId, assistantId) => {
                const assistant = await userOpenAI.beta.assistants.retrieve(assistantId);
                console.log('BYOK Assistant model:', assistant.model);
                
                const run = await userOpenAI.beta.threads.runs.createAndPoll(
                    threadId,
                    { assistant_id: assistantId }
                );
                
                if (run.status === 'completed') {
                    const messages = await userOpenAI.beta.threads.messages.list(threadId);
                    const lastMessage = messages.data.find(msg => msg.role === 'assistant');
                    
                    if (lastMessage && lastMessage.content[0]) {
                        return {
                            response: lastMessage.content[0].text.value,
                            usage: run.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
                        };
                    }
                }
                
                throw new Error(`Run failed with status: ${run.status}`);
            };
            
            assistants.deleteThread = async (threadId) => {
                try {
                    await userOpenAI.beta.threads.del(threadId);
                } catch (error) {
                    console.error('Error deleting thread:', error);
                }
            };
        }
        
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
        
        // Restore original functions
        if (isUsingByok) {
            Object.assign(assistants, originalFunctions);
        }

        // ========== CALCULATE COST (ONLY FOR NON-BYOK) ==========
        let costTHB = 0;
        let todayTotal = 0;
        
        if (!isUsingByok) {
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
                        suggestByok: true
                    });
                }
            }
        }

        // ========== SEND RESPONSE ==========
res.json({
    success: true,  // เพิ่ม field นี้
    response: result.response,
    model: isUsingByok ? 'gpt-4o' : 'gpt-4o-mini',  // เพิ่ม model
    cost: isUsingByok ? {
        message: '🔑 Using your API key',
        isByok: true
    } : {
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
    usingByok: isUsingByok
});

    } catch (error) {
        console.error('❌ Chat error:', error);
        
        // Handle thread errors
        if (error.message.includes('thread') || 
            error.message.includes('Thread') ||
            error.message.includes('assistant')) {
            
            const threadKey = `${userId}_${mode}_${isUsingByok ? 'byok' : 'standard'}`;
            userThreads.delete(threadKey);
            
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

// ========== BYOK ENDPOINTS ==========

// Test API Key
app.post('/api/test-api-key', async (req, res) => {
    const { apiKey } = req.body;
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
        return res.json({ valid: false });
    }
    
    try {
        // Test with a simple API call
        const OpenAI = require('openai');
        const testOpenAI = new OpenAI({ apiKey });
        const models = await testOpenAI.models.list();
        
        // Check if has access to GPT-4o
        const hasGPT4o = models.data.some(m => m.id.includes('gpt-4o'));
        
        res.json({ 
            valid: true,
            hasGPT4o: hasGPT4o,
            message: hasGPT4o ? 'API Key valid with GPT-4o access!' : 'API Key valid (GPT-3.5 only)'
        });
        
    } catch (error) {
        console.error('API Key test error:', error);
        res.json({ valid: false });
    }
});

// Save API Key
app.post('/api/save-api-key', async (req, res) => {
    const { userId, apiKey } = req.body;
    
    console.log('📝 Save API Key request:', { userId, hasApiKey: !!apiKey });
    
    if (!userId || !apiKey) {
        return res.status(400).json({ 
            error: 'Missing required fields' 
        });
    }
    
    try {
        // Check if database is available
        if (!db) {
            return res.status(503).json({ 
                error: 'Database service unavailable' 
            });
        }

        // Encrypt API key
        const encryptedKey = encrypt(apiKey);
        
        // Save to database
        const result = await db.saveUserApiKey(userId, encryptedKey);
        
        if (result.success) {
            res.json({ 
                success: true,
                message: 'API Key saved successfully' 
            });
        } else {
            console.error('Database save failed:', result.error);
            res.status(500).json({ 
                error: 'Failed to save API key',
                details: result.error 
            });
        }
        
    } catch (error) {
        console.error('Save API key error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Remove API Key
app.post('/api/remove-api-key', async (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ 
            error: 'User ID required' 
        });
    }
    
    try {
        const result = await db.removeUserApiKey(userId);
        
        if (result.success) {
            res.json({ 
                success: true,
                message: 'API Key removed' 
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to remove API key' 
            });
        }
        
    } catch (error) {
        console.error('Remove API key error:', error);
        res.status(500).json({ 
            error: 'Internal server error' 
        });
    }
});

// Get BYOK Status
app.get('/api/byok-status/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const userData = await db.getUserApiKey(userId);
        
        res.json({
            hasByok: userData.isByok,
            isActive: userData.isByok
        });
        
    } catch (error) {
        console.error('Get BYOK status error:', error);
        res.json({
            hasByok: false,
            isActive: false
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
║        with BYOK Support 🔑           ║
╚═══════════════════════════════════════╝

✅ Server running on port ${PORT}
📌 API Key: ${process.env.OPENAI_API_KEY ? 'Configured ✓' : 'Not configured ✗'}

Standard Assistants (GPT-4o-mini):
📌 General: ${process.env.ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}
📌 Character: ${process.env.CHARACTER_ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}
📌 Multichar: ${process.env.MULTI_CHARACTER_ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}
💬 Chat: ${process.env.CHAT_ASSISTANT_ID ? 'Configured ✓' : 'Not configured ✗'}  // เพิ่ม

BYOK Assistants (GPT-4o):
🔑 General: ${process.env.ASSISTANT_ID_4O ? 'Configured ✓' : 'Not configured ✗'}
🔑 Character: ${process.env.CHARACTER_ASSISTANT_ID_4O ? 'Configured ✓' : 'Not configured ✗'}
🔑 Multichar: ${process.env.MULTI_CHARACTER_ASSISTANT_ID_4O ? 'Configured ✓' : 'Not configured ✗'}
💬 Chat: ${process.env.CHAT_ASSISTANT_ID_4O ? 'Configured ✓' : 'Not configured ✗'}  // เพิ่ม

📌 Database: ${db ? 'Connected ✓' : 'Not connected ✗'}
💰 Daily Limit: ${DAILY_LIMIT_THB} THB per user
🔐 Encryption Key: ${ENCRYPTION_KEY ? 'Set ✓' : 'Not set ✗'}
🌐 URL: http://localhost:${PORT}

Available Features:
- Standard Mode (GPT-4o-mini with credits)
- BYOK Mode (GPT-4o with user's API key)
- Auto Payment Verification
    `);
});