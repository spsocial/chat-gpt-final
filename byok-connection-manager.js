// BYOK Connection Manager
// Manages OpenAI client instances for BYOK users to prevent conflicts

const OpenAI = require('openai');

class ByokConnectionManager {
    constructor() {
        // Map to store OpenAI client instances per user
        this.userClients = new Map();
        
        // Map to track active connections
        this.activeConnections = new Map();
        
        // Cleanup inactive connections every 5 minutes
        setInterval(() => this.cleanupInactiveConnections(), 5 * 60 * 1000);
    }
    
    /**
     * Get or create OpenAI client for a user
     */
    getClient(userId, apiKey) {
        // Check if user already has a client
        if (this.userClients.has(userId)) {
            const existing = this.userClients.get(userId);
            
            // If API key changed, create new client
            if (existing.apiKey !== apiKey) {
                console.log(`🔄 API key changed for ${userId}, creating new client`);
                existing.client = null; // Clear old client
                return this.createClient(userId, apiKey);
            }
            
            // Update last access time
            existing.lastAccess = Date.now();
            return existing.client;
        }
        
        // Create new client
        return this.createClient(userId, apiKey);
    }
    
    /**
     * Create new OpenAI client for user
     */
    createClient(userId, apiKey) {
        try {
            const client = new OpenAI({ 
                apiKey: apiKey,
                maxRetries: 3,
                timeout: 30000 // 30 second timeout
            });
            
            // Store client info
            this.userClients.set(userId, {
                client: client,
                apiKey: apiKey,
                lastAccess: Date.now(),
                createdAt: Date.now()
            });
            
            console.log(`✅ Created new OpenAI client for ${userId}`);
            return client;
            
        } catch (error) {
            console.error(`❌ Failed to create OpenAI client for ${userId}:`, error);
            throw error;
        }
    }
    
    /**
     * Track active connection
     */
    trackConnection(userId, threadId) {
        if (!this.activeConnections.has(userId)) {
            this.activeConnections.set(userId, new Set());
        }
        this.activeConnections.get(userId).add(threadId);
    }
    
    /**
     * Remove connection tracking
     */
    untrackConnection(userId, threadId) {
        if (this.activeConnections.has(userId)) {
            this.activeConnections.get(userId).delete(threadId);
            if (this.activeConnections.get(userId).size === 0) {
                this.activeConnections.delete(userId);
            }
        }
    }
    
    /**
     * Check if user has active connections
     */
    hasActiveConnections(userId) {
        return this.activeConnections.has(userId) && 
               this.activeConnections.get(userId).size > 0;
    }
    
    /**
     * Remove user's client
     */
    removeClient(userId) {
        if (this.userClients.has(userId)) {
            const client = this.userClients.get(userId);
            client.client = null; // Clear client reference
            this.userClients.delete(userId);
            console.log(`🗑️ Removed OpenAI client for ${userId}`);
        }
        
        // Also remove any active connections
        this.activeConnections.delete(userId);
    }
    
    /**
     * Cleanup inactive connections
     */
    cleanupInactiveConnections() {
        const now = Date.now();
        const INACTIVE_THRESHOLD = 15 * 60 * 1000; // 15 minutes
        
        for (const [userId, clientInfo] of this.userClients) {
            if (now - clientInfo.lastAccess > INACTIVE_THRESHOLD) {
                // Don't remove if user has active connections
                if (!this.hasActiveConnections(userId)) {
                    this.removeClient(userId);
                    console.log(`🧹 Cleaned up inactive client for ${userId}`);
                }
            }
        }
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            totalClients: this.userClients.size,
            activeConnections: this.activeConnections.size,
            clients: Array.from(this.userClients.entries()).map(([userId, info]) => ({
                userId,
                createdAt: new Date(info.createdAt).toISOString(),
                lastAccess: new Date(info.lastAccess).toISOString(),
                hasActiveConnections: this.hasActiveConnections(userId)
            }))
        };
    }
}

// Create singleton instance
const byokConnectionManager = new ByokConnectionManager();

module.exports = byokConnectionManager;