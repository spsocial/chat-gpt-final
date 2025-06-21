// PROFESSIONAL VERSION - NO ERRORS
console.log("Script loaded - Professional Version 5.0");

// ========== GLOBAL CONFIGURATION ==========
const API_URL = window.location.origin + '/api';
const MAX_IMAGE_SIZE = 800;
let isProcessing = false;

// ========== GLOBAL VARIABLES ==========
let currentMode = 'general';
let messageId = 0;
let characterLibrary = [];
let currentCharacterProfile = null;
let userId = '';
let userCredits = 0;
let lastPromptData = null;

// ========== TEMPLATES DATA ==========
const promptTemplates = {
    action: [
        {
            emoji: "💥",
            title: "ฉากระเบิดมันส์ๆ",
            prompt: "High-octane explosion sequence with debris flying in slow motion, dynamic camera shake, orange and blue color grading, Michael Bay style cinematography, practical effects enhanced with CGI, 4K resolution",
            category: "action"
        },
        {
            emoji: "🥊",
            title: "ฉากต่อสู้",
            prompt: "Intense hand-to-hand combat scene, rapid cuts between strikes, sweat droplets in slow motion, dramatic lighting with shadows, John Wick style choreography, steady cam following the action",
            category: "action"
        },
        {
            emoji: "🏃",
            title: "ฉากไล่ล่า",
            prompt: "Heart-pounding chase sequence through crowded streets, parkour movements, handheld camera work, quick cuts, motion blur, adrenaline-fueled cinematography, Mission Impossible style",
            category: "action"
        }
    ],
    cinematic: [
        {
            emoji: "🌅",
            title: "Golden Hour Magic",
            prompt: "Cinematic golden hour shot with warm sunlight streaming through, lens flares, anamorphic aspect ratio, shallow depth of field, Roger Deakins style cinematography, 35mm film aesthetic",
            category: "cinematic"
        },
        {
            emoji: "🌧️",
            title: "ฉากฝนดราม่า",
            prompt: "Emotional rain scene with water droplets on lens, moody blue color grading, slow motion raindrops, backlit silhouettes, Blade Runner 2049 aesthetic, atmospheric fog",
            category: "cinematic"
        },
        {
            emoji: "🌃",
            title: "Neon Noir",
            prompt: "Cyberpunk cityscape at night, neon lights reflecting on wet asphalt, volumetric fog, pink and cyan color palette, wide establishing shot, Blade Runner inspired, ultra wide lens",
            category: "cinematic"
        }
    ],
    nature: [
        {
            emoji: "🏔️",
            title: "ภูเขาสุดอลังการ",
            prompt: "Epic mountain landscape with morning mist, drone aerial shot ascending over peaks, golden sunrise light, Planet Earth documentary style, 8K resolution, majestic orchestral mood",
            category: "nature"
        },
        {
            emoji: "🌊",
            title: "คลื่นทะเลสโลโม",
            prompt: "Ocean waves in ultra slow motion, underwater to above water transition, crystal clear turquoise water, sunlight rays penetrating surface, BBC Blue Planet style cinematography",
            category: "nature"
        },
        {
            emoji: "🦅",
            title: "สัตว์ป่า Documentary",
            prompt: "Wildlife documentary shot following eagle in flight, smooth gimbal tracking, telephoto lens compression, National Geographic style, crisp 4K detail, natural lighting",
            category: "nature"
        }
    ],
    emotion: [
        {
            emoji: "💕",
            title: "ฉากโรแมนติก",
            prompt: "Romantic scene with soft bokeh background, warm candlelight, intimate close-ups, handheld camera for natural movement, golden hour window light, film grain texture",
            category: "emotion"
        },
        {
            emoji: "😢",
            title: "ฉากเศร้า",
            prompt: "Emotional dramatic scene, single tear rolling down cheek in extreme close-up, desaturated color grading, soft natural lighting, shallow focus, A24 film aesthetic",
            category: "emotion"
        },
        {
            emoji: "😊",
            title: "ความสุขล้นหัวใจ",
            prompt: "Joyful celebration scene with confetti falling in slow motion, warm color grading, lens flares, dynamic camera movement, uplifting atmosphere, commercial style cinematography",
            category: "emotion"
        }
    ]
};

// ========== FAVORITES MANAGEMENT ==========
function loadFavorites() {
    return JSON.parse(localStorage.getItem('veoFavorites') || '[]');
}

function saveFavorites(favorites) {
    localStorage.setItem('veoFavorites', JSON.stringify(favorites));
    updateFavoritesCount();
}

function updateFavoritesCount() {
    const favorites = loadFavorites();
    const countElement = document.getElementById('favoritesCount');
    if (countElement) {
        countElement.textContent = favorites.length || '';
    }
}

function addToFavorites(promptText) {
    const favorites = loadFavorites();
    const newFavorite = {
        id: Date.now(),
        prompt: promptText,
        date: new Date().toISOString(),
        rating: lastPromptData?.rating || 0
    };
    
    favorites.unshift(newFavorite);
    saveFavorites(favorites);
    
    // แสดง notification
    showNotification('⭐ เพิ่มใน Favorites แล้ว!', 'success');
    return newFavorite.id;
}

function removeFromFavorites(id) {
    const favorites = loadFavorites();
    const filtered = favorites.filter(fav => fav.id !== id);
    saveFavorites(filtered);
    displayFavorites(); // Refresh display
}

function isFavorited(promptText) {
    const favorites = loadFavorites();
    return favorites.some(fav => fav.prompt === promptText);
}

// ========== TEMPLATES UI ==========
function showTemplates() {
    document.getElementById('templatesModal').style.display = 'flex';
    filterTemplates('all');
}

function closeTemplates() {
    document.getElementById('templatesModal').style.display = 'none';
}

function filterTemplates(category) {
    // Update active button
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(category) || category === 'all') {
            btn.classList.add('active');
        }
    });
    
    const grid = document.getElementById('templatesGrid');
    grid.innerHTML = '';
    
    // Get templates
    let templates = [];
    if (category === 'all') {
        templates = Object.values(promptTemplates).flat();
    } else {
        templates = promptTemplates[category] || [];
    }
    
    // Display templates
    templates.forEach(template => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.innerHTML = `
            <div class="template-emoji">${template.emoji}</div>
            <div class="template-title">${template.title}</div>
            <div class="template-preview">${template.prompt}</div>
        `;
        card.onclick = () => useTemplate(template.prompt);
        grid.appendChild(card);
    });
}

function useTemplate(prompt) {
    document.getElementById('messageInput').value = prompt;
    closeTemplates();
    
    // Auto scroll to input
    document.getElementById('messageInput').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
    });
    
    showNotification('📋 Template copied to input!', 'success');
}

// ========== FAVORITES UI ==========
function showFavorites() {
    document.getElementById('favoritesModal').style.display = 'flex';
    displayFavorites();
}

function closeFavorites() {
    document.getElementById('favoritesModal').style.display = 'none';
}

