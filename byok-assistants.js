// BYOK Assistant Management
// For BYOK users, we need to create assistants on-the-fly in their account

const assistantTemplates = {
    general: {
        name: "General Assistant",
        instructions: "You are a helpful assistant.",
        model: "gpt-4o",
        tools: []
    },
    character: {
        name: "Character Assistant",
        instructions: "You are a character roleplay assistant. Follow the character's personality and traits.",
        model: "gpt-4o",
        tools: []
    },
    multichar: {
        name: "Multi-Character Assistant",
        instructions: "You are a multi-character roleplay assistant. Manage multiple characters and their interactions.",
        model: "gpt-4o",
        tools: []
    },
    chat: {
        name: "Chat Assistant", 
        instructions: "You are a conversational assistant for chat.",
        model: "gpt-4o",
        tools: []
    }
};

// Cache for BYOK assistant IDs per user
const byokAssistantCache = new Map();

async function getOrCreateByokAssistant(userOpenAI, userId, mode) {
    const cacheKey = `${userId}_${mode}`;
    
    // Check cache first
    if (byokAssistantCache.has(cacheKey)) {
        const cachedId = byokAssistantCache.get(cacheKey);
        try {
            // Verify it still exists
            await userOpenAI.beta.assistants.retrieve(cachedId);
            return cachedId;
        } catch (error) {
            // Assistant was deleted, remove from cache
            byokAssistantCache.delete(cacheKey);
        }
    }
    
    // Create new assistant
    const template = assistantTemplates[mode] || assistantTemplates.general;
    
    try {
        const assistant = await userOpenAI.beta.assistants.create({
            name: `${template.name} (BYOK)`,
            instructions: template.instructions,
            model: template.model,
            tools: template.tools
        });
        
        // Cache the ID
        byokAssistantCache.set(cacheKey, assistant.id);
        
        console.log(`✅ Created BYOK assistant for ${userId} in ${mode} mode: ${assistant.id}`);
        return assistant.id;
        
    } catch (error) {
        console.error(`❌ Failed to create BYOK assistant:`, error);
        throw error;
    }
}

// Clean up old assistants for a user (optional)
async function cleanupByokAssistants(userOpenAI, userId) {
    try {
        const assistants = await userOpenAI.beta.assistants.list({ limit: 100 });
        
        for (const assistant of assistants.data) {
            if (assistant.name && assistant.name.includes('(BYOK)')) {
                await userOpenAI.beta.assistants.del(assistant.id);
                console.log(`🗑️ Deleted old BYOK assistant: ${assistant.id}`);
            }
        }
        
        // Clear cache for this user
        for (const [key] of byokAssistantCache) {
            if (key.startsWith(userId)) {
                byokAssistantCache.delete(key);
            }
        }
        
    } catch (error) {
        console.error('Error cleaning up BYOK assistants:', error);
    }
}

module.exports = {
    getOrCreateByokAssistant,
    cleanupByokAssistants,
    byokAssistantCache
};