// assistants.js
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Create thread for conversation
async function createThread(openaiClient = null) {
    const client = openaiClient || openai;
    try {
        const thread = await client.beta.threads.create();
        return thread.id;
    } catch (error) {
        console.error('Error creating thread:', error);
        throw error;
    }
}

// Add message to thread
async function addMessage(threadId, content, images = [], openaiClient = null) {
    const client = openaiClient || openai;
    try {
        let messageContent;

        // If there are images, format as array with URLs
        if (images.length > 0) {
            messageContent = [
                { 
                    type: "text", 
                    text: content || "ช่วยสร้าง prompt จากรูปนี้" 
                }
            ];
            
            // Add each image URL with validation
            for (const img of images) {
                if (img) {
                    // Validate image format
                    // Get the actual URL from the image object
                    const imageUrl = typeof img === 'string' ? img : (img.url || img);
                    
                    // Validate URL format
                    if (!imageUrl) {
                        console.warn('⚠️ Empty image URL, skipping');
                        continue;
                    }
                    
                    // Check if it's base64 or URL
                    const isBase64 = imageUrl.startsWith('data:image/');
                    const isValidUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
                    
                    if (!isBase64 && !isValidUrl) {
                        console.warn('⚠️ Invalid image URL format, skipping:', imageUrl.substring(0, 50));
                        continue;
                    }
                    
                    // Additional validation for URL images
                    if (isValidUrl) {
                        const supportedFormats = ['png', 'jpeg', 'jpg', 'gif', 'webp'];
                        const urlLower = imageUrl.toLowerCase();
                        const hasValidFormat = supportedFormats.some(format => 
                            urlLower.includes(`.${format}`) || 
                            urlLower.includes(`/${format}`) ||
                            urlLower.includes(`format=${format}`)
                        );
                        
                        if (!hasValidFormat) {
                            console.warn('⚠️ Unsupported image format, attempting anyway:', imageUrl);
                        }
                    }
                    
                    messageContent.push({
                        type: "image_url",
                        image_url: { 
                            url: imageUrl
                        }
                    });
                }
            }
        } else {
            // Text only
            messageContent = content;
        }

        console.log('Sending message with', images.length, 'image URLs');
        
        const message = await client.beta.threads.messages.create(
            threadId,
            {
                role: "user",
                content: messageContent
            }
        );
        
        return message.id;
    } catch (error) {
        console.error('Error adding message:', error);
        throw error;
    }
}

// Run assistant and get response
async function runAssistant(threadId, assistantId, openaiClient = null, retryCount = 0) {
    // Use provided client or default
    const client = openaiClient || openai;
    const maxRetries = 2;
    
    try {
        // Check assistant info first
        const assistant = await client.beta.assistants.retrieve(assistantId);
        console.log('Assistant model:', assistant.model);
        
        // Check if model supports vision
        const visionModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-vision-preview'];
        if (!visionModels.includes(assistant.model)) {
            console.warn('⚠️ Assistant model may not support images:', assistant.model);
        }
        
        // Create and poll run
        const run = await client.beta.threads.runs.createAndPoll(
            threadId,
            { assistant_id: assistantId }
        );

        if (run.status === 'completed') {
            // Get messages
            const messages = await client.beta.threads.messages.list(threadId);
            
            // Get the latest assistant message
            const lastMessage = messages.data.find(msg => msg.role === 'assistant');
            
            if (lastMessage && lastMessage.content[0]) {
                return {
                    response: lastMessage.content[0].text.value,
                    usage: run.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
                };
            }
        } else {
            console.error('Run failed:', run.status, run.last_error);
            
            // Handle specific error codes
            if (run.last_error && run.last_error.code === 'invalid_image_format') {
                throw new Error('รูปภาพที่อัพโหลดไม่รองรับ กรุณาใช้ไฟล์ PNG, JPG, GIF หรือ WebP');
            }
            
            // Handle invalid_image_url error
            if (run.last_error && run.last_error.code === 'invalid_image_url') {
                console.error('Invalid image URL:', run.last_error.message);
                if (retryCount < maxRetries) {
                    console.log(`Retrying due to invalid_image_url... (attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
                    return runAssistant(threadId, assistantId, openaiClient, retryCount + 1);
                }
                throw new Error('ไม่สามารถดาวน์โหลดรูปภาพจาก URL ที่ให้มาได้ กรุณาตรวจสอบ URL หรือลองใช้รูปภาพอื่น');
            }
            
            // Retry for server_error
            if (run.last_error && run.last_error.code === 'server_error' && retryCount < maxRetries) {
                console.log(`Retrying due to server_error... (attempt ${retryCount + 1}/${maxRetries})`);
                // Wait a bit before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return runAssistant(threadId, assistantId, openaiClient, retryCount + 1);
            }
            
            // Generic error
            throw new Error(`Run failed with status: ${run.status}`);
        }
    } catch (error) {
        console.error('Error running assistant:', error);
        
        // Retry on network errors
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            if (retryCount < maxRetries) {
                console.log(`Retrying due to network error... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return runAssistant(threadId, assistantId, openaiClient, retryCount + 1);
            }
        }
        
        throw error;
    }
}

// Delete thread when done (optional, for cleanup)
async function deleteThread(threadId) {
    try {
        await openai.beta.threads.del(threadId);
    } catch (error) {
        console.error('Error deleting thread:', error);
        // Non-critical error, just log it
    }
}

// Get assistant info (for debugging)
async function getAssistantInfo(assistantId) {
    try {
        const assistant = await openai.beta.assistants.retrieve(assistantId);
        console.log('Assistant Info:', {
            name: assistant.name,
            instructions: assistant.instructions?.substring(0, 100) + '...',
            model: assistant.model
        });
        return assistant;
    } catch (error) {
        console.error('Error getting assistant info:', error);
        return null;
    }
}

module.exports = {
    openai,  // Export openai instance
    createThread,
    addMessage,
    runAssistant,
    deleteThread,
    getAssistantInfo
};