function displayFavorites() {
    const favorites = loadFavorites();
    const grid = document.getElementById('favoritesGrid');
    
    if (favorites.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⭐</div>
                <div class="empty-state-text">ยังไม่มี Favorites<br>กดดาวตอนสร้าง Prompt เพื่อบันทึก</div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = favorites.map(fav => `
        <div class="favorite-item">
            <button class="remove-fav-btn" onclick="removeFromFavorites(${fav.id})">×</button>
            <div class="favorite-content">${fav.prompt}</div>
            <div class="favorite-meta">
                <span>${new Date(fav.date).toLocaleDateString('th-TH')}</span>
                <div class="favorite-actions">
                    <button class="fav-action-btn" onclick="useFavorite('${encodeURIComponent(fav.prompt)}')">
                        📝 ใช้งาน
                    </button>
                    <button class="fav-action-btn" onclick="shareFavorite('${encodeURIComponent(fav.prompt)}')">
                        📤 แชร์
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function useFavorite(encodedPrompt) {
    const prompt = decodeURIComponent(encodedPrompt);
    document.getElementById('messageInput').value = prompt;
    closeFavorites();
    
    document.getElementById('messageInput').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
    });
}

function shareFavorite(encodedPrompt) {
    const prompt = decodeURIComponent(encodedPrompt);
    sharePrompt(prompt);
}

// ========== SHARE FUNCTION ==========
async function sharePrompt(promptText) {
    const shareData = {
        title: 'Veo 3 Prompt Generator',
        text: `Check out this amazing prompt:\n\n"${promptText}"\n\nสร้างด้วย`,
        url: 'https://promptdee.net'
    };
    
    try {
        if (navigator.share && window.innerWidth <= 768) {
            await navigator.share(shareData);
        } else {
            // Desktop fallback - copy to clipboard
            const fullText = `${shareData.text} ${shareData.url}`;
            await navigator.clipboard.writeText(fullText);
            showNotification('📋 Copied to clipboard!', 'success');
        }
    } catch (error) {
        console.error('Error sharing:', error);
    }
}

// ========== NOTIFICATION SYSTEM ==========
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Kanit', sans-serif;
        font-size: 14px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========== ANNOUNCEMENT POPUP SYSTEM ==========
const ANNOUNCEMENT_KEY = 'veo_announcement';
const DONT_SHOW_KEY = 'veo_announcement_dont_show';
const LAST_VISIT_KEY = 'veo_last_visit';
const THREE_HOURS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const FIVE_MINUTES = 5 * 60 * 1000; // 5 minutes in milliseconds

// Current announcement version (change this when you have new announcements)
const CURRENT_ANNOUNCEMENT_VERSION = '1.3.0';

function shouldShowAnnouncement() {
    const now = new Date().getTime();
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    const lastAnnouncementVersion = localStorage.getItem(ANNOUNCEMENT_KEY);
    const dontShowUntil = localStorage.getItem(DONT_SHOW_KEY);
    
    // Update last visit
    localStorage.setItem(LAST_VISIT_KEY, now);
    
    // Check if user selected "don't show for 3 hours"
    if (dontShowUntil && now < parseInt(dontShowUntil)) {
        console.log('Announcement hidden for 3 hours');
        return false;
    }
    
    // Always show if it's a new announcement version
    if (lastAnnouncementVersion !== CURRENT_ANNOUNCEMENT_VERSION) {
        console.log('New announcement version');
        return true;
    }
    
    // Show if first visit ever
    if (!lastVisit) {
        console.log('First visit');
        return true;
    }
    
    const timeSinceLastVisit = now - parseInt(lastVisit);
    
    // Show if hasn't visited for more than 5 minutes (สั้นลงจาก 6 ชั่วโมง)
    if (timeSinceLastVisit > FIVE_MINUTES) {
        console.log('Haven\'t visited for 5+ minutes');
        return true;
    }
    
    // Show every page refresh if no "don't show" is active
    if (!dontShowUntil) {
        console.log('Showing on refresh');
        return true;
    }
    
    return false;
}

function showAnnouncement() {
    const popup = document.getElementById('announcementPopup');
    if (popup) {
        popup.style.display = 'flex';
        popup.classList.add('show');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
}

function closeAnnouncement(updateVersion = false) {
    const popup = document.getElementById('announcementPopup');
    const dontShowCheckbox = document.getElementById('dontShowFor3Hours');
    
    if (popup) {
        // Fade out animation
        popup.style.animation = 'fadeOut 0.3s ease';
        
        setTimeout(() => {
            popup.style.display = 'none';
            popup.classList.remove('show');
            
            // Restore body scroll
            document.body.style.overflow = '';
        }, 300);
    }
    
    // Update version if OK button was clicked
    if (updateVersion) {
        localStorage.setItem(ANNOUNCEMENT_KEY, CURRENT_ANNOUNCEMENT_VERSION);
    }
    
    // Handle "don't show for 3 hours"
    if (dontShowCheckbox && dontShowCheckbox.checked) {
        const dontShowUntil = new Date().getTime() + THREE_HOURS;
        localStorage.setItem(DONT_SHOW_KEY, dontShowUntil);
    }
}

// Add fade out animation
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(fadeOutStyle);

// Initialize announcement on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check and show announcement after a short delay
    setTimeout(() => {
        if (shouldShowAnnouncement()) {
            showAnnouncement();
        }
    }, 1000); // Show after 1 second
});

// Auto-resize on input
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('input', autoResize);

     // Keyboard shortcuts
    messageInput.addEventListener('keydown', (e) => {
        // Ctrl+E = Open full editor
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            openFullEditor();
        }
    });

// Close popup when clicking outside
document.addEventListener('click', (e) => {
    const popup = document.getElementById('announcementPopup');
    if (e.target === popup) {
        closeAnnouncement(false);
    }
});

// Add keyboard support (ESC to close)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const popup = document.getElementById('announcementPopup');
        if (popup && popup.style.display === 'flex') {
            closeAnnouncement(false);
        }
    }
});

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize favorites count on load
document.addEventListener('DOMContentLoaded', () => {
    updateFavoritesCount();
});

// Chat history for each mode
const chatHistory = {
    general: '',
    character: '',
    multichar: '',   // ✅ เพิ่ม comma
    image: ''
};

// Initialize image URLs array globally
window.imageUrls = [];

// Track if announcement has been viewed
function markAnnouncementAsViewed() {
    const fab = document.querySelector('.fab-announcement');
    if (fab) {
        fab.classList.add('viewed');
        sessionStorage.setItem('announcement_viewed', 'true');
    }
}

// Check if announcement was viewed in this session
function checkAnnouncementViewed() {
    const viewed = sessionStorage.getItem('announcement_viewed');
    const fab = document.querySelector('.fab-announcement');
    if (viewed && fab) {
        fab.classList.add('viewed');
    }
}

// Update showAnnouncement function
const originalShowAnnouncement = showAnnouncement;
showAnnouncement = function() {
    originalShowAnnouncement();
    markAnnouncementAsViewed();
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    checkAnnouncementViewed();
});

// Optional: Hide FAB when scrolling down, show when scrolling up
let lastScrollTop = 0;
let scrollTimeout;

window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    
    const fab = document.querySelector('.fab-announcement');
    if (!fab) return;
    
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    
    if (currentScroll > lastScrollTop && currentScroll > 100) {
        // Scrolling down
        fab.style.transform = 'translateX(200px)';
    } else {
        // Scrolling up
        fab.style.transform = 'translateX(0)';
    }
    
    lastScrollTop = currentScroll;
    
    // Reset position after scrolling stops
    scrollTimeout = setTimeout(() => {
        fab.style.transform = 'translateX(0)';
    }, 1000);
});

// ========== CREDIT SYSTEM FUNCTIONS ==========
async function loadUserCredits() {
    try {
        const response = await fetch(`${API_URL}/credits/${userId}`);
        const data = await response.json();
        
        userCredits = data.currentCredits || 0;
        updateCreditDisplay();
    } catch (error) {
        console.error('Error loading credits:', error);
    }
}

function updateCreditDisplay() {
    // เพิ่มการแสดงเครดิตใน header
    const creditDisplay = document.getElementById('creditDisplay');
    if (!creditDisplay) {
        // สร้าง element ใหม่ถ้ายังไม่มี
        const usageDisplay = document.querySelector('.usage-display');
        const creditDiv = document.createElement('div');
        creditDiv.id = 'creditDisplay';
        creditDiv.className = 'credit-info';
        creditDiv.innerHTML = `
            <div class="credit-balance">
                <span class="credit-icon">💰</span>
                <span class="credit-amount">${userCredits.toFixed(2)}</span>
                <span class="credit-label">เครดิต</span>
            </div>
            <button class="add-credit-btn" onclick="showCreditPackages()">
                <span>+</span> เติมเครดิต
            </button>
        `;
        usageDisplay.appendChild(creditDiv);
    } else {
        // อัพเดทจำนวนเครดิต
        creditDisplay.querySelector('.credit-amount').textContent = userCredits.toFixed(2);
    }
}

async function showCreditPackages() {
    try {
        const response = await fetch(`${API_URL}/credit-packages`);
        const packages = await response.json();
        
        const modal = document.createElement('div');
        modal.className = 'credit-modal';
        modal.innerHTML = `
            <div class="credit-modal-content">
                <div class="modal-header">
                    <h2>💰 เติมเครดิต</h2>
                    <button class="close-btn" onclick="closeCreditModal()">✕</button>
                </div>
                
                <div class="packages-grid">
                    ${packages.map(pkg => `
                        <div class="package-card ${pkg.is_popular ? 'popular' : ''}">
                            ${pkg.is_popular ? '<div class="popular-badge">ยอดนิยม!</div>' : ''}
                            <h3>${pkg.name}</h3>
                            <div class="credits-amount">
                                <span class="number">${pkg.credits}</span>
                                <span class="label">เครดิต</span>
                                ${pkg.bonus_credits > 0 ? `<span class="bonus">+${pkg.bonus_credits} โบนัส!</span>` : ''}
                            </div>
                            <div class="price">฿${pkg.price}</div>
                            ${pkg.description ? `<p class="description">${pkg.description}</p>` : ''}
                            <button class="select-package-btn" onclick="selectPackage(${pkg.id}, ${pkg.price})">
                                เลือกแพ็คเกจนี้
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <div class="payment-info">
                    <h3>📱 วิธีชำระเงิน</h3>
                    <div class="payment-methods">
                        <div class="payment-method">
                            <div style="font-size: 48px;">📲</div>
                            <div>
                                <strong>PromptPay</strong><br>
                                เบอร์: 090-246-2826<br>
                                <small>หลังโอนแล้ว แจ้งสลิปทาง Line: 
                                    <a href="https://lin.ee/KWn4Otg" target="_blank" style="color: #00ff00; text-decoration: underline;">
                                        @social24
                                    </a>
                                </small>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 20px; padding: 16px; background: rgba(147, 51, 234, 0.1); border-radius: 8px;">
                        <p style="color: var(--text-secondary); font-size: 14px;">
                            <strong>วิธีการชำระเงิน:</strong><br>
                            1. โอนเงินตามจำนวนที่เลือก<br>
                            2. แคปหน้าจอสลิป<br>
                            3. ส่งสลิปพร้อม User ID: <strong style="color: #9333ea;">${userId}</strong> ทาง 
                               <a href="https://lin.ee/KWn4Otg" target="_blank" style="color: #00ff00;">Line</a><br>
                            4. รอแอดมินตรวจสอบ (ภายใน 30 นาที)<br>
                            5. เครดิตจะเข้าอัตโนมัติ
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="https://lin.ee/KWn4Otg" target="_blank" style="
                            display: inline-block;
                            background: #00B900;
                            color: white;
                            padding: 12px 32px;
                            border-radius: 25px;
                            text-decoration: none;
                            font-weight: 600;
                            font-size: 16px;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            <span style="margin-right: 8px;">💬</span> แจ้งโอนเงินทาง Line
                        </a>
                    </div>
                </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error loading packages:', error);
        alert('ไม่สามารถโหลดแพ็คเกจได้');
    }
}

function closeCreditModal() {
    const modal = document.querySelector('.credit-modal');
    if (modal) modal.remove();
}

function selectPackage(packageId, price) {
    alert(`กรุณาโอนเงิน ${price} บาท\nแล้วแจ้งสลิปทาง Line พร้อมระบุ User ID: ${userId}`);
    closeCreditModal();
}

function showCreditRequiredMessage(data) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="credit-required-message">
                <h3>💳 เครดิตไม่เพียงพอ</h3>
                <p>คุณใช้งานเกินโควต้าประจำวันแล้ว</p>
                <div class="credit-info-box">
                    <span>เครดิตคงเหลือ: <strong style="color: var(--error);">${data.credits.current}</strong></span>
                    <span>ต้องการ: <strong style="color: var(--primary);">${data.credits.required}</strong></span>
                </div>
                <button class="add-credit-btn" onclick="showCreditPackages()" style="margin: 16px auto 0;">
                    💰 เติมเครดิตเลย
                </button>
            </div>
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Get or generate user ID
    userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    
    // Update user ID display
    document.getElementById('userId').textContent = userId;
    
    // Check API status
    checkAPIStatus();
    
    // Update usage display
    updateUsageDisplay();
    // Load user credits
loadUserCredits();
    
    // Load character library
    loadCharacterLibrary();
    
    // Refresh usage every 30 seconds
    setInterval(updateUsageDisplay, 30000);
    // Refresh credits every 30 seconds
setInterval(loadUserCredits, 30000);
    
    // Enter key to send
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Send button
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    
    // Initialize mode
    switchMode('general');
});

// Ratio button handlers
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('ratio-btn')) {
        document.querySelectorAll('.ratio-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');
    }
});

// Get selected model
function getSelectedImageModel() {
    const selected = document.querySelector('input[name="imageModel"]:checked');
    return selected ? selected.value : 'flux-schnell';
}

// Get selected ratio
function getSelectedRatio() {
    const selected = document.querySelector('.ratio-btn.active');
    return selected ? selected.dataset.ratio : '1:1';
}

// ========== MODE MANAGEMENT ==========
function switchMode(mode) {
    // Save current chat history before switching
    if (currentMode === 'general' || currentMode === 'character' || currentMode === 'multichar' || currentMode === 'image') {
        saveChatHistory(currentMode);
    }
    
    currentMode = mode;
    
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    
    // Hide all info panels
    document.getElementById('generalInfo').style.display = 'none';
    document.getElementById('characterInfo').style.display = 'none';
    document.getElementById('multicharInfo').style.display = 'none';
    document.getElementById('imageInfo').style.display = 'none';
    document.getElementById('characterLibrary').classList.remove('active');
    
    // Update UI based on mode
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const modeNotice = document.getElementById('modeNotice');
    const uploadSection = document.getElementById('uploadSection');
    
    switch(mode) {
        case 'general':
            document.getElementById('generalInfo').style.display = 'block';
            messageInput.placeholder = "อธิบายวิดีโอที่ต้องการ...";
            sendButton.innerHTML = 'สร้าง Prompt ✨';
            modeNotice.classList.remove('active');
            uploadSection.style.display = 'flex';
            loadChatHistory('general');
            break;
            
        case 'character':
            document.getElementById('characterInfo').style.display = 'block';
            messageInput.placeholder = "บรรยายตัวละครที่ต้องการ...";
            sendButton.innerHTML = 'สร้างตัวละคร 👤';
            modeNotice.innerHTML = '💡 <strong>Character Mode:</strong> AI จะสร้าง Character Profile';
            modeNotice.classList.add('active');
            uploadSection.style.display = 'flex';
            loadChatHistory('character');
            break;

        case 'multichar':
            document.getElementById('multicharInfo').style.display = 'block';
            messageInput.placeholder = "บรรยายฉากที่มีหลายตัวละคร...";
            sendButton.innerHTML = 'สร้าง Prompt 🎭';
            modeNotice.innerHTML = '💡 <strong>Multi-Character Mode:</strong> สร้างฉากหลายตัวละคร';
            modeNotice.classList.add('active');
            uploadSection.style.display = 'flex';
            loadChatHistory('multichar');
            break;
            
        case 'library':
            const library = document.getElementById('characterLibrary');
            library.classList.add('active');
            
            if (window.innerWidth <= 968) {
                document.querySelector('.chat-panel').style.display = 'none';
                library.style.cssText = `
                    display: block !important;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 1000;
                    background: var(--background);
                    overflow-y: auto;
                    padding: 20px;
                `;
            }
            
            modeNotice.classList.remove('active');
            uploadSection.style.display = 'none';
            break;

        case 'image':
            document.getElementById('imageInfo').style.display = 'block';
            messageInput.placeholder = "Describe your image in English...";
            sendButton.innerHTML = 'สร้างภาพ 🎨';
            modeNotice.innerHTML = '💡 <strong>Image Mode:</strong> AI จะสร้างภาพจาก prompt ของคุณ';
            modeNotice.classList.add('active');
            uploadSection.style.display = 'none';
            loadChatHistory('image');
            break;
    }
}

// ========== CHAT HISTORY MANAGEMENT ==========
function saveChatHistory(mode) {
    const chatMessages = document.getElementById('chatMessages');
    if (mode === 'general' || mode === 'character' || mode === 'multichar' || mode === 'image') {
        chatHistory[mode] = chatMessages.innerHTML;
    }
}

function loadChatHistory(mode) {
    const chatMessages = document.getElementById('chatMessages');
    
    if (chatHistory[mode] && chatHistory[mode].length > 0) {
        chatMessages.innerHTML = chatHistory[mode];
    } else {
        clearChat();
        addWelcomeMessage(mode);
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
}

function clearModeChat(mode) {
    if (mode === 'general' || mode === 'character') {
        chatHistory[mode] = '';
        if (currentMode === mode) {
            clearChat();
            addWelcomeMessage(mode);
        }
    }
}

function addWelcomeMessage(mode) {
    let message = '';
    
    switch(mode) {
        case 'general':
            message = `สวัสดีครับ! ผมคือ Prompt D ผู้ช่วยสร้าง Prompt ระดับเทพ🎬<br><br>
                      บอกผมว่าคุณอยากสร้างวิดีโอแบบไหน หรือแนบรูปตัวอย่างมาได้เลย<br><br>
                      💡 <strong>Tip:</strong> ยิ่งบรรยายละเอียด ผลลัพธ์ยิ่งดี!`;
            break;
            
        case 'character':
            message = `สวัสดีครับ! ผมคือ Character Creator 👤<br><br>
                      ผมจะช่วยสร้าง Character Profile <strong>ภาษาอังกฤษ</strong> แบบละเอียดสำหรับใช้กับ Veo 3<br><br>
                      💡 <strong>บอกผมได้เป็นภาษาไทย:</strong> คุณอยากได้ตัวละครแบบไหน? แต่ผมจะตอบเป็นภาษาอังกฤษนะครับ`;
            break;
            
        case 'multichar':
    message = `สวัสดีครับ! ผมคือ Prompt D Master 🎭<br><br>
              โหมดสร้าง Prompt ระดับสูง สำหรับฉากที่ซับซ้อน<br>
              ✨ รองรับตัวละคร 2-5 คน<br>
              ✨ บทพูดพร้อม timing แม่นยำ<br>
              ✨ มุมกล้องและ audio หลายชั้น<br><br>
              💡 <strong>เหมาะกับ:</strong> งานที่ต้องการความละเอียดสูง, ฉากสนทนา, หนังสั้น`;
    break;

    case 'image':
    message = `สวัสดีครับ! ผมคือ AI Image Generator 🎨<br><br>
              เลือก Model และพิมพ์คำอธิบายภาพที่ต้องการเป็นภาษาอังกฤษ<br><br>
              💡 <strong>ตัวอย่าง:</strong> "A cute cat wearing sunglasses, digital art style"`;
    break;
    }
    
    addMessage(message, 'assistant');
}

// ========== CHARACTER LIBRARY FUNCTIONS ==========
async function loadCharacterLibrary() {
    try {
        const response = await fetch(`${API_URL}/characters/${userId}`);
        if (response.ok) {
            characterLibrary = await response.json();
            displayCharacterLibrary();
        }
    } catch (error) {
        console.error('Error loading character library:', error);
    }
}

function displayCharacterLibrary() {
    const characterList = document.getElementById('characterList');
    
    if (characterLibrary.length === 0) {
        characterList.innerHTML = `
            <div class="empty-library">
                <p>ยังไม่มีตัวละครที่บันทึกไว้</p>
                <p style="margin-top: 8px;">สร้างตัวละครใหม่ในโหมด Character Creator</p>
            </div>
        `;
        return;
    }
    
    characterList.innerHTML = characterLibrary.map((char, index) => {
        // ใช้ preview เป็นหลักก่อน เพราะ backend อาจไม่ส่ง profile มา
        const displayText = char.preview || 'No description available';
        
        return `
            <div class="character-card" onclick="useCharacter(${index})">
                <div class="character-name">${char.name}</div>
                <div class="character-preview">${displayText}</div>
                <div class="character-meta">
                    <span>Created: ${new Date(char.created_at).toLocaleDateString('en-US')}</span>
                    <button onclick="deleteCharacter('${char.id}', event)" style="background: none; border: none; color: var(--error); cursor: pointer;">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function useCharacter(index) {
    const character = characterLibrary[index];
    
    // ปิด library ก่อน (ทั้ง desktop และ mobile)
    const library = document.getElementById('characterLibrary');
    library.classList.remove('active');
    library.style.cssText = '';
    
    // แสดง chat panel (กรณีมือถือ)
    const chatPanel = document.querySelector('.chat-panel');
    if (chatPanel) {
        chatPanel.style.display = '';
    }
    
    // เปลี่ยนไป general mode
    switchMode('general');
    
    // ใส่ข้อมูลตัวละคร
    const messageInput = document.getElementById('messageInput');
    
    let characterData = character.profile || character.preview || 'Character details not available';
    
    if (character.profile) {
    const visualProfile = extractVisualDetails(character.profile);
    
    // Format ใหม่ที่ชัดเจนกว่า
    messageInput.value = `⚠️ MUST INCLUDE these character details in EVERY part of the video prompt:

CHARACTER: ${character.name}
===================
${visualProfile}
===================

CRITICAL: The prompt MUST describe this EXACT character (not generic "person" or "man/woman"). Include their name, age, clothing colors, and appearance in EVERY shot.

Now create a prompt where this character: [your scene here]`;
}
    
    // Focus ที่ input
    messageInput.focus();
    
    // Scroll to input area (สำหรับมือถือ)
    if (window.innerWidth <= 968) {
        setTimeout(() => {
            messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
    
    // Helper function (ถ้ายังไม่มี)
    function extractVisualDetails(profile) {
        if (!profile) return '';
        
        const wantedSections = [
            'character profile',
            'basic info',
            'physical appearance', 
            'costume', 'style'
        ];
        
        const unwantedSections = [
            'voice', 'speech', 'speaking', 'tone', 'accent',
            'personality', 'mannerisms',
            'cinematic notes', 'cinematic',
            'veo 3 keywords', 'keywords'
        ];
        
        const lines = profile.split('\n');
        const resultLines = [];
        let shouldInclude = true;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();
            
            const isSectionHeader = line.includes('🎭') || line.includes('📋') || 
                                  line.includes('🎨') || line.includes('👔') || 
                                  line.includes('🎬') || line.includes('💡') ||
                                  /^[A-Z\s&]+:/.test(line) ||
                                  /^##/.test(line) ||
                                  /^\*\*[A-Z]/.test(line);
            
            if (isSectionHeader) {
                shouldInclude = false;
                
                for (const wanted of wantedSections) {
                    if (lowerLine.includes(wanted)) {
                        shouldInclude = true;
                        break;
                    }
                }
                
                for (const unwanted of unwantedSections) {
                    if (lowerLine.includes(unwanted)) {
                        shouldInclude = false;
                        break;
                    }
                }
            }
            
            if (shouldInclude) {
                resultLines.push(line);
            }
        }
        
        if (resultLines.length < 5) {
            return profile.split('\n')
                .filter(line => {
                    const lower = line.toLowerCase();
                    return !lower.includes('voice') && 
                           !lower.includes('speech') && 
                           !lower.includes('personality & mannerisms') &&
                           !lower.includes('cinematic notes') &&
                           !lower.includes('veo 3 keywords') &&
                           !lower.includes('dialogue');
                })
                .join('\n');
        }
        
        return resultLines.join('\n').trim();
    }
}

async function deleteCharacter(characterId, event) {
    event.stopPropagation();
    
    if (!confirm('ต้องการลบตัวละครนี้ใช่ไหม?')) return;
    
    try {
        const response = await fetch(`${API_URL}/characters/${characterId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadCharacterLibrary();
        }
    } catch (error) {
        console.error('Error deleting character:', error);
    }
}

// ========== API STATUS CHECK ==========
async function checkAPIStatus() {
    try {
        const response = await fetch(`${API_URL.replace('/api', '')}/test`);
        const data = await response.json();
        
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const apiStatus = document.getElementById('apiStatus');
        
        if (data.hasApiKey && data.hasAssistantId && data.hasDatabase) {
            statusDot.style.background = '#10b981';
            statusText.textContent = 'พร้อมใช้งาน';
            apiStatus.textContent = '✅ System Ready';
        } else if (!data.hasAssistantId) {
            statusDot.style.background = '#f59e0b';
            statusText.textContent = 'ไม่มี Assistant ID';
            apiStatus.textContent = '⚠️ No Assistant';
        } else if (!data.hasDatabase) {
            statusDot.style.background = '#f59e0b';
            statusText.textContent = 'ไม่มี Database';
            apiStatus.textContent = '⚠️ No Database';
        } else {
            statusDot.style.background = '#f59e0b';
            statusText.textContent = 'Demo Mode';
            apiStatus.textContent = '⚠️ Demo Mode';
        }
    } catch (error) {
        document.getElementById('statusDot').style.background = '#ef4444';
        document.getElementById('statusText').textContent = 'ออฟไลน์';
        document.getElementById('apiStatus').textContent = '❌ Offline';
    }
}

// ========== USAGE DISPLAY ==========
async function updateUsageDisplay() {
    try {
        const response = await fetch(`${API_URL}/usage/${userId}`);
        const data = await response.json();
        
        if (data.today) {
            const percentage = parseFloat(data.today.percentUsed) || 0;
            const progressBar = document.getElementById('usageProgress');
            progressBar.style.width = percentage + '%';
            
            document.getElementById('usageText').textContent = `💰${data.today.used}/${data.today.limit}`;
            
            if (percentage >= 100) {
                progressBar.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
            } else if (percentage >= 80) {
                progressBar.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
            } else {
                progressBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
            }
        }
    } catch (error) {
        console.error('Error updating usage:', error);
    }
}

// ========== IMAGE MANAGEMENT ==========
function showImageUrlDialog() {
    document.getElementById('imageUrlDialog').style.display = 'flex';
    document.getElementById('imageUrlInput').focus();
}

function closeImageUrlDialog() {
    document.getElementById('imageUrlDialog').style.display = 'none';
    document.getElementById('imageUrlInput').value = '';
}

function addImageUrl() {
    const input = document.getElementById('imageUrlInput');
    const url = input.value.trim();
    
    if (!url) return;
    
    window.imageUrls.push({
        url: url,
        name: 'image.jpg'
    });
    
    displayImagePreview();
    closeImageUrlDialog();
}

function displayImagePreview() {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    
    window.imageUrls.forEach((img, index) => {
        const div = document.createElement('div');
        div.className = 'image-preview-item';
        div.innerHTML = `
            <img src="${img.url}" alt="${img.name}" 
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23666%22>Error</text></svg>'">
            <button class="remove-btn" onclick="removeImage(${index})">×</button>
        `;
        preview.appendChild(div);
    });
}

function removeImage(index) {
    window.imageUrls.splice(index, 1);
    displayImagePreview();
}

// ========== SEND MESSAGE ==========
async function sendMessage() {
    if (isProcessing) return;
    
    const input = document.getElementById('messageInput');
    let message = input.value.trim();
    
    if (!message && window.imageUrls.length === 0) {
        return;
    }
    
    if (!message && window.imageUrls.length > 0) {
        message = currentMode === 'character' ? 
            "ช่วยสร้างตัวละครจากรูปนี้" : 
            "ช่วยสร้าง prompt จากรูปนี้";
    }
    
    isProcessing = true;
    input.disabled = true;
    document.getElementById('sendButton').disabled = true;
    
    let displayMessage = message;
    if (window.imageUrls.length > 0) {
        displayMessage += ` <span style="color: #a1a1aa;">(พร้อมรูป ${window.imageUrls.length} รูป)</span>`;
    }
    addMessage(displayMessage, 'user');
    
    input.value = '';
    
    const loadingId = addLoadingMessage();
    
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                userId,
                images: window.imageUrls,
                mode: currentMode
            })
        });
        
        const data = await response.json();
        
        removeMessage(loadingId);
        
        if (response.ok) {
            if (currentMode === 'image') {
        // ส่งไปสร้างภาพแทน
        removeMessage(loadingId);
        generateImage(message);
        return;
    }
            if (currentMode === 'character') {
                currentCharacterProfile = data.response;
                addMessage(data.response, 'assistant', false, true);
            } else {
                addMessage(data.response, 'assistant', true);
            }
            
            if (data.usage && data.usage.cost) {
                showUsageInfo(data.usage.cost);
            }
            
            
            updateUsageDisplay();
            // โหลดเครดิตใหม่หลังใช้งาน
loadUserCredits();
            
            window.imageUrls = [];
            displayImagePreview();
            
        if (response.status === 429) {
    // ถ้าเกิน limit และไม่มีเครดิต
    if (data.error === 'Insufficient credits') {
        showCreditRequiredMessage(data);
    } else {
        // Daily limit แบบปกติ
        addMessage(`
            <div style="color: #ef4444;">
                <strong>❌ ${data.message}</strong><br>
                <span style="color: #a1a1aa;">ใช้งานได้อีกครั้งในวันพรุ่งนี้</span>
            </div>
        `, 'assistant');
    }
    return;
}
            
        } else {
    // Check if it's a thread error that needs retry
    if (data.shouldRetry || data.clearThread || 
    (data.error && (data.error.includes('invalid_image_format') || 
                    data.error.includes('thread') ||
                    data.error.includes('Thread')))) {
    
    // เคลียร์ thread อัตโนมัติ
    const threadKey = `${userId}_${mode}`;
    userThreads.delete(threadKey);
    console.log('🔄 Auto-clearing problematic thread');
        addMessage(`⚠️ Session หมดอายุ กำลังสร้าง session ใหม่...`, 'assistant');
        
        // Wait a bit then retry automatically
        setTimeout(() => {
            // Re-enable input
            isProcessing = false;
            input.disabled = false;
            document.getElementById('sendButton').disabled = false;
            
            // Put the message back
            input.value = message;
            
            // Try again
            addMessage(`🔄 กำลังลองใหม่อัตโนมัติ...`, 'assistant');
            sendMessage();
        }, 2000);
        
    } else {
        // Other errors
        addMessage(`❌ Error: ${data.error || 'Something went wrong'}`, 'assistant');
        
        // Re-enable input for other errors
        isProcessing = false;
        input.disabled = false;
        document.getElementById('sendButton').disabled = false;
    }
}
    } catch (error) {
        removeMessage(loadingId);
        console.error('Error:', error);
        addMessage('❌ เกิดข้อผิดพลาด กรุณาลองใหม่', 'assistant');
    } finally {
        isProcessing = false;
        input.disabled = false;
        document.getElementById('sendButton').disabled = false;
        input.focus();
    }
}

// ========== MESSAGE DISPLAY ==========
function addMessage(content, type, isVeoPrompt = false, isCharacterProfile = false) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    const id = `msg-${messageId++}`;
    
    messageDiv.id = id;
    messageDiv.className = `message ${type}`;
    
    if (type === 'user') {
        messageDiv.innerHTML = `
            <div class="message-avatar">👤</div>
            <div class="message-content">${content}</div>
        `;
    } else if (isCharacterProfile) {
        messageDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                ${formatCharacterProfile(content)}
            </div>
        `;
    } else if (isVeoPrompt) {
        messageDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                ${formatVeoPrompt(content)}
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">${content}</div>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return id;
}

function formatCharacterProfile(response) {
    const formattedResponse = response
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\s/g, '• ');
    
    return `
        <div>✨ Character Profile สร้างเสร็จแล้ว!</div>
        <div class="character-profile">
            <div class="prompt-header">👤 Character Profile:</div>
            <div class="prompt-content">${formattedResponse}</div>
            <div class="profile-actions">
                <button class="copy-btn" onclick="copyPrompt(this)">📋 Copy Profile</button>
                <button class="save-btn" onclick="showSaveDialog()">💾 บันทึกตัวละคร</button>
            </div>
        </div>
    `;
}

function formatVeoPrompt(response) {
    // Generate unique ID for this prompt
    const promptId = 'prompt_' + Date.now();
    
    // Store prompt data
    lastPromptData = {
        promptId: promptId,
        promptText: document.querySelector('.message.user:last-child .message-content').textContent,
        responseText: response,
        mode: currentMode
    };
    
    const formattedResponse = response
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\s/g, '• ');
    
    const isFav = isFavorited(response);
    
    return `
    <div>✨ Veo Prompt สำเร็จแล้ว!</div>
    <div class="veo3-prompt">
        <div class="prompt-header">🎬 Veo Prompt:</div>
        <div class="prompt-content" id="promptContent-${promptId}">${formattedResponse}</div>
        <div class="prompt-actions">
            <button class="copy-btn" onclick="copyPrompt(this)">📋 Copy Prompt</button>
            <button class="favorite-btn ${isFav ? 'favorited' : ''}" id="favBtn-${promptId}" onclick="toggleFavorite('${promptId}')">
                ${isFav ? '⭐ Favorited' : '⭐ Add to Favorites'}
            </button>
            <button class="share-btn" onclick="sharePromptById('${promptId}')">
                📤 Share
            </button>
            <button class="continue-btn" onclick="continueScene('${promptId}')">
                🎬 ต่อฉาก
            </button>
        </div>
        <!-- Rating ย้ายมาอยู่ข้างใน veo3-prompt -->
        <div class="rating-section" id="rating-${promptId}">
            <div class="rating-header">⭐ ให้คะแนน Prompt นี้:</div>
            <div class="star-rating" onmouseleave="resetStarPreview('${promptId}')">
                ${[1,2,3,4,5].map(star => `
                    <span class="star" data-rating="${star}" 
                          onclick="ratePrompt('${promptId}', ${star})"
                          onmouseover="previewStars('${promptId}', ${star})"
                          title="${star} ดาว">
                        ☆
                    </span>
                `).join('')}
            </div>
            <div class="rating-labels">
                <span>แย่มาก</span>
                <span>แย่</span>
                <span>พอใช้</span>
                <span>ดี</span>
                <span>ดีมาก</span>
            </div>
            <textarea 
                id="feedback-${promptId}"
                class="rating-feedback"
                placeholder="ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)"
                rows="2"
                style="display: none;"
            ></textarea>
        </div>
    </div>  <!-- ปิด veo3-prompt -->
`;
}

function toggleFavorite(promptId) {
    const promptElement = document.getElementById(`promptContent-${promptId}`);
    const favBtn = document.getElementById(`favBtn-${promptId}`);
    
    if (!promptElement) return;
    
    const promptText = promptElement.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<br>/g, '\n')
        .replace(/• /g, '* ')
        .replace(/<[^>]*>/g, '');
    
    if (isFavorited(promptText)) {
        // Remove from favorites
        const favorites = loadFavorites();
        const filtered = favorites.filter(fav => fav.prompt !== promptText);
        saveFavorites(filtered);
        
        favBtn.classList.remove('favorited');
        favBtn.innerHTML = '⭐ Add to Favorites';
        showNotification('❌ ลบจาก Favorites แล้ว', 'info');
    } else {
        // Add to favorites
        addToFavorites(promptText);
        favBtn.classList.add('favorited');
        favBtn.innerHTML = '⭐ Favorited';
    }
}

function sharePromptById(promptId) {
    const promptElement = document.getElementById(`promptContent-${promptId}`);
    if (!promptElement) return;
    
    const promptText = promptElement.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<br>/g, '\n')
        .replace(/• /g, '* ')
        .replace(/<[^>]*>/g, '');
    
    sharePrompt(promptText);
}

// Close modals on click outside
window.onclick = function(event) {
    if (event.target.classList.contains('templates-modal')) {
        event.target.style.display = 'none';
    }
}

function copyPrompt(button) {
    // หา prompt content จาก parent element
    let promptElement = null;
    const parent = button.closest('.veo3-prompt, .character-profile');
    
    if (parent) {
        promptElement = parent.querySelector('.prompt-content');
    }
    
    if (!promptElement) {
        console.error('Cannot find prompt content');
        return;
    }
    
    // แปลง HTML เป็น text
    const fullText = promptElement.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<br>/g, '\n')
        .replace(/• /g, '* ')
        .replace(/<[^>]*>/g, '');
    
    // ========== กรองเอาเฉพาะ prompt ภาษาอังกฤษ ==========
    
    // ========== กรองเอาเฉพาะ prompt ภาษาอังกฤษ ==========

let finalPrompt = '';

// Method 1: หา prompt ที่ขึ้นต้นด้วย "Veo 3 Prompt:" และจบที่ emoji หรือคำว่าสรุป
// หา prompt ที่ขึ้นต้นด้วย "Veo 3 Prompt:" และจบก่อน emoji หรือคำว่าสรุป
const veoPromptRegex = /Veo 3 Prompt:[\s\S]*?(?=\n{1,2}(?:📽️|🎬|⏱️|📌|\*\*สรุป|สรุป))/;
const veoPromptMatch = fullText.match(veoPromptRegex);

if (veoPromptMatch && veoPromptMatch[0]) {
    // ถ้าเจอ pattern "Veo 3 Prompt:..."
    finalPrompt = veoPromptMatch[0].trim();
    console.log('Found Veo prompt pattern, length:', finalPrompt.length);
} else {
    // Method 2: ถ้าไม่เจอ pattern ข้างบน ให้ตัดที่ emoji หรือภาษาไทย
    console.log('No Veo prompt pattern found, using fallback');
    
    const stopPatterns = [
        /📽️/,
        /🎬/,
        /⏱️/,
        /📌/,
        /📸/,
        /\*\*สรุป/,
        /สรุป Prompt/,
        /ประเภท:/,
        /ความยาว:/,
        /เนื้อเรื่อง/,
        /เทคนิคกล้อง/,
        /saying in Thai:/i,
        /พูดเป็นภาษาไทย:/i,
        /[ก-๙]/
    ];
    
    let cutoffIndex = fullText.length;
    
    for (const pattern of stopPatterns) {
        const match = fullText.search(pattern);
        if (match !== -1 && match < cutoffIndex) {
            cutoffIndex = match;
        }
    }
    
    finalPrompt = fullText.substring(0, cutoffIndex).trim();
}
    
    // Method 2: ถ้าไม่เจออะไรเลย หรือสั้นเกินไป ลองวิธีอื่น
    if (!finalPrompt || finalPrompt.length < 50) {
        // หาบล็อกข้อความภาษาอังกฤษที่ต่อเนื่องกันยาวที่สุด
        const lines = fullText.split('\n');
        const englishBlocks = [];
        let currentBlock = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // ถ้าเป็นบรรทัดว่าง reset block
            if (!trimmed) {
                if (currentBlock.length > 0) {
                    englishBlocks.push(currentBlock.join('\n'));
                    currentBlock = [];
                }
                continue;
            }
            
            // เช็คว่าเป็นภาษาอังกฤษเป็นหลักไหม
            const hasEnglish = /[a-zA-Z]/.test(trimmed);
            const hasThai = /[ก-๙]/.test(trimmed);
            const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(trimmed);
            
            if (hasEnglish && !hasThai && !hasEmoji) {
                currentBlock.push(trimmed);
            } else {
                // ถ้าเจอภาษาไทยหรือ emoji จบ block
                if (currentBlock.length > 0) {
                    englishBlocks.push(currentBlock.join('\n'));
                    currentBlock = [];
                }
            }
        }
        
        // เอา block สุดท้าย
        if (currentBlock.length > 0) {
            englishBlocks.push(currentBlock.join('\n'));
        }
        
        // เลือก block ที่ยาวที่สุด
        if (englishBlocks.length > 0) {
            finalPrompt = englishBlocks.reduce((a, b) => a.length > b.length ? a : b);
        }
    }
    
    // ทำความสะอาดขั้นสุดท้าย
    finalPrompt = finalPrompt
        .replace(/```/g, '')  // ลบ markdown code block
        .replace(/\*\*/g, '')  // ลบ bold markdown
        .replace(/\s+/g, ' ')  // ลบช่องว่างซ้ำ
        .replace(/^[-•*]\s*/gm, '')  // ลบ bullet points
        .trim();
    
    // ถ้ายังไม่ได้อะไรเลย
    if (!finalPrompt) {
        finalPrompt = fullText;
        console.warn('Could not extract English prompt, using full text');
    }
    
    // Debug
    console.log('Extracted prompt length:', finalPrompt.length);
    console.log('First 100 chars:', finalPrompt.substring(0, 100) + '...');
    
    // Copy to clipboard
    navigator.clipboard.writeText(finalPrompt).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = '✅ Copied!';
        
        // แสดง notification พร้อมจำนวนตัวอักษร
        showNotification(`📋 Copied English prompt (${finalPrompt.length} chars)`, 'success');
        
        setTimeout(() => {
            button.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        
        // Fallback method
        const textArea = document.createElement('textarea');
        textArea.value = finalPrompt;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            const originalText = button.innerHTML;
            button.innerHTML = '✅ Copied!';
            
            showNotification(`📋 Copied English prompt (${finalPrompt.length} chars)`, 'success');
            
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        } catch (err) {
            console.error('Fallback copy failed:', err);
            showNotification('❌ Failed to copy', 'error');
        }
        
        document.body.removeChild(textArea);
    });
}

function addLoadingMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    const id = `msg-${messageId++}`;
    
    messageDiv.id = id;
    messageDiv.className = 'message assistant';
    
    const loadingText = currentMode === 'character' ? 
    'กำลังสร้าง Character Profile แบบละเอียด...' :
    currentMode === 'image' ?
    'กำลังสร้างภาพตาม prompt ของคุณ...' :
    'กำลังสร้าง Cinematic Prompt สำหรับ Veo 3...';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
            ${loadingText}
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    return id;
    
}

function removeMessage(msgId) {
    const message = document.getElementById(msgId);
    if (message) message.remove();
}

function showUsageInfo(cost) {
    const messagesContainer = document.getElementById('chatMessages');
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
        text-align: center;
        padding: 8px 16px;
        margin: 8px auto;
        background: rgba(147, 51, 234, 0.1);
        border-radius: 8px;
        font-size: 14px;
        color: #a1a1aa;
    `;
    infoDiv.innerHTML = `
        💰 ค่าใช้จ่าย: <strong style="color: #9333ea;">💰${cost.this_request}</strong> | 
        วันนี้: <strong style="color: #9333ea;">💰${cost.today_total}/${cost.daily_limit}</strong>
    `;
    messagesContainer.appendChild(infoDiv);
}

// ========== SAVE CHARACTER DIALOG ==========
function showSaveDialog() {
    document.getElementById('saveCharacterDialog').style.display = 'flex';
    document.getElementById('characterNameInput').focus();
}

function closeSaveDialog() {
    document.getElementById('saveCharacterDialog').style.display = 'none';
    document.getElementById('characterNameInput').value = '';
}

async function saveCharacter() {
    const nameInput = document.getElementById('characterNameInput');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('กรุณาใส่ชื่อตัวละคร');
        return;
    }
    
    if (!currentCharacterProfile) {
        alert('ไม่มี Character Profile ที่จะบันทึก');
        return;
    }
    
    const profileText = currentCharacterProfile
        .replace(/<br><br>/g, '\n\n')
        .replace(/<br>/g, '\n')
        .replace(/• /g, '* ')
        .replace(/<[^>]*>/g, '');
    
    // สร้าง preview โดยเอาเฉพาะส่วนสรุปหรือ 300 ตัวอักษรแรก
    let previewText = profileText;
    const summaryMatch = profileText.match(/summary[:\s]*(.+?)(?=\n|$)/i);
    if (summaryMatch) {
        previewText = summaryMatch[1];
    } else {
        // ถ้าไม่มี summary ให้เอา 300 ตัวแรก
        previewText = profileText.substring(0, 300) + '...';
    }
    
    try {
        const response = await fetch(`${API_URL}/characters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                name,
                profile: profileText, // ส่ง profile แบบเต็ม
                preview: previewText  // preview แค่ส่วนสรุป
            })
        });
        
        if (response.ok) {
            closeSaveDialog();
            loadCharacterLibrary();
            
            const messagesContainer = document.getElementById('chatMessages');
            const successDiv = document.createElement('div');
            successDiv.style.cssText = `
                text-align: center;
                padding: 12px 20px;
                margin: 12px auto;
                background: rgba(16, 185, 129, 0.1);
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 8px;
                color: #10b981;
            `;
            successDiv.innerHTML = `✅ บันทึกตัวละคร "${name}" เรียบร้อยแล้ว!`;
            messagesContainer.appendChild(successDiv);
            
            currentCharacterProfile = null;
        } else {
            alert('เกิดข้อผิดพลาดในการบันทึก');
        }
    } catch (error) {
        console.error('Error saving character:', error);
        alert('เกิดข้อผิดพลาดในการบันทึก');
    }
}

// ========== RATING FUNCTIONS ==========
async function ratePrompt(promptId, rating) {
    if (!lastPromptData || lastPromptData.promptId !== promptId) {
        console.error('Prompt data not found');
        return;
    }
    
    // Save selected rating
    const ratingSection = document.getElementById(`rating-${promptId}`);
    ratingSection.dataset.selectedRating = rating;
    
    // Update UI
    const stars = ratingSection.querySelectorAll('.star');
    
    // Highlight stars
    stars.forEach((star, index) => {
        if (index < rating) {
            star.textContent = '★';
            star.style.color = '#f59e0b';
            star.classList.add('selected');
        } else {
            star.textContent = '☆';
            star.style.color = '#666';
            star.classList.remove('selected');
        }
    });
    
    // Show feedback box
    const feedbackBox = document.getElementById(`feedback-${promptId}`);
    feedbackBox.style.display = 'block';
    
    // Add submit button if not exists
    if (!ratingSection.querySelector('.submit-rating')) {
        const submitBtn = document.createElement('button');
        submitBtn.className = 'submit-rating';
        submitBtn.textContent = 'ส่งคะแนน';
        submitBtn.onclick = () => submitRating(promptId, rating);
        feedbackBox.after(submitBtn);
    }
}

function previewStars(promptId, rating) {
    const ratingSection = document.getElementById(`rating-${promptId}`);
    const stars = ratingSection.querySelectorAll('.star');
    
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('preview');
            star.textContent = '★';
        } else {
            star.classList.remove('preview');
            star.textContent = '☆';
        }
    });
}

function resetStarPreview(promptId) {
    const ratingSection = document.getElementById(`rating-${promptId}`);
    const stars = ratingSection.querySelectorAll('.star');
    
    // Reset ทุกดาวกลับเป็นสีเทา ถ้ายังไม่ได้เลือก
    if (!ratingSection.dataset.selectedRating) {
        stars.forEach(star => {
            star.classList.remove('preview');
            star.textContent = '☆';
        });
    }
}

async function submitRating(promptId, rating) {
    const feedback = document.getElementById(`feedback-${promptId}`).value;
    
    try {
        const response = await fetch(`${API_URL}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                promptId: promptId,
                promptText: lastPromptData.promptText,
                responseText: lastPromptData.responseText,
                rating: rating,
                feedback: feedback,
                mode: lastPromptData.mode
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update UI to show thank you
            const ratingSection = document.getElementById(`rating-${promptId}`);
            ratingSection.innerHTML = `
                <div class="rating-thanks">
                    ✅ ขอบคุณสำหรับคะแนน! 
                    <span style="color: #f59e0b;">
                        ${'★'.repeat(rating)}${'☆'.repeat(5-rating)}
                    </span>
                    ${data.averageRating ? `<br>คะแนนเฉลี่ยของคุณ: ${data.averageRating.toFixed(1)}/5` : ''}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error submitting rating:', error);
    }
}

// Voice Recognition Variables
let recognition = null;
let isListening = false;
let voiceTimeout = null;
let finalTranscript = '';

// Initialize Voice Recognition
function initVoiceRecognition() {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('Browser does not support speech recognition');
        document.getElementById('voiceButton').style.display = 'none';
        return false;
    }
    
    // Create recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    // Configure recognition
    recognition.continuous = true;          // Keep listening
    recognition.interimResults = true;      // Show results while speaking
    recognition.lang = 'th-TH';            // Thai language
    recognition.maxAlternatives = 1;
    recognition.interimMaxAlternatives = 1;
    recognition.continuous = true;  // ต้องเป็น true
    
    // Recognition event handlers
    recognition.onstart = () => {
        console.log('Voice recognition started');
        isListening = true;
        updateVoiceUI(true);
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        // Process results
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Update textarea with current text
        const messageInput = document.getElementById('messageInput');
        messageInput.value = finalTranscript + interimTranscript;
        
        // Auto-resize textarea
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
        
    };
    
    recognition.onerror = (event) => {
        console.error('Voice recognition error:', event.error);
        
         // ถ้าเป็น no-speech ไม่ต้องหยุด ให้ฟังต่อ
    if (event.error === 'no-speech') {
        console.log('No speech detected, continuing...');
        return; // ไม่ทำอะไร ฟังต่อ
    }
    
    if (event.error === 'not-allowed') {
        showVoicePermissionDialog();
    } else {
        showVoiceError(getErrorMessage(event.error));
    }
    
    stopVoiceInput();
};
    
    recognition.onend = () => {
        console.log('Voice recognition ended');
        isListening = false;
        updateVoiceUI(false);
    };
    
    return true;
}

// Toggle Voice Input
function toggleVoiceInput() {
    if (!recognition) {
        if (!initVoiceRecognition()) {
            alert('ขออภัย เบราว์เซอร์ของคุณไม่รองรับการพูด กรุณาใช้ Chrome หรือ Edge');
            return;
        }
    }
    
    if (isListening) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
}

// Start Voice Input
function startVoiceInput() {
    try {
        // Clear previous transcript
        finalTranscript = document.getElementById('messageInput').value || '';
        if (finalTranscript && !finalTranscript.endsWith(' ')) {
            finalTranscript += ' ';
        }
        
        recognition.start();
        
    } catch (error) {
        console.error('Error starting voice input:', error);
        showVoiceError('ไม่สามารถเริ่มการฟังได้ กรุณาลองใหม่');
    }
}

// Stop Voice Input
function stopVoiceInput() {
    if (recognition && isListening) {
        recognition.stop();
        clearTimeout(voiceTimeout);
    }
}

// Update Voice UI
function updateVoiceUI(listening) {
    const voiceButton = document.getElementById('voiceButton');
    const voiceStatus = document.getElementById('voiceStatus');
    
    if (listening) {
        voiceButton.classList.add('listening');
        voiceButton.innerHTML = '🔴 กำลังฟัง...';
        voiceButton.disabled = true; // ปิดปุ่มไมค์ตอนกำลังฟัง
        voiceStatus.style.display = 'flex';
        
        // เพิ่ม hint
        const voiceText = voiceStatus.querySelector('.voice-text');
        voiceText.innerHTML = 'กำลังฟัง... พูดได้เรื่อยๆ นึกคำช้าก็ได้ 😊';
    } else {
        voiceButton.classList.remove('listening');
        voiceButton.innerHTML = '🎤 พูดเลย';
        voiceButton.disabled = false;
        voiceStatus.style.display = 'none';
    }
}

// Show Voice Permission Dialog
function showVoicePermissionDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'voice-permission-dialog';
    dialog.innerHTML = `
        <h3>🎤 ขออนุญาตใช้ไมโครโฟน</h3>
        <p>
            กรุณาอนุญาตให้เว็บไซต์เข้าถึงไมโครโฟน<br>
            เพื่อใช้งานฟีเจอร์พูดแทนพิมพ์
        </p>
        <button onclick="this.parentElement.remove()">ตกลง</button>
    `;
    document.body.appendChild(dialog);
}

// Show Voice Error
function showVoiceError(message) {
    const messagesContainer = document.getElementById('chatMessages');
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        text-align: center;
        padding: 12px 20px;
        margin: 12px auto;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        color: #ef4444;
    `;
    errorDiv.innerHTML = `⚠️ ${message}`;
    messagesContainer.appendChild(errorDiv);
    
    // Remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
}

// Get Error Message
function getErrorMessage(error) {
    const errorMessages = {
        'not-allowed': 'ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน',
        'no-speech': 'ไม่ได้ยินเสียงพูด กรุณาลองใหม่',
        'audio-capture': 'ไม่พบไมโครโฟน',
        'network': 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต',
        'aborted': 'การฟังถูกยกเลิก'
    };
    
    return errorMessages[error] || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

// Voice Commands (Bonus Feature!)
function processVoiceCommands(text) {
    const commands = {
        'ส่ง': () => sendMessage(),
        'ลบทั้งหมด': () => { document.getElementById('messageInput').value = ''; },
        'สร้างตัวละคร': () => switchMode('character'),
        'ดูตัวละคร': () => switchMode('library'),
        'เปลี่ยนเป็นภาษาอังกฤษ': () => { recognition.lang = 'en-US'; },
        'เปลี่ยนเป็นภาษาไทย': () => { recognition.lang = 'th-TH'; }
    };
    
    // Check for commands
    for (const [command, action] of Object.entries(commands)) {
        if (text.includes(command)) {
            action();
            return true;
        }
    }
    
    return false;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if browser supports voice
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        console.log('Voice recognition supported');
    } else {
        console.log('Voice recognition not supported');
        // Hide voice button
        const voiceBtn = document.getElementById('voiceButton');
        if (voiceBtn) voiceBtn.style.display = 'none';
    }
});

// Add keyboard shortcut (Spacebar to toggle voice)
document.addEventListener('keydown', (e) => {
    // Only if not typing in input
    if (e.code === 'Space' && e.ctrlKey && !e.target.matches('input, textarea')) {
        e.preventDefault();
        toggleVoiceInput();
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (recognition && isListening) {
        recognition.stop();
    }
});
// Function กลับจาก library (มือถือ)
function backToChat() {
    const library = document.getElementById('characterLibrary');
    const chatPanel = document.querySelector('.chat-panel');
    
    library.classList.remove('active');
    library.style.cssText = '';
    chatPanel.style.display = '';
    
    switchMode('general');
}

// ========== IMAGE GENERATION FUNCTION ==========
async function generateImage(prompt) {
    const model = getSelectedImageModel();
    const ratio = getSelectedRatio();
    
    // แสดง loading message
    const loadingId = addMessage('🎨 กำลังสร้างภาพ... อาจใช้เวลา 5-30 วินาที', 'assistant');
    
    // เพิ่ม loading animation
    const messagesContainer = document.getElementById('chatMessages');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'image-loading';
    loadingDiv.innerHTML = `
        <div class="image-loading-spinner"></div>
        <div class="progress-text">กำลังประมวลผล ${model}...</div>
    `;
    messagesContainer.appendChild(loadingDiv);
    
    try {
        const response = await fetch(`${API_URL}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                userId: userId,
                model: model,
                aspectRatio: ratio
            })
        });
        
        const data = await response.json();
        
        // Remove loading
        removeMessage(loadingId);
        loadingDiv.remove();
        
        if (response.ok && data.success) {
    // Debug
    console.log('Full response:', data);
    console.log('Image URL type:', typeof data.imageUrl);
    console.log('Image URL value:', data.imageUrl);
    
    // ถ้า imageUrl เป็น array ให้เอาตัวแรก
    let imageUrl = data.imageUrl;
    if (Array.isArray(imageUrl)) {
        imageUrl = imageUrl[0];
    }
    
    // แสดงภาพที่สร้างได้
    displayGeneratedImage(imageUrl, prompt, model, data.cost);
            
            // Update usage และ credits
            updateUsageDisplay();
            loadUserCredits();
            
        } else if (response.status === 429) {
            // เครดิตไม่พอ
            if (data.error === 'Insufficient credits') {
                showCreditRequiredMessage(data);
            } else {
                addMessage(`❌ ${data.message || 'Daily limit exceeded'}`, 'assistant');
            }
        } else {
            // Error อื่นๆ
            addMessage(`❌ เกิดข้อผิดพลาด: ${data.error || 'Failed to generate image'}`, 'assistant');
        }
        
    } catch (error) {
        removeMessage(loadingId);
        if (loadingDiv) loadingDiv.remove();
        console.error('Image generation error:', error);
        addMessage('❌ ไม่สามารถเชื่อมต่อกับ server ได้', 'assistant');
    }
}

// Function แปลงชื่อ model ให้สวยงาม
function getModelDisplayName(modelId) {
    const modelNames = {
        'flux-schnell': 'Express Mode',
        'flux-dev': 'Premium Mode',
        'flux-pro': '🔥 Ultra Mode'
    };
    return modelNames[modelId] || modelId;
}

// Function แสดงภาพที่สร้างเสร็จ
function displayGeneratedImage(imageUrl, prompt, model, cost) {
    const messageId = `img-${Date.now()}`;
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    // Escape quotes สำหรับใช้ใน HTML attributes
    const escapedUrl = imageUrl.replace(/'/g, "\\'");
    const escapedPrompt = prompt.replace(/'/g, "\\'");
    const altText = prompt.replace(/"/g, '&quot;');
    
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div>✨ สร้างภาพเสร็จแล้ว!</div>
            <div class="generated-image" style="margin-top: 16px;">
                <img src="${imageUrl}" 
                     alt="${altText}" 
                     style="width: 100%; max-width: 512px; height: auto; border-radius: 12px; display: block; cursor: zoom-in;"
                     onclick="openImageModal('${escapedUrl}')"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%23333%22 width=%22400%22 height=%22300%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 fill=%22%23999%22>Image Load Error</text></svg>';">
            </div>
            <div class="image-actions">
                <button class="download-btn" onclick="downloadImage('${escapedUrl}', '${escapedPrompt.substring(0, 50)}')">
                    💾 Download
                </button>
                <button class="retry-btn" onclick="retryGeneration('${escapedPrompt}')">
                    🔄 สร้างใหม่
                </button>
            </div>
            
            <div style="margin-top: 12px; font-size: 14px; color: var(--text-secondary);">
                📊 Model: ${getModelDisplayName(model)} | 💰 ใช้เครดิต: ${cost}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Debug log (เก็บไว้ได้ ไม่เป็นปัญหา)
    console.log('Image URL:', imageUrl);
}

// Helper functions
// แทนที่ function downloadImage เดิม
function downloadImage(url, filename) {
    // Clean filename - ลบอักขระพิเศษ
    const cleanFilename = filename
        .replace(/[^a-z0-9\u0E00-\u0E7F]/gi, '-') // รวมภาษาไทยด้วย
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') // ลบ - หน้าหลัง
        .toLowerCase()
        .substring(0, 50); // จำกัดความยาว
    
    // สร้าง link element
    const a = document.createElement('a');
    a.href = url;
    a.download = `veo-${cleanFilename || 'image'}.png`;
    a.target = '_blank';
    
    // เพิ่ม link ชั่วคราวและคลิก
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showNotification('💾 กำลังดาวน์โหลด...', 'success');
}

// เพิ่ม function นี้ถ้ายังไม่มี (ใส่ต่อจาก downloadImage)
function retryGeneration(prompt) {
    document.getElementById('messageInput').value = prompt;
    sendMessage();
}

// เพิ่ม function นี้ถ้ายังไม่มี
function openImageModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    if (modal && modalImg) {
        modal.style.display = 'flex';
        modalImg.src = imageUrl;
        document.body.style.overflow = 'hidden';
    }
}

// เพิ่ม function นี้ถ้ายังไม่มี
function closeImageModal(event) {
    if (!event || event.target.id === 'imageModal' || event.target.className === 'image-modal-close') {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
}

function retryGeneration(prompt) {
    document.getElementById('messageInput').value = prompt;
    sendMessage();
}

function favoriteImage(imageUrl, prompt) {
    // บันทึกใน localStorage
    const imageHistory = JSON.parse(localStorage.getItem('veoImageHistory') || '[]');
    imageHistory.unshift({
        id: Date.now(),
        url: imageUrl,
        prompt: prompt,
        date: new Date().toISOString()
    });
    
    // เก็บแค่ 50 รูปล่าสุด
    if (imageHistory.length > 50) {
        imageHistory.length = 50;
    }
    
    localStorage.setItem('veoImageHistory', JSON.stringify(imageHistory));
    showNotification('⭐ บันทึกเรียบร้อย!', 'success');
}

// ========== GLOBAL FUNCTION EXPORTS ==========
window.switchMode = switchMode;
window.removeImage = removeImage;
window.copyPrompt = copyPrompt;
window.showImageUrlDialog = showImageUrlDialog;
window.closeImageUrlDialog = closeImageUrlDialog;
window.addImageUrl = addImageUrl;
window.useCharacter = useCharacter;
window.deleteCharacter = deleteCharacter;
window.showSaveDialog = showSaveDialog;
window.closeSaveDialog = closeSaveDialog;
window.saveCharacter = saveCharacter;
window.ratePrompt = ratePrompt;
window.submitRating = submitRating;
window.toggleVoiceInput = toggleVoiceInput;
window.startVoiceInput = startVoiceInput;
window.stopVoiceInput = stopVoiceInput;
window.backToChat = backToChat;
window.showCreditPackages = showCreditPackages;
window.closeCreditModal = closeCreditModal;
window.selectPackage = selectPackage;
window.showTemplates = showTemplates;
window.closeTemplates = closeTemplates;
window.filterTemplates = filterTemplates;
window.showFavorites = showFavorites;
window.closeFavorites = closeFavorites;
window.removeFromFavorites = removeFromFavorites;
window.useFavorite = useFavorite;
window.shareFavorite = shareFavorite;
window.toggleFavorite = toggleFavorite;
window.sharePromptById = sharePromptById;
window.closeAnnouncement = closeAnnouncement;
window.previewStars = previewStars;
window.resetStarPreview = resetStarPreview;
window.showSceneBuilder = showSceneBuilder;
window.closeSceneBuilder = closeSceneBuilder;
window.setCharacterCount = setCharacterCount;
window.updateCharacter = updateCharacter;
window.setMood = setMood;
window.setDuration = setDuration;
window.generateFromBuilder = generateFromBuilder;
window.showCourse = showCourse;
window.closeCourse = closeCourse;
window.continueScene = continueScene;
window.toggleExpand = toggleExpand;
window.openFullEditor = openFullEditor;
window.closeEditor = closeEditor;
window.applyEditorChanges = applyEditorChanges;
window.clearPlaceholders = clearPlaceholders;
window.formatPrompt = formatPrompt;
window.downloadImage = downloadImage;
window.retryGeneration = retryGeneration;
window.favoriteImage = favoriteImage;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;

// 2. เพิ่มฟังก์ชัน Scene Builder
function showSceneBuilder() {
    const modal = document.createElement('div');
    modal.className = 'scene-modal';
    modal.innerHTML = `
        <div class="scene-modal-content">
            <button class="close-modal" onclick="closeSceneBuilder()">✕</button>
            <h2>🎭 สร้าง Promp master</h2>
            
            <div class="scene-form">
                <!-- 1. สถานที่ -->
                <div class="form-section">
                    <h3>📍 1. ฉากนี้เกิดที่ไหน?</h3>
                    <input type="text" id="sceneLocation" 
                           placeholder="เช่น ตลาดนัด, ร้านกาแฟ, ออฟฟิศ" 
                           class="scene-input">
                    <small>💡 ยิ่งละเอียดยิ่งดี เช่น "ตลาดนัดตอนเช้า มีแสงแดดส่อง"</small>
                </div>

                <!-- 1.5 สถานการณ์ -->
<div class="form-section">
    <h3>🎭 1.5 เกิดเหตุการณ์/สถานการณ์อะไร?</h3>
    <input type="text" id="sceneSituation" 
           placeholder="เช่น ด่านตรวจเมาไม่ขับ, งานแต่งงาน, การสัมภาษณ์งาน" 
           class="scene-input">
    <small>💡 บอกเหตุการณ์ที่กำลังเกิดขึ้น หรือบรรยากาศของฉาก</small>
</div>
                
                <!-- 2. จำนวนคน -->
                <div class="form-section">
                    <h3>👥 2. มีกี่คนในฉาก?</h3>
                    <div class="character-count-buttons">
                        <button onclick="setCharacterCount(2)" class="count-btn active">2 คน</button>
                        <button onclick="setCharacterCount(3)" class="count-btn">3 คน</button>
                        <button onclick="setCharacterCount(4)" class="count-btn">4 คน</button>
                        <button onclick="setCharacterCount(5)" class="count-btn">5 คน</button>
                    </div>
                </div>
                
                <!-- 3. ตัวละคร (Dynamic) -->
                <div class="form-section" id="charactersSection">
                    <h3>👤 3. แต่ละคนเป็นใคร?</h3>
                    <div id="characterInputs">
                        <div class="char-input-group">
                            <label>คนที่ 1:</label>
                            <input type="text" placeholder="เช่น นักข่าวสาวชุดสูท" class="scene-input" data-index="0">
                        </div>
                        <div class="char-input-group">
                            <label>คนที่ 2:</label>
                            <input type="text" placeholder="เช่น ลุงขายของ" class="scene-input" data-index="1">
                        </div>
                    </div>
                </div>
                
                <!-- 4. พูดอะไร -->
                <div class="form-section">
                    <h3>💬 4. พูดอะไรกัน? (ถ้ามี)</h3>
                    <textarea id="sceneDialogue" 
                              placeholder="ตัวอย่าง:&#10;นักข่าว: สวัสดีค่ะ ลุงขายของมานานแค่ไหนแล้วคะ?&#10;ลุง: โอ้ย นานแล้วละ สัก 20 ปีได้มั้ง&#10;นักข่าว: ว้าว นานมากเลยนะคะ" 
                              class="scene-textarea"></textarea>
                </div>
                
                <!-- 5. อารมณ์ฉาก -->
                <div class="form-section">
                    <h3>🎬 5. อารมณ์ของฉาก</h3>
                    <div class="mood-buttons">
                        <button onclick="setMood('casual')" class="mood-btn active">
                            😊 สบายๆ
                        </button>
                        <button onclick="setMood('serious')" class="mood-btn">
                            🤔 จริงจัง
                        </button>
                        <button onclick="setMood('funny')" class="mood-btn">
                            😄 ตลกขำขัน
                        </button>
                        <button onclick="setMood('dramatic')" class="mood-btn">
                            😱 ดราม่า
                        </button>
                    </div>
                </div>
                
                <!-- 6. ความยาว -->
                <div class="form-section">
                    <h3>⏱️ 6. ความยาวฉาก</h3>
                    <div class="duration-buttons">
                        <button onclick="setDuration('short')" class="duration-btn active">
                            สั้น (5-6 วินาที)
                        </button>
                        <button onclick="setDuration('medium')" class="duration-btn">
                            กลาง (7-8 วินาที)
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="modal-actions">
                <button onclick="generateFromBuilder()" class="generate-btn">
                    ✨ สร้าง Prompt Master
                </button>
                <button onclick="closeSceneBuilder()" class="cancel-btn">
                    ยกเลิก
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus first input
    setTimeout(() => {
        document.getElementById('sceneLocation').focus();
    }, 100);
}

// 3. Scene Builder Data & Functions
let sceneData = {
    location: '',
    situation: '',
    characterCount: 2,
    characters: ['', ''],
    dialogue: '',
    mood: 'casual',
    duration: 'short'
};

function setCharacterCount(count) {
    sceneData.characterCount = count;
    
    // Update UI
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update character inputs
    const container = document.getElementById('characterInputs');
    container.innerHTML = '';
    
    sceneData.characters = new Array(count).fill('');
    
    for (let i = 0; i < count; i++) {
        container.innerHTML += `
            <div class="char-input-group">
                <label>คนที่ ${i+1}:</label>
                <input type="text" 
                       placeholder="บอกลักษณะสั้นๆ เช่น อายุ เพศ การแต่งตัว" 
                       class="scene-input"
                       data-index="${i}"
                       onchange="updateCharacter(${i}, this.value)">
            </div>
        `;
    }
}

function updateCharacter(index, value) {
    sceneData.characters[index] = value;
}

function setMood(mood) {
    sceneData.mood = mood;
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

function setDuration(duration) {
    sceneData.duration = duration;
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// 4. Generate from builder
function generateFromBuilder() {
    // Collect data
    sceneData.location = document.getElementById('sceneLocation').value;
    sceneData.situation = document.getElementById('sceneSituation').value;
    sceneData.dialogue = document.getElementById('sceneDialogue').value;
    
    // Collect characters
    const charInputs = document.querySelectorAll('#characterInputs input');
    charInputs.forEach(input => {
        const index = parseInt(input.dataset.index);
        sceneData.characters[index] = input.value;
    });
    
    // Validation
if (!sceneData.location && !sceneData.situation) {
    alert('กรุณาระบุสถานที่ หรือ สถานการณ์ อย่างน้อย 1 อย่าง');
    return;
}
    
    // Build message
    let message = `สร้าง Multi-Character Scene แบบละเอียดมาก:\n\n`;
    message += `📍 สถานที่: ${sceneData.location}\n`;
    // เพิ่มส่วนนี้
if (sceneData.situation) {
    message += `🎭 สถานการณ์: ${sceneData.situation}\n`;
}
    message += `👥 จำนวนตัวละคร: ${sceneData.characterCount} คน\n\n`;
    
    message += `รายละเอียดตัวละคร:\n`;
    sceneData.characters.forEach((char, i) => {
        if (char) {
            message += `${i+1}. ${char}\n`;
        } else {
            message += `${i+1}. (ไม่ได้ระบุ - ให้ AI สร้างให้เหมาะกับฉาก)\n`;
        }
    });
    
    if (sceneData.dialogue) {
        message += `\n💬 บทพูด:\n${sceneData.dialogue}\n`;
    } else {
        message += `\n💬 ไม่มีบทพูด หรือให้ AI สร้างบทสนทนาสั้นๆ ให้เหมาะกับฉาก\n`;
    }
    
    message += `\n🎭 อารมณ์: ${getMoodText(sceneData.mood)}`;
    message += `\n⏱️ ความยาว: ${sceneData.duration === 'short' ? '5-6 วินาที' : '7-8 วินาที'}`;
    
    message += `\n\n⚠️ สำคัญ:
- ต้องมี scene setting ละเอียดมาก (props, background, lighting)
- ตัวละครแต่ละคนต้องมีรายละเอียดครบ (หน้าตา, เสื้อผ้า, ท่าทาง)
- ถ้ามีบทพูด ให้ใส่ timing ที่ชัดเจน
- Camera angles และ movements
- Audio layers (dialogue, ambient, effects)
- เอาท์พุตเป็นภาษาอังกฤษทั้งหมด ยกเว้นบทพูดภาษาไทย`;
    
    // Close modal
    closeSceneBuilder();
    
    // Set message and send
    document.getElementById('messageInput').value = message;
    sendMessage();
}

function getMoodText(mood) {
    const moods = {
        casual: 'สบายๆ เป็นกันเอง',
        serious: 'จริงจัง เป็นทางการ',
        funny: 'ตลกขำขัน สนุกสนาน',
        dramatic: 'ดราม่า ตื่นเต้น'
    };
    return moods[mood] || mood;
}

function closeSceneBuilder() {
    document.querySelector('.scene-modal')?.remove();
}

// 5. เพิ่ม styles
const multicharStyles = `
/* Scene Modal */
.scene-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
    padding: 20px;
    overflow-y: auto;
}

.scene-modal-content {
    background: #1a1a1a;
    border-radius: 24px;
    padding: 32px;
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
}

.close-modal {
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    color: #666;
    font-size: 28px;
    cursor: pointer;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.3s ease;
}

.close-modal:hover {
    background: #262626;
    color: #fff;
}

.scene-form {
    margin-top: 24px;
}

.form-section {
    margin-bottom: 32px;
    padding: 20px;
    background: #262626;
    border-radius: 12px;
}

.form-section h3 {
    font-size: 18px;
    margin-bottom: 16px;
    color: #9333ea;
}

.form-section small {
    display: block;
    margin-top: 8px;
    color: #666;
    font-size: 13px;
}

.scene-input {
    width: 100%;
    padding: 12px 16px;
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 8px;
    color: white;
    font-size: 16px;
    margin-bottom: 8px;
    font-family: 'Kanit', sans-serif;
}

.scene-input:focus {
    outline: none;
    border-color: #9333ea;
}

.scene-textarea {
    width: 100%;
    min-height: 150px;
    padding: 12px 16px;
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 8px;
    color: white;
    font-size: 16px;
    resize: vertical;
    font-family: 'Kanit', sans-serif;
    line-height: 1.5;
}

.character-count-buttons,
.mood-buttons,
.duration-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
}

.count-btn,
.mood-btn,
.duration-btn {
    padding: 12px 20px;
    background: #1a1a1a;
    border: 1px solid #404040;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: 'Kanit', sans-serif;
}

.count-btn:hover,
.mood-btn:hover,
.duration-btn:hover {
    border-color: #9333ea;
    transform: translateY(-1px);
}

.count-btn.active,
.mood-btn.active,
.duration-btn.active {
    background: #9333ea;
    border-color: #9333ea;
}

.char-input-group {
    margin-bottom: 12px;
}

.char-input-group label {
    display: block;
    margin-bottom: 4px;
    color: #a1a1aa;
    font-size: 14px;
}

.modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 32px;
}

.generate-btn {
    flex: 1;
    padding: 16px;
    background: linear-gradient(135deg, #9333ea, #ec4899);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'Kanit', sans-serif;
    transition: all 0.3s ease;
}

.generate-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(147, 51, 234, 0.4);
}

.cancel-btn {
    padding: 16px 32px;
    background: #262626;
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-family: 'Kanit', sans-serif;
}

/* Mobile adjustments */
@media (max-width: 768px) {
    .scene-modal-content {
        padding: 24px 20px;
        margin: 20px 0;
    }
    
    .form-section {
        padding: 16px;
    }
    
    .mood-buttons,
    .duration-buttons {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .modal-actions {
        flex-direction: column;
    }
    
    .cancel-btn {
        width: 100%;
    }
}
    /* Highlight situation field */
#sceneSituation {
    border-left: 3px solid #f59e0b;
}

#sceneSituation:focus {
    border-color: #f59e0b;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}
`;

// Add styles to page
if (!document.getElementById('multichar-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'multichar-styles';
    styleSheet.textContent = multicharStyles;
    document.head.appendChild(styleSheet);
}

// ========== COURSE MODAL FUNCTIONS ==========
function showCourse() {
    document.getElementById('courseModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCourse() {
    document.getElementById('courseModal').style.display = 'none';
    document.body.style.overflow = '';
}

// Close on click outside
document.addEventListener('click', (e) => {
    const courseModal = document.getElementById('courseModal');
    if (e.target === courseModal) {
        closeCourse();
    }
});

// Generate Calendar for June 2025
function generateCalendar() {
    const calendar = document.getElementById('courseCalendar');
    if (!calendar) return;
    
    calendar.innerHTML = '';
    
    // Days header
    const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.textContent = day;
        calendar.appendChild(header);
    });
    
    // June 2025 starts on Sunday (0)
    const firstDay = 0;
    const daysInMonth = 30;
    const today = new Date();
    const currentDate = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Empty cells before month starts
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendar.appendChild(emptyDay);
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const dayOfWeek = (firstDay + day - 1) % 7;
        
        // Check availability
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            // Weekend - available
            dayElement.classList.add('available');
            
            // Special case: Sunday June 22
            if (day === 22) {
                dayElement.classList.remove('available');
                dayElement.classList.add('busy');
            }
        } else {
            // Weekday - busy
            dayElement.classList.add('busy');
        }
        
        calendar.appendChild(dayElement);
    }
}

// Update showCourse function
const originalShowCourse = window.showCourse || function() {};
window.showCourse = function() {
    document.getElementById('courseModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    generateCalendar();
};

// ========== SCENE CONTINUITY FUNCTIONS ==========
function continueScene(promptId) {
    // หา prompt element
    const promptElement = document.getElementById(`promptContent-${promptId}`);
    if (!promptElement) return;
    
    // แปลง HTML เป็น text
    const originalPrompt = promptElement.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<br>/g, '\n')
        .replace(/• /g, '* ')
        .replace(/<[^>]*>/g, '');
    
    // สร้างข้อความสำหรับต่อฉาก
    const continuationText = `
[ต่อฉากจาก Scene ก่อนหน้า]
=========================
${originalPrompt}
=========================

[Scene ต่อไป - ขอให้คงทุกอย่างไว้เหมือนเดิม ยกเว้น]:
- เปลี่ยนมุมกล้อง: [ระบุมุมใหม่]
- เปลี่ยน action: [ระบุ action ใหม่]
- เพิ่มบทพูด: [ระบุบทพูดใหม่]

⚠️ สำคัญมาก: ต้องใช้ตัวละครเดิม, สถานที่เดิม, แสงเดิม, และ style เดิมทุกอย่าง!`;
    
    // ใส่ใน textarea
    const messageInput = document.getElementById('messageInput');
    messageInput.value = continuationText;

    // Auto resize textarea
    autoResize();
    
    // ถ้าข้อความยาวมาก เปิด full editor อัตโนมัติ
    if (continuationText.length > 500) {
        setTimeout(() => {
            openFullEditor();
        }, 300);
    } else {
    
    // Scroll ไปที่ input
        messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageInput.focus();
    }
    
    // Highlight text ที่ต้องแก้ไข
    setTimeout(() => {
        const start = continuationText.indexOf('[ระบุมุมใหม่]');
        const end = continuationText.indexOf('⚠️ สำคัญมาก');
        messageInput.setSelectionRange(start, end);
    }, 500);
    
    // แสดง notification
    showNotification('📋 Copied scene! ใช้ปุ่ม ⛶ เพื่อขยาย editor', 'success');
}

// ========== EXPANDABLE TEXTAREA FUNCTIONS ==========
let isExpanded = false;

function toggleExpand() {
    const textarea = document.getElementById('messageInput');
    const btn = document.getElementById('expandBtn');
    
    isExpanded = !isExpanded;
    
    if (isExpanded) {
        textarea.classList.add('expanded');
        btn.innerHTML = '⊟ ย่อ';
    } else {
        textarea.classList.remove('expanded');
        btn.innerHTML = '⛶ ขยาย';
    }
}

// Auto-resize textarea
function autoResize() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
}

// Full screen editor
function openFullEditor() {
    const content = document.getElementById('messageInput').value;
    document.getElementById('fullEditor').value = content;
    document.getElementById('editorModal').style.display = 'flex';
    
    // Focus และเลือก text ที่ต้องแก้
    setTimeout(() => {
        const editor = document.getElementById('fullEditor');
        editor.focus();
        
        // หา [ระบุ...] เพื่อ highlight
        const start = content.indexOf('[ระบุ');
        if (start !== -1) {
            const end = content.indexOf('⚠️ สำคัญมาก') || content.length;
            editor.setSelectionRange(start, end);
        }
    }, 100);
}

function closeEditor() {
    document.getElementById('editorModal').style.display = 'none';
}

function applyEditorChanges() {
    const content = document.getElementById('fullEditor').value;
    document.getElementById('messageInput').value = content;
    closeEditor();
    
    // Update height
    autoResize();
}

// แสดง Quick Edit Bar เมื่อ focus ที่ textarea
document.getElementById('messageInput').addEventListener('focus', () => {
    const bar = document.getElementById('quickEditBar');
    const input = document.getElementById('messageInput');
    
    // แสดงเฉพาะเมื่อมีข้อความแล้ว
    if (input.value.length > 50) {
        bar.style.display = 'flex';
    }
});

// ฟังก์ชัน Clear Placeholders
function clearPlaceholders() {
    const input = document.getElementById('messageInput');
    input.value = input.value.replace(/\[.*?\]/g, '');
    showNotification('🧹 ลบ placeholders แล้ว!', 'success');
}

// ฟังก์ชัน Format Prompt
function formatPrompt() {
    const input = document.getElementById('messageInput');
    // จัดรูปแบบให้อ่านง่าย
    input.value = input.value
        .replace(/\n{3,}/g, '\n\n') // ลบบรรทัดว่างเกิน
        .replace(/\s+/g, ' ') // ลบช่องว่างซ้ำ
        .trim();
    
    autoResize();
    showNotification('✨ จัดรูปแบบแล้ว!', 'success');
}

// Image Modal Functions
function openImageModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.style.display = 'flex';
    modalImg.src = imageUrl;
    document.body.style.overflow = 'hidden';
}

function closeImageModal(event) {
    if (!event || event.target.id === 'imageModal' || event.target.className === 'image-modal-close') {
        const modal = document.getElementById('imageModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ========== MOBILE FIX OVERRIDE ==========
// แก้ไข Character Library สำหรับมือถือ

// Override switchMode function for mobile
const originalSwitchMode = window.switchMode;
window.switchMode = function(mode) {
    // เรียกฟังก์ชันเดิม
    originalSwitchMode(mode);
    
    // เพิ่มการแก้ไขสำหรับ library mode บนมือถือ
    if (mode === 'library' && window.innerWidth <= 968) {
        const library = document.getElementById('characterLibrary');
        const header = document.querySelector('.header');
        const chatPanel = document.querySelector('.chat-panel');
        const statusBar = document.querySelector('.status-bar');
        
        // ซ่อนทุกอย่าง
        if (header) header.style.display = 'none';
        if (chatPanel) chatPanel.style.display = 'none';
        if (statusBar) statusBar.style.display = 'none';
        
        // ทำให้ library เต็มจอ
        if (library) {
            library.style.cssText = `
                display: block !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: 9999 !important;
                background: #0f0f0f !important;
                overflow-y: auto !important;
                padding: 20px !important;
            `;
        }
    }
};

// Override backToChat function
const originalBackToChat = window.backToChat;
window.backToChat = function() {
    const library = document.getElementById('characterLibrary');
    const header = document.querySelector('.header');
    const chatPanel = document.querySelector('.chat-panel');
    const statusBar = document.querySelector('.status-bar');
    
    // แสดงทุกอย่างกลับมา
    if (header) header.style.display = '';
    if (chatPanel) chatPanel.style.display = '';
    if (statusBar) statusBar.style.display = '';
    
    // เรียกฟังก์ชันเดิม
    if (originalBackToChat) {
        originalBackToChat();
    } else {
        // ถ้าไม่มีฟังก์ชันเดิม
        if (library) {
            library.classList.remove('active');
            library.style.cssText = '';
        }
        switchMode('general');
    }
};

console.log('✅ Mobile fixes applied!');

// ========== MOBILE ENHANCEMENTS ==========

// Toggle Mobile Info
function toggleMobileInfo() {
    const content = document.getElementById('mobileInfoContent');
    const button = document.querySelector('.mobile-info-toggle');
    
    if (content.classList.contains('show')) {
        content.classList.remove('show');
        button.innerHTML = 'ℹ️ ดูข้อมูล/วิธีใช้ ▼';
    } else {
        content.classList.add('show');
        button.innerHTML = 'ℹ️ ซ่อนข้อมูล ▲';
        
        // Load content based on current mode
        loadMobileInfo(currentMode);
    }
}

// Load info content for mobile
function loadMobileInfo(mode) {
    const content = document.getElementById('mobileInfoContent');
    let infoHTML = '';
    
    // เพิ่ม Quick Actions ที่ด้านบนเสมอ
    const quickActionsHTML = `
        <div style="
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid #404040;
        ">
            <button onclick="showTemplates(); toggleMobileInfo();" style="
                flex: 1;
                padding: 12px;
                background: #262626;
                border: 1px solid #404040;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                font-size: 14px;
                font-family: 'Kanit', sans-serif;
            ">
                📚 Templates
            </button>
            <button onclick="showFavorites(); toggleMobileInfo();" style="
                flex: 1;
                padding: 12px;
                background: #262626;
                border: 1px solid #404040;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                font-size: 14px;
                font-family: 'Kanit', sans-serif;
            ">
                ⭐ Favorites
            </button>
        </div>
    `;
    
    switch(mode) {
        case 'general':
            infoHTML = quickActionsHTML + `
                <h4>✨ วิธีใช้ General Prompt</h4>
                <p>• เล่าเรื่องง่ายๆ AI จะสร้าง prompt ระดับมืออาชีพให้</p>
                <p>• แนบรูป reference ได้</p>
                <p>• ใช้คำพิเศษ: "สมจริงตามกฏฟิสิกส์", "มุมกล้องระดับเทพ"</p>
            `;
            break;
            
        case 'character':
            infoHTML = quickActionsHTML + `
                <h4>🧙 วิธีใช้ Character Creator</h4>
                <p>• บอกแค่ไอเดีย AI จะสร้าง Character Profile</p>
                <p>• บันทึกไว้ใช้ซ้ำได้</p>
                <p>• ตัวอย่าง: "นักสืบหญิงสไตล์ cyberpunk"</p>
            `;
            break;
            
        case 'multichar':
            infoHTML = quickActionsHTML + `
                <h4>🎭 Prompt Master</h4>
                <div style="margin: 16px 0;">
                    <button onclick="showSceneBuilder(); toggleMobileInfo();" style="
                        width: 100%;
                        padding: 16px;
                        background: linear-gradient(135deg, #9333ea, #ec4899);
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        font-family: 'Kanit', sans-serif;
                    ">
                        🎬 สร้าง Prompt Master
                    </button>
                </div>
                <p style="font-size: 13px; color: #a1a1aa;">
                    • รองรับ 2-5 ตัวละคร พร้อมบทพูด<br>
                    • เหมาะกับฉากซับซ้อน
                </p>
            `;
            break;
            
        case 'image':
    infoHTML = quickActionsHTML + `
        <h4>🎨 Image Generator</h4>
        
        <div style="margin: 16px 0;">
            <label style="display: block; margin-bottom: 8px; color: #9333ea; font-weight: 600;">
                ✨ เลือก Model:
            </label>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    background: #262626;
                    border: 2px solid #9333ea;
                    border-radius: 8px;
                    cursor: pointer;
                ">
                    <input type="radio" name="mobileImageModel" value="flux-schnell" checked style="margin-right: 12px;">
                    <div>
                        <div style="font-weight: 600;">Express Mode</div>
                        <div style="font-size: 12px; color: #a1a1aa;">💰 0.15 เครดิต | ⚡ เร็ว 5-8 วินาที</div>
                    </div>
                </label>
                
                <label style="
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    background: #262626;
                    border: 2px solid #404040;
                    border-radius: 8px;
                    cursor: pointer;
                ">
                    <input type="radio" name="mobileImageModel" value="flux-dev" style="margin-right: 12px;">
                    <div>
                        <div style="font-weight: 600;">Premium Mode</div>
                        <div style="font-size: 12px; color: #a1a1aa;">💰 0.20 เครดิต | ✨ คุณภาพสูง</div>
                    </div>
                </label>
        
        <div style="margin: 16px 0;">
            <label style="display: block; margin-bottom: 8px; color: #9333ea; font-weight: 600;">
                📐 Aspect Ratio:
            </label>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button onclick="setMobileRatio('1:1')" class="mobile-ratio-btn" style="
                    padding: 8px 16px;
                    background: #9333ea;
                    border: 1px solid #404040;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                ">1:1</button>
                <button onclick="setMobileRatio('16:9')" class="mobile-ratio-btn" style="
                    padding: 8px 16px;
                    background: #262626;
                    border: 1px solid #404040;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                ">16:9</button>
                <button onclick="setMobileRatio('9:16')" class="mobile-ratio-btn" style="
                    padding: 8px 16px;
                    background: #262626;
                    border: 1px solid #404040;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                ">9:16</button>
                <button onclick="setMobileRatio('4:3')" class="mobile-ratio-btn" style="
                    padding: 8px 16px;
                    background: #262626;
                    border: 1px solid #404040;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                ">4:3</button>
                <button onclick="setMobileRatio('3:4')" class="mobile-ratio-btn" style="
                    padding: 8px 16px;
                    background: #262626;
                    border: 1px solid #404040;
                    border-radius: 6px;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                ">3:4</button>
            </div>
        </div>
    `;
    break;
            
        case 'library':
            infoHTML = quickActionsHTML + `
                <h4>🗂️ My Character Library</h4>
                <p>• บันทึกตัวละครไว้ใช้ซ้ำ</p>
                <p>• คลิกเพื่อใช้งาน</p>
                <p>• ลบตัวละครที่ไม่ใช้แล้ว</p>
            `;
            break;
    }
    
    content.innerHTML = infoHTML;
}

// เพิ่มฟังก์ชันสำหรับ mobile image settings
let mobileImageRatio = '1:1';

function setMobileRatio(ratio) {
    mobileImageRatio = ratio;
    
    // Update button styles
    document.querySelectorAll('.mobile-ratio-btn').forEach(btn => {
        if (btn.textContent === ratio) {
            btn.style.background = '#9333ea';
        } else {
            btn.style.background = '#262626';
        }
    });
}

// Override getSelectedImageModel สำหรับ mobile
const originalGetSelectedImageModel = window.getSelectedImageModel;
window.getSelectedImageModel = function() {
    if (window.innerWidth <= 768) {
        const mobileSelected = document.querySelector('input[name="mobileImageModel"]:checked');
        if (mobileSelected) {
            return mobileSelected.value;
        }
    }
    return originalGetSelectedImageModel();
};

// Override getSelectedRatio สำหรับ mobile
const originalGetSelectedRatio = window.getSelectedRatio;
window.getSelectedRatio = function() {
    if (window.innerWidth <= 768) {
        return mobileImageRatio;
    }
    return originalGetSelectedRatio();
};

// Export functions
window.toggleMobileInfo = toggleMobileInfo;
window.setMobileRatio = setMobileRatio;
// ========== END MOBILE ENHANCEMENTS ==========
// FAB Tools Menu Toggle
function toggleToolsMenu() {
    const menu = document.getElementById('fabToolsMenu');
    const isOpen = menu.style.display === 'flex';
    
    if (isOpen) {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'flex';
        
        // ปิดเมื่อคลิกที่อื่น
        setTimeout(() => {
            document.addEventListener('click', closeToolsMenu);
        }, 100);
    }
}

function closeToolsMenu(e) {
    const menu = document.getElementById('fabToolsMenu');
    const button = document.querySelector('.fab-tools');
    
    if (!menu.contains(e.target) && !button.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeToolsMenu);
    }
}

// Export functions
window.toggleToolsMenu = toggleToolsMenu;
window.closeToolsMenu = closeToolsMenu;

// ========== RESET THREAD FUNCTION ==========
function resetCurrentThread() {
    // แสดง confirmation
    if (!confirm('ต้องการ Reset การสนทนาหรือไม่?\n\nใช้เมื่อเจอ error หรือระบบค้าง')) {
        return;
    }
    
    try {
        // 1. เคลียร์ thread
        const threadKey = `${userId}_${currentMode}`;
        if (userThreads.has(threadKey)) {
            userThreads.delete(threadKey);
            console.log('✅ Thread cleared:', threadKey);
        }
        
        // 2. เคลียร์ chat history
        if (chatHistory[currentMode]) {
            chatHistory[currentMode] = '';
        }
        
        // 3. เคลียร์หน้าจอ chat
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        
        // 4. เคลียร์รูปที่ค้าง
        window.imageUrls = [];
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) {
            imagePreview.innerHTML = '';
        }
        
        // 5. แสดงข้อความต้อนรับใหม่
        addWelcomeMessage(currentMode);
        
        // 6. แจ้งเตือนสำเร็จ
        showNotification('✅ Reset เรียบร้อย! พร้อมใช้งานใหม่', 'success');
        
    } catch (error) {
        console.error('Reset error:', error);
        // ถ้า reset ไม่สำเร็จ ให้ reload หน้า
        location.reload();
    }
}

// Export function
window.resetCurrentThread = resetCurrentThread;

// END OF PROFESSIONAL SCRIPT