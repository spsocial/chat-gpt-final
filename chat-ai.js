// chat-ai.js
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize APIs
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Check if Google API key exists
if (!process.env.GOOGLE_AI_API_KEY) {
    console.warn('⚠️ WARNING: Google AI API key not configured!');
    console.warn('⚠️ Gemini models will not work without API key');
}

// Model configurations with pricing (per 1K tokens)
const MODEL_CONFIG = {
    // OpenAI Models
    'gpt-3.5-turbo': {
        api: 'openai',
        name: 'GPT-3.5 Turbo',
        inputCost: 0.0005,
        outputCost: 0.0015,
        description: 'เร็ว ประหยัด เหมาะกับงานทั่วไป',
        displayPrice: '0.07 เครดิต/1K tokens'
    },
    'gpt-4o-mini': {
        api: 'openai',
        name: 'GPT-4o Mini',
        inputCost: 0.00015,
        outputCost: 0.0006,
        description: 'ฉลาดกว่า คุ้มค่า',
        displayPrice: '0.015 เครดิต/1K tokens'
    },
    'gpt-4o': {
        api: 'openai',
        name: 'GPT-4o',
        inputCost: 0.005,
        outputCost: 0.015,
        description: 'ฉลาดที่สุด เหมาะกับงานซับซ้อน',
        displayPrice: '0.25 เครดิต/1K tokens'
    },
    
    // Google Models
    'gemini-1.5-flash': {
    api: 'google',
    name: 'Gemini 1.5 Flash',
    inputCost: 0.000075,     // ← แก้แล้ว (เพิ่มขึ้น 4 เท่า)
    outputCost: 0.0003,      // ← แก้แล้ว (เพิ่มขึ้น 4 เท่า)
    description: 'เร็วมาก ราคาถูก',
    displayPrice: '0.008 เครดิต/1K tokens'  // ← อัพเดทราคาแสดง
},
    'gemini-1.5-pro': {
        api: 'google',
        name: 'Gemini 1.5 Pro',
        inputCost: 0.00125,
        outputCost: 0.005,
        description: 'ฉลาด เหมาะกับงานที่ต้องการความแม่นยำ',
        displayPrice: '0.12 เครดิต/1K tokens'
    }
};

// Function to calculate cost in THB (with 10% markup)
function calculateCostTHB(inputTokens, outputTokens, model) {
    const config = MODEL_CONFIG[model];
    if (!config) return 0;
    
    // Calculate base cost in USD
    const inputCostUSD = (inputTokens / 1000) * config.inputCost;
    const outputCostUSD = (outputTokens / 1000) * config.outputCost;
    const totalCostUSD = inputCostUSD + outputCostUSD;
    
    // Convert to THB (assume 35 THB/USD) and add 10% markup
    const totalCostTHB = totalCostUSD * 35 * 1.3;
    
    return totalCostTHB;
}

// Chat with OpenAI
async function chatWithOpenAI(model, messages, images = []) {
    try {
        const response = await openai.chat.completions.create({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000
        });
        
        return {
            content: response.choices[0].message.content,
            usage: {
                inputTokens: response.usage.prompt_tokens,
                outputTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens
            }
        };
    } catch (error) {
        console.error('OpenAI chat error:', error);
        throw error;
    }
}

// Chat with Google
async function chatWithGoogle(model, messages, images = []) {
    try {
        const genModel = genAI.getGenerativeModel({ model: model });
        
        // Convert messages format
        const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
        
        const result = await genModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Google doesn't provide token count directly, estimate it
        const estimatedTokens = Math.ceil(text.length / 4);
        
        return {
            content: text,
            usage: {
                inputTokens: Math.ceil(prompt.length / 4),
                outputTokens: estimatedTokens,
                totalTokens: Math.ceil(prompt.length / 4) + estimatedTokens
            }
        };
    } catch (error) {
        console.error('Google AI chat error:', error);
        throw error;
    }
}

// Main chat function
async function chat(model, messages, images = []) {
    const config = MODEL_CONFIG[model];
    if (!config) {
        throw new Error('Invalid model selected');
    }
    
    let result;
    
    if (config.api === 'openai') {
        result = await chatWithOpenAI(model, messages, images);
    } else if (config.api === 'google') {
        result = await chatWithGoogle(model, messages, images);
    }
    
    // Calculate cost
    const costTHB = calculateCostTHB(
        result.usage.inputTokens,
        result.usage.outputTokens,
        model
    );
    
    return {
        ...result,
        model: model,
        costTHB: costTHB
    };
}

module.exports = {
    chat,
    MODEL_CONFIG,
    calculateCostTHB
};