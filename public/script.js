console.log("Script Version: 5.1.0 - Added Image Prompt feature");
// Suppress WM Failed warning
if (typeof window !== 'undefined') {
    window.WM = window.WM || {};
    window.wb_service = window.wb_service || {};
}

// PROFESSIONAL VERSION - NO ERRORS
console.log("Script loaded - Professional Version 5.1");

// ========== GLOBAL CONFIGURATION ==========
const API_URL = window.location.origin + '/api';
const MAX_IMAGE_SIZE = 800;
let isProcessing = false;
let processingMode = null;

// Feature flags
const FEATURES = {
    GOOGLE_AUTH: false  // Set to true when ready to enable Google Sign-In
};

// Simple cloud storage using a public service (for demo only)
// ในระบบจริงควรใช้ backend API ของตัวเอง
window.CLOUD_STORAGE_URL = 'https://api.npoint.io/f1c6b0f3e8b9d2a4c5e7'; // Demo endpoint

// ========== GLOBAL VARIABLES ==========
let currentMode = 'promptmaster';
let messageId = 0;
let characterLibrary = [];
let currentCharacterProfile = null;
let userId = '';
let googleUser = null;

// Function to ensure userId is ready
function ensureUserId() {
    if (!userId) {
        // Check if we have a Google user stored
        const storedGoogleUser = localStorage.getItem('googleUser');
        if (storedGoogleUser) {
            googleUser = JSON.parse(storedGoogleUser);
            userId = googleUser.userId;
        } else {
            // Fall back to regular user ID
            userId = localStorage.getItem('userId');
            if (!userId) {
                userId = 'user_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('userId', userId);
                
                // Save as original userId for tracking free credits
                if (!localStorage.getItem('originalUserId')) {
                    localStorage.setItem('originalUserId', userId);
                }
            }
        }
    }
    return userId;
}
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
    const grid = document.getElementById('templatesGrid');
    if (!document.getElementById('musicVideoCard')) {
        const musicCard = document.createElement('div');
        musicCard.id = 'musicVideoCard';
        musicCard.className = 'template-card';
        musicCard.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(220, 38, 38, 0.2))';
        musicCard.style.border = '2px solid #f59e0b';
        musicCard.innerHTML = `
            <div class="template-emoji">🎵</div>
            <div class="template-title">Music Video Template</div>
            <div class="template-preview">สร้าง MV แบบมืออาชีพ พร้อมฟอร์มกรอกข้อมูล</div>
        `;
        musicCard.onclick = () => {
            closeTemplates();
            showMusicVideoForm();
        };
        grid.insertBefore(musicCard, grid.firstChild);
    }
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
        text: `"${promptText}"\n\nสร้างด้วย`,
        url: 'https://www.promptdee.net'
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
const CURRENT_ANNOUNCEMENT_VERSION = '5.1.0';

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
            // เรียกฟังก์ชันแสดงปุ่ม FAB
showAllFABButtons();
            
            // ✅ แก้ไขปุ่ม FAB หายหลังปิด popup
            const fabButtons = document.querySelectorAll('.fab-announcement, .fab-course, .fab-tools');
            fabButtons.forEach(btn => {
                if (btn) {
                    btn.style.display = 'flex';
                    btn.style.visibility = 'visible';
                    btn.style.opacity = '1';
                }
            });
            
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
    multichar: '',   
    image: '',
    chat: ''  // เพิ่มบรรทัดนี้
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
// Track free credits usage
function trackFreeCreditsUsage(amount) {
    const originalUserId = localStorage.getItem('originalUserId') || userId;
    const today = new Date().toDateString();
    const lastResetDate = localStorage.getItem(`freeCreditsResetDate_${originalUserId}`);
    
    // Reset if new day
    if (lastResetDate !== today) {
        localStorage.setItem(`usedFreeCredits_${originalUserId}`, '0');
        localStorage.setItem(`freeCreditsResetDate_${originalUserId}`, today);
        console.log('New day detected, free credits reset');
    }
    
    const usedFreeCredits = parseFloat(localStorage.getItem(`usedFreeCredits_${originalUserId}`) || '0');
    const newUsedAmount = usedFreeCredits + amount;
    
    // Store the used amount
    localStorage.setItem(`usedFreeCredits_${originalUserId}`, newUsedAmount.toString());
    
    console.log('Free credits used today:', newUsedAmount, 'of 5');
}

async function loadUserCredits() {
    try {
        console.log('🔍 Loading credits for user:', userId);
        const response = await fetch(`${API_URL}/credits/${userId}`);
        const data = await response.json();
        
        console.log('💰 Credits data:', data);
        userCredits = data.currentCredits || 0;
        
        // Track free credit usage if not logged in
        const linkedAccount = localStorage.getItem('linkedAccount');
        if (!linkedAccount && data.previousCredits && data.currentCredits < data.previousCredits) {
            const used = data.previousCredits - data.currentCredits;
            trackFreeCreditsUsage(used);
        }
        
        updateCreditDisplay();
        
        // อัพเดทยอดเครดิตคงเหลือในมือถือ - ใช้ userCredits เหมือนในคอม
        const mobileCreditsBalance = document.getElementById('mobileCreditsBalance');
        if (mobileCreditsBalance) {
            mobileCreditsBalance.textContent = userCredits.toFixed(2);
        }
    } catch (error) {
        console.error('Error loading credits:', error);
    }
}

async function loadTotalPurchasedCredits() {
    try {
        const response = await fetch(`${API_URL}/user-credits-info/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            const totalPurchased = data.totalPurchased || 0;
            document.getElementById('totalPurchasedCredits').textContent = totalPurchased;
        }
    } catch (error) {
        console.error('Error loading total purchased credits:', error);
    }
}
function updateCreditDisplay() {
    const creditDisplay = document.getElementById('creditDisplay');
    if (!creditDisplay) {
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
                <span>+</span> สนับสนุนเว็บ
            </button>
        `;
        usageDisplay.appendChild(creditDiv);
    } else {
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
                    <h2>💖 สนับสนุนเว็บไซต์</h2>
                    <button class="close-btn" onclick="closeCreditModal()">✕</button>
                </div>
                
                <div style="text-align: center; padding: 20px; background: rgba(236, 72, 153, 0.1); border-radius: 12px; margin-bottom: 24px;">
                    <p style="font-size: 16px; color: var(--text); margin: 0;">
                        🙏 ขอบคุณที่ใช้บริการของเรา<br>
                        <span style="font-size: 14px; color: var(--text-secondary);">
                            การสนับสนุนของคุณช่วยให้เราพัฒนาบริการได้ดียิ่งขึ้น
                        </span>
                    </p>
                </div>
                
                <div style="background: rgba(147, 51, 234, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                    <p style="color: var(--primary); font-weight: 600; margin: 0;">
                        ขั้นตอนที่ 1: เลือกแพ็กเกจที่ต้องการสนับสนุน 👇
                    </p>
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
                                💝 สนับสนุน
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                   <div class="payment-info">
                    <h3>💳 ช่องทางสนับสนุน</h3>
                    
                    <!-- QR Code Section -->
                    <div class="qr-section" id="qrSection" style="display: none;">
                        <h4>สแกนเพื่อสนับสนุน</h4>
                        <div class="qr-code" id="qrCodeDisplay"></div>
                        <p style="color: #f59e0b; font-size: 14px; margin-top: 12px;">
                            💡 โอนเงินให้ตรงกับแพ็กเกจที่เลือก แล้วกดแนบสลิปด้านล่าง
                        </p>
                    </div>
                    
                    <div class="payment-methods">
                        <div class="payment-method">
                            <div style="font-size: 48px;">📲</div>
                            <div>
                                <strong>PromptPay</strong><br>
                                เบอร์: ${window.PROMPTPAY_ID || '090-246-2826'}<br>
                                <small style="color: #a1a1aa;">
                                    อัพโหลดสลิปด้านล่างเพื่อรับเครดิตทันที!
                                </small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Upload Section -->
                    <div class="upload-slip-section">
                        <input type="file" id="slipFileInput" accept="image/*" style="display: none;" onchange="handleSlipSelect(event)">
                        <div class="upload-area" onclick="document.getElementById('slipFileInput').click()">
                            <div class="upload-icon">📤</div>
                            <div class="upload-text">อัพโหลดสลิป</div>
                            <div class="upload-hint">คลิกหรือลากไฟล์มาที่นี่</div>
                        </div>
                        
                        <div id="slipPreview" style="display: none;">
                            <div class="slip-preview">
                                <img id="slipImage" src="" alt="Slip preview">
                            </div>
                            <button id="confirmUploadBtn" onclick="uploadSlip()" style="
                                margin-top: 16px;
                                padding: 12px 32px;
                                background: var(--primary);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                cursor: pointer;
                                font-size: 16px;
                                font-weight: 600;
                                transition: all 0.3s ease;
                            ">
                                ✨ ยืนยันการสนับสนุน
                            </button>
                        </div>
                        
                        <div id="uploadStatus" class="upload-status" style="display: none;">
                            <!-- Status จะแสดงที่นี่ -->
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; padding: 16px; background: rgba(147, 51, 234, 0.1); border-radius: 8px;">
                        <p style="color: var(--text-secondary); font-size: 14px; text-align: center;">
                            🎉 <strong>ขอบคุณล่วงหน้า:</strong> ทุกการสนับสนุนมีความหมายกับเรา<br>
                            ⚡ ระบบจะเพิ่มเครดิตให้อัตโนมัติภายใน 5 วินาที
                        </p>
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
    console.log('Package selected:', packageId, price);
    
    // Store selected package data
    selectedPackageData = {
        id: packageId,
        price: price
    };
    
    // Generate QR Code
    generateQRCode(price);
    
    // Show upload section
    const uploadSection = document.querySelector('.upload-slip-section');
    if (uploadSection) {
        uploadSection.style.display = 'block';
        uploadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Update UI to show selected
    document.querySelectorAll('.package-card').forEach(card => {
        card.style.borderColor = '#404040';
        card.style.boxShadow = 'none';
    });
    
    // Find the clicked button's package card
    const clickedCard = event.target.closest('.package-card');
    if (clickedCard) {
        clickedCard.style.borderColor = '#9333ea';
        clickedCard.style.boxShadow = '0 0 20px rgba(147, 51, 234, 0.3)';
    }
    
    // DON'T close modal - ลบ alert และ closeCreditModal ออก
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

// ========== GOOGLE AUTH FUNCTIONS ==========
// Global callback for Google Sign-In
function handleGoogleSignIn(response) {
    console.log('Google Sign-In response received:', response);
    
    // Check if response has credential
    if (!response || !response.credential) {
        console.error('No credential in response:', response);
        showNotification('❌ ไม่ได้รับข้อมูลจาก Google', 'error');
        return;
    }
    
    // Process the sign-in
    processGoogleSignIn(response);
}

async function processGoogleSignIn(response) {
    
    try {
        const currentUserId = ensureUserId();
        console.log('Current userId before login:', currentUserId);
        
        // Send token to backend
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                credential: response.credential,
                currentUserId: currentUserId
            })
        });
        
        console.log('Auth response status:', res.status);
        const data = await res.json();
        console.log('Auth response data:', data);
        
        if (data.success) {
            // Store user info
            googleUser = data.user;
            localStorage.setItem('googleUser', JSON.stringify(googleUser));
            
            // Update userId if changed
            if (data.user.userId !== currentUserId) {
                userId = data.user.userId;
                localStorage.setItem('userId', userId);
                
                // Reload chat histories with new userId
                if (typeof MasterChatHistory !== 'undefined') MasterChatHistory.init();
                if (typeof MultiCharChatHistory !== 'undefined') MultiCharChatHistory.init();
                if (typeof AIChatHistory !== 'undefined') AIChatHistory.init();
                if (typeof CharacterChatHistory !== 'undefined') CharacterChatHistory.init();
            }
            
            // Update UI
            updateAuthUI();
            updateUserId();
            updateCreditsDisplay();
            
            showNotification('✅ เข้าสู่ระบบสำเร็จ!', 'success');
        } else {
            showNotification('❌ เข้าสู่ระบบไม่สำเร็จ', 'error');
        }
    } catch (error) {
        console.error('Sign-in error:', error);
        showNotification('❌ เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
    }
}

function signOut() {
    // Clear Google user data
    googleUser = null;
    localStorage.removeItem('googleUser');
    localStorage.removeItem('linkedAccount');
    
    // Clear credits data
    localStorage.removeItem('totalCredits');
    localStorage.removeItem('creditsData');
    
    // Generate new local userId
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);
    
    // Reset to default free credits
    localStorage.setItem('totalCredits', '5');
    
    // Reload chat histories
    if (typeof MasterChatHistory !== 'undefined') MasterChatHistory.init();
    if (typeof MultiCharChatHistory !== 'undefined') MultiCharChatHistory.init();
    if (typeof AIChatHistory !== 'undefined') AIChatHistory.init();
    if (typeof CharacterChatHistory !== 'undefined') CharacterChatHistory.init();
    
    // Clear character library if exists
    characterLibrary = [];
    if (currentMode === 'library') {
        displayCharacterLibrary();
    }
    
    // Update UI
    updateAuthUI();
    updateUserId();
    updateCreditsDisplay();
    
    showNotification('👋 ออกจากระบบแล้ว', 'info');
}

function updateAuthUI() {
    // Skip if Google Auth is disabled
    if (!FEATURES.GOOGLE_AUTH) {
        return;
    }
    
    const signInWrapper = document.getElementById('googleSignInWrapper');
    const userProfile = document.getElementById('userProfile');
    
    if (googleUser) {
        // Hide sign in button, show profile
        signInWrapper.style.display = 'none';
        userProfile.style.display = 'flex';
        
        // Update profile info
        document.getElementById('userAvatar').src = googleUser.picture || '/default-avatar.png';
        document.getElementById('userName').textContent = googleUser.name || 'User';
        document.getElementById('userEmail').textContent = googleUser.email || '';
    } else {
        // Show sign in button, hide profile
        signInWrapper.style.display = 'block';
        userProfile.style.display = 'none';
    }
}

// Helper function to update userId display
function updateUserId() {
    const userIdElement = document.getElementById('userId');
    if (userIdElement) {
        userIdElement.textContent = userId;
    }
}

// Helper function to update credits display
function updateCreditsDisplay() {
    // Refresh both usage and credits
    updateUsageDisplay();
    loadUserCredits();
    loadTotalPurchasedCredits();
}

// Manual Google Sign-In function
function manualGoogleSignIn() {
    console.log('Manual Google Sign-In clicked');
    
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        try {
            // Try to trigger sign-in programmatically
            google.accounts.id.prompt((notification) => {
                console.log('Prompt notification:', notification);
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // If prompt fails, try OAuth2 redirect flow
                    console.log('Prompt failed, trying redirect flow...');
                    initiateOAuth2Flow();
                }
            });
        } catch (error) {
            console.error('Error with manual sign-in:', error);
            initiateOAuth2Flow();
        }
    } else {
        console.error('Google library not loaded');
        showNotification('❌ Google Sign-In ยังไม่พร้อม กรุณาลองใหม่', 'error');
    }
}

// OAuth2 redirect flow as last resort
function initiateOAuth2Flow() {
    const clientId = '1062109975739-avasict57nmucjds54qp4etmv24g49ue.apps.googleusercontent.com';
    const redirectUri = encodeURIComponent(window.location.origin);
    const scope = encodeURIComponent('openid email profile');
    const responseType = 'token id_token';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `response_type=${responseType}&` +
        `scope=${scope}&` +
        `nonce=${Math.random().toString(36).substring(2)}`;
    
    console.log('Redirecting to:', authUrl);
    window.location.href = authUrl;
}

// Make functions global (MUST be before DOMContentLoaded)
window.handleGoogleSignIn = handleGoogleSignIn;
window.signOut = signOut;
window.manualGoogleSignIn = manualGoogleSignIn;

// Debug: Verify function is accessible
console.log('handleGoogleSignIn function registered:', typeof window.handleGoogleSignIn);

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Get or generate user ID using ensureUserId และอัพเดท global
    userId = ensureUserId();
    updateAuthUI();
    
    // Check for new day and reset free credits if needed (for non-logged in users)
    const originalUserId = localStorage.getItem('originalUserId') || userId;
    const today = new Date().toDateString();
    const lastResetDate = localStorage.getItem(`freeCreditsResetDate_${originalUserId}`);
    
    if (!localStorage.getItem('linkedAccount') && lastResetDate !== today) {
        // Reset free credits for new day
        localStorage.setItem(`usedFreeCredits_${originalUserId}`, '0');
        localStorage.setItem(`freeCreditsResetDate_${originalUserId}`, today);
        
        // Update credits display if not logged in
        const currentCredits = parseFloat(localStorage.getItem('totalCredits') || '0');
        if (currentCredits < 5) {
            localStorage.setItem('totalCredits', '5');
            console.log('New day: Free credits reset to 5');
        }
    }
    
    // Check if user is logged in and sync credits from cloud
    const linkedAccount = localStorage.getItem('linkedAccount');
    if (linkedAccount) {
        try {
            const account = JSON.parse(linkedAccount);
            // Backup current credits before sync
            const currentCredits = parseFloat(localStorage.getItem('totalCredits') || '0');
            console.log('Current local credits before sync:', currentCredits);
            
            // Fetch latest credits from Firebase
            const userResponse = await fetch(`${window.FIREBASE_DATABASE_URL}/users/${account.userId}.json`);
            if (userResponse.ok) {
                const userData = await userResponse.json();
                if (userData && userData.credits !== undefined) {
                    const cloudCredits = parseFloat(userData.credits);
                    console.log('Cloud credits:', cloudCredits);
                    
                    // Use the higher value between local and cloud
                    const finalCredits = Math.max(currentCredits, cloudCredits);
                    localStorage.setItem('totalCredits', finalCredits.toString());
                    updateCreditsDisplay();
                    
                    // If local was higher, update cloud
                    if (currentCredits > cloudCredits) {
                        await updateCloudCredits(account.userId, finalCredits);
                    }
                } else {
                    // No cloud data, keep local credits and update cloud
                    console.log('No cloud data found, keeping local credits');
                    await updateCloudCredits(account.userId, currentCredits);
                }
            }
        } catch (error) {
            console.error('Error syncing credits on load:', error);
        }
    }
    
    // Initialize Google Sign-In with proper configuration
    const initializeGoogleSignIn = () => {
        // Check if feature is enabled
        if (!FEATURES.GOOGLE_AUTH) {
            console.log('🔒 Google Auth is disabled');
            return;
        }
        
        // Show auth section if enabled
        const authSection = document.getElementById('authSection');
        if (authSection) {
            authSection.style.display = 'flex';
        }
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            console.log('✅ Google Sign-In library loaded');
            console.log('📍 Current origin:', window.location.origin);
            console.log('🌐 Full URL:', window.location.href);
            console.log('🔗 Protocol:', window.location.protocol);
            console.log('🏠 Hostname:', window.location.hostname);
            
            try {
                // Initialize
                google.accounts.id.initialize({
                    client_id: '1062109975739-avasict57nmucjds54qp4etmv24g49ue.apps.googleusercontent.com',
                    callback: handleGoogleSignIn,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });
                
                // Render button
                const buttonDiv = document.getElementById('googleSignInButton');
                if (buttonDiv) {
                    google.accounts.id.renderButton(
                        buttonDiv,
                        {
                            type: 'standard',
                            theme: 'filled_blue',
                            size: 'medium',
                            text: 'signin_with',
                            shape: 'rectangular',
                            logo_alignment: 'left',
                            width: 200
                        }
                    );
                    console.log('✅ Google Sign-In button rendered');
                    // Hide manual button if official button renders
                    document.getElementById('manualSignInBtn').style.display = 'none';
                } else {
                    console.error('❌ Button container not found');
                    // Show manual button as fallback
                    document.getElementById('manualSignInBtn').style.display = 'flex';
                }
                
            } catch (error) {
                console.error('❌ Error initializing Google Sign-In:', error);
                // Show manual button as fallback
                document.getElementById('manualSignInBtn').style.display = 'flex';
            }
        } else {
            console.log('⏳ Waiting for Google library...');
            // Show manual button while waiting
            const manualBtn = document.getElementById('manualSignInBtn');
            if (manualBtn) manualBtn.style.display = 'flex';
            
            setTimeout(initializeGoogleSignIn, 1000);
        }
    };
    
    // Wait a bit then initialize
    setTimeout(initializeGoogleSignIn, 1000);
    
    document.addEventListener('change', (e) => {
        if (e.target.name === 'imageModel' || e.target.name === 'mobileImageModel') {
            updateModelSelection(e.target.value);
        }
    });

// Function สำหรับ update UI เมื่อเลือก model
function updateModelSelection(selectedModel) {
    // Update desktop model cards
    document.querySelectorAll('.model-option').forEach(option => {
        const input = option.querySelector('input[type="radio"]');
        const card = option.querySelector('.model-card');
        
        if (input && card) {
            if (input.value === selectedModel) {
                card.style.borderColor = '#9333ea';
                card.style.background = 'rgba(147, 51, 234, 0.1)';
            } else {
                card.style.borderColor = '#404040';
                card.style.background = '';
            }
        }
    });
    
    // Update mobile model selection ถ้ามี
    const mobileRadios = document.querySelectorAll('input[name="mobileImageModel"]');
    mobileRadios.forEach(radio => {
        const label = radio.closest('label');
        if (label) {
            if (radio.value === selectedModel) {
                label.style.borderColor = '#9333ea';
                label.style.background = 'rgba(147, 51, 234, 0.1)';
            } else {
                label.style.borderColor = '#404040';
                label.style.background = '#262626';
            }
        }
    });
}
    
    // Update user ID display
    console.log('📘 UserId in DOMContentLoaded:', userId);
    document.getElementById('userId').textContent = userId;
    
    // Check API status
    checkAPIStatus();
    
    // Update usage display
    updateUsageDisplay();
    // Load user credits
loadUserCredits();
    // Load total purchased credits
    loadTotalPurchasedCredits();
    
    // Load character library
    loadCharacterLibrary();
    
    // Refresh usage every 30 seconds
    setInterval(updateUsageDisplay, 30000);
    // Refresh credits every 30 seconds
setInterval(loadUserCredits, 30000);
    // Refresh total purchased credits every 30 seconds
    setInterval(loadTotalPurchasedCredits, 30000);
    
    // Enter key to send
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Send button
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    
    // Show/hide quick edit bar based on input content
    const quickEditBar = document.getElementById('quickEditBar');
    messageInput.addEventListener('input', () => {
        if (messageInput.value.length > 50) {
            quickEditBar.style.display = 'flex';
        } else {
            quickEditBar.style.display = 'none';
        }
    });
    
    // Initialize mode แต่ยังไม่โหลดประวัติ
    currentMode = 'promptmaster';
    switchMode('promptmaster');
    
    // รอให้ userId พร้อมจริงๆ แล้วค่อยโหลดประวัติ
    setTimeout(() => {
        console.log('🔵 Force reload history after init');
        console.log('🔵 Current userId:', userId);
        if (userId && (currentMode === 'promptmaster' || currentMode === 'multichar' || currentMode === 'image')) {
            if (currentMode === 'promptmaster') {
                loadChatHistory('multichar');
            } else {
                loadChatHistory(currentMode);
            }
        }
    }, 1000); // เพิ่มเป็น 1 วินาที
    
setTimeout(showAllFABButtons, 500);
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
    // ถ้ากำลังประมวลผลอยู่ ไม่ให้เปลี่ยน mode
    if (isProcessing) {
        showNotification('⏳ กรุณารอให้ AI ตอบก่อนค่อยเปลี่ยนโหมด', 'warning');
        
        // คืนค่าปุ่มกลับ
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${currentMode}"]`).classList.add('active');
        
        // คืนค่า dropdown (mobile)
        const dropdown = document.getElementById('mobileModeDrop');
        if (dropdown) dropdown.value = currentMode;
        
        return; // หยุดการเปลี่ยน mode
    }

    // ลบ class เก่าออก
    document.body.className = document.body.className.replace(/mode-\w+/g, '');
    // เพิ่ม class ใหม่
    document.body.classList.add(`mode-${mode}`);
    
    // Save current chat history before switching
    if (currentMode === 'promptmaster' || currentMode === 'character' || currentMode === 'multichar' || currentMode === 'image') {
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
    document.getElementById('imageGenInfo').style.display = 'none';
    document.getElementById('chatInfo').style.display = 'none';
    document.getElementById('characterLibrary').classList.remove('active');
    
    // Update UI based on mode
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const modeNotice = document.getElementById('modeNotice');
    const uploadSection = document.getElementById('uploadSection');
    
    switch(mode) {
        // ในแต่ละ case ให้แก้ไขดังนี้:

case 'promptmaster':
    document.getElementById('multicharInfo').style.display = 'block';
    messageInput.placeholder = "อธิบายวิดีโอที่ต้องการ...";
    sendButton.innerHTML = 'สร้าง Prompt ✨';
    modeNotice.classList.remove('active');
    uploadSection.style.display = 'flex';
    const uploadBtnGeneral = uploadSection.querySelector('.upload-btn');
    if (uploadBtnGeneral) uploadBtnGeneral.style.display = '';
    
    // เพิ่มบรรทัดนี้
    const enhanceSection1 = document.getElementById('enhanceSection');
    if (enhanceSection1) enhanceSection1.style.display = 'none';
    document.getElementById('clearChatBtn').style.display = 'none';
    document.getElementById('clearHistoryBtn').style.display = 'block';
    document.getElementById('chatInfo').style.display = 'none';
    
    loadChatHistory('multichar');
    break;
    
case 'character':
    document.getElementById('characterInfo').style.display = 'block';
    messageInput.placeholder = "บรรยายตัวละครที่ต้องการ...";
    sendButton.innerHTML = 'สร้างตัวละคร 👤';
    modeNotice.innerHTML = '💡 <strong>Character Mode:</strong> AI จะสร้าง Character Profile';
    modeNotice.classList.add('active');
    uploadSection.style.display = 'flex';
    const uploadBtnChar = uploadSection.querySelector('.upload-btn');
    if (uploadBtnChar) uploadBtnChar.style.display = '';
    
    // ซ่อนปุ่ม Template Form สีส้ม
    const templateBtnChar = document.getElementById('templateButtonSection');
    if (templateBtnChar) templateBtnChar.style.display = 'none';
    
    // แสดงปุ่ม Character Template สีม่วง
    const charTemplateBtnChar = document.getElementById('characterTemplateButtonSection');
    if (charTemplateBtnChar) charTemplateBtnChar.style.display = 'inline-block';
    
    const enhanceSection2 = document.getElementById('enhanceSection');
    if (enhanceSection2) enhanceSection2.style.display = 'none';
    document.getElementById('clearChatBtn').style.display = 'none';
    document.getElementById('clearHistoryBtn').style.display = 'none';
    document.getElementById('chatInfo').style.display = 'none';
    
    loadChatHistory('character');
    break;

case 'multichar':
    document.getElementById('multicharInfo').style.display = 'block';
    messageInput.placeholder = "บรรยายฉากที่มีหลายตัวละคร...";
    sendButton.innerHTML = 'สร้าง Prompt 🎭';
    modeNotice.innerHTML = '💡 <strong>Multi-Character Mode:</strong> สร้างฉากหลายตัวละคร';
    modeNotice.classList.add('active');
    uploadSection.style.display = 'flex';
    // แสดงปุ่ม URL กลับมา
    const uploadBtnMulti = uploadSection.querySelector('.upload-btn');
    if (uploadBtnMulti) uploadBtnMulti.style.display = '';
    const enhanceSectionHide = document.getElementById('enhanceSection');
if (enhanceSectionHide) enhanceSectionHide.style.display = 'none';
    document.getElementById('clearChatBtn').style.display = 'none';
    document.getElementById('clearHistoryBtn').style.display = 'block';
    document.getElementById('chatInfo').style.display = 'none';

    loadChatHistory('multichar');
    break;

    case 'library':
    const library = document.getElementById('characterLibrary');
    library.classList.add('active');
    
    // เพิ่มส่วนนี้
    uploadSection.style.display = 'none'; // ซ่อน upload section ใน library
    modeNotice.classList.remove('active'); // ซ่อน mode notice
    document.getElementById('clearChatBtn').style.display = 'none';
    document.getElementById('clearHistoryBtn').style.display = 'none';
    document.getElementById('chatInfo').style.display = 'none';
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
    
    break;

case 'image':
    document.getElementById('imageInfo').style.display = 'block';
    messageInput.placeholder = "บอกไอเดียภาพที่ต้องการ...";
    sendButton.innerHTML = 'สร้าง Prompt 🖼️';
    modeNotice.classList.remove('active');
    uploadSection.style.display = 'flex';
    const uploadBtnImage = uploadSection.querySelector('.upload-btn');
    if (uploadBtnImage) uploadBtnImage.style.display = '';
    
    // ซ่อน enhance section  
    const enhanceSection = document.getElementById('enhanceSection');
    if (enhanceSection) enhanceSection.style.display = 'none';
    document.getElementById('clearChatBtn').style.display = 'none';
    document.getElementById('clearHistoryBtn').style.display = 'block';
    document.getElementById('chatInfo').style.display = 'none';

    // ซ่อนปุ่ม Template Form
    const templateBtnImage = document.getElementById('templateButtonSection');
    if (templateBtnImage) templateBtnImage.style.display = 'none';
    
    loadChatHistory('image');
    break;

case 'imagegen':
    document.getElementById('imageGenInfo').style.display = 'block';
    messageInput.placeholder = "พิมพ์ Prompt ภาษา English...";
    sendButton.innerHTML = 'สร้างภาพ 🎨';
    modeNotice.innerHTML = '💡 <strong>Image Mode:</strong> พิมพ์/พูดไทยได้ แต่ต้องกดปรับปรุง Prompt';
    modeNotice.classList.add('active');
    
    // ซ่อน upload section ทั้งหมด
    uploadSection.style.display = 'none';
    
    // แสดง enhance section  
    const enhanceSectionImageGen = document.getElementById('enhanceSection');
    if (enhanceSectionImageGen) enhanceSectionImageGen.style.display = 'flex';
    document.getElementById('clearChatBtn').style.display = 'none';
    document.getElementById('clearHistoryBtn').style.display = 'none';
    document.getElementById('chatInfo').style.display = 'none';

    // ซ่อนปุ่ม Template Form
    const templateBtnImage2 = document.getElementById('templateButtonSection');
    if (templateBtnImage2) templateBtnImage2.style.display = 'none';
    
    loadChatHistory('imagegen');
    break;

    case 'chat':
    document.getElementById('chatInfo').style.display = 'block';
    messageInput.placeholder = "พิมพ์ถามอะไรก็ได้ หรือแนบรูปมาวิเคราะห์...";
    sendButton.innerHTML = 'ส่งข้อความ 💬';
    modeNotice.innerHTML = '💡 <strong>AI Chat Mode:</strong> สนทนากับ AI ได้ทุกเรื่อง';
    modeNotice.classList.add('active');
    uploadSection.style.display = 'flex';
    const uploadBtnChat = uploadSection.querySelector('.upload-btn');
    if (uploadBtnChat) uploadBtnChat.style.display = '';
    
    // ซ่อนปุ่ม Template Form สีส้ม
    const templateBtnChatMode = document.getElementById('templateButtonSection');
    if (templateBtnChatMode) templateBtnChatMode.style.display = 'none';
    
    // ซ่อนปุ่ม Character Template สีม่วง
    const charTemplateBtnChatMode = document.getElementById('characterTemplateButtonSection');
    if (charTemplateBtnChatMode) charTemplateBtnChatMode.style.display = 'none';
    
    const enhanceSectionChat = document.getElementById('enhanceSection');
    if (enhanceSectionChat) enhanceSectionChat.style.display = 'none';
    document.getElementById('clearChatBtn').style.display = 'block';
    document.getElementById('clearHistoryBtn').style.display = 'none';
    
    loadChatHistory('chat');
    break;
    }
    
    // Hide all info panels first
    document.querySelectorAll('.info-panel').forEach(panel => {
        panel.style.display = 'none';
    });
    
    // Show correct info panel
    if (mode === 'imagegen') {
        document.getElementById('imageGenInfo').style.display = 'block';
    }
    
}

// ========== CHAT HISTORY MANAGEMENT ==========
function saveChatHistory(mode) {
    const chatMessages = document.getElementById('chatMessages');
    if (mode === 'promptmaster' || mode === 'character' || mode === 'multichar' || mode === 'image') {
        chatHistory[mode] = chatMessages.innerHTML;
    }
}

function loadChatHistory(mode) {
    console.log(`📘 loadChatHistory called for ${mode} mode`);
    const chatMessages = document.getElementById('chatMessages');
    
    // ใช้ PromptStorage สำหรับ promptmaster และ multichar
    if (mode === 'promptmaster' || mode === 'multichar') {
        console.log(`📘 Using PromptStorage for ${mode}`);
        PromptStorage.display(mode);
        return;
    }
    
    // ใช้ ImagePromptStorage สำหรับ image mode
    if (mode === 'image') {
        console.log(`📘 Using ImagePromptStorage for image mode`);
        ImagePromptStorage.display();
        return;
    }
    
    // ใช้ ChatStorage สำหรับ chat
    if (mode === 'chat') {
        console.log(`📘 Using ChatStorage for chat mode`);
        ChatStorage.display();
        return;
    }
    
    // โหมดอื่นๆ ใช้วิธีเดิม
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
    if (mode === 'promptmaster' || mode === 'character') {
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
            message = `สวัสดีครับ! ผมคือ Image Prompt Creator 🖼️<br><br>
                      ผมช่วยสร้าง Prompt สำหรับสร้างรูปภาพโดยเฉพาะ<br><br>
                      💡 <strong>Tip:</strong> บอกแค่ไอเดีย ผมจะสร้าง prompt ที่ละเอียดสำหรับ AI สร้างภาพ`;
            break;
            
        case 'imagegen':
            message = `สวัสดีครับ! ผมคือ AI Image Generator 🎨<br><br>
                      เลือก Model และพิมพ์คำอธิบายภาพที่ต้องการเป็นภาษาอังกฤษ<br><br>
                      💡 <strong>ตัวอย่าง:</strong> "A cute cat wearing sunglasses, digital art style"`;
            break;

        case 'chat':
            message = `สวัสดีครับ! ผมคือ AI Chat บอท D ครับ 💬<br><br>
                      เรียกใช้ Bot D ได้เสมอครับ แล้วถามอะไรก็ได้ครับ<br>
                      📎 แนบรูปได้ | 🎤 พูดได้<br><br>
                      💡 <strong>ลองถาม:</strong> "ช่วยอธิบายprompt รุปภาพที่แนบไป หน่อย" หรือ "ขอสูตรแกงเขียวหวาน..."`;
            break;
    }
    
    // ใช้ addMessage ธรรมดา ไม่ใช้ displayChatResponse
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
                    <div class="character-actions">
                        <button onclick="editCharacter(${index}, event)" style="background: none; border: none; color: var(--primary); cursor: pointer; margin-right: 10px;">
                            ✏️ Edit
                        </button>
                        <button onclick="deleteCharacter('${char.id}', event)" style="background: none; border: none; color: var(--error); cursor: pointer;">
                            🗑️ Delete
                        </button>
                    </div>
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
    
    // เปลี่ยนไป promptmaster mode
    switchMode('promptmaster');
    
    // ใส่ข้อมูลตัวละคร
    const messageInput = document.getElementById('messageInput');
    
    let characterData = character.profile || character.preview || 'Character details not available';
    
    if (character.profile) {
        // ดึงข้อมูลทั้งหมด 8 หัวข้อ
        const visualProfile = extractCompleteCharacterProfile(character.profile);
        
        // Format ใหม่ที่ชัดเจนกว่า
        messageInput.value = `⚠️ MUST INCLUDE these character details in EVERY part of the video prompt:

CHARACTER: ${character.name}
===================
${visualProfile}
===================

CRITICAL: The prompt MUST describe this EXACT character (not generic "person" or "man/woman"). Include their name, age, clothing colors, and appearance in EVERY shot.

Now create a prompt where this character: 

[⚠️ กรุณาลบข้อความนี้ออก แล้วพิมพ์ฉากที่คุณต้องการแทนที่]`;
    }
    
    // Focus ที่ input
    messageInput.focus();
    
    // Scroll to input area (สำหรับมือถือ)
    if (window.innerWidth <= 968) {
        setTimeout(() => {
            messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
}

// เพิ่มฟังก์ชันใหม่สำหรับดึงข้อมูลให้ครบทั้ง 14 หัวข้อ
function extractCompleteCharacterProfile(profile) {
    if (!profile) return '';
    
    // ค้นหาส่วนที่เป็น Character Identity Template
    const templateStart = profile.indexOf('📋 **Character Identity Template');
    const templateEnd = profile.indexOf('===================', templateStart + 1);
    
    if (templateStart !== -1 && templateEnd !== -1) {
        // ดึงเฉพาะส่วน template ทั้งหมด
        return profile.substring(templateStart, templateEnd).trim();
    }
    
    // ถ้าไม่เจอ format ใหม่ ใช้วิธีเดิม
    const sections = [
        {
            headers: ['character identity template', '📋'],
            include: true
        },
        {
            headers: ['👤', 'ชื่อ / บทบาท', 'name / role', '1.'],
            include: true
        },
        {
            headers: ['🧑‍🎨', 'เพศ / อายุ', 'gender / age', '2.'],
            include: true
        },
        {
            headers: ['💃', 'รูปร่าง / ผิว', 'body / skin', '3.'],
            include: true
        },
        {
            headers: ['👤', 'ใบหน้า', 'face', '4.'],
            include: true
        },
        {
            headers: ['👁️', 'ดวงตา / คิ้ว', 'eyes / eyebrows', '5.'],
            include: true
        },
        {
            headers: ['👄', 'ริมฝีปาก', 'lips', '6.'],
            include: true
        },
        {
            headers: ['💇', 'ผม', 'hair', '7.'],
            include: true
        },
        {
            headers: ['👗', 'เครื่องแต่งกาย', 'outfit', '8.'],
            include: true
        },
        {
            headers: ['💎', 'เครื่องประดับ', 'accessories', '9.'],
            include: true
        },
        {
            headers: ['🎭', 'บุคลิกภาพ', 'personality', '10.'],
            include: true
        },
        {
            headers: ['🕴️', 'ท่าทางเริ่มต้น', 'starting pose', '11.'],
            include: true
        },
        {
            headers: ['🎙️', 'โทนเสียง', 'voice tone', '12.'],
            include: true
        },
        {
            headers: ['✨', 'ลักษณะพิเศษ', 'special features', '13.'],
            include: true
        },
        {
            headers: ['🖼️', 'ภาพความสมจริง', 'visual style', '14.'],
            include: true
        }
    ];
    
    const lines = profile.split('\n');
    const resultLines = [];
    let currentSection = null;
    let shouldInclude = false;
    let foundSummary = false; // เพิ่มตัวแปรนี้
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();
        
        // ถ้าเจอ summary แล้ว ให้หยุดเลย
        if (foundSummary) {
            break;
        }
        
        // ตรวจสอบว่าเป็นหัวข้อใหม่หรือไม่
        let isNewSection = false;
        
        for (let j = 0; j < sections.length; j++) {
            const section = sections[j];
            for (const header of section.headers) {
                if (lowerLine.includes(header.toLowerCase())) {
                    currentSection = j;
                    shouldInclude = section.include;
                    isNewSection = true;
                    break;
                }
            }
            if (isNewSection) break;
        }
        
        // เก็บบรรทัดถ้าควรเก็บ
        if (shouldInclude) {
            resultLines.push(line);
        }
        
        // ถ้าเจอประโยค summary ให้เก็บแค่ครั้งเดียวแล้วหยุด
        if (lowerLine.includes('this character profile provides') || 
            lowerLine.includes('comprehensive insight')) {
            if (!foundSummary) {
                resultLines.push(line);
                foundSummary = true;
            }
        }
    }
    
    return resultLines.join('\n').trim();
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

// Function to edit character
function editCharacter(index, event) {
    event.stopPropagation();
    
    const character = characterLibrary[index];
    if (!character) return;
    
    // Debug: แสดงข้อมูล character
    console.log('Editing character:', character);
    console.log('Character keys:', Object.keys(character));
    
    // Try to get full profile data - it might be stored in different fields
    let profileText = '';
    if (character.profile && character.profile.length > 100) {
        profileText = character.profile;
        console.log('Using character.profile');
    } else if (character.preview && character.preview.includes('CHARACTER IDENTITY TEMPLATE')) {
        profileText = character.preview;
        console.log('Using character.preview');
    } else if (character.data) {
        profileText = character.data;
        console.log('Using character.data');
    } else {
        // Try to reconstruct from preview
        profileText = character.preview || '';
        console.log('Using fallback preview');
    }
    
    console.log('Profile text length:', profileText.length);
    console.log('Profile text preview:', profileText.substring(0, 200));
    
    // Store character data for editing
    window.editingCharacter = {
        id: character.id,
        name: character.name,
        profile: profileText,
        index: index
    };
    
    // Parse profile to extract 8 sections
    const profileData = parseCharacterProfile(profileText);
    
    // Open character template modal with existing data
    showEditCharacterModal(profileData);
}

// Parse character profile to extract sections (supports both 8 and 14 section formats)
function parseCharacterProfile(profile) {
    if (!profile) return {};
    
    console.log('Parsing profile:', profile);
    
    const parsed = {
        // Character type fields
        type: 'human',
        species: '',
        // Original 8 fields for backward compatibility
        nickname: '',
        role: '',
        gender: '',
        age: '',
        ethnicity: '',
        body: '',
        skin: '',
        posture: '',
        hair: '',
        face: '',
        glasses: '',
        accessories: '',
        shirt: '',
        jacket: '',
        pants: '',
        shoes: '',
        voiceTone: '',
        speechStyle: '',
        confidence: '',
        cameraPresence: '',
        storyRole: '',
        // New 14 fields
        name: '',
        heightWeight: '',
        faceShape: '',
        faceFeatures: '',
        eyes: '',
        eyebrows: '',
        lips: '',
        hairStyle: '',
        hairColor: '',
        hairDetails: '',
        bottoms: '',
        outerwear: '',
        fabric: '',
        headAccessories: '',
        jewelry: '',
        otherAccessories: '',
        personalityTraits: '',
        initialPose: '',
        bodyLanguage: '',
        voicePitch: '',
        speakingStyle: '',
        accent: '',
        voiceCharacteristics: '',
        speech: '',
        theme: '',
        // Additional fields for 14-field format
        uniqueTraits: '',
        specialEffects: '',
        realismType: ''
    };
    
    // Extract data from each section
    const lines = profile.split('\n');
    let currentSection = null;
    let collectedData = {};
    
    // Debug log to see the profile structure
    console.log('Parsing profile lines:', lines.length);
    console.log('First 10 lines:', lines.slice(0, 10));
    
    // Count sections to determine format
    let sectionCount = 0;
    for (const line of lines) {
        if (line.includes('**') && /\*\*\d+\./.test(line)) {
            sectionCount++;
        }
    }
    
    const is14FieldFormat = sectionCount > 10;
    console.log(`Detected ${sectionCount} sections, using ${is14FieldFormat ? '14' : '8'}-field format`);
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (is14FieldFormat) {
            // 14-field format detection
            // Section 1: ชื่อ / บทบาท
            if (trimmedLine.includes('**1.') || trimmedLine.includes('👤')) {
                currentSection = 1;
                collectedData[currentSection] = [];
            }
            // Section 2: เพศ / อายุ / เชื้อชาติ
            else if (trimmedLine.includes('**2.') || trimmedLine.includes('🧑‍🎨')) {
                currentSection = 2;
                collectedData[currentSection] = [];
            }
            // Section 3: รูปร่าง / ผิว
            else if (trimmedLine.includes('**3.') || trimmedLine.includes('💃')) {
                currentSection = 3;
                collectedData[currentSection] = [];
            }
            // Section 4: ใบหน้า
            else if (trimmedLine.includes('**4.') && trimmedLine.includes('ใบหน้า')) {
                currentSection = 4;
                collectedData[currentSection] = [];
            }
            // Section 5: ดวงตา / คิ้ว
            else if (trimmedLine.includes('**5.') || trimmedLine.includes('👁️')) {
                currentSection = 5;
                collectedData[currentSection] = [];
            }
            // Section 6: ริมฝีปาก
            else if (trimmedLine.includes('**6.') || trimmedLine.includes('👄')) {
                currentSection = 6;
                collectedData[currentSection] = [];
            }
            // Section 7: ผม
            else if (trimmedLine.includes('**7.') || trimmedLine.includes('💇‍♀️')) {
                currentSection = 7;
                collectedData[currentSection] = [];
            }
            // Section 8: เครื่องแต่งกาย
            else if (trimmedLine.includes('**8.') || trimmedLine.includes('👗')) {
                currentSection = 8;
                collectedData[currentSection] = [];
            }
            // Section 9: เครื่องประดับ
            else if (trimmedLine.includes('**9.') || trimmedLine.includes('💎')) {
                currentSection = 9;
                collectedData[currentSection] = [];
            }
            // Section 10: บุคลิกภาพ
            else if (trimmedLine.includes('**10.') || trimmedLine.includes('🎭')) {
                currentSection = 10;
                collectedData[currentSection] = [];
            }
            // Section 11: ท่าทางเริ่มต้น
            else if (trimmedLine.includes('**11.') || trimmedLine.includes('🕴️')) {
                currentSection = 11;
                collectedData[currentSection] = [];
            }
            // Section 12: โทนเสียง
            else if (trimmedLine.includes('**12.') || trimmedLine.includes('🎙️')) {
                currentSection = 12;
                collectedData[currentSection] = [];
            }
            // Section 13: ลักษณะพิเศษ
            else if (trimmedLine.includes('**13.') || trimmedLine.includes('💬') || trimmedLine.includes('✨') || 
                     trimmedLine.includes('ลักษณะพิเศษ') || trimmedLine.includes('Special Features')) {
                currentSection = 13;
                collectedData[currentSection] = [];
            }
            // Section 14: ภาพความสมจริง
            else if (trimmedLine.includes('**14.') || trimmedLine.includes('🎨') || trimmedLine.includes('🖼️') || 
                     trimmedLine.includes('ภาพความสมจริง') || trimmedLine.includes('Visual Style')) {
                currentSection = 14;
                collectedData[currentSection] = [];
            }
        } else {
            // 8-field format detection (original)
            // Section 1: ชื่อเรียก / บทบาท
            if (trimmedLine.includes('**1.') || trimmedLine.includes('👩‍🏫')) {
                currentSection = 1;
                collectedData[currentSection] = [];
            }
            // Section 2: เพศ / อายุ / เชื้อชาติ
            else if (trimmedLine.includes('**2.') || trimmedLine.includes('🧑‍🎨')) {
                currentSection = 2;
                collectedData[currentSection] = [];
            }
            // Section 3: รูปร่าง / ผิว / ท่าทาง
            else if (trimmedLine.includes('**3.') || trimmedLine.includes('💃')) {
                currentSection = 3;
                collectedData[currentSection] = [];
            }
            // Section 4: ลักษณะผม / ใบหน้า
            else if (trimmedLine.includes('**4.') || trimmedLine.includes('💇')) {
                currentSection = 4;
                collectedData[currentSection] = [];
            }
            // Section 5: แว่น / เครื่องประดับ
            else if (trimmedLine.includes('**5.') || trimmedLine.includes('👓')) {
                currentSection = 5;
                collectedData[currentSection] = [];
            }
            // Section 6: เครื่องแต่งกาย
            else if (trimmedLine.includes('**6.') || trimmedLine.includes('👗')) {
                currentSection = 6;
                collectedData[currentSection] = [];
            }
            // Section 7: น้ำเสียง / วิธีพูด
            else if (trimmedLine.includes('**7.') || trimmedLine.includes('🎙️')) {
                currentSection = 7;
                collectedData[currentSection] = [];
            }
            // Section 8: บุคลิกภายใน
            else if (trimmedLine.includes('**8.') || trimmedLine.includes('💼')) {
                currentSection = 8;
                collectedData[currentSection] = [];
            }
        }
        
        // Collect data lines (support both - and * bullet points)
        if (currentSection && (trimmedLine.startsWith('-') || trimmedLine.startsWith('*'))) {
            const dataLine = trimmedLine.substring(1).trim();
            if (dataLine.includes(':')) {
                const [key, ...valueParts] = dataLine.split(':');
                const value = valueParts.join(':').trim();
                collectedData[currentSection].push({ key: key.trim(), value });
            } else {
                collectedData[currentSection].push({ key: '', value: dataLine });
            }
        }
    }
    
    // Process collected data
    console.log('Collected data:', collectedData);
    console.log('Section 13 data:', collectedData[13]);
    console.log('Section 14 data:', collectedData[14]);
    
    // Debug: Check which sections were detected
    const detectedSections = Object.keys(collectedData).map(k => parseInt(k)).sort((a, b) => a - b);
    console.log('Detected sections:', detectedSections);
    
    if (is14FieldFormat) {
        // Parse 14-field format
        // Section 1: ชื่อ / บทบาท
        if (collectedData[1]) {
            const nameData = collectedData[1].find(d => 
                d.key.toLowerCase().includes('name') || 
                d.key.includes('ชื่อ') || 
                d.key.includes('Name') ||
                d.key === 'ชื่อ' ||
                (d.key === '' && d.value && !d.value.includes(':'))
            );
            const nicknameData = collectedData[1].find(d => 
                d.key.toLowerCase().includes('nickname') || d.key.includes('ชื่อเรียก')
            );
            const roleData = collectedData[1].find(d => 
                d.key.toLowerCase().includes('role') || d.key.includes('บทบาท')
            );
            parsed.name = nameData ? nameData.value : '';
            parsed.nickname = nicknameData ? nicknameData.value : '';
            parsed.role = roleData ? roleData.value : '';
        }
        
        // Section 2: เพศ / อายุ / เชื้อชาติ or Type / Species
        if (collectedData[2]) {
            // Check for type/species data
            const typeData = collectedData[2].find(d => 
                d.key.toLowerCase().includes('type') || d.key.includes('ประเภท')
            );
            const speciesData = collectedData[2].find(d => 
                d.key.toLowerCase().includes('species') || d.key.includes('ชนิด') || d.key.includes('พันธุ์')
            );
            
            if (typeData) {
                const typeValue = typeData.value.toLowerCase();
                if (typeValue.includes('สัตว์') || typeValue.includes('animal')) {
                    parsed.type = 'animal';
                } else if (typeValue.includes('การ์ตูน') || typeValue.includes('cartoon') || typeValue.includes('แฟนตาซี')) {
                    parsed.type = 'cartoon';
                } else if (typeValue.includes('หุ่นยนต์') || typeValue.includes('robot') || typeValue.includes('ai')) {
                    parsed.type = 'robot';
                } else if (typeValue.includes('สิ่งมีชีวิต') || typeValue.includes('creature')) {
                    parsed.type = 'creature';
                }
            }
            
            if (speciesData) {
                parsed.species = speciesData.value;
            }
            
            const genderData = collectedData[2].find(d => 
                d.key.toLowerCase().includes('gender') || d.key.includes('เพศ')
            );
            const ageData = collectedData[2].find(d => 
                d.key.toLowerCase().includes('age') || d.key.includes('อายุ')
            );
            const ethnicityData = collectedData[2].find(d => 
                d.key.toLowerCase().includes('ethnicity') || d.key.includes('เชื้อชาติ')
            );
            parsed.gender = genderData ? genderData.value : '';
            parsed.age = ageData ? ageData.value : '';
            parsed.ethnicity = ethnicityData ? ethnicityData.value : '';
        }
        
        // Section 3: รูปร่าง / ผิว
        if (collectedData[3]) {
            const bodyData = collectedData[3].find(d => 
                d.key.toLowerCase().includes('body') || d.key.includes('รูปร่าง')
            );
            const heightWeightData = collectedData[3].find(d => 
                d.key.toLowerCase().includes('height') || d.key.includes('ส่วนสูง')
            );
            const skinData = collectedData[3].find(d => 
                d.key.toLowerCase().includes('skin') || d.key.includes('สีผิว') || d.key.includes('ผิว')
            );
            parsed.body = bodyData ? bodyData.value : '';
            parsed.heightWeight = heightWeightData ? heightWeightData.value : '';
            parsed.skin = skinData ? skinData.value : '';
        }
        
        // Section 4: ใบหน้า
        if (collectedData[4]) {
            const faceShapeData = collectedData[4].find(d => 
                d.key.toLowerCase().includes('shape') || d.key.includes('รูปหน้า')
            );
            const faceFeaturesData = collectedData[4].find(d => 
                d.key.toLowerCase().includes('features') || d.key.includes('ลักษณะหน้า')
            );
            parsed.faceShape = faceShapeData ? faceShapeData.value : '';
            parsed.faceFeatures = faceFeaturesData ? faceFeaturesData.value : '';
            parsed.face = `${parsed.faceShape} ${parsed.faceFeatures}`.trim();
        }
        
        // Section 5: ดวงตา / คิ้ว
        if (collectedData[5]) {
            const eyesData = collectedData[5].find(d => 
                d.key.toLowerCase().includes('eyes') || d.key.includes('ดวงตา')
            );
            const eyebrowsData = collectedData[5].find(d => 
                d.key.toLowerCase().includes('eyebrows') || d.key.includes('คิ้ว')
            );
            parsed.eyes = eyesData ? eyesData.value : '';
            parsed.eyebrows = eyebrowsData ? eyebrowsData.value : '';
        }
        
        // Section 6: ริมฝีปาก
        if (collectedData[6]) {
            const lipsData = collectedData[6].find(d => 
                d.key.toLowerCase().includes('lips') || d.key.includes('ริมฝีปาก')
            );
            parsed.lips = lipsData ? lipsData.value : '';
        }
        
        // Section 7: ผม
        if (collectedData[7]) {
            const hairStyleData = collectedData[7].find(d => 
                d.key.toLowerCase().includes('style') || d.key.includes('ทรงผม')
            );
            const hairColorData = collectedData[7].find(d => 
                d.key.toLowerCase().includes('color') || d.key.includes('สีผม')
            );
            const hairDetailsData = collectedData[7].find(d => 
                d.key.toLowerCase().includes('details') || d.key.includes('รายละเอียดผม')
            );
            parsed.hairStyle = hairStyleData ? hairStyleData.value : '';
            parsed.hairColor = hairColorData ? hairColorData.value : '';
            parsed.hairDetails = hairDetailsData ? hairDetailsData.value : '';
            parsed.hair = `${parsed.hairStyle} ${parsed.hairColor} ${parsed.hairDetails}`.trim();
        }
        
        // Section 8: เครื่องแต่งกาย
        if (collectedData[8]) {
            collectedData[8].forEach(d => {
                const keyLower = d.key.toLowerCase();
                if ((keyLower.includes('shirt') && !keyLower.includes('outerwear')) || 
                    (d.key.includes('เสื้อ') && !d.key.includes('เสื้อคลุม'))) {
                    parsed.shirt = d.value;
                } else if (keyLower.includes('bottoms') || keyLower.includes('pants') || 
                           d.key.includes('กางเกง') || d.key.includes('กระโปรง')) {
                    parsed.bottoms = d.value;
                    parsed.pants = d.value; // For backward compatibility
                } else if (keyLower.includes('outerwear') || keyLower.includes('jacket') || 
                           d.key.includes('เสื้อคลุม')) {
                    parsed.outerwear = d.value;
                    parsed.jacket = d.value; // For backward compatibility
                } else if (keyLower.includes('shoes') || d.key.includes('รองเท้า')) {
                    parsed.shoes = d.value;
                } else if (keyLower.includes('fabric') || d.key.includes('วัสดุ') || d.key.includes('ผ้า')) {
                    parsed.fabric = d.value;
                }
            });
        }
        
        // Section 9: เครื่องประดับ
        if (collectedData[9]) {
            const headAccessoriesData = collectedData[9].find(d => 
                d.key.toLowerCase().includes('head') || d.key.includes('ที่ศีรษะ')
            );
            const jewelryData = collectedData[9].find(d => 
                d.key.toLowerCase().includes('jewelry') || 
                d.key.includes('เครื่องประดับ') ||
                d.key.includes('สร้อยคอ') ||
                d.key.includes('สร้อย') ||
                d.key.includes('necklace') ||
                d.key.includes('Necklace') ||
                (d.key === '' && d.value && (d.value.includes('สร้อย') || d.value.includes('necklace')))
            );
            const otherAccessoriesData = collectedData[9].find(d => 
                d.key.toLowerCase().includes('other') || 
                d.key.includes('อื่นๆ') ||
                d.key.includes('แว่น') ||
                d.key.includes('glasses') ||
                (d.key === '' && d.value && (d.value.includes('แว่น') || d.value.includes('นาฬิกา')))
            );
            parsed.headAccessories = headAccessoriesData ? headAccessoriesData.value : '';
            parsed.jewelry = jewelryData ? jewelryData.value : '';
            parsed.otherAccessories = otherAccessoriesData ? otherAccessoriesData.value : '';
            parsed.accessories = `${parsed.headAccessories} ${parsed.jewelry} ${parsed.otherAccessories}`.trim();
            
            // Also check for glasses in accessories if not found elsewhere
            if (!parsed.glasses && otherAccessoriesData && otherAccessoriesData.value.includes('แว่น')) {
                parsed.glasses = otherAccessoriesData.value;
            }
        }
        
        // Section 10: บุคลิกภาพ
        if (collectedData[10]) {
            const personalityTraitsData = collectedData[10].find(d => 
                d.key.toLowerCase().includes('traits') || d.key.includes('ลักษณะนิสัย')
            );
            const confidenceData = collectedData[10].find(d => 
                d.key.toLowerCase().includes('confidence') || d.key.includes('ความมั่นใจ')
            );
            const cameraPresenceData = collectedData[10].find(d => 
                d.key.toLowerCase().includes('camera') || d.key.includes('ท่าทีต่อกล้อง')
            );
            parsed.personalityTraits = personalityTraitsData ? personalityTraitsData.value : '';
            parsed.confidence = confidenceData ? confidenceData.value : '';
            parsed.cameraPresence = cameraPresenceData ? cameraPresenceData.value : '';
        }
        
        // Section 11: ท่าทางเริ่มต้น
        if (collectedData[11]) {
            const initialPoseData = collectedData[11].find(d => 
                d.key.toLowerCase().includes('pose') || d.key.includes('ท่าทางเริ่มต้น')
            );
            const bodyLanguageData = collectedData[11].find(d => 
                d.key.toLowerCase().includes('language') || d.key.includes('ภาษากาย')
            );
            parsed.initialPose = initialPoseData ? initialPoseData.value : '';
            parsed.bodyLanguage = bodyLanguageData ? bodyLanguageData.value : '';
            parsed.posture = parsed.initialPose; // For backward compatibility
        }
        
        // Section 12: โทนเสียง
        if (collectedData[12]) {
            const voicePitchData = collectedData[12].find(d => 
                d.key.toLowerCase().includes('pitch') || d.key.includes('ระดับเสียง')
            );
            const speakingStyleData = collectedData[12].find(d => 
                d.key.toLowerCase().includes('speaking') || d.key.includes('ลักษณะการพูด')
            );
            const accentData = collectedData[12].find(d => 
                d.key.toLowerCase().includes('accent') || d.key.includes('สำเนียง')
            );
            const voiceCharData = collectedData[12].find(d => 
                d.key.toLowerCase().includes('characteristics') || d.key.includes('ลักษณะเสียง')
            );
            parsed.voicePitch = voicePitchData ? voicePitchData.value : '';
            parsed.speakingStyle = speakingStyleData ? speakingStyleData.value : '';
            parsed.accent = accentData ? accentData.value : '';
            parsed.voiceCharacteristics = voiceCharData ? voiceCharData.value : '';
            parsed.voiceTone = parsed.voicePitch; // For backward compatibility
            parsed.speechStyle = parsed.speakingStyle; // For backward compatibility
        }
        
        // Section 13: ลักษณะพิเศษ
        if (collectedData[13]) {
            const uniqueTraitsData = collectedData[13].find(d => 
                d.key.toLowerCase().includes('unique') || d.key.toLowerCase().includes('traits') || 
                d.key.includes('ลักษณะเฉพาะ') || d.key.includes('ลักษณะพิเศษ')
            );
            const specialEffectsData = collectedData[13].find(d => 
                d.key.toLowerCase().includes('effects') || d.key.toLowerCase().includes('special') || 
                d.key.includes('เอฟเฟกต์') || d.key.includes('เอฟเฟกต์พิเศษ')
            );
            parsed.uniqueTraits = uniqueTraitsData ? uniqueTraitsData.value : '';
            parsed.specialEffects = specialEffectsData ? specialEffectsData.value : '';
            // For backward compatibility with speech
            parsed.speech = parsed.uniqueTraits || parsed.specialEffects || '';
        }
        
        // Section 14: ภาพความสมจริง
        if (collectedData[14]) {
            const realismData = collectedData[14].find(d => 
                d.key.toLowerCase().includes('realism') || d.key.toLowerCase().includes('visual') || 
                d.key.toLowerCase().includes('style') || d.key.includes('ความสมจริง') || 
                d.key.includes('สไตล์') || d.key.includes('ภาพ') || d.key.includes('ประเภท')
            );
            parsed.realismType = realismData ? realismData.value : '';
            
            // If no realismType found, check if there's any data without a key
            if (!parsed.realismType && collectedData[14].length > 0) {
                const noKeyData = collectedData[14].find(d => !d.key || d.key === '');
                if (noKeyData) {
                    parsed.realismType = noKeyData.value;
                }
            }
            
            // For backward compatibility with theme
            const themeData = collectedData[14].find(d => 
                d.key.toLowerCase().includes('theme') || d.key.includes('ธีม')
            );
            if (!parsed.realismType && themeData) {
                parsed.theme = themeData.value;
                parsed.storyRole = parsed.theme;
            }
        }
    } else {
        // Parse 8-field format (original logic)
        // Section 1: ชื่อเรียก / บทบาท / Nickname / Role
        if (collectedData[1]) {
            const nicknameData = collectedData[1].find(d => 
                d.key.toLowerCase().includes('nickname') || d.key.includes('ชื่อเรียก')
            );
            const roleData = collectedData[1].find(d => 
                d.key.toLowerCase().includes('role') || d.key.includes('บทบาท')
            );
            parsed.nickname = nicknameData ? nicknameData.value : '';
            parsed.role = roleData ? roleData.value : '';
        }
        
        // Section 2: เพศ / อายุ / เชื้อชาติ / Gender / Age / Ethnicity
        if (collectedData[2]) {
            const genderData = collectedData[2].find(d => 
                d.key.toLowerCase().includes('gender') || d.key.includes('เพศ')
            );
            const ageData = collectedData[2].find(d => 
                d.key.toLowerCase().includes('age') || d.key.includes('อายุ')
            );
            const ethnicityData = collectedData[2].find(d => 
                d.key.toLowerCase().includes('ethnicity') || d.key.includes('เชื้อชาติ')
            );
            parsed.gender = genderData ? genderData.value : '';
            parsed.age = ageData ? ageData.value : '';
            parsed.ethnicity = ethnicityData ? ethnicityData.value : '';
        }
        
        // Section 3: รูปร่าง / ผิว / ท่าทาง / Body / Skin / Posture
        if (collectedData[3]) {
            const bodyData = collectedData[3].find(d => 
                d.key.toLowerCase().includes('body') || d.key.includes('รูปร่าง')
            );
            const skinData = collectedData[3].find(d => 
                d.key.toLowerCase().includes('skin') || d.key.includes('ผิว')
            );
            const postureData = collectedData[3].find(d => 
                d.key.toLowerCase().includes('posture') || d.key.includes('ท่าทาง')
            );
            parsed.body = bodyData ? bodyData.value : '';
            parsed.skin = skinData ? skinData.value : '';
            parsed.posture = postureData ? postureData.value : '';
        }
        
        // Section 4: ลักษณะผม / ใบหน้า / Hair / Face
        if (collectedData[4]) {
            const hairData = collectedData[4].find(d => 
                d.key.toLowerCase().includes('hair') || d.key.includes('ผม')
            );
            const faceData = collectedData[4].find(d => 
                d.key.toLowerCase().includes('face') || d.key.includes('ใบหน้า')
            );
            parsed.hair = hairData ? hairData.value : '';
            parsed.face = faceData ? faceData.value : '';
        }
        
        // Section 5: แว่น / เครื่องประดับ / Glasses / Accessories
        if (collectedData[5]) {
            const glassesData = collectedData[5].find(d => 
                d.key.toLowerCase().includes('glasses') || 
                d.key.includes('แว่น') ||
                d.key.includes('แว่นตา') ||
                d.key.includes('Glasses') ||
                (d.key === '' && d.value && (d.value.includes('แว่น') || d.value.includes('glasses')))
            );
            const accessoriesData = collectedData[5].find(d => 
                d.key.toLowerCase().includes('accessories') || d.key.includes('เครื่องประดับ')
            );
            parsed.glasses = glassesData ? glassesData.value : '';
            parsed.accessories = accessoriesData ? accessoriesData.value : '';
        }
        
        // Section 6: เครื่องแต่งกาย / Clothing
        if (collectedData[6]) {
            collectedData[6].forEach(d => {
                const keyLower = d.key.toLowerCase();
                if ((keyLower.includes('shirt') && !keyLower.includes('jacket')) || 
                    (d.key.includes('เสื้อ') && !d.key.includes('เสื้อคลุม'))) {
                    parsed.shirt = d.value;
                } else if (keyLower.includes('jacket') || keyLower.includes('suit') || 
                           d.key.includes('เสื้อคลุม') || d.key.includes('สูท')) {
                    parsed.jacket = d.value;
                } else if (keyLower.includes('pants') || keyLower.includes('skirt') || 
                           d.key.includes('กางเกง') || d.key.includes('กระโปรง')) {
                    parsed.pants = d.value;
                } else if (keyLower.includes('shoes') || d.key.includes('รองเท้า')) {
                    parsed.shoes = d.value;
                }
            });
        }
        
        // Section 7: น้ำเสียง / วิธีพูด / Voice / Speech
        if (collectedData[7]) {
            const voiceData = collectedData[7].find(d => 
                d.key.toLowerCase().includes('voice') || d.key.includes('โทนเสียง')
            );
            const speechData = collectedData[7].find(d => 
                d.key.toLowerCase().includes('speech') || d.key.includes('ลักษณะการพูด')
            );
            parsed.voiceTone = voiceData ? voiceData.value : '';
            parsed.speechStyle = speechData ? speechData.value : '';
        }
        
        // Section 8: บุคลิกภายใน / Personality
        if (collectedData[8]) {
            collectedData[8].forEach(d => {
                const keyLower = d.key.toLowerCase();
                if (keyLower.includes('confidence') || d.key.includes('ความมั่นใจ')) {
                    parsed.confidence = d.value;
                } else if (keyLower.includes('camera') || d.key.includes('ท่าทีต่อกล้อง')) {
                    parsed.cameraPresence = d.value;
                } else if (keyLower.includes('story') || d.key.includes('บทบาทในเรื่อง')) {
                    parsed.storyRole = d.value;
                }
            });
        }
    }
    
    console.log('Parsed result:', parsed);
    console.log('Is 14-field format:', is14FieldFormat);
    return parsed;
}

// Show edit character modal
function showEditCharacterModal(profileData) {
    // ปิด library ก่อน
    const library = document.getElementById('characterLibrary');
    library.classList.remove('active');
    
    // เปิด character template modal
    const modal = document.getElementById('characterTemplateModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '10001';
    
    // Fix for mobile - ensure modal is visible and buttons clickable
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    
    // Ensure modal is on top and scrolls to top (especially for mobile)
    setTimeout(() => {
        modal.scrollTop = 0;
        window.scrollTo(0, 0);
        document.body.style.overflow = 'hidden';
        
        // Mobile specific fix
        if (window.innerWidth <= 768) {
            const modalContent = modal.querySelector('.character-template-content');
            if (modalContent) {
                modalContent.style.marginTop = '20px';
                modalContent.style.maxHeight = 'calc(100vh - 40px)';
                modalContent.style.overflowY = 'auto';
            }
        }
    }, 100);
    
    // Update modal title
    const modalTitle = modal.querySelector('h2');
    modalTitle.textContent = '✏️ แก้ไขข้อมูลตัวละคร';
    
    // Clear all fields first
    document.querySelectorAll('.character-template-section input, .character-template-section textarea').forEach(input => {
        input.value = '';
    });
    
    console.log('Filling form with data:', profileData);
    console.log('Profile data keys:', Object.keys(profileData));
    console.log('Profile data values:', Object.values(profileData));
    
    // Fill form with existing data
    // The parsed data already contains clean values without labels
    
    // Debug logging
    console.log('=== Filling form with parsed data ===');
    console.log('Section 13 - uniqueTraits:', profileData.uniqueTraits);
    console.log('Section 13 - specialEffects:', profileData.specialEffects);
    console.log('Section 14 - realismType:', profileData.realismType);
    
    // Character Type
    if (profileData.type) {
        document.getElementById('charType').value = profileData.type;
        updateCharacterFormFields(); // Update form fields based on type
    }
    if (profileData.species) document.getElementById('charSpecies').value = profileData.species;
    
    // Section 1: ชื่อ / บทบาท
    if (profileData.name) document.getElementById('charName').value = profileData.name;
    if (profileData.nickname) document.getElementById('charNickname').value = profileData.nickname;
    if (profileData.role) document.getElementById('charRole').value = profileData.role;
    
    // Section 2: เพศ / อายุ / เชื้อชาติ
    if (profileData.gender) document.getElementById('charGender').value = profileData.gender;
    if (profileData.age) document.getElementById('charAge').value = profileData.age;
    if (profileData.ethnicity) document.getElementById('charEthnicity').value = profileData.ethnicity;
    
    // Section 3: รูปร่าง / ผิว
    if (profileData.body) document.getElementById('charBody').value = profileData.body;
    if (profileData.heightWeight) document.getElementById('charHeightWeight').value = profileData.heightWeight;
    if (profileData.skin) document.getElementById('charSkin').value = profileData.skin;
    
    // Section 4: ใบหน้า
    if (profileData.faceShape) document.getElementById('charFaceShape').value = profileData.faceShape;
    if (profileData.faceFeatures) document.getElementById('charFaceFeatures').value = profileData.faceFeatures;
    // For backward compatibility, if old face field exists
    if (!profileData.faceShape && !profileData.faceFeatures && profileData.face) {
        document.getElementById('charFaceShape').value = profileData.face;
    }
    
    // Section 5: ดวงตา / คิ้ว
    if (profileData.eyes) document.getElementById('charEyes').value = profileData.eyes;
    if (profileData.eyebrows) document.getElementById('charEyebrows').value = profileData.eyebrows;
    
    // Section 6: ริมฝีปาก
    if (profileData.lips) document.getElementById('charLips').value = profileData.lips;
    
    // Section 7: ผม
    if (profileData.hairStyle) document.getElementById('charHairStyle').value = profileData.hairStyle;
    if (profileData.hairColor) document.getElementById('charHairColor').value = profileData.hairColor;
    if (profileData.hairDetails) document.getElementById('charHairDetails').value = profileData.hairDetails;
    // For backward compatibility, if old hair field exists
    if (!profileData.hairStyle && !profileData.hairColor && !profileData.hairDetails && profileData.hair) {
        document.getElementById('charHairStyle').value = profileData.hair;
    }
    
    // Section 8: เครื่องแต่งกาย
    if (profileData.shirt) document.getElementById('charShirt').value = profileData.shirt;
    if (profileData.bottoms) document.getElementById('charBottoms').value = profileData.bottoms;
    if (profileData.pants && !profileData.bottoms) document.getElementById('charBottoms').value = profileData.pants; // Backward compatibility
    if (profileData.outerwear) document.getElementById('charOuterwear').value = profileData.outerwear;
    if (profileData.jacket && !profileData.outerwear) document.getElementById('charOuterwear').value = profileData.jacket; // Backward compatibility
    if (profileData.shoes) document.getElementById('charShoes').value = profileData.shoes;
    if (profileData.fabric) document.getElementById('charFabric').value = profileData.fabric;
    
    // Section 9: เครื่องประดับ
    if (profileData.headAccessories) document.getElementById('charHeadAccessories').value = profileData.headAccessories;
    if (profileData.jewelry) document.getElementById('charJewelry').value = profileData.jewelry;
    if (profileData.otherAccessories) document.getElementById('charOtherAccessories').value = profileData.otherAccessories;
    // For backward compatibility with old accessories field
    if (!profileData.headAccessories && !profileData.jewelry && !profileData.otherAccessories && profileData.accessories) {
        document.getElementById('charJewelry').value = profileData.accessories;
    }
    // Handle glasses from old format
    if (profileData.glasses) document.getElementById('charOtherAccessories').value = profileData.glasses;
    
    // Section 10: บุคลิกภาพ
    if (profileData.personalityTraits) document.getElementById('charPersonalityTraits').value = profileData.personalityTraits;
    if (profileData.confidence) document.getElementById('charConfidence').value = profileData.confidence;
    if (profileData.cameraPresence) document.getElementById('charCameraPresence').value = profileData.cameraPresence;
    
    // Section 11: ท่าทางเริ่มต้น
    if (profileData.initialPose) document.getElementById('charInitialPose').value = profileData.initialPose;
    if (profileData.bodyLanguage) document.getElementById('charBodyLanguage').value = profileData.bodyLanguage;
    // For backward compatibility with posture
    if (!profileData.initialPose && profileData.posture) document.getElementById('charInitialPose').value = profileData.posture;
    
    // Section 12: โทนเสียง
    if (profileData.voicePitch) document.getElementById('charVoicePitch').value = profileData.voicePitch;
    if (profileData.speakingStyle) document.getElementById('charSpeakingStyle').value = profileData.speakingStyle;
    if (profileData.accent) document.getElementById('charAccent').value = profileData.accent;
    if (profileData.voiceCharacteristics) document.getElementById('charVoiceCharacteristics').value = profileData.voiceCharacteristics;
    // For backward compatibility with old voice fields
    if (!profileData.voicePitch && profileData.voiceTone) document.getElementById('charVoicePitch').value = profileData.voiceTone;
    if (!profileData.speakingStyle && profileData.speechStyle) document.getElementById('charSpeakingStyle').value = profileData.speechStyle;
    
    // Section 13: ลักษณะพิเศษ
    if (profileData.uniqueTraits) document.getElementById('charUniqueTraits').value = profileData.uniqueTraits;
    if (profileData.specialEffects) document.getElementById('charSpecialEffects').value = profileData.specialEffects;
    
    // Section 14: ภาพความสมจริง
    if (profileData.realismType) document.getElementById('charRealismType').value = profileData.realismType;
    // For backward compatibility with storyRole/theme
    if (!profileData.realismType && (profileData.storyRole || profileData.theme)) {
        // Try to map old values to new realism types
        const oldValue = profileData.storyRole || profileData.theme;
        if (oldValue.toLowerCase().includes('realistic') || oldValue.toLowerCase().includes('photo')) {
            document.getElementById('charRealismType').value = 'Photorealistic Human';
        }
    }
    
    // หา action buttons div
    const actionsDiv = modal.querySelector('.template-actions');
    if (actionsDiv) {
        // เปลี่ยนปุ่มเป็นปุ่มบันทึก
        actionsDiv.innerHTML = `
            <button class="generate-from-template-btn" onclick="window.saveEditedCharacter()">
                💾 บันทึกการแก้ไข
            </button>
            <button class="cancel-btn" onclick="window.cancelEditCharacter()">
                ยกเลิก
            </button>
        `;
    }
}

// Save edited character
function saveEditedCharacter() {
    console.log('saveEditedCharacter called');
    console.log('window.editingCharacter:', window.editingCharacter);
    
    if (!window.editingCharacter) {
        console.error('No character being edited');
        alert('ไม่พบข้อมูลตัวละครที่กำลังแก้ไข');
        return;
    }
    
    // Get form data - support 14 fields format
    // Character Type
    const charType = document.getElementById('charType')?.value || 'human';
    const species = document.getElementById('charSpecies')?.value.trim() || '';
    
    // Section 1: ชื่อ / บทบาท
    const name = document.getElementById('charName')?.value.trim() || '';
    const nickname = document.getElementById('charNickname')?.value.trim() || '';
    const role = document.getElementById('charRole')?.value.trim() || '';
    
    // Section 2: เพศ / อายุ / เชื้อชาติ
    const gender = document.getElementById('charGender')?.value.trim() || '';
    const age = document.getElementById('charAge')?.value.trim() || '';
    const ethnicity = document.getElementById('charEthnicity')?.value.trim() || '';
    
    // Section 3: รูปร่าง / ผิว
    const body = document.getElementById('charBody')?.value.trim() || '';
    const heightWeight = document.getElementById('charHeightWeight')?.value.trim() || '';
    const skin = document.getElementById('charSkin')?.value.trim() || '';
    
    // Section 4: ใบหน้า
    const faceShape = document.getElementById('charFaceShape')?.value.trim() || '';
    const faceFeatures = document.getElementById('charFaceFeatures')?.value.trim() || '';
    
    // Section 5: ดวงตา / คิ้ว
    const eyes = document.getElementById('charEyes')?.value.trim() || '';
    const eyebrows = document.getElementById('charEyebrows')?.value.trim() || '';
    
    // Section 6: ริมฝีปาก
    const lips = document.getElementById('charLips')?.value.trim() || '';
    
    // Section 7: ผม
    const hairStyle = document.getElementById('charHairStyle')?.value.trim() || '';
    const hairColor = document.getElementById('charHairColor')?.value.trim() || '';
    const hairDetails = document.getElementById('charHairDetails')?.value.trim() || '';
    
    // Section 8: เครื่องแต่งกาย
    const shirt = document.getElementById('charShirt')?.value.trim() || '';
    const bottoms = document.getElementById('charBottoms')?.value.trim() || '';
    const outerwear = document.getElementById('charOuterwear')?.value.trim() || '';
    const shoes = document.getElementById('charShoes')?.value.trim() || '';
    const fabric = document.getElementById('charFabric')?.value.trim() || '';
    
    // Section 9: เครื่องประดับ
    const headAccessories = document.getElementById('charHeadAccessories')?.value.trim() || '';
    const jewelry = document.getElementById('charJewelry')?.value.trim() || '';
    const otherAccessories = document.getElementById('charOtherAccessories')?.value.trim() || '';
    
    // Section 10: บุคลิกภาพ
    const personalityTraits = document.getElementById('charPersonalityTraits')?.value.trim() || '';
    const confidence = document.getElementById('charConfidence')?.value.trim() || '';
    const cameraPresence = document.getElementById('charCameraPresence')?.value.trim() || '';
    
    // Section 11: ท่าทางเริ่มต้น
    const initialPose = document.getElementById('charInitialPose')?.value.trim() || '';
    const bodyLanguage = document.getElementById('charBodyLanguage')?.value.trim() || '';
    
    // Section 12: โทนเสียง
    const voicePitch = document.getElementById('charVoicePitch')?.value.trim() || '';
    const speakingStyle = document.getElementById('charSpeakingStyle')?.value.trim() || '';
    const accent = document.getElementById('charAccent')?.value.trim() || '';
    const voiceCharacteristics = document.getElementById('charVoiceCharacteristics')?.value.trim() || '';
    
    // Section 13: ลักษณะพิเศษ
    const uniqueTraits = document.getElementById('charUniqueTraits')?.value.trim() || '';
    const specialEffects = document.getElementById('charSpecialEffects')?.value.trim() || '';
    
    // Section 14: ภาพความสมจริง
    const realismType = document.getElementById('charRealismType')?.value.trim() || '';
    
    // Create updated profile using the 14-field format
    let updatedProfile = '📋 CHARACTER IDENTITY TEMPLATE (Prompt D)\n\n';
    
    // 1. ชื่อ / บทบาท
    if (name || nickname || role) {
        updatedProfile += '👤 **1. ชื่อ / บทบาท (Name / Role)**\n';
        if (name) updatedProfile += `- ชื่อ: ${name}\n`;
        if (nickname) updatedProfile += `- ชื่อเรียก: ${nickname}\n`;
        if (role) updatedProfile += `- บทบาท: ${role}\n`;
        updatedProfile += '\n';
    }
    
    // 2. เพศ / อายุ / เชื้อชาติ or Type / Species
    if (charType === 'human') {
        if (gender || age || ethnicity) {
            updatedProfile += '🧑‍🎨 **2. เพศ / อายุ / เชื้อชาติ (Gender / Age / Ethnicity)**\n';
            if (gender) updatedProfile += `- เพศ: ${gender}\n`;
            if (age) updatedProfile += `- อายุ: ${age}\n`;
            if (ethnicity) updatedProfile += `- เชื้อชาติ: ${ethnicity}\n`;
            updatedProfile += '\n';
        }
    } else {
        // For non-human characters
        let characterTypeText = '';
        if (charType === 'animal') {
            characterTypeText = `สัตว์ประเภท ${species || 'ไม่ระบุ'}`;
        } else if (charType === 'cartoon') {
            characterTypeText = `ตัวการ์ตูน/แฟนตาซี ${species || ''}`;
        } else if (charType === 'robot') {
            characterTypeText = `หุ่นยนต์/AI ${species || ''}`;
        } else if (charType === 'creature') {
            characterTypeText = `สิ่งมีชีวิต ${species || ''}`;
        }
        
        updatedProfile += '🧑‍🎨 **2. ประเภท / เพศ / อายุ (Type / Gender / Age)**\n';
        updatedProfile += `- ประเภท: ${characterTypeText}\n`;
        if (species) updatedProfile += `- ชนิด/พันธุ์: ${species}\n`;
        if (gender) updatedProfile += `- เพศ: ${gender}\n`;
        if (age) updatedProfile += `- อายุ: ${age}\n`;
        updatedProfile += '\n';
    }
    
    // 3. รูปร่าง / ผิว
    if (body || heightWeight || skin) {
        updatedProfile += '💃 **3. รูปร่าง / ผิว (Body / Skin)**\n';
        if (body) updatedProfile += `- รูปร่าง: ${body}\n`;
        if (heightWeight) updatedProfile += `- ส่วนสูง & น้ำหนัก: ${heightWeight}\n`;
        if (skin) updatedProfile += `- สีผิว: ${skin}\n`;
        updatedProfile += '\n';
    }
    
    // 4. ใบหน้า
    if (faceShape || faceFeatures) {
        updatedProfile += '👤 **4. ใบหน้า (Face)**\n';
        if (faceShape) updatedProfile += `- รูปหน้า: ${faceShape}\n`;
        if (faceFeatures) updatedProfile += `- ลักษณะหน้า: ${faceFeatures}\n`;
        updatedProfile += '\n';
    }
    
    // 5. ดวงตา / คิ้ว
    if (eyes || eyebrows) {
        updatedProfile += '👁️ **5. ดวงตา / คิ้ว (Eyes / Eyebrows)**\n';
        if (eyes) updatedProfile += `- ดวงตา: ${eyes}\n`;
        if (eyebrows) updatedProfile += `- คิ้ว: ${eyebrows}\n`;
        updatedProfile += '\n';
    }
    
    // 6. ริมฝีปาก
    if (lips) {
        updatedProfile += '👄 **6. ริมฝีปาก (Lips)**\n';
        updatedProfile += `- ริมฝีปาก: ${lips}\n`;
        updatedProfile += '\n';
    }
    
    // 7. ผม
    if (hairStyle || hairColor || hairDetails) {
        updatedProfile += '💇‍♀️ **7. ผม (Hair)**\n';
        if (hairStyle) updatedProfile += `- ทรงผม: ${hairStyle}\n`;
        if (hairColor) updatedProfile += `- สีผม: ${hairColor}\n`;
        if (hairDetails) updatedProfile += `- รายละเอียดผม: ${hairDetails}\n`;
        updatedProfile += '\n';
    }
    
    // 8. เครื่องแต่งกาย
    if (shirt || bottoms || outerwear || shoes || fabric) {
        updatedProfile += '👗 **8. เครื่องแต่งกาย (Outfit)**\n';
        if (shirt) updatedProfile += `- เสื้อ: ${shirt}\n`;
        if (bottoms) updatedProfile += `- กางเกง/กระโปรง: ${bottoms}\n`;
        if (outerwear) updatedProfile += `- เสื้อคลุม: ${outerwear}\n`;
        if (shoes) updatedProfile += `- รองเท้า: ${shoes}\n`;
        if (fabric) updatedProfile += `- วัสดุ/ผ้า: ${fabric}\n`;
        updatedProfile += '\n';
    }
    
    // 9. เครื่องประดับ
    if (headAccessories || jewelry || otherAccessories) {
        updatedProfile += '💎 **9. เครื่องประดับ (Accessories)**\n';
        if (headAccessories) updatedProfile += `- ที่ศีรษะ: ${headAccessories}\n`;
        if (jewelry) updatedProfile += `- เครื่องประดับ: ${jewelry}\n`;
        if (otherAccessories) updatedProfile += `- อื่นๆ: ${otherAccessories}\n`;
        updatedProfile += '\n';
    }
    
    // 10. บุคลิกภาพ
    if (personalityTraits || confidence || cameraPresence) {
        updatedProfile += '🎭 **10. บุคลิกภาพ (Personality)**\n';
        if (personalityTraits) updatedProfile += `- ลักษณะนิสัย: ${personalityTraits}\n`;
        if (confidence) updatedProfile += `- ระดับความมั่นใจ: ${confidence}\n`;
        if (cameraPresence) updatedProfile += `- ท่าทีต่อกล้อง: ${cameraPresence}\n`;
        updatedProfile += '\n';
    }
    
    // 11. ท่าทางเริ่มต้น
    if (initialPose || bodyLanguage) {
        updatedProfile += '🕴️ **11. ท่าทางเริ่มต้น (Starting Pose)**\n';
        if (initialPose) updatedProfile += `- ท่าทางเริ่มต้น: ${initialPose}\n`;
        if (bodyLanguage) updatedProfile += `- ภาษากาย: ${bodyLanguage}\n`;
        updatedProfile += '\n';
    }
    
    // 12. โทนเสียง
    if (voicePitch || speakingStyle || accent || voiceCharacteristics) {
        updatedProfile += '🎙️ **12. โทนเสียง (Voice Tone)**\n';
        if (voicePitch) updatedProfile += `- ระดับเสียง: ${voicePitch}\n`;
        if (speakingStyle) updatedProfile += `- ลักษณะการพูด: ${speakingStyle}\n`;
        if (accent) updatedProfile += `- สำเนียง: ${accent}\n`;
        if (voiceCharacteristics) updatedProfile += `- ลักษณะเสียง: ${voiceCharacteristics}\n`;
        updatedProfile += '\n';
    }
    
    // 13. ลักษณะพิเศษ
    if (uniqueTraits || specialEffects) {
        updatedProfile += '✨ **13. ลักษณะพิเศษ (Special Features)**\n';
        if (uniqueTraits) updatedProfile += `- ลักษณะเฉพาะ: ${uniqueTraits}\n`;
        if (specialEffects) updatedProfile += `- เอฟเฟกต์พิเศษ: ${specialEffects}\n`;
        updatedProfile += '\n';
    }
    
    // 14. ภาพความสมจริง
    if (realismType) {
        updatedProfile += '🖼️ **14. ภาพความสมจริง (Visual Style)**\n';
        updatedProfile += `- ประเภทความสมจริง: ${realismType}\n`;
    }
    
    // Log the profile
    console.log('Updated profile:', updatedProfile);
    console.log('Profile length:', updatedProfile.length);
    
    // Make sure we have some content
    if (!updatedProfile || updatedProfile.trim() === '📋 CHARACTER IDENTITY TEMPLATE\n\n') {
        alert('กรุณากรอกข้อมูลตัวละครอย่างน้อย 1 ช่อง');
        return;
    }
    
    // บันทึกข้อมูลโดยตรงที่นี่เลย
    console.log('Saving character directly...');
    
    ensureUserId();
    const characterId = window.editingCharacter.id;
    const characterName = window.editingCharacter.name;
    
    fetch(`${API_URL}/characters/${characterId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId
        },
        body: JSON.stringify({
            name: characterName,
            profile: updatedProfile,
            preview: updatedProfile.substring(0, 500)
        })
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (response.ok) {
            // ปิด modal
            closeCharacterTemplate();
            
            // Clear data
            window.editingCharacter = null;
            window.tempUpdatedProfile = null;
            
            // โหลด library ใหม่
            loadCharacterLibrary();
            
            // แสดงข้อความสำเร็จ
            showNotification('✅ แก้ไขตัวละครเรียบร้อยแล้ว');
        } else {
            return response.text().then(text => {
                throw new Error(`Failed: ${response.status} - ${text}`);
            });
        }
    })
    .catch(error => {
        console.error('Error saving:', error);
        alert('ไม่สามารถบันทึกได้: ' + error.message);
    });
}

// Cancel edit character
function cancelEditCharacter() {
    // Close modal
    closeCharacterTemplate();
    
    // Clear editing data
    window.editingCharacter = null;
    
    // Restore original button
    const modal = document.getElementById('characterTemplateModal');
    const actionsDiv = modal.querySelector('.template-actions');
    if (actionsDiv) {
        actionsDiv.innerHTML = `
            <button class="generate-from-template-btn" onclick="generateFromCharacterTemplate()">
                ✨ สร้าง Character Profile
            </button>
        `;
    }
}

// Update character  
async function updateCharacter() {
    console.log('=== updateCharacter called ===');
    console.log('window.editingCharacter:', window.editingCharacter);
    console.log('window.tempUpdatedProfile:', window.tempUpdatedProfile?.substring(0, 100) + '...');
    
    if (!window.editingCharacter) {
        console.error('No editing character in updateCharacter');
        alert('ไม่พบข้อมูลตัวละครที่กำลังแก้ไข');
        return;
    }
    
    // Use the profile from saveEditedCharacter if available
    const updatedProfile = window.tempUpdatedProfile || '';
    
    if (!updatedProfile) {
        alert('กรุณากรอกข้อมูลตัวละคร');
        return;
    }
    
    // Direct update without name dialog
    try {
        ensureUserId();
        console.log('Updating character ID:', window.editingCharacter.id);
        console.log('User ID:', userId);
        console.log('Character name:', window.editingCharacter.name);
        
        const requestBody = {
            name: window.editingCharacter.name, // Keep existing name
            profile: updatedProfile,
            preview: updatedProfile.substring(0, 500)
        };
        console.log('Request body:', requestBody);
        console.log('Fetch URL:', `${API_URL}/characters/${window.editingCharacter.id}`);
        
        const response = await fetch(`${API_URL}/characters/${window.editingCharacter.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (response.ok) {
            // Close modal
            closeCharacterTemplate();
            
            // Clear editing data
            window.editingCharacter = null;
            window.tempUpdatedProfile = null;
            
            // Reload library
            loadCharacterLibrary();
            
            // Show success message
            showNotification('✅ แก้ไขตัวละครเรียบร้อยแล้ว');
        } else {
            throw new Error('Failed to update character');
        }
    } catch (error) {
        console.error('Error updating character:', error);
        alert('เกิดข้อผิดพลาดในการแก้ไขตัวละคร');
    }
}

// Confirm update character
async function confirmUpdateCharacter(updatedProfile) {
    const newName = document.getElementById('editCharacterName').value.trim();
    if (!newName) {
        alert('กรุณาใส่ชื่อตัวละคร');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/characters/${window.editingCharacter.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: newName,
                profile: updatedProfile,
                preview: updatedProfile.substring(0, 500)
            })
        });
        
        if (response.ok) {
            // Close modals
            document.querySelector('.modal').remove();
            closeCharacterTemplate();
            
            // Reload library
            loadCharacterLibrary();
            
            // Show success message
            showNotification('✅ แก้ไขตัวละครเรียบร้อยแล้ว');
        } else {
            throw new Error('Failed to update character');
        }
    } catch (error) {
        console.error('Error updating character:', error);
        alert('เกิดข้อผิดพลาดในการแก้ไขตัวละคร');
    }
    
    // Clear editing data
    window.editingCharacter = null;
}

// ========== API STATUS CHECK ==========
async function checkAPIStatus() {
    try {
        const response = await fetch(`${API_URL.replace('/api', '')}/test`);
        const data = await response.json();
        
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const apiStatus = document.getElementById('apiStatus');
        
        if (data.hasAssistantId && data.hasDatabase) {
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
        
        // Sync credits to cloud if logged in
        syncCreditsToCloud();
        
        if (data.today) {
            // คำนวณเครดิตฟรีที่เหลือ
            const used = parseFloat(data.today.used) || 0;
            const limit = parseFloat(data.today.limit) || 5;
            const remaining = Math.max(0, limit - used); // เครดิตฟรีที่เหลือ (ไม่ติดลบ)
            
            // คำนวณ percentage (100% = เหลือเต็ม, 0% = หมด)
            const percentage = (remaining / limit) * 100;
            
            // อัพเดท progress bar
            const progressBar = document.getElementById('usageProgress');
            progressBar.style.width = percentage + '%';
            
            // อัพเดทข้อความ
            document.getElementById('usageText').textContent = `💰${remaining.toFixed(2)}/${limit}`;
            
            // เปลี่ยนสี progress bar ตามเครดิตที่เหลือ
            if (percentage <= 0) {
                // หมดแล้ว - สีแดง
                progressBar.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
            } else if (percentage <= 20) {
                // เหลือน้อย - สีส้ม
                progressBar.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
            } else {
                // เหลือเยอะ - สีเขียว
                progressBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
            }
            
            // แสดง tooltip เมื่อ hover (ถ้าต้องการ)
            const usageBar = document.querySelector('.usage-bar');
            if (usageBar) {
                usageBar.title = `เครดิตฟรีคงเหลือ: ${remaining.toFixed(2)} บาท จาก ${limit} บาท`;
            }
            
            // อัพเดทยอดเครดิตคงเหลือในมือถือ - ใช้ userCredits เหมือนในคอม
            loadUserCredits(); // โหลดเครดิตล่าสุดเพื่อให้แน่ใจว่าข้อมูลถูกต้อง
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
window.sendMessage = async function() {
    if (isProcessing) return;
    
    const input = document.getElementById('messageInput');
    let message = input.value.trim();
    
    if (!message && window.imageUrls.length === 0) {
        return;
    }
    
    if (!message && window.imageUrls.length > 0) {
    if (currentMode === 'character') {
        message = `วิเคราะห์รูปภาพนี้และสร้าง Character Profile แบบละเอียดครบทั้ง 14 หัวข้อ:

📋 **CHARACTER IDENTITY TEMPLATE (Prompt D)**

👤 **1. ชื่อ / บทบาท (Name / Role)**
- ชื่อ: (ถ้าทราบ)
- ชื่อเรียก: ใช้สรรพนามทั่วไป เช่น "เด็กผู้ชาย", "เด็กผู้หญิง", "คุณผู้ชาย", "คุณผู้หญิง", "วัยรุ่นชาย", "วัยรุ่นหญิง" ตามอายุที่ประเมิน
- บทบาท: ประเมินอาชีพ/บทบาทจากการแต่งตัวและบุคลิก

🧑‍🎨 **2. เพศ / อายุ / เชื้อชาติ (Gender / Age / Ethnicity)**
- เพศ: ระบุเพศ
- อายุ: ประมาณอายุให้เป็นช่วง (เช่น 25-30 ปี)
- เชื้อชาติ: วิเคราะห์เชื้อชาติ/ภูมิหลัง

💃 **3. รูปร่าง / ผิว (Body / Skin)**
- รูปร่าง: บรรยายรูปร่างโดยรวม
- ส่วนสูง & น้ำหนัก: ประมาณการจากรูป
- สีผิว: ลักษณะและสีผิว

👤 **4. ใบหน้า (Face)**
- รูปหน้า: บรรยายรูปทรงใบหน้า
- ลักษณะหน้า: โครงหน้า จุดเด่น

👁️ **5. ดวงตา / คิ้ว (Eyes / Eyebrows)**
- ดวงตา: รูปร่าง สี ลักษณะพิเศษ
- คิ้ว: ทรงคิ้ว ความหนา

👄 **6. ริมฝีปาก (Lips)**
- ริมฝีปาก: สี รูปทรง ลักษณะพิเศษ

💇‍♀️ **7. ผม (Hair)**
- ทรงผม: บรรยายทรงผม
- สีผม: สีธรรมชาติหรือย้อม
- รายละเอียดผม: ความยาว ลักษณะเส้นผม

👗 **8. เครื่องแต่งกาย (Outfit)**
- เสื้อ: บรรยายแบบ สี
- กางเกง/กระโปรง: บรรยายแบบ สี
- เสื้อคลุม: (ถ้ามี)
- รองเท้า: (ถ้าเห็นในรูป)
- วัสดุ/ผ้า: ประเภทผ้าหรือวัสดุ

💎 **9. เครื่องประดับ (Accessories)**
- ที่ศีรษะ: หมวก ที่คาดผม
- เครื่องประดับ: สร้อย ต่างหู
- อื่นๆ: แว่น นาฬิกา เข็มขัด

🎭 **10. บุคลิกภาพ (Personality)**
- ลักษณะนิสัย: ประเมินจากท่าทาง
- ระดับความมั่นใจ: วิเคราะห์จากภาษากาย
- ท่าทีต่อกล้อง: สบายหรือเขิน

🕴️ **11. ท่าทางเริ่มต้น (Starting Pose)**
- ท่าทางเริ่มต้น: ท่าทางในรูป
- ภาษากาย: การวางมือ ท่ายืน

🎙️ **12. โทนเสียง (Voice Tone)**
- ระดับเสียง: คาดเดาจากบุคลิก
- ลักษณะการพูด: วิธีการพูดที่น่าจะเป็น
- สำเนียง: ประมาณการ
- ลักษณะเสียง: นุ่มนวล ทุ้ม ใส

✨ **13. ลักษณะพิเศษ (Special Features)**
- ลักษณะเฉพาะ: ไฝ รอยสัก ลักยิ้ม
- เอฟเฟกต์พิเศษ: (ถ้าต้องการเพิ่ม)

🖼️ **14. ภาพความสมจริง (Visual Style)**
- ประเภทความสมจริง: Photorealistic Human / 3D Anime Style / Semi-Real
- บทบาทที่เหมาะในเรื่องราว

⚠️ สำคัญ: ต้องกรอกข้อมูลให้ครบทุกหัวข้อ ไม่เว้นว่าง ถ้าไม่แน่ใจให้ประเมินจากภาพที่เห็น`;
    } else {
        message = "ช่วยสร้าง prompt จากรูปนี้";
    }
}
    
    isProcessing = true;
    input.disabled = true;
    document.getElementById('sendButton').disabled = true;
    
    // Clean timestamp patterns from message before displaying
    let cleanedMessage = message.replace(/\d{2}:\d{2} • \d{1,2} .+? \d{4}/g, '').trim();
    
    let displayMessage = cleanedMessage;
    if (window.imageUrls.length > 0) {
        displayMessage += ` <span style="color: #a1a1aa;">(พร้อมรูป ${window.imageUrls.length} รูป)</span>`;
    }
    addMessage(displayMessage, 'user');
    
    input.value = '';
    
    const loadingId = addLoadingMessage();

    
    try {
        // Map promptmaster to multichar for backend
        const apiMode = currentMode === 'promptmaster' ? 'multichar' : currentMode;
        
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                userId,
                images: window.imageUrls,
                mode: apiMode
            })
        });
        
        const data = await response.json();
        
        removeMessage(loadingId);
        
        if (response.ok) {
            if (currentMode === 'imagegen') {
        // ส่งไปสร้างภาพแทน
        removeMessage(loadingId);
        generateImage(message);
        // Reset processing state for imagegen
        isProcessing = false;
        input.disabled = false;
        document.getElementById('sendButton').disabled = false;
        return;
    }
    if (currentMode === 'chat') {
        // AI Chat mode
        removeMessage(loadingId);
        sendChatMessage(message);
        // Reset processing state for chat
        isProcessing = false;
        input.disabled = false;
        document.getElementById('sendButton').disabled = false;
        return;
    }
            if (currentMode === 'character') {
                currentCharacterProfile = data.response;
                addMessage(data.response, 'assistant', false, true);
            } else {
                console.log('=== Response from AI ===');
                console.log('Response:', data.response);
                console.log('Original message:', message);
                addMessage(data.response, 'assistant', true);
            }
            
            if (data.usage && data.usage.cost) {
                showUsageInfo(data.usage.cost);
            }
            
            
            updateUsageDisplay();
            // โหลดเครดิตใหม่หลังใช้งาน
loadUserCredits();
            loadTotalPurchasedCredits();
            
            window.imageUrls = [];
            displayImagePreview();
            
        } else if (response.status === 429) {
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
    
    // สร้าง timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    const dateString = now.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    
    messageDiv.id = id;
    messageDiv.className = `message ${type}`;
    
    // เพิ่ม timestamp ในทุกข้อความ
    const timestampHTML = `<div class="message-timestamp">${timeString} • ${dateString}</div>`;
    
    if (type === 'user') {
        // Preserve line breaks in user messages
        const formattedContent = content.replace(/\n/g, '<br>');
        messageDiv.innerHTML = `
            <div class="message-avatar">👤</div>
            <div class="message-content">
                ${formattedContent}
                ${timestampHTML}
            </div>
        `;
    } else if (isCharacterProfile) {
        messageDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                ${formatCharacterProfile(content)}
                ${timestampHTML}
            </div>
        `;
    } else if (isVeoPrompt) {
        messageDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                ${formatVeoPrompt(content)}
                ${timestampHTML}
            </div>
        `;
    } else {
        // Preserve line breaks in assistant messages too
        const formattedContent = content.replace(/\n/g, '<br>');
        messageDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                ${formattedContent}
                ${timestampHTML}
            </div>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Auto-save after adding any message (both user and assistant)
    if (currentMode === 'promptmaster' || currentMode === 'multichar') {
        setTimeout(() => {
            PromptStorage.save('multichar');
        }, 100);
    } else if (currentMode === 'image') {
        setTimeout(() => {
            ImagePromptStorage.save();
        }, 100);
    }
    
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
    
    // Check if this is image mode
    if (currentMode === 'image') {
        return `
        <div>✨ Image Prompt สำเร็จแล้ว!</div>
        <div class="veo3-prompt">
            <div class="prompt-header">🖼️ Image Prompt:</div>
            <div class="prompt-content" id="promptContent-${promptId}">${formattedResponse}</div>
            <div class="prompt-actions">
                <button class="copy-btn" onclick="copyPrompt(this)">📋 Copy Prompt</button>
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" id="favBtn-${promptId}" onclick="toggleFavorite('${promptId}')">
                    ${isFav ? '⭐ Favorited' : '⭐ Add to Favorites'}
                </button>
                <button class="share-btn" onclick="sharePromptById('${promptId}')">
                    📤 Share
                </button>
                <button class="image-gen-internal-btn" onclick="switchToImageGen()">
                    🎨 สร้างภาพในเว็บ
                </button>
                <button class="image-gen-external-btn" onclick="openExternalImageGen()">
                    🌐 สร้างภาพภายนอก
                </button>
            </div>
        </div>
        `;
    }
    
    // Default format for other modes
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
            <button class="json-btn" onclick="requestJSON('${promptId}')">
                📄 JSON
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
    
    // ใช้วิธีที่เข้ากันได้ดีกว่าสำหรับทุก browser
    let fullText = '';
    
    // Clone element เพื่อไม่กระทบ DOM จริง
    const clonedElement = promptElement.cloneNode(true);
    
    // Check if this is image mode prompt
    if (currentMode === 'image' && promptElement.innerHTML.includes('🇺🇸 **English Prompt')) {
        // Extract only English prompt for image mode
        const html = promptElement.innerHTML;
        const text = promptElement.textContent;
        
        // Try to find the English section using different patterns
        const englishStart = text.indexOf('🇺🇸 **English Prompt');
        const thaiStart = text.indexOf('🇹🇭 **พ้อม');
        
        if (englishStart !== -1 && thaiStart !== -1) {
            // Get text between English and Thai sections
            let englishSection = text.substring(englishStart, thaiStart).trim();
            
            // Remove the header and bullet
            englishSection = englishSection
                .replace(/🇺🇸\s*\*\*English Prompt\*[\*•]?\s*/g, '')
                .replace(/^1\.\s*/, '') // Remove numbering if present
                .trim();
            
            // Remove the divider line and any trailing numbers
            englishSection = englishSection
                .replace(/---\s*$/m, '')
                .replace(/---\s*\d+\.?\s*$/m, '')
                .trim();
            
            fullText = englishSection;
        } else {
            // Fallback to original method
            fullText = text;
        }
    } else {
        // Original method for other modes
        const text = promptElement.textContent || promptElement.innerText || '';
        
        // ตรวจสอบว่าเป็น JSON format หรือไม่ (มี ```json)
        if (text.includes('```json') && text.includes('```')) {
            // Extract JSON content
            const jsonStart = text.indexOf('```json');
            const jsonEnd = text.lastIndexOf('```');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                // Get HTML content to preserve formatting
                const htmlContent = promptElement.innerHTML;
                
                // Try to extract formatted JSON from HTML
                const jsonPattern = /```json([\s\S]*?)```/;
                const match = htmlContent.match(jsonPattern);
                
                if (match && match[1]) {
                    // Clean up HTML tags but preserve line breaks
                    let jsonContent = match[1]
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<\/?(div|p|span)[^>]*>/gi, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&quot;/g, '"')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                        .trim();
                    
                    fullText = '```json\n' + jsonContent + '\n```';
                } else {
                    // Fallback: extract from text
                    fullText = text.substring(jsonStart, jsonEnd + 3).trim();
                }
            } else {
                // Fallback ถ้าหา JSON block ไม่เจอ
                fullText = text;
            }
        } else {
            // แปลง br tags เป็น newlines
            const brElements = clonedElement.getElementsByTagName('br');
            for (let i = brElements.length - 1; i >= 0; i--) {
                const br = brElements[i];
                const textNode = document.createTextNode('\n');
                br.parentNode.replaceChild(textNode, br);
            }
            
            // ดึง text content
            fullText = clonedElement.textContent || clonedElement.innerText || '';
            
            // ทำความสะอาด text
            fullText = fullText
                .replace(/•\s/g, '* ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }
    }
    
    let finalPrompt = '';
    
    // If we already have the full text for image mode, use it
    if (currentMode === 'image' && fullText && !fullText.includes('VEO3 MULTI-CHARACTER SCENE')) {
        finalPrompt = fullText;
    } else if (fullText.includes('```json')) {
        // ถ้าเป็น JSON format ให้ใช้ fullText ที่ extract มาแล้ว
        finalPrompt = fullText;
    } else {
    
    // ตรวจสอบว่าเป็น Prompt Master format ใหม่
    if (fullText.includes('VEO3 MULTI-CHARACTER SCENE') || 
        fullText.includes('SETTING & ENVIRONMENT') ||
        fullText.includes('CHARACTER ROSTER')) {
        
        console.log('Detected new Prompt Master format');
        
        // หาจุดเริ่มต้น (emoji 🎬 หรือ VEO3)
        const startIndex = fullText.search(/🎬|VEO3 MULTI-CHARACTER SCENE/);
        
        // หาจุดสิ้นสุด (หลัง VISUAL EFFECTS บรรทัดสุดท้าย)
        const visualEffectsIndex = fullText.lastIndexOf('VISUAL EFFECTS');
        let endIndex = fullText.length;
        
        // ตรวจสอบว่ามี ``` (code block) หรือไม่
        const codeBlockEnd = fullText.lastIndexOf('```');
        if (codeBlockEnd !== -1 && codeBlockEnd > visualEffectsIndex) {
            // ถ้ามี code block ให้ตัดที่ตรงนั้น
            endIndex = codeBlockEnd + 3; // +3 เพื่อรวม ``` ด้วย
        }
        
        if (visualEffectsIndex !== -1) {
            // หาบรรทัดสุดท้ายหลัง VISUAL EFFECTS
            const afterVisualEffects = fullText.substring(visualEffectsIndex);
            const lines = afterVisualEffects.split('\n');
            
            // นับบรรทัดที่มีเนื้อหา (ไม่ใช่บรรทัดว่าง)
            let contentLines = 0;
            let lastContentIndex = 0;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().length > 0) {
                    contentLines++;
                    lastContentIndex = i;
                }
                // ถ้าเจอภาษาไทยหรือสรุป ให้หยุด
                if (lines[i].match(/[\u0E00-\u0E7F]|สรุป|Summary/)) {
                    break;
                }
            }
            
            // ตัดที่บรรทัดที่มีเนื้อหาสุดท้าย
            const cutLines = lines.slice(0, lastContentIndex + 1).join('\n');
            endIndex = visualEffectsIndex + cutLines.length;
        }
        
        if (startIndex !== -1) {
            finalPrompt = fullText.substring(startIndex, endIndex).trim();
        }
        
    } else if (currentMode === 'multichar' || fullText.includes('[Scene Setup]') || fullText.includes('[Settings / Scene]')) {
        // Format เก่า
        const thaiIndex = fullText.search(/[\u0E00-\u0E7F]/);
        const summaryIndex = fullText.search(/(\*\*)?สรุป|Summary|📌|📽️|🎬|⏱️/i);
        
        let cutoffIndex = fullText.length;
        
        if (thaiIndex !== -1) {
            cutoffIndex = Math.min(cutoffIndex, thaiIndex);
        }
        if (summaryIndex !== -1) {
            cutoffIndex = Math.min(cutoffIndex, summaryIndex);
        }
        
        finalPrompt = fullText.substring(0, cutoffIndex).trim();
        
    } else if (fullText.includes('Professional Music Video Prompt') || fullText.includes('[Visual Style]')) {
        // Music Video format
        const visualStyleEnd = fullText.lastIndexOf('[Visual Style]');
        if (visualStyleEnd !== -1) {
            const nextSectionStart = fullText.indexOf('\n\n', visualStyleEnd + 100);
            finalPrompt = fullText.substring(0, nextSectionStart > 0 ? nextSectionStart : fullText.length).trim();
        } else {
            const thaiIndex = fullText.search(/[ก-๙]/);
            finalPrompt = thaiIndex > 0 ? fullText.substring(0, thaiIndex).trim() : fullText;
        }
    } else {
        // General format
        const veoPromptMatch = fullText.match(/Veo 3 Prompt:[\s\S]*?(?=\n{1,2}(?:📽️|🎬|⏱️|📌|\*\*สรุป|สรุป))/);
        if (veoPromptMatch) {
            finalPrompt = veoPromptMatch[0].trim();
        } else {
            const stopPatterns = [/📽️/, /🎬/, /⏱️/, /📌/, /[ก-๙]/];
            let cutoffIndex = fullText.length;
            
            for (const pattern of stopPatterns) {
                const match = fullText.search(pattern);
                if (match !== -1 && match < cutoffIndex) {
                    cutoffIndex = match;
                }
            }
            
            finalPrompt = fullText.substring(0, cutoffIndex).trim();
        }
    }
    }
    
    // สำหรับ Prompt Master - ตัดที่ "All dialogue is AUDIO ONLY" + ```
    if (currentMode === 'promptmaster' || finalPrompt.includes('AUDIO ONLY')) {
        const audioOnlyIndex = finalPrompt.indexOf('All dialogue is AUDIO ONLY');
        if (audioOnlyIndex !== -1) {
            // หา ``` หลังจาก AUDIO ONLY
            const afterAudioOnly = finalPrompt.substring(audioOnlyIndex);
            const codeBlockIndex = afterAudioOnly.indexOf('```');
            
            if (codeBlockIndex !== -1) {
                // ตัดที่ ``` (รวม ``` ด้วย)
                finalPrompt = finalPrompt.substring(0, audioOnlyIndex + codeBlockIndex + 3);
            }
        }
    }
    
    // ลบบรรทัดว่างท้าย
    finalPrompt = finalPrompt.replace(/\n\s*\n\s*$/g, '\n');
    
    if (!finalPrompt || finalPrompt.length === 0) {
        showNotification('❌ ไม่พบข้อความที่จะ copy', 'error');
        return;
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(finalPrompt).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = '✅ Copied!';
        
        showNotification(`📋 Copied prompt (${finalPrompt.length} chars)`, 'success');
        
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
            
            showNotification(`📋 Copied prompt (${finalPrompt.length} chars)`, 'success');
            
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
    
    // เพิ่มการเช็ค mode
    let loadingText;
    switch(currentMode) {
        case 'chat':
            loadingText = 'กำลังคิด...';
            break;
        case 'character':
            loadingText = 'กำลังสร้าง Character Profile แบบละเอียด...';
            break;
        case 'image':
            loadingText = 'กำลังสร้าง Image Prompt ที่ละเอียด...';
            break;
        case 'imagegen':
            loadingText = 'กำลังสร้างภาพตาม prompt ของคุณ...';
            break;
        default:
            loadingText = 'กำลังสร้าง Cinematic Prompt สำหรับ Vdo ขั้นเทพ...';
    }
    
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
    
    // คำนวณเครดิตฟรีที่เหลือ
    const used = parseFloat(cost.today_total);
    const limit = parseFloat(cost.daily_limit);
    const remaining = Math.max(0, limit - used);
    
    infoDiv.innerHTML = `
        💰 ค่าใช้จ่าย: <strong style="color: #9333ea;">฿${cost.this_request}</strong> | 
        เครดิตฟรีคงเหลือ: <strong style="color: ${remaining > 0 ? '#10b981' : '#ef4444'};">฿${remaining.toFixed(2)}/${limit}</strong>
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
    
    // สร้าง structured data จาก characterTemplateData (ถ้ามี)
    let structuredData = null;
    if (characterTemplateData && Object.keys(characterTemplateData).length > 0) {
        structuredData = {
            ...characterTemplateData
        };
    }
    
    // สร้าง preview
    let previewText = profileText;
    if (structuredData && structuredData.nickname) {
        previewText = `${structuredData.nickname} - ${structuredData.gender || 'N/A'}, ${structuredData.age || 'N/A'}`;
        if (structuredData.role) {
            previewText += ` (${structuredData.role})`;
        }
    } else {
        // ใช้ 300 ตัวแรกเป็น preview
        previewText = profileText.substring(0, 300) + '...';
    }
    
    try {
        const response = await fetch(`${API_URL}/characters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                name,
                profile: profileText,
                preview: previewText,
                structuredData: structuredData // เพิ่มข้อมูลจากฟอร์ม
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
            characterTemplateData = {}; // Clear template data
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
    
    // เลือก voice status ตาม mode
    let voiceStatus;
    
    if (currentMode === 'chat') {
        // Chat mode ใช้ voiceStatusChat (ถ้ามี) หรือไม่แสดง
        voiceStatus = document.getElementById('voiceStatusChat');
    } else if (currentMode === 'image') {
        // Image mode ใช้ voiceStatusImage
        voiceStatus = document.getElementById('voiceStatusImage');
    } else {
        // โหมดอื่นๆ (general, character, multichar) ใช้ voiceStatus ทั่วไป
        voiceStatus = document.getElementById('voiceStatus');
    }
    
    if (!voiceStatus) return;
    
    if (listening) {
        voiceButton.classList.add('listening');
        voiceButton.innerHTML = '🔴 กำลังฟัง...';
        voiceButton.disabled = true;
        voiceStatus.style.display = 'flex';
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

// Function to switch to Image Gen mode
function switchToImageGen() {
    switchMode('imagegen');
}

// Function to open external image generation
function openExternalImageGen() {
    window.open('https://aistudio.google.com/app/prompts/new_image', '_blank');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Slip upload handler
    const slipInput = document.getElementById('slipFileInput');
    if (slipInput) {
        slipInput.addEventListener('change', handleSlipSelect);
    }
    
    // Store PromptPay ID globally
    window.PROMPTPAY_ID = '090-246-2826'; // เปลี่ยนเป็นเบอร์คุณ
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
        
        // Debug response
        console.log('API Response:', {
            ok: response.ok,
            status: response.status,
            data: data
        });
        
        // Remove loading
        removeMessage(loadingId);
        loadingDiv.remove();
        
        if (response.ok && data.imageUrl) {
    // Debug
    console.log('Full response:', data);
    console.log('Image URL type:', typeof data.imageUrl);
    console.log('Image URL value:', data.imageUrl);
    
    // ถ้า imageUrl เป็น array ให้เอาตัวแรก
    let imageUrl = data.imageUrl;
    if (Array.isArray(imageUrl)) {
        console.log('imageUrl is array, taking first element');
        imageUrl = imageUrl[0];
    }
    
    // Ensure it's a string
    if (typeof imageUrl !== 'string') {
        console.error('imageUrl is not a string after processing:', typeof imageUrl, imageUrl);
    }
    
    // แสดงภาพที่สร้างได้
    displayGeneratedImage(imageUrl, prompt, model, data.cost);
            
            // Update usage และ credits
            updateUsageDisplay();
            loadUserCredits();
            loadTotalPurchasedCredits();
            
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
    } finally {
        // Reset processing state
        isProcessing = false;
        const input = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        if (input) input.disabled = false;
        if (sendButton) sendButton.disabled = false;
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
    
    // Ensure imageUrl is a string
    if (typeof imageUrl !== 'string') {
        console.error('Invalid imageUrl type:', typeof imageUrl, imageUrl);
        imageUrl = String(imageUrl);
    }
    
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
                <button class="download-btn" onclick="downloadImage('${imageUrl.replace(/'/g, "\\'")}', '${prompt.substring(0, 50).replace(/'/g, "\\'")}')">
    💾 Download
</button>
                <button class="retry-btn" onclick="retryGeneration('${escapedPrompt}')">
                    🔄 สร้างใหม่
                </button>
            </div>
            
            <div style="margin-top: 12px; font-size: 14px; color: var(--text-secondary);">
                📊 Model: ${getModelDisplayName(model)} | 💰 ใช้เครดิต: ${cost}
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); word-break: break-all;">
                🔗 URL: ${imageUrl}
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
    // แสดง popup ยืนยัน
    const modal = document.createElement('div');
    modal.className = 'confirmation-modal';
    modal.innerHTML = `
        <div class="confirmation-content">
            <h3>⚠️ ยืนยันการสร้างภาพใหม่</h3>
            <p>คุณต้องการสร้างภาพใหม่หรือไม่?</p>
            <p style="color: #f59e0b; font-size: 14px;">
                ⚡ จะใช้เครดิต ${getSelectedImageModel() === 'flux-schnell' ? '0.15' : '0.20'} เครดิต
            </p>
            <div class="confirmation-buttons">
                <button onclick="confirmRetry('${encodeURIComponent(prompt)}')" class="confirm-btn">
                    ✅ ยืนยัน
                </button>
                <button onclick="closeConfirmation()" class="cancel-btn">
                    ❌ ยกเลิก
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function confirmRetry(encodedPrompt) {
    closeConfirmation();
    const prompt = decodeURIComponent(encodedPrompt);
    document.getElementById('messageInput').value = prompt;
    sendMessage();
}

function closeConfirmation() {
    const modal = document.querySelector('.confirmation-modal');
    if (modal) modal.remove();
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

// ========== AI CHAT FUNCTIONS ==========
async function sendChatMessage(message) {
    const model = getSelectedChatModel();
    
    // ถ้ามีรูปแต่ไม่มีข้อความ
    if (!message && window.imageUrls.length > 0) {
        message = "วิเคราะห์รูปนี้ให้หน่อย";
    }
    
    // แสดง loading พร้อมบอกว่ากำลังทำอะไร
    let loadingText = '💭 กำลังคิด...';
    if (window.imageUrls.length > 0) {
        loadingText = '🖼️ กำลังวิเคราะห์รูป...';
    }
    const loadingId = addMessage(loadingText, 'assistant');
    
    try {
        const response = await fetch(`${API_URL}/ai-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                userId: userId,
                model: model,
                images: window.imageUrls, // ส่งรูปไปด้วย
                history: getChatModeHistory()
            })
        });
        
        const data = await response.json();
        
        // Remove loading
        removeMessage(loadingId);
        
        if (response.ok && data.success) {
            // แสดงข้อความตอบกลับ
            displayChatResponse(data.response, data.model, data.cost);
            
            // Update usage และ credits
            updateUsageDisplay();
            loadUserCredits();
            loadTotalPurchasedCredits();
            
            // Clear images
            window.imageUrls = [];
            displayImagePreview();
            
        } else if (response.status === 429) {
            // เครดิตไม่พอ
            if (data.error === 'Insufficient credits') {
                showCreditRequiredMessage(data);
            } else {
                addMessage(`❌ ${data.message || 'Daily limit exceeded'}`, 'assistant');
            }
        } else {
            // Error อื่นๆ - แสดง userMessage ถ้ามี
            const errorMsg = data.userMessage || `❌ เกิดข้อผิดพลาด: ${data.error || 'Failed to send message'}`;
            addMessage(errorMsg, 'assistant');
        }
        
    } catch (error) {
        removeMessage(loadingId);
        console.error('Chat error:', error);
        addMessage('❌ ไม่สามารถเชื่อมต่อกับ server ได้', 'assistant');
    } finally {
        // Reset processing state
        isProcessing = false;
        const input = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        if (input) input.disabled = false;
        if (sendButton) sendButton.disabled = false;
    }
}

// Get selected chat model
function getSelectedChatModel() {
    const selected = document.querySelector('input[name="chatModel"]:checked');
    return selected ? selected.value : 'gpt-3.5-turbo';
}

// Get chat history for current conversation
function getChatModeHistory() {
    const messages = [];
    const chatElements = document.querySelectorAll('#chatMessages .message');
    
    // เก็บแค่ 10 ข้อความล่าสุด (5 คู่)
    const recentMessages = Array.from(chatElements).slice(-10);
    
    recentMessages.forEach(elem => {
        const isUser = elem.classList.contains('user');
        const content = elem.querySelector('.message-content').textContent;
        
        // ไม่เอา welcome message และ error messages
        if (!content.includes('สวัสดีครับ') && !content.includes('❌')) {
            messages.push({
                role: isUser ? 'user' : 'assistant',
                content: content
            });
        }
    });
    
    return messages;
}

// Update chat model and description
function updateChatModel(model) {
    const descriptions = {
        'gpt-3.5-turbo': '<strong>GPT-3.5 Turbo:</strong> เร็ว ประหยัด เหมาะกับงานทั่วไป',
        'gpt-4o-mini': '<strong>GPT-4o Mini:</strong> ฉลาดกว่า คุ้มค่า ตอบได้ละเอียด',
        'gpt-4o': '<strong>GPT-4o:</strong> ฉลาดที่สุด เหมาะกับงานซับซ้อน',
        'gemini-1.5-flash': '<strong>Gemini Flash:</strong> เร็วมาก ราคาถูก by Google',
        'gemini-1.5-pro': '<strong>Gemini Pro:</strong> แม่นยำ เหมาะกับงานที่ต้องการความละเอียด'
    };
    
    const descElement = document.getElementById('modelDescription');
    if (descElement && descriptions[model]) {
        descElement.innerHTML = descriptions[model];

        syncChatModelSelection(model);
    }
}

function getSelectedChatModel() {
    // Always return gpt-4o-mini as it's the only model now
    return 'gpt-4o-mini';
}

// Sync desktop และ mobile model selection (no longer needed)
function syncChatModelSelection(model) {
    // Do nothing as we only have one model now
}

// Export function
window.updateChatModel = updateChatModel;

// Display chat response
// Function สำหรับ format markdown เป็น HTML
function formatMarkdown(text) {
    // แปลง markdown เป็น HTML
    return text
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Lists
        .replace(/^\* (.+)$/gim, '<li>$1</li>')
        .replace(/^- (.+)$/gim, '<li>$1</li>')
        // Wrap lists
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        // Wrap in paragraphs
        .replace(/^(.+)$/gm, '<p>$1</p>')
        // Clean up
        .replace(/<p><h/g, '<h')
        .replace(/<\/h(\d)><\/p>/g, '</h$1>')
        .replace(/<p><ul>/g, '<ul>')
        .replace(/<\/ul><\/p>/g, '</ul>');
}

function displayChatResponse(response, model, cost) {
    const messageId = `chat-${Date.now()}`;
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    // จัดการ cost ที่อาจเป็น object หรือ number
    let costDisplay = '';
    if (cost && typeof cost === 'object') {
        {
            costDisplay = `${cost.this_request || '0.000'} เครดิต`;
        }
    } else if (typeof cost === 'number') {
        costDisplay = `${cost.toFixed(3)} เครดิต`;
    } else {
        costDisplay = '0.000 เครดิต';
    }
    
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div>${formatMarkdown(response)}</div>
            
            <!-- แสดงข้อมูลเล็กๆ ด้านล่าง -->
            <div class="chat-model-info">
                <span style="font-size: 11px; color: #64748b;">
                    ${getModelDisplayName(model)}
                </span>
                <span style="font-size: 11px; color: #64748b;">
                    ${costDisplay}
                </span>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Display chat response from history (with saved model data)
function displayChatResponseFromHistory(content, modelData) {
    const messageId = `chat-history-${Date.now()}`;
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    // จัดการ cost สำหรับ history
    let costDisplay = '0.000 เครดิต';
    if (modelData.cost) {
        if (typeof modelData.cost === 'number') {
            costDisplay = `${modelData.cost.toFixed(3)} เครดิต`;
        } else if (modelData.cost === 0) {
            costDisplay = '🆓 ฟรี';
        }
    }
    
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div>${formatMarkdown(content)}</div>
            
            <!-- แสดงข้อมูลเล็กๆ ด้านล่าง -->
            <div class="chat-model-info">
                <span style="font-size: 11px; color: #64748b;">
                    ${modelData.model}
                </span>
                <span style="font-size: 11px; color: #64748b;">
                    ${costDisplay}
                </span>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
}

// Get model display name
function getModelDisplayName(modelId) {
    const modelNames = {
        'gpt-3.5-turbo': 'GPT-3.5 Turbo',
        'gpt-4o-mini': 'GPT-4o Mini',
        'gpt-4o': 'GPT-4o',
        'gemini-1.5-flash': 'Gemini Flash',
        'gemini-1.5-pro': 'Gemini Pro'
    };
    return modelNames[modelId] || modelId;
}

// ========== SLIP UPLOAD FUNCTIONS ==========

let selectedSlipFile = null;
let selectedPackageData = null;

// Handle slip file selection
function handleSlipSelect(event) {
    console.log('handleSlipSelect called', event);
    const file = event.target.files[0];
    console.log('Selected file:', file);
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        showNotification('❌ กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
        return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('❌ ไฟล์ใหญ่เกิน 5MB', 'error');
        return;
    }
    
    selectedSlipFile = file;
    
    // Preview image
    const reader = new FileReader();
    reader.onerror = function(error) {
        console.error('FileReader error:', error);
        showNotification('❌ ไม่สามารถอ่านไฟล์ได้', 'error');
    };
    
    reader.onload = function(e) {
        console.log('FileReader loaded');
        
        // ค้นหา elements ภายใน modal โดยเฉพาะ
        const modal = document.querySelector('.credit-modal');
        console.log('Modal exists:', !!modal);
        
        if (!modal) {
            console.error('Modal disappeared!');
            showNotification('❌ กรุณาเปิดหน้าต่างใหม่', 'error');
            return;
        }
        
        const slipImage = modal.querySelector('#slipImage');
        const slipPreview = modal.querySelector('#slipPreview');
        const uploadArea = modal.querySelector('.upload-area');
        
        console.log('Elements found:', {
            slipImage: !!slipImage,
            slipPreview: !!slipPreview,
            uploadArea: !!uploadArea
        });
        
        if (slipImage) {
            slipImage.src = e.target.result;
            console.log('Image src set');
        }
        
        if (slipPreview) {
            slipPreview.style.display = 'block';
            console.log('Preview display set to block');
            
            // Force reflow
            slipPreview.offsetHeight;
        }
        
        if (uploadArea) {
            uploadArea.style.display = 'none';
            console.log('Upload area hidden');
        }
        
        // เลื่อนให้เห็น preview
        if (slipPreview) {
            slipPreview.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };
    
    console.log('Starting to read file...');
    reader.readAsDataURL(file);
}

// Upload slip function
async function uploadSlip() {
    if (!selectedSlipFile) {
        showNotification('❌ กรุณาเลือกไฟล์สลิป', 'error');
        return;
    }
    
    if (!selectedPackageData) {
        showNotification('💝 กรุณาเลือกจำนวนที่ต้องการสนับสนุน', 'error');
        return;
    }
    
    // Disable button and show loading
    const confirmBtn = document.getElementById('confirmUploadBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.6';
        confirmBtn.style.cursor = 'not-allowed';
        confirmBtn.innerHTML = '⏳ กำลังประมวลผล...';
    }
    
    // Show loading status with animation
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.className = 'upload-status checking';
    statusDiv.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <div class="spinner" style="
                width: 20px;
                height: 20px;
                border: 3px solid rgba(147, 51, 234, 0.3);
                border-top: 3px solid #9333ea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <span>🎆 กำลังตรวจสอบสลิปการโอนเงิน...</span>
        </div>
    `;
    statusDiv.style.display = 'block';
    
    // Add spinning animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Hide preview
    document.getElementById('slipPreview').style.display = 'none';
    
    try {
        // Create FormData
        const formData = new FormData();
        formData.append('slip', selectedSlipFile);
        formData.append('userId', userId);
        formData.append('packageId', selectedPackageData.id);
        formData.append('expectedAmount', selectedPackageData.price);
        
        // Upload to server
        const response = await fetch('/api/verify-slip', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        console.log('Slip verification response:', data);
        
        if (response.ok && data.success && !data.isDuplicate) {
            // Success!
            statusDiv.className = 'upload-status success';
            statusDiv.innerHTML = `
                🎉 ขอบคุณที่สนับสนุนเว็บของเรา!<br>
                💖 การสนับสนุนของคุณมีค่ามาก<br>
                ✨ เครดิตของคุณตอนนี้: ${data.newBalance} เครดิต
            `;
            
            // Update credit display
            userCredits = data.newBalance;
            updateCreditDisplay();
            
            // Close modal after 3 seconds
            setTimeout(() => {
                closeCreditModal();
                showNotification('🎆 ขอบคุณที่สนับสนุนค่ะ!', 'success');
            }, 3000);
            
        } else if (data.isDuplicate) {
            // สลิปซ้ำ
            const duplicateMessage = `
                ⚠️ สลิปนี้ถูกใช้ไปแล้ว<br>
                <small style="color: #a1a1aa;">
                    ใช้เมื่อ: ${new Date(data.verifiedAt).toLocaleString('th-TH')}<br>
                    หมายเลขอ้างอิง: ${data.transactionRef}
                </small>
            `;
            
            statusDiv.className = 'upload-status error';
            statusDiv.innerHTML = duplicateMessage;
            
            showNotification('⚠️ สลิปนี้ถูกใช้ไปแล้ว กรุณาใช้สลิปใหม่', 'error');
            
            // Enable button again
            const confirmBtn = document.getElementById('confirmUploadBtn');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
                confirmBtn.innerHTML = '✨ ยืนยันการสนับสนุน';
            }
            
            // Reset upload area
            setTimeout(() => {
                resetUploadArea();
            }, 5000);
            
        } else {
            // Error - ตรวจสอบประเภทของ error
            let errorMessage = '';
            
            // ตรวจสอบว่าเป็นสลิปซ้ำหรือไม่
            if (data.isDuplicate || data.error?.includes('ถูกใช้แล้ว') || data.error?.includes('duplicate')) {
                errorMessage = '⚠️ สลิปนี้ถูกใช้ไปแล้ว กรุณาใช้สลิปใหม่';
            } else if (data.error?.includes('จำนวนเงินไม่ตรง')) {
                errorMessage = `❌ ${data.error}`;
            } else if (data.error?.includes('ไม่สามารถอ่านข้อมูล')) {
                errorMessage = '❌ ไม่สามารถอ่านข้อมูลจากสลิป กรุณาถ่ายภาพให้ชัดเจน';
            } else if (data.error?.includes('ผู้รับเงินไม่ถูกต้อง')) {
                errorMessage = '❌ หมายเลขผู้รับไม่ถูกต้อง กรุณาตรวจสอบการโอนเงิน';
            } else {
                errorMessage = `❌ ${data.error || 'ไม่สามารถตรวจสอบสลิปได้ กรุณาลองใหม่'}`;
            }
            
            statusDiv.className = 'upload-status error';
            statusDiv.innerHTML = errorMessage;
            
            // แสดง notification ด้วย
            showNotification(errorMessage, 'error');
            
            // Enable button again
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
                confirmBtn.innerHTML = '✨ ยืนยันการสนับสนุน';
            }
            
            // Reset upload area
            setTimeout(() => {
                resetUploadArea();
            }, 5000);
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        statusDiv.className = 'upload-status error';
        
        let errorMessage = '❌ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = '❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต';
        }
        
        statusDiv.innerHTML = errorMessage;
        showNotification(errorMessage, 'error');
        
        // Enable button again
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
            confirmBtn.innerHTML = '✨ ยืนยันการสนับสนุน';
        }
        
        setTimeout(() => {
            resetUploadArea();
        }, 5000);
    }
}

// Reset upload area
function resetUploadArea() {
    document.getElementById('slipPreview').style.display = 'none';
    document.querySelector('.upload-area').style.display = 'block';
    document.getElementById('uploadStatus').style.display = 'none';
    document.getElementById('slipFileInput').value = '';
    selectedSlipFile = null;
}

// Generate QR Code
async function generateQRCode(amount) {
    try {
        const response = await fetch('/api/generate-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                promptpayId: window.PROMPTPAY_ID
            })
        });
        
        const data = await response.json();
        
        if (data.qrCode) {
            const qrSection = document.getElementById('qrSection');
            const qrDisplay = document.getElementById('qrCodeDisplay');
            
            qrDisplay.innerHTML = `<img src="${data.qrCode}" alt="QR Code" style="max-width: 300px;">`;
            qrSection.style.display = 'block';
        }
    } catch (error) {
        console.error('QR Code error:', error);
    }
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
window.uploadSlip = uploadSlip;
window.handleSlipSelect = handleSlipSelect;
window.resetUploadArea = resetUploadArea;
window.generateQRCode = generateQRCode;
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
window.retryGeneration = retryGeneration;
window.confirmRetry = confirmRetry;
window.closeConfirmation = closeConfirmation;
window.displayChatResponseFromHistory = displayChatResponseFromHistory;

// 2. เพิ่มฟังก์ชัน Scene Builder
function showSceneBuilder() {
    const modal = document.createElement('div');
    modal.className = 'scene-modal';
    modal.innerHTML = `
        <div class="scene-modal-content">
            <button class="close-modal" onclick="closeSceneBuilder()">✕</button>
            <h2>🎭 สร้าง Prompt master</h2>
            
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
                        <!-- จะถูกสร้างโดย setCharacterCount -->
                    </div>
                </div>
                
                <!-- ส่วนที่เหลือเหมือนเดิม... -->
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
    
    // เรียก setCharacterCount เพื่อสร้างช่องกรอกเริ่มต้น 2 คน
    setTimeout(() => {
        setCharacterCount(2);
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
    // ใช้ currentTarget แทน event.target เพื่อหลีกเลี่ยงปัญหา
    const clickedBtn = document.querySelector(`.count-btn:nth-child(${count-1})`);
    if (clickedBtn) clickedBtn.classList.add('active');
    
    // Update character inputs
    const container = document.getElementById('characterInputs');
    if (!container) return;
    
    container.innerHTML = '';
    sceneData.characters = new Array(count).fill('');
    
    for (let i = 0; i < count; i++) {
        const charDiv = document.createElement('div');
        charDiv.className = 'char-input-group';
        charDiv.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <label style="flex: 1;">คนที่ ${i+1}:</label>
                <button type="button" class="my-char-btn" 
                        onclick="openCharacterPicker('sceneChar${i}')" 
                        title="เลือกจาก My Characters">
                    📚 My Character
                </button>
            </div>
            <input type="text" 
                   id="sceneChar${i}"
                   placeholder="บอกลักษณะสั้นๆ เช่น อายุ เพศ การแต่งตัว" 
                   class="scene-input"
                   data-index="${i}"
                   onchange="updateCharacter(${i}, this.value)">
        `;
        container.appendChild(charDiv);
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

// ========== IMAGE UPLOAD FUNCTIONS ==========
// Toggle feature flag for image upload
const ENABLE_DIRECT_UPLOAD = false; // เปิด/ปิด feature ได้ที่นี่

// Show/hide upload button based on feature flag
window.addEventListener('DOMContentLoaded', () => {
    if (ENABLE_DIRECT_UPLOAD) {
        const uploadBtn = document.querySelector('.upload-local-btn');
        if (uploadBtn) uploadBtn.style.display = 'inline-flex';
    }
});

// Open file picker
function openImageUpload() {
    document.getElementById('localImageUpload').click();
}

// Handle local image upload
async function handleLocalImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Show loading state
    showNotification('🔄 กำลังอัพโหลดรูป...', 'info');
    
    try {
        for (const file of files) {
            // Validate file
            if (!file.type.startsWith('image/')) {
                showNotification('❌ กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
                continue;
            }
            
            // Check file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                showNotification('❌ ขนาดไฟล์ต้องไม่เกิน 10MB', 'error');
                continue;
            }
            
            // Convert to base64 directly (skip ImgBB)
            const imageUrl = await convertToBase64(file);
            console.log('Base64 length:', imageUrl.length); // Debug
            
            if (imageUrl) {
                // Ensure imageUrls array exists
                if (!window.imageUrls) {
                    window.imageUrls = [];
                }
                
                // Add to image array same as URL method
                window.imageUrls.push(imageUrl);
                console.log('Added base64 image to array'); // Debug
                
                displayImagePreview();
                showNotification('✅ อัพโหลดรูปสำเร็จ!', 'success');
            } else {
                showNotification('❌ ไม่สามารถแปลงรูปได้', 'error');
            }
        }
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('❌ อัพโหลดไม่สำเร็จ ลองใช้ URL แทน', 'error');
    }
    
    // Reset input
    event.target.value = '';
}

// Upload to ImgBB service
async function uploadToImgBB(file) {
    try {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData,
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const data = await response.json();
        console.log('ImgBB Response:', data); // Debug log
        
        if (data.success && data.data) {
            // ตรวจสอบ structure ของ response
            const imageUrl = data.data.display_url || data.data.url || data.data.image?.url;
            console.log('Image URL:', imageUrl); // Debug log
            
            if (imageUrl) {
                return imageUrl;
            } else {
                console.error('No URL found in response:', data);
                throw new Error('No URL in response');
            }
        } else {
            throw new Error(data.error?.message || 'Upload failed');
        }
    } catch (error) {
        console.error('ImgBB upload error:', error);
        // Fallback to base64 if ImgBB fails
        return await convertToBase64(file);
    }
}

// Convert to base64 as fallback
async function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========== JSON REQUEST FUNCTION ==========
async function requestJSON(promptId) {
    // หา prompt element
    const promptElement = document.getElementById(`promptContent-${promptId}`);
    if (!promptElement) return;
    
    // แปลง HTML เป็น text
    const originalPrompt = promptElement.innerHTML
        .replace(/<br><br>/g, '\n\n')
        .replace(/<br>/g, '\n')
        .replace(/• /g, '* ')
        .replace(/<[^>]*>/g, '');
    
    // สร้างข้อความขอ JSON
    const jsonRequest = `ขอแบบ json`;
    
    // ใส่ใน textarea
    const messageInput = document.getElementById('messageInput');
    messageInput.value = jsonRequest;
    
    // Auto resize textarea
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
    
    // แสดง notification
    showNotification('📄 กำลังขอ JSON...', 'info');
    
    // ส่งข้อความอัตโนมัติ
    await sendMessage();
}

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
    
    // ตรวจสอบและดึง Character Identity จาก prompt
    let characterDetails = '';
    
    // พยายามดึงข้อมูลตัวละครจาก prompt เดิม
    const characterMatches = originalPrompt.match(/Character[^:]*:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi);
    if (characterMatches) {
        characterDetails = '\n\n[Character Identity - คงไว้เหมือนเดิม]\n' + characterMatches.join('\n');
    }
    
    // ถ้ามี characterTemplateData จากฟอร์ม ให้ใช้ข้อมูลนั้น
    if (characterTemplateData && Object.keys(characterTemplateData).length > 0) {
        characterDetails = '\n\n[Character Identity from Template]\n';
        
        const data = characterTemplateData;
        if (data.nickname) characterDetails += `Nickname: ${data.nickname}\n`;
        if (data.gender) characterDetails += `Gender: ${data.gender}\n`;
        if (data.age) characterDetails += `Age: ${data.age}\n`;
        if (data.ethnicity) characterDetails += `Ethnicity: ${data.ethnicity}\n`;
        if (data.body) characterDetails += `Body type: ${data.body}\n`;
        if (data.skin) characterDetails += `Skin: ${data.skin}\n`;
        if (data.hair) characterDetails += `Hair: ${data.hair}\n`;
        if (data.face) characterDetails += `Face features: ${data.face}\n`;
        if (data.glasses) characterDetails += `Glasses: ${data.glasses}\n`;
        if (data.shirt) characterDetails += `Shirt: ${data.shirt}\n`;
        if (data.jacket) characterDetails += `Jacket/Suit: ${data.jacket}\n`;
        if (data.pants) characterDetails += `Pants/Skirt: ${data.pants}\n`;
        if (data.shoes) characterDetails += `Shoes: ${data.shoes}\n`;
    }
    
    // สร้างข้อความสำหรับต่อฉาก
    const continuationText = `
[ต่อฉากจาก Scene ก่อนหน้า]
=========================
${originalPrompt}
=========================
${characterDetails}

[Scene ต่อไป - ขอให้คงทุกอย่างไว้เหมือนเดิม ยกเว้น]:
- เปลี่ยนมุมกล้อง: [ระบุมุมใหม่]
- เปลี่ยน action: [ระบุ action ใหม่]
- เพิ่มบทพูด: [ระบุบทพูดใหม่]

⚠️ สำคัญมาก: 
- ต้องใช้ตัวละครเดิม 100% (ทุกรายละเอียดต้องเหมือนเดิม)
- ใช้สถานที่เดิม, แสงเดิม, และ style เดิม
- Character Identity ด้านบนต้องปรากฏในทุกส่วนของ prompt!`;
    
    // ใส่ใน textarea
    const messageInput = document.getElementById('messageInput');
    messageInput.value = continuationText;

    // Auto resize textarea
    autoResize();
    
    // Scroll ไปที่ input
    messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageInput.focus();
    
    // แสดง notification
    showNotification('📋 Scene ต่อพร้อมข้อมูลตัวละคร! กด "สร้าง Prompt ✨"', 'success');
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
            
        case 'promptmaster':
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
        <h4>🖼️ Image Prompt</h4>
        <p>• สร้าง prompt สำหรับรูปภาพโดยเฉพาะ</p>
        <p>• บอกแค่ไอเดีย AI จะสร้าง prompt ที่ละเอียด</p>
        <p>• สามารถสร้างภาพได้ทันที</p>
    `;
    break;
    
        case 'imagegen':
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

            case 'chat':
    infoHTML = quickActionsHTML + `
        <h4>💬 AI Chat Assistant</h4>
        
        <div style="margin: 16px 0; padding: 12px; background: rgba(147, 51, 234, 0.1); border-radius: 8px;">
            <div style="color: #9333ea; font-weight: 600; margin-bottom: 4px;">
                🤖 Model ที่ใช้งาน
            </div>
            <div style="font-size: 14px;">
                <strong>⚡ GPT-4o-mini</strong>
            </div>
        </div>
        
        <div style="margin-top: 16px;">
            <h5 style="color: #9333ea; margin-bottom: 8px;">💡 วิธีใช้:</h5>
            <p style="font-size: 13px;">• พิมพ์หรือพูดถามอะไรก็ได้</p>
            <p style="font-size: 13px;">• แนบรูปเพื่อให้ AI วิเคราะห์</p>
            <p style="font-size: 13px;">• ประวัติการสนทนาจะถูกบันทึก</p>
            <p style="font-size: 13px;">• AI ฉลาดและแม่นยำ!!</p>
        </div>
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

// ========== ENHANCE PROMPT FUNCTION ==========
async function enhancePrompt() {
    const input = document.getElementById('messageInput');
    const enhanceBtn = document.getElementById('enhanceBtn');
    const enhanceStatus = document.getElementById('enhanceStatus');
    const prompt = input.value.trim();
    
    if (!prompt) {
        showNotification('⚠️ กรุณาพิมพ์หรือพูด prompt ก่อน', 'warning');
        return;
    }
    
    // Disable button และแสดง loading
    enhanceBtn.disabled = true;
    enhanceBtn.style.display = 'none';
    enhanceStatus.style.display = 'flex';
    
    try {
        const response = await fetch(`${API_URL}/enhance-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                userId: userId
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.enhancedPrompt) {
            // แทนที่ prompt ด้วยที่ปรับปรุงแล้ว
            input.value = data.enhancedPrompt;
            
            // Auto resize textarea
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
            
            showNotification('✨ ปรับปรุง prompt เรียบร้อย!', 'success');
            
            // Update usage และ credits ถ้ามี
            if (data.usage) {
                updateUsageDisplay();
                loadUserCredits();
            }
            
        } else if (response.status === 429) {
            // เครดิตไม่พอ
            if (data.error === 'Insufficient credits') {
                showCreditRequiredMessage(data);
            } else {
                showNotification('❌ ใช้งานเกินโควต้าประจำวัน', 'error');
            }
        } else {
            showNotification(`❌ ${data.error || 'เกิดข้อผิดพลาด'}`, 'error');
        }
        
    } catch (error) {
        console.error('Enhance error:', error);
        showNotification('❌ ไม่สามารถเชื่อมต่อ server', 'error');
    } finally {
        // Enable button กลับ
        enhanceBtn.disabled = false;
        enhanceBtn.style.display = '';
        enhanceStatus.style.display = 'none';
    }
}

// Export function
window.enhancePrompt = enhancePrompt;

// Clear chat history
function clearChatHistory() {
    if (currentMode === 'chat') {
        if (confirm('ต้องการล้างประวัติการสนทนาหรือไม่?')) {
            chatHistory.chat = '';
            clearChat();
            addWelcomeMessage('chat');
            showNotification('🗑️ ล้างประวัติแล้ว', 'success');
        }
    }
}

// Export function
window.clearChatHistory = clearChatHistory;

// ========== CHAT LOCALSTORAGE SYSTEM ==========

// ระบบจัดการประวัติ Chat
const ChatStorage = {
    MAX_MESSAGES: 100,  // เก็บสูงสุด 100 ข้อความ
    STORAGE_KEY: `veo_chat_history`,
    
    // บันทึกประวัติ
    save: function() {
        if (currentMode !== 'chat') return;
        
        try {
            const messages = [];
            const chatElements = document.querySelectorAll('#chatMessages .message');
            
            chatElements.forEach(elem => {
                const isUser = elem.classList.contains('user');
                const contentElem = elem.querySelector('.message-content');
                if (!contentElem) return;
                
                // ดึงข้อความหลัก (ไม่รวม model info)
                let mainContent = '';
                let htmlContent = '';
                const contentDiv = contentElem.querySelector('div:first-child');
                
                if (isUser) {
                    // สำหรับ user message เก็บเป็น text ธรรมดา
                    if (contentDiv) {
                        mainContent = contentDiv.textContent.trim();
                    } else {
                        mainContent = contentElem.textContent.trim();
                    }
                    // Clean timestamp patterns from stored content
                    mainContent = mainContent.replace(/\d{2}:\d{2} • \d{1,2} .+? \d{4}/g, '').trim();
                } else {
                    // สำหรับ assistant message เก็บเป็น HTML เพื่อรักษา format
                    if (contentDiv) {
                        mainContent = contentDiv.textContent.trim();
                        htmlContent = contentDiv.innerHTML;
                    } else {
                        mainContent = contentElem.textContent.trim();
                        htmlContent = contentElem.innerHTML;
                    }
                    
                    // ลบ model info ออกจาก htmlContent ถ้ามี
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = htmlContent;
                    const modelInfoElem = tempDiv.querySelector('.chat-model-info');
                    if (modelInfoElem) {
                        modelInfoElem.remove();
                    }
                    htmlContent = tempDiv.innerHTML;
                }
                
                // ไม่เก็บ loading, error, หรือ welcome message
                if (mainContent.includes('กำลังคิด...') || 
                    mainContent.includes('❌') || 
                    mainContent.includes('สวัสดีครับ! ผมคือ AI Assistant')) {
                    return;
                }
                
                // ดึงข้อมูล model และ cost จาก chat-model-info (ถ้ามี)
let modelData = null;
const modelInfo = contentElem.querySelector('.chat-model-info');
if (modelInfo && !isUser) {
    const spans = modelInfo.querySelectorAll('span');
    if (spans.length >= 2) {
        const modelText = spans[0].textContent.trim();
        const costText = spans[1].textContent.trim();
        
        // เก็บข้อมูลเฉพาะถ้าไม่ใช่ข้อความเก่า
        if (!modelText.includes('undefined') && !costText.includes('undefined')) {
            modelData = {
                model: modelText,
                cost: parseFloat(costText.replace(' เครดิต', ''))
            };
        }
    }
}
                
                messages.push({
                    role: isUser ? 'user' : 'assistant',
                    content: mainContent,
                    htmlContent: htmlContent,  // เพิ่ม HTML content สำหรับ assistant
                    timestamp: new Date().toISOString(),
                    modelData: modelData  // เพิ่มข้อมูล model
                });
            });
            
            // เก็บแค่ข้อความล่าสุดตามจำนวนที่กำหนด
            const recentMessages = messages.slice(-this.MAX_MESSAGES);
            
            // บันทึกลง localStorage
            const key = `${this.STORAGE_KEY}_${userId}`;
            localStorage.setItem(key, JSON.stringify({
                messages: recentMessages,
                lastUpdated: new Date().toISOString(),
                model: getSelectedChatModel()
            }));
            
            console.log(`💾 Saved ${recentMessages.length} messages to LocalStorage`);
            
        } catch (error) {
            console.error('Failed to save chat:', error);
            if (error.name === 'QuotaExceededError') {
                // localStorage เต็ม - ลบข้อมูลเก่า
                this.cleanup();
            }
        }
    },
    
    // โหลดประวัติ
    load: function() {
        try {
            const key = `${this.STORAGE_KEY}_${userId}`;
            const saved = localStorage.getItem(key);
            
            if (!saved) return [];
            
            const data = JSON.parse(saved);
            console.log(`📂 Loaded ${data.messages.length} messages from LocalStorage`);
            
            return data.messages || [];
            
        } catch (error) {
            console.error('Failed to load chat:', error);
            return [];
        }
    },
    
    // แสดงประวัติใน UI
    display: function() {
        const messages = this.load();
        
        // Clear current chat ก่อนเสมอ
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            // ไม่มีประวัติ แสดง welcome message
            addWelcomeMessage('chat');
            return;
        }
        
        // แสดงประวัติ
        messages.forEach(msg => {
            if (msg.role === 'assistant') {
                // สำหรับ assistant ใช้ HTML content ที่เก็บไว้
                if (msg.htmlContent) {
                    // แสดงด้วย HTML format ที่เก็บไว้
                    const messageId = `msg-${Date.now()}-${Math.random()}`;
                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message assistant';
                    messageDiv.innerHTML = `
                        <div class="message-avatar">🤖</div>
                        <div class="message-content">
                            <div>${msg.htmlContent}</div>
                            ${msg.modelData ? `
                            <div class="chat-model-info">
                                <span>${msg.modelData.model}</span>
                                <span>${msg.modelData.cost} เครดิต</span>
                            </div>` : ''}
                        </div>
                    `;
                    chatMessages.appendChild(messageDiv);
                } else if (msg.modelData) {
                    // ถ้ามีข้อมูล model แต่ไม่มี HTML (ข้อมูลเก่า)
                    displayChatResponseFromHistory(msg.content, msg.modelData);
                } else {
                    // ถ้าไม่มีข้อมูลเลย
                    addMessage(msg.content, msg.role);
                }
            } else {
                // User message แสดงแบบปกติ - clean timestamps first
                const cleanedContent = msg.content.replace(/\d{2}:\d{2} • \d{1,2} .+? \d{4}/g, '').trim();
                addMessage(cleanedContent, msg.role);
            }
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // แสดงข้อความว่าโหลดจาก local
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `
            text-align: center;
            padding: 8px;
            margin: 8px auto;
            background: rgba(59, 130, 246, 0.1);
            border-radius: 8px;
            font-size: 12px;
            color: #64748b;
        `;
        infoDiv.innerHTML = `📂 โหลดประวัติ ${messages.length} ข้อความจากเครื่องของคุณ`;
        chatMessages.insertBefore(infoDiv, chatMessages.firstChild);
    },
    
    // ลบประวัติ
    clear: function() {
        try {
            const key = `${this.STORAGE_KEY}_${userId}`;
            localStorage.removeItem(key);
            console.log('🗑️ Chat history cleared');
        } catch (error) {
            console.error('Failed to clear chat:', error);
        }
    },
    
    // ทำความสะอาด localStorage (ลบข้อมูลเก่า)
    cleanup: function() {
        try {
            const allKeys = Object.keys(localStorage);
            const chatKeys = allKeys.filter(key => key.startsWith(this.STORAGE_KEY));
            
            // เรียงตาม lastUpdated แล้วลบเก่าสุด
            const items = chatKeys.map(key => ({
                key,
                data: JSON.parse(localStorage.getItem(key))
            })).sort((a, b) => 
                new Date(b.data.lastUpdated) - new Date(a.data.lastUpdated)
            );
            
            // ลบครึ่งหนึ่งที่เก่าที่สุด
            const toDelete = items.slice(Math.floor(items.length / 2));
            toDelete.forEach(item => {
                localStorage.removeItem(item.key);
            });
            
            console.log(`🧹 Cleaned up ${toDelete.length} old chat histories`);
            
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    },
    
    // ดูขนาดที่ใช้
    getSize: function() {
        try {
            const key = `${this.STORAGE_KEY}_${userId}`;
            const data = localStorage.getItem(key) || '';
            const sizeInBytes = new Blob([data]).size;
            const sizeInKB = (sizeInBytes / 1024).toFixed(2);
            return `${sizeInKB} KB`;
        } catch (error) {
            return '0 KB';
        }
    }
};

// ========== UPDATE EXISTING FUNCTIONS ==========

// แก้ไข sendChatMessage - เพิ่มการบันทึก
const originalSendChatMessage = window.sendChatMessage;
window.sendChatMessage = async function(message) {
    // เรียก function เดิม
    await originalSendChatMessage(message);
    
    // บันทึกหลังส่งข้อความ
    setTimeout(() => {
        ChatStorage.save();
    }, 500);
};

// แก้ไข clearChatHistory - ลบ localStorage ด้วย
const originalClearChatHistory = window.clearChatHistory;
window.clearChatHistory = function() {
    if (currentMode === 'chat') {
        if (confirm('ต้องการล้างประวัติการสนทนาหรือไม่?')) {
            chatHistory.chat = '';
            clearChat();
            addWelcomeMessage('chat');
            ChatStorage.clear(); // เพิ่มบรรทัดนี้
            showNotification('🗑️ ล้างประวัติแล้ว', 'success');
        }
    }
};

// แก้ไข switchMode - บันทึกประวัติก่อนเปลี่ยนโหมด
const originalSwitchMode2 = window.switchMode;
window.switchMode = function(mode) {
    // Save current mode history before switching
    if (currentMode === 'promptmaster' || currentMode === 'multichar' || currentMode === 'image') {
        PromptStorage.save(currentMode);
    } else if (currentMode === 'chat') {
        ChatStorage.save();
    }
    
    // เรียก function เดิม (ซึ่งจะเรียก loadChatHistory อยู่แล้ว)
    originalSwitchMode2(mode);
};

// ========== AUTO SAVE ==========

// บันทึกอัตโนมัติทุก 30 วินาที
setInterval(() => {
    if (currentMode === 'chat') {
        ChatStorage.save();
    }
}, 30000);

// บันทึกก่อนปิดหน้า
window.addEventListener('beforeunload', () => {
    if (currentMode === 'chat') {
        ChatStorage.save();
    }
});

// ========== UTILITY FUNCTIONS ==========

// แสดงข้อมูลการใช้ storage (สำหรับ debug)
window.showChatStorageInfo = function() {
    const size = ChatStorage.getSize();
    const messages = ChatStorage.load();
    console.log(`
📊 Chat Storage Info:
- User: ${userId}
- Messages: ${messages.length}
- Size: ${size}
- Max allowed: ~5-10 MB
    `);
};

console.log('✅ Chat LocalStorage System loaded');

// ========== PROMPT STORAGE SYSTEM ==========
// Storage system for general and multichar (prompt master) modes
const PromptStorage = {
    MAX_MESSAGES: 50,  // เก็บสูงสุด 50 ข้อความต่อโหมด
    STORAGE_KEYS: {
        promptmaster: 'veo_promptmaster_history',
        multichar: 'veo_multichar_history'
    },
    
    // บันทึกประวัติ
    save: function(mode) {
        if (mode !== 'promptmaster' && mode !== 'multichar') return;
        
        // ใช้ userId โดยตรงเหมือน ChatStorage
        console.log(`🔵 PromptStorage.save called for ${mode} mode, userId: ${userId}`);
        
        if (!userId) {
            console.error('❌ PromptStorage.save: userId is not set!');
            return;
        }
        
        try {
            const messages = [];
            const chatElements = document.querySelectorAll('#chatMessages .message');
            console.log(`🔵 Found ${chatElements.length} elements to save`);
            
            chatElements.forEach(elem => {
                const isUser = elem.classList.contains('user');
                const contentElem = elem.querySelector('.message-content');
                if (!contentElem) return;
                
                let content = '';
                
                if (isUser) {
                    // สำหรับ user message ต้องแปลง <br> กลับเป็น \n ก่อนเก็บ
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = contentElem.innerHTML;
                    // ลบ timestamp ถ้ามี
                    const timestampElem = tempDiv.querySelector('.message-timestamp');
                    if (timestampElem) {
                        timestampElem.remove();
                    }
                    // แปลง <br> เป็น \n
                    let html = tempDiv.innerHTML;
                    html = html.replace(/<br\s*\/?>/gi, '\n');
                    // แปลง HTML entities กลับเป็นข้อความปกติ
                    tempDiv.innerHTML = html;
                    content = tempDiv.textContent.trim();
                } else {
                    // สำหรับ assistant message เก็บ innerHTML ทั้งหมด
                    content = contentElem.innerHTML;
                }
                
                // ไม่เก็บ loading, error messages
                if (content.includes('กำลังสร้าง') || 
                    content.includes('กำลังคิด') ||
                    content.includes('❌') || 
                    content.includes('⚠️ Session หมดอายุ') ||
                    content.includes('สวัสดีครับ! ผมคือ')) {
                    return;
                }
                
                messages.push({
                    role: isUser ? 'user' : 'assistant',
                    content: content,
                    timestamp: new Date().toISOString(),
                    hasPrompt: !isUser && (content.includes('veo3-prompt') || content.includes('character-profile'))
                });
            });
            
            // เก็บแค่ข้อความล่าสุดตามจำนวนที่กำหนด
            const recentMessages = messages.slice(-this.MAX_MESSAGES);
            
            // บันทึกลง localStorage
            const key = `${this.STORAGE_KEYS[mode]}_${userId}`;
            localStorage.setItem(key, JSON.stringify({
                messages: recentMessages,
                lastUpdated: new Date().toISOString(),
                mode: mode
            }));
            
            console.log(`💾 Saved ${recentMessages.length} messages for ${mode} mode`);
            console.log(`🔵 Saved to key: ${key}`);
            
        } catch (error) {
            console.error(`Failed to save ${mode} history:`, error);
            if (error.name === 'QuotaExceededError') {
                this.cleanup(mode);
            }
        }
    },
    
    // โหลดประวัติ
    load: function(mode) {
        if (mode !== 'general' && mode !== 'multichar') return [];
        
        try {
            const key = `${this.STORAGE_KEYS[mode]}_${userId}`;
            console.log(`🟡 Loading from key: ${key}`);
            const saved = localStorage.getItem(key);
            
            if (!saved) return [];
            
            const data = JSON.parse(saved);
            console.log(`📂 Loaded ${data.messages.length} messages for ${mode} mode`);
            
            return data.messages || [];
            
        } catch (error) {
            console.error(`Failed to load ${mode} history:`, error);
            return [];
        }
    },
    
    // แสดงประวัติใน UI
    display: function(mode) {
        if (mode !== 'general' && mode !== 'multichar') return;
        
        const messages = this.load(mode);
        
        // Clear current chat
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            // ไม่มีประวัติ แสดง welcome message
            addWelcomeMessage(mode);
            return;
        }
        
        // แสดงประวัติ
        messages.forEach(msg => {
            if (msg.role === 'user') {
                // Clean timestamp patterns from user messages before displaying
                const cleanedContent = msg.content.replace(/\d{2}:\d{2} • \d{1,2} .+? \d{4}/g, '').trim();
                // Pass the cleaned content with newlines preserved
                addMessage(cleanedContent, 'user');
            } else {
                // สำหรับ assistant message สร้าง wrapper และใส่ HTML ที่บันทึกไว้
                const messageId = `msg-${Date.now()}-${Math.random()}`;
                const messageDiv = document.createElement('div');
                messageDiv.id = messageId;
                messageDiv.className = 'message assistant';
                
                // ใช้ HTML ที่บันทึกไว้โดยตรง
                messageDiv.innerHTML = `
                    <div class="message-avatar">🤖</div>
                    <div class="message-content">${msg.content}</div>
                `;
                
                chatMessages.appendChild(messageDiv);
            }
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // แสดงข้อความว่าโหลดจาก local
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `
            text-align: center;
            padding: 8px;
            margin: 8px auto;
            background: rgba(147, 51, 234, 0.1);
            border-radius: 8px;
            font-size: 12px;
            color: #a1a1aa;
        `;
        infoDiv.innerHTML = `📂 โหลดประวัติ ${messages.length} ข้อความจากเครื่องของคุณ`;
        chatMessages.insertBefore(infoDiv, chatMessages.firstChild);
    },
    
    // ลบประวัติ
    clear: function(mode) {
        if (mode !== 'general' && mode !== 'multichar') return;
        
        // ใช้ userId โดยตรงเหมือน ChatStorage
        try {
            const key = `${this.STORAGE_KEYS[mode]}_${userId}`;
            localStorage.removeItem(key);
            console.log(`🗑️ ${mode} history cleared`);
        } catch (error) {
            console.error(`Failed to clear ${mode} history:`, error);
        }
    },
    
    // ทำความสะอาด localStorage
    cleanup: function(mode) {
        // ใช้ userId โดยตรงเหมือน ChatStorage
        try {
            const key = `${this.STORAGE_KEYS[mode]}_${userId}`;
            const saved = localStorage.getItem(key);
            
            if (saved) {
                const data = JSON.parse(saved);
                // เก็บแค่ครึ่งหนึ่งของข้อความ
                const halfMessages = data.messages.slice(Math.floor(data.messages.length / 2));
                
                localStorage.setItem(key, JSON.stringify({
                    messages: halfMessages,
                    lastUpdated: new Date().toISOString(),
                    mode: mode
                }));
                
                console.log(`🧹 Cleaned up ${mode} history, kept ${halfMessages.length} messages`);
            }
        } catch (error) {
            console.error(`Cleanup failed for ${mode}:`, error);
        }
    },
    
    // ดูขนาดที่ใช้
    getSize: function(mode) {
        // ใช้ userId โดยตรงเหมือน ChatStorage
        try {
            const key = `${this.STORAGE_KEYS[mode]}_${userId}`;
            const data = localStorage.getItem(key) || '';
            const sizeInBytes = new Blob([data]).size;
            const sizeInKB = (sizeInBytes / 1024).toFixed(2);
            return `${sizeInKB} KB`;
        } catch (error) {
            return '0 KB';
        }
    }
};

// ========== UPDATE SAVE AND LOAD FUNCTIONS ==========

// แก้ไข saveChatHistory function เดิม
const originalSaveChatHistory = window.saveChatHistory;
window.saveChatHistory = function(mode) {
    if (mode === 'chat') {
        // ใช้ ChatStorage สำหรับ chat mode
        originalSaveChatHistory(mode);
    } else if (mode === 'promptmaster' || mode === 'multichar') {
        // ใช้ PromptStorage สำหรับ promptmaster และ multichar
        PromptStorage.save(mode);
    } else if (mode === 'image') {
        // ใช้ ImagePromptStorage สำหรับ image mode
        ImagePromptStorage.save();
    } else {
        // โหมดอื่นๆ ใช้วิธีเดิม
        originalSaveChatHistory(mode);
    }
};

// loadChatHistory ถูกแก้ไขโดยตรงในฟังก์ชันหลักแล้ว ไม่ต้อง override

// แก้ไข clearModeChat function
const originalClearModeChat = window.clearModeChat;
window.clearModeChat = function(mode) {
    if (mode === 'promptmaster' || mode === 'multichar') {
        const modeName = mode === 'promptmaster' ? 'Prompt Master' : 'Prompt Master';
        if (confirm(`ต้องการล้างประวัติ ${modeName} หรือไม่?`)) {
            PromptStorage.clear(mode);
            chatHistory[mode] = '';
            if (currentMode === mode) {
                clearChat();
                addWelcomeMessage(mode);
            }
            showNotification('🗑️ ล้างประวัติแล้ว', 'success');
        }
    } else if (mode === 'image') {
        if (confirm(`ต้องการล้างประวัติ Image Prompt หรือไม่?`)) {
            ImagePromptStorage.clear();
            chatHistory[mode] = '';
            if (currentMode === mode) {
                clearChat();
                addWelcomeMessage(mode);
            }
            showNotification('🗑️ ล้างประวัติแล้ว', 'success');
        }
    } else {
        originalClearModeChat(mode);
    }
};


// Auto save ทุก 30 วินาที
setInterval(() => {
    if (currentMode === 'promptmaster' || currentMode === 'multichar') {
        PromptStorage.save('multichar');
    } else if (currentMode === 'image') {
        ImagePromptStorage.save();
    }
}, 30000);

// บันทึกก่อนปิดหน้า
window.addEventListener('beforeunload', () => {
    if (currentMode === 'promptmaster' || currentMode === 'multichar') {
        PromptStorage.save('multichar');
    } else if (currentMode === 'image') {
        ImagePromptStorage.save();
    }
});

// Utility function สำหรับดูข้อมูล storage
window.showPromptStorageInfo = function() {
    const promptmasterSize = PromptStorage.getSize('promptmaster');
    const multicharSize = PromptStorage.getSize('multichar');
    const imageSize = PromptStorage.getSize('image');
    const promptmasterMessages = PromptStorage.load('promptmaster');
    const multicharMessages = PromptStorage.load('multichar');
    const imageMessages = PromptStorage.load('image');
    
    console.log(`
📊 Prompt Storage Info:
- User: ${userId}
- Prompt Master Mode: ${promptmasterMessages.length} messages (${promptmasterSize})
- Multichar Mode: ${multicharMessages.length} messages (${multicharSize})
- Image Mode: ${imageMessages.length} messages (${imageSize})
- Max allowed: ~5-10 MB per mode
    `);
};

console.log('✅ Prompt Storage System loaded');

// ========== IMAGE PROMPT STORAGE SYSTEM ==========
const ImagePromptStorage = {
    MAX_MESSAGES: 30,
    STORAGE_KEY: 'veo_image_prompt_history',
    
    save: function() {
        if (currentMode !== 'image') return;
        
        console.log(`🔵 ImagePromptStorage.save called, userId: ${userId}`);
        
        if (!userId) {
            console.error('❌ ImagePromptStorage.save: userId is not set!');
            return;
        }
        
        try {
            const messages = [];
            const chatElements = document.querySelectorAll('#chatMessages .message');
            
            chatElements.forEach(elem => {
                const isUser = elem.classList.contains('user');
                const content = elem.querySelector('.message-content');
                
                if (content) {
                    messages.push({
                        type: isUser ? 'user' : 'assistant',
                        content: content.innerHTML,
                        timestamp: Date.now()
                    });
                }
            });
            
            const trimmedMessages = messages.slice(-this.MAX_MESSAGES);
            const key = `${this.STORAGE_KEY}_${userId}`;
            localStorage.setItem(key, JSON.stringify(trimmedMessages));
            console.log(`✅ Saved ${trimmedMessages.length} messages to image prompt storage`);
        } catch (error) {
            console.error('❌ Error saving image prompt history:', error);
        }
    },
    
    load: function() {
        try {
            const key = `${this.STORAGE_KEY}_${userId}`;
            const saved = localStorage.getItem(key);
            
            if (saved) {
                const messages = JSON.parse(saved);
                console.log(`📘 Loaded ${messages.length} messages from image prompt storage`);
                return messages;
            }
        } catch (error) {
            console.error('❌ Error loading image prompt history:', error);
        }
        return [];
    },
    
    display: function() {
        const messages = this.load();
        const chatMessages = document.getElementById('chatMessages');
        
        // Clear current messages
        chatMessages.innerHTML = '';
        
        // Add welcome message only if no messages
        if (messages.length === 0) {
            addWelcomeMessage('image');
        } else {
            // Add saved messages
            messages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.type}`;
                
                // Add avatar for assistant messages
                if (msg.type === 'assistant') {
                    messageDiv.innerHTML = `
                        <div class="message-avatar">🤖</div>
                        <div class="message-content">${msg.content}</div>
                    `;
                } else {
                    // Clean timestamp patterns from user messages before displaying
                    let cleanedContent = msg.content.replace(/\d{2}:\d{2} • \d{1,2} .+? \d{4}/g, '').trim();
                    // If it's plain text (user message), preserve line breaks
                    if (!cleanedContent.includes('<')) {
                        cleanedContent = cleanedContent.replace(/\n/g, '<br>');
                    }
                    messageDiv.innerHTML = `<div class="message-content">${cleanedContent}</div>`;
                }
                
                chatMessages.appendChild(messageDiv);
            });
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        console.log(`✅ Displayed ${messages.length} messages from image prompt storage`);
    },
    
    clear: function() {
        try {
            const key = `${this.STORAGE_KEY}_${userId}`;
            localStorage.removeItem(key);
            console.log('✅ Image prompt history cleared');
        } catch (error) {
            console.error('❌ Error clearing image prompt history:', error);
        }
    }
};

console.log('✅ Image Prompt Storage System loaded');

// Debug function to check localStorage
window.checkPromptStorage = function() {
    console.log('=== Checking Prompt Storage ===');
    console.log('Current userId:', userId);
    console.log('Current mode:', currentMode);
    
    const generalKey = `veo_general_history_${userId}`;
    const multicharKey = `veo_multichar_history_${userId}`;
    
    console.log('\nGeneral Storage:');
    const generalData = localStorage.getItem(generalKey);
    if (generalData) {
        const parsed = JSON.parse(generalData);
        console.log(`- Key: ${generalKey}`);
        console.log(`- Messages: ${parsed.messages.length}`);
        console.log(`- Last updated: ${parsed.lastUpdated}`);
    } else {
        console.log('- No data found');
    }
    
    console.log('\nMultichar Storage:');
    const multicharData = localStorage.getItem(multicharKey);
    if (multicharData) {
        const parsed = JSON.parse(multicharData);
        console.log(`- Key: ${multicharKey}`);
        console.log(`- Messages: ${parsed.messages.length}`);
        console.log(`- Last updated: ${parsed.lastUpdated}`);
    } else {
        console.log('- No data found');
    }
    
    console.log('\nAll localStorage keys:');
    Object.keys(localStorage).forEach(key => {
        if (key.includes('veo_')) {
            console.log(`- ${key}`);
        }
    });
};

// Function to clear current mode history
window.clearCurrentModeHistory = function() {
    if (currentMode === 'promptmaster' || currentMode === 'multichar' || currentMode === 'image') {
        const modeName = currentMode === 'promptmaster' ? 'Prompt Master' : 
                        currentMode === 'multichar' ? 'Prompt Master' :
                        'Image Prompt';
        if (confirm(`ต้องการล้างประวัติ ${modeName} ทั้งหมดหรือไม่?\n\nประวัติการสนทนาจะถูกลบถาวร`)) {
            PromptStorage.clear(currentMode);
            chatHistory[currentMode] = '';
            clearChat();
            addWelcomeMessage(currentMode);
            showNotification('🗑️ ล้างประวัติเรียบร้อยแล้ว', 'success');
        }
    }
};

// ========== FIX FAB BUTTONS ==========
// ฟังก์ชันแสดงปุ่ม FAB ทั้งหมด
function showAllFABButtons() {
    const fabAnnouncement = document.querySelector('.fab-announcement');
    const fabCourse = document.querySelector('.fab-course');
    const fabTools = document.querySelector('.fab-tools');
    const fabToolsMenu = document.getElementById('fabToolsMenu');
    
    // แสดงปุ่มข่าวสาร
    if (fabAnnouncement) {
        fabAnnouncement.style.display = 'flex';
        fabAnnouncement.style.visibility = 'visible';
        fabAnnouncement.style.opacity = '1';
        fabAnnouncement.style.position = 'fixed';
        fabAnnouncement.style.bottom = '20px';
        fabAnnouncement.style.right = '20px';
        fabAnnouncement.style.zIndex = '999';
    }
    
    // แสดงปุ่มคอร์ส
    if (fabCourse) {
        fabCourse.style.display = 'flex';
        fabCourse.style.visibility = 'visible';
        fabCourse.style.opacity = '1';
        fabCourse.style.position = 'fixed';
        fabCourse.style.bottom = '90px';
        fabCourse.style.right = '20px';
        fabCourse.style.zIndex = '999';
    }
    
    // แสดงปุ่ม Tools
    if (fabTools) {
        fabTools.style.display = 'flex';
        fabTools.style.visibility = 'visible';
        fabTools.style.opacity = '1';
        fabTools.style.position = 'fixed';
        fabTools.style.bottom = '160px';
        fabTools.style.right = '20px';
        fabTools.style.zIndex = '999';
    }
    
    // ซ่อนเมนู tools ถ้าเปิดอยู่
    if (fabToolsMenu) {
        fabToolsMenu.style.display = 'none';
    }
}

// Export function
window.showAllFABButtons = showAllFABButtons;
// ========== END FIX FAB BUTTONS ==========
window.syncChatModelSelection = syncChatModelSelection;

// ========== MUSIC VIDEO TEMPLATE SYSTEM ==========

// เพิ่ม template ใน promptTemplates
const musicVideoTemplates = {
    isaanTrap: {
        emoji: "🎤",
        title: "Isaan Trap Music Video", 
        category: "musicvideo",
        defaultValues: {
            singer: `A man in his late 50s from Isaan, Thailand. He has a warm, kind, and heavily wrinkled face from years of working in the sun, with tan to dark skin and high cheekbones. His face and arms are smudged with a bit of dried mud and dust. His most defining feature is a chipped or broken upper front tooth (the right incisor), visible when he smiles.

Outfit: A heavily worn, faded indigo-blue mor hom cotton farmer's shirt, unbuttoned at the top with rolled-up sleeves. Three-quarter length dark brown wrap-around fisherman pants (kang-keng le). A worn woven cloth shoulder bag (yaam) across his chest and a simple fishing net over one shoulder.`,
            
            lyrics: "Yo! Woke up at dawn, sun on my face! King of this field, ain't no other place. Sticky rice power, that's the morning grace. Me and my dog, we runnin' this space!",
            
            musicStyle: "LOUD, energetic Isaan Trap music with prominent Phin (lute) melody and heavy hip-hop beat",
            
            background: "A vast, green rice paddy field in Isaan, Thailand during early morning. Soft, diffused sunrise light with gentle mist. The sun is low and partially hidden by morning haze, creating a subtle warm glow. Water-filled paddies reflect the soft sky. A few water buffalo visible in the distance",
            
            tone: "Vibrant, warm, golden hour tones. High contrast. Ultra realistic, cinematic music video with gritty, authentic feel"
        }
    }
};

// ฟังก์ชันแสดง Music Video Form
function showMusicVideoForm() {
    const template = musicVideoTemplates.isaanTrap;
    
    const modal = document.createElement('div');
    modal.className = 'music-template-modal';
    modal.innerHTML = `
        <div class="music-template-content">
            <button class="close-btn" onclick="closeMusicVideoForm()">✕</button>
            
            <h2>🎵 สร้าง Music Video Prompt</h2>
            <p class="template-subtitle">สร้าง prompt สำหรับ MV แบบมืออาชีพ - กรอกเฉพาะที่ต้องการเปลี่ยน ใช้ภาษาไทยได้</p>
            
            <div class="template-form">
                <div class="form-group">
                    <label>🎤 ลักษณะนักร้อง/ตัวละคร:</label>
                    <textarea id="mvSinger" rows="4" placeholder="บรรยายหน้าตา อายุ การแต่งตัว ลักษณะเด่น...">${template.defaultValues.singer}</textarea>
                    <small>💡 ยิ่งละเอียดยิ่งดี เช่น สีผิว ทรงผม เครื่องประดับ</small>
                </div>
                
                <div class="form-group">
                    <label>📝 เนื้อร้อง (ภาษาอะไรก็ได้):</label>
                    <textarea id="mvLyrics" rows="3" placeholder="Yo! Check it out...">${template.defaultValues.lyrics}</textarea>
                    <small>💡 ใช้ภาษาไทยได้ เดี๋ยว bot จัดการให้</small>
                </div>
                
                <div class="form-group">
                    <label>🎵 แนวเพลง/ดนตรี:</label>
                    <input type="text" id="mvMusicStyle" value="${template.defaultValues.musicStyle}">
                    <small>💡 ระบุแนวเพลง เครื่องดนตรีหลัก จังหวะ</small>
                </div>
                
                <div class="form-group">
                    <label>🌄 สถานที่/บรรยากาศ:</label>
                    <textarea id="mvBackground" rows="3" placeholder="บรรยายสถานที่ เวลา แสง บรรยากาศ...">${template.defaultValues.background}</textarea>
                    <small>💡 เช่น ทุ่งนา ตอนเช้า มีหมอก แสงทอง</small>
                </div>
                
                <div class="form-group">
                    <label>🎨 โทนสี/สไตล์ภาพ:</label>
                    <input type="text" id="mvTone" value="${template.defaultValues.tone}">
                    <small>💡 เช่น warm tone, high contrast, cinematic</small>
                </div>
                
                <div class="advanced-options">
                    <button class="toggle-advanced" onclick="toggleAdvancedOptions()">
                        ⚙️ ตัวเลือกขั้นสูง ▼
                    </button>
                    
                    <div class="advanced-fields" style="display: none;">
                        <div class="form-group">
                            <label>📹 มุมกล้อง/การเคลื่อนไหว:</label>
                            <input type="text" id="mvCamera" value="Low-angle, slow-motion dolly shot following the performer">
                        </div>
                        
                        <div class="form-group">
                            <label>🐕 ตัวประกอบ/Props:</label>
                            <input type="text" id="mvProps" value="A loyal brown dog trotting alongside">
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="generate-btn" onclick="generateMusicVideoPrompt()">
                        ✨ สร้าง Music Video Prompt
                    </button>
                    <button class="cancel-btn" onclick="closeMusicVideoForm()">
                        ยกเลิก
                    </button>
                </div>
                
                <div class="template-tips">
                    <h4>💡 Tips for Best Results:</h4>
                    <ul>
                        <li>ใช้ภาษาอะไรก็ได้ในเนื้อร้อง แต่อย่ายาวเกิน 8 วิ</li>
                        <li>บรรยายลักษณะเด่นที่ต้องการให้เห็นในทุกฉาก</li>
                        <li>ระบุแนวเพลงให้ชัดเจนเพื่อให้ท่าเต้นเข้ากัน</li>
                        <li>กรอกเฉพาะส่วนที่ต้องการเปลี่ยน ที่เหลือจะใช้ค่า default</li>
                        <li>ใช้ภาษาไทยได้ทุกหัวข้อ!!</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ฟังก์ชันสร้าง Prompt
// ฟังก์ชันสร้าง Prompt (แบบใหม่ที่รองรับภาษาไทย)
function generateMusicVideoPrompt() {
    const template = musicVideoTemplates.isaanTrap;
    
    // ดึงค่าจาก form
    const singer = document.getElementById('mvSinger').value.trim() || template.defaultValues.singer;
    const lyrics = document.getElementById('mvLyrics').value.trim() || template.defaultValues.lyrics;
    const musicStyle = document.getElementById('mvMusicStyle').value.trim() || template.defaultValues.musicStyle;
    const background = document.getElementById('mvBackground').value.trim() || template.defaultValues.background;
    const tone = document.getElementById('mvTone').value.trim() || template.defaultValues.tone;
    
    // ดึงค่า advanced options
    const advancedFields = document.querySelector('.advanced-fields');
    let camera = "Low-angle, slow-motion dolly shot that follows the performer";
    let props = "";
    
    if (advancedFields && advancedFields.style.display !== 'none') {
        camera = document.getElementById('mvCamera').value.trim() || camera;
        props = document.getElementById('mvProps').value.trim();
    }
    
    // สร้าง prompt คำสั่งสำหรับ AI
    const aiPrompt = `สร้าง Music Video Prompt แบบ Professional จากข้อมูลนี้:

🎤 นักร้อง/ตัวละคร: ${singer}
📝 เนื้อร้อง: ${lyrics}
🎵 แนวเพลง: ${musicStyle}
🌄 สถานที่/บรรยากาศ: ${background}
🎨 โทนสี/สไตล์: ${tone}
${camera !== "Low-angle, slow-motion dolly shot that follows the performer" ? `📹 มุมกล้อง: ${camera}` : ''}
${props ? `🎭 Props/ตัวประกอบ: ${props}` : ''}

กรุณาสร้าง prompt ภาษาอังกฤษในรูปแบบ Professional Music Video:
[Settings / Atmosphere]
[Characters + Appearance + Emotion] 
[Action / Pose]
[Dialogue – with Lipsync]
[Audio & Effects]
[Visual Style]

⚠️ สำคัญ:
- แปลงทุกอย่างเป็นภาษาอังกฤษ
- เนื้อร้องใน [Dialogue] ให้คงภาษาเดิมของผู้ใช้ไว้ ห้ามแปล!
- ถ้าเนื้อร้องเป็นภาษาไทย ให้ใส่เป็นภาษาไทยพร้อมหมายเหตุ "Lipsync to lyrics:"
- ถ้าเนื้อร้องเป็นภาษาอังกฤษ ให้ใส่เป็นภาษาอังกฤษ
- รักษาโครงสร้างตามต้นแบบ Music Video  
- เพิ่มรายละเอียดให้ cinematic และ professional
- Audio ต้องเน้นว่าเสียงเพลงเป็นหลัก ambient sounds เบามาก`;
    
    // ใส่ prompt ใน textarea
    document.getElementById('messageInput').value = aiPrompt;
    
    // Auto resize textarea
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
    
    // ปิด modal
    closeMusicVideoForm();
    if (document.getElementById('templatesModal').style.display === 'flex') {
        closeTemplates();
    }
    
    // Scroll to input
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // แจ้งให้ user รู้ว่าต้องกดส่ง
    showNotification('📝 ข้อมูลพร้อมแล้ว! กด "สร้าง Prompt" เพื่อให้ AI แปลงเป็นภาษาอังกฤษ', 'success');
    
    // เปลี่ยนข้อความปุ่มชั่วคราว
    const sendButton = document.getElementById('sendButton');
    const originalText = sendButton.innerHTML;
    sendButton.innerHTML = '🎵 สร้าง MV Prompt';
    
    // คืนค่าเดิมหลัง 5 วินาที
    setTimeout(() => {
        sendButton.innerHTML = originalText;
    }, 5000);
}

// ฟังก์ชันปิด Modal
function closeMusicVideoForm() {
    const modal = document.querySelector('.music-template-modal');
    if (modal) modal.remove();
}

// Toggle Advanced Options
function toggleAdvancedOptions() {
    const advancedFields = document.querySelector('.advanced-fields');
    const toggleBtn = document.querySelector('.toggle-advanced');
    
    if (advancedFields.style.display === 'none') {
        advancedFields.style.display = 'block';
        toggleBtn.innerHTML = '⚙️ ตัวเลือกขั้นสูง ▲';
    } else {
        advancedFields.style.display = 'none';
        toggleBtn.innerHTML = '⚙️ ตัวเลือกขั้นสูง ▼';
    }
}

// เพิ่มปุ่มใน Quick Actions Bar
function addMusicVideoButton() {
    // หา Quick Actions Bar
    const quickActionsBar = document.querySelector('.quick-actions-bar');
    if (quickActionsBar && !document.getElementById('musicVideoBtn')) {
        const musicBtn = document.createElement('button');
        musicBtn.id = 'musicVideoBtn';
        musicBtn.className = 'action-btn';
        musicBtn.onclick = showMusicVideoForm;
        musicBtn.innerHTML = `
            <span class="action-icon">🎵</span>
            <span class="action-text">Music Video</span>
        `;
        quickActionsBar.appendChild(musicBtn);
    }
}

// เพิ่มใน initialization
document.addEventListener('DOMContentLoaded', () => {
    // เพิ่มปุ่ม Music Video
    setTimeout(addMusicVideoButton, 1000);
});

// Export functions
window.showMusicVideoForm = showMusicVideoForm;
window.closeMusicVideoForm = closeMusicVideoForm;
window.generateMusicVideoPrompt = generateMusicVideoPrompt;
window.toggleAdvancedOptions = toggleAdvancedOptions;

// ========== TEMPLATE FORM SYSTEM ==========
let templateCharCount = 2;

// Show/Hide Template Button based on mode
function updateTemplateButton() {
    const templateSection = document.getElementById('templateButtonSection');
    
    if (currentMode === 'promptmaster' || currentMode === 'multichar' || currentMode === 'chat') {
        templateSection.style.display = 'block';
    } else {
        templateSection.style.display = 'none';
    }
}

// Show Template Form
function showTemplateForm() {
    const modal = document.getElementById('templateFormModal');
    const title = document.getElementById('templateFormTitle');
    
    modal.style.display = 'flex';
    
    if (currentMode === 'promptmaster') {
        title.innerHTML = '📋 Prompt Master Template';
    } else if (currentMode === 'multichar') {
        title.innerHTML = '🎭 Prompt Master Template';
    }
    
    // Reset character count to 2
    templateCharCount = 2;
    setTemplateCharCount(2);
    
    // Clear all fields
    document.querySelectorAll('.template-input, .template-textarea, .template-select').forEach(field => {
        field.value = '';
    });
    
    // Stop any ongoing voice recognition
    if (typeof stopFieldVoice === 'function') {
        stopFieldVoice();
    }
}

// Close Template Form
function closeTemplateForm() {
    const modal = document.getElementById('templateFormModal');
    modal.style.display = 'none';
    stopFieldVoice(); // เพิ่มบรรทัดนี้
    
    // Reset form
    document.querySelectorAll('.template-select, .template-input, .template-textarea').forEach(el => {
        el.value = '';
    });
}

// Close template form when clicking outside
function closeTemplateFormOnOutsideClick(event) {
    if (event.target.classList.contains('template-form-modal')) {
        closeTemplateForm();
    }
}

// Set character count in template
function setTemplateCharCount(count, buttonElement) {
    console.log('setTemplateCharCount called with count:', count);
    
    // บันทึกจำนวนตัวละคร
    templateFormData.characterCount = count;
    window.templateCharCount = count; // เก็บทั้ง 2 ที่
    
    // Update UI
    document.querySelectorAll('.char-count-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
    
    // Update character inputs
    const container = document.getElementById('characterDescriptions');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (count === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">ไม่มีตัวละครในฉากนี้</p>';
    } else {
        for (let i = 1; i <= count; i++) {
            const charDiv = document.createElement('div');
            charDiv.className = 'form-group char-field';
            charDiv.innerHTML = `
                <label>
                    👤 ตัวละครที่ ${i}
                    <button type="button" class="mic-btn" onclick="toggleFieldVoice('char${i}')" data-field="char${i}">
                        🎤
                    </button>
                    <button type="button" class="my-char-btn" onclick="openCharacterPicker('char${i}')" title="เลือกจาก My Characters">
                        📚 My Character
                    </button>
                </label>
                <input type="text" id="char${i}" class="template-input" 
                       placeholder="บรรยายลักษณะตัวละคร เช่น อายุ เพศ การแต่งตัว"
                       oninput="updateTemplatePreview(); saveCharacterData(${i}, this.value);">
            `;
            container.appendChild(charDiv);
        }
    }
    
    updateTemplatePreview();
}

// เพิ่มฟังก์ชันบันทึกข้อมูลตัวละคร
function saveCharacterData(index, value) {
    templateFormData.characters[`char${index}`] = value;
}

// Generate prompt from template
function generateFromTemplate() {
    let prompt = '';
    
    if (currentMode === 'promptmaster') {
        // Prompt Master Template
        const videoType = document.getElementById('videoType').value;
        const cameraAngle = document.getElementById('cameraAngle').value;
        const timeOfDay = document.getElementById('timeOfDay').value;
        const visualStyle = document.getElementById('visualStyle').value;
        const duration = document.getElementById('duration').value;
        const details = document.getElementById('additionalDetails').value;
        
        // Build prompt
        prompt = 'สร้าง Cinematic Veo Prompt แบบละเอียดสำหรับ:\n\n';
        
        if (videoType) prompt += `🎬 ประเภท: ${getVideoTypeText(videoType)}\n`;
        if (cameraAngle) prompt += `📷 มุมกล้อง: ${getCameraAngleText(cameraAngle)}\n`;
        if (timeOfDay) prompt += `🌅 แสง/เวลา: ${getTimeOfDayText(timeOfDay)}\n`;
        if (visualStyle) prompt += `🎨 สไตล์: ${getVisualStyleText(visualStyle)}\n`;
        if (duration) prompt += `⏱️ ความยาว: ${duration}\n`;
        // ========== เพิ่มส่วนนี้ ==========
// Characters - เหมือน Scene Builder
const charCount = window.templateCharCount || 0;
if (charCount > 0) {
    prompt += `\n👥 จำนวนตัวละคร: ${charCount} คน\n`;
    prompt += 'รายละเอียดตัวละคร:\n';
    
    for (let i = 1; i <= charCount; i++) {
        const charInput = document.getElementById(`char${i}`);
        if (charInput && charInput.value) {
            prompt += `${i}. ${charInput.value}\n`;
        } else {
            prompt += `${i}. (ให้ AI สร้างให้เหมาะกับฉาก)\n`;
        }
    }
}
// ========== จบส่วนที่เพิ่ม ==========
        if (details) prompt += `\n📝 รายละเอียด: ${details}\n`;
        
        prompt += '\n⚠️ สำคัญ: ต้องมีรายละเอียด cinematography, มุมกล้อง, แสง, การเคลื่อนไหว และเอาท์พุตเป็นภาษาอังกฤษ';
        
    } else if (currentMode === 'multichar') {
        // Prompt Master Template
        const videoType = document.getElementById('videoType').value;
        const sceneType = document.getElementById('sceneType').value;
        const location = document.getElementById('location').value;
        const timeOfDay = document.getElementById('timeOfDay').value;
        const visualStyle = document.getElementById('visualStyle').value;
        const mood = document.getElementById('mood').value;
        const soundType = document.getElementById('soundType').value;
        const duration = document.getElementById('duration').value;
        const dialogue = document.getElementById('dialogueText').value;
        const additionalDetails = document.getElementById('additionalDetails').value;
        
        prompt = 'สร้าง Multi-Character Scene แบบละเอียดมาก:\n\n';
        
        if (videoType) prompt += `🎬 ประเภท: ${videoType}\n`;
        if (sceneType) prompt += `🎭 ประเภทฉาก: ${sceneType}\n`;
        if (location) prompt += `📍 สถานที่: ${location}\n`;
        
        // เพิ่มการดึงมุมกล้อง - ใช้วิธีง่ายๆ ดึงจาก ID โดยตรง
        console.log('=== ตรวจสอบมุมกล้อง (วิธีใหม่) ===');
        let hasCameraAngles = false;
        let hasCameraMovements = false;
        let cameraAngleText = '';
        let cameraMovementText = '';
        
        // ตรวจสอบมุมกล้องทั้ง 3 มุม
        for (let i = 1; i <= 3; i++) {
            const angleElem = document.getElementById(`cameraAngle${i}`);
            const movementElem = document.getElementById(`cameraMovement${i}`);
            
            console.log(`มุมที่ ${i}:`, {
                angle: angleElem?.value || 'ไม่มี',
                movement: movementElem?.value || 'ไม่มี'
            });
            
            if (angleElem && angleElem.value) {
                if (!hasCameraAngles) {
                    cameraAngleText = '📷 มุมกล้อง:\n';
                    hasCameraAngles = true;
                }
                cameraAngleText += `  มุมที่ ${i}: ${getCameraAngleText(angleElem.value)}\n`;
            }
            
            if (movementElem && movementElem.value) {
                if (!hasCameraMovements) {
                    cameraMovementText = '🎬 การเคลื่อนกล้อง:\n';
                    hasCameraMovements = true;
                }
                cameraMovementText += `  ช็อตที่ ${i}: ${getCameraMovementText(movementElem.value)}\n`;
            }
        }
        
        // เพิ่มข้อมูลมุมกล้องใน prompt
        if (hasCameraAngles) {
            prompt += cameraAngleText;
        }
        if (hasCameraMovements) {
            prompt += cameraMovementText;
        }
        
        console.log('พบมุมกล้อง:', hasCameraAngles);
        console.log('พบการเคลื่อนกล้อง:', hasCameraMovements);
        
        // เก็บโค้ดเดิมไว้เผื่อใช้ภายหลัง (comment out)
        /*
        const cameraAngleItems = document.querySelectorAll('.camera-angle-item');
        console.log('จำนวน camera angle items:', cameraAngleItems.length);
        
        // ถ้าไม่เจอ ให้ลองวิธีอื่น
        if (cameraAngleItems.length === 0) {
            console.log('ไม่พบ .camera-angle-item, ลองค้นหาด้วยวิธีอื่น...');
            
            // แสดงค่าที่พบ
            console.log('ค้นหาค่ามุมกล้อง:', {
                angle1: document.getElementById('cameraAngle1')?.value,
                angle2: document.getElementById('cameraAngle2')?.value,
                angle3: document.getElementById('cameraAngle3')?.value,
                movement1: document.getElementById('cameraMovement1')?.value,
                movement2: document.getElementById('cameraMovement2')?.value,
                movement3: document.getElementById('cameraMovement3')?.value
            });
            
            // ลองดึงจาก ID โดยตรง
            const angle1 = document.getElementById('cameraAngle1');
            const movement1 = document.getElementById('cameraMovement1');
            
            if (angle1 && angle1.value) {
                prompt += `📷 มุมกล้อง:\n  มุมที่ 1: ${getCameraAngleText(angle1.value)}\n`;
            }
            if (movement1 && movement1.value) {
                prompt += `🎬 การเคลื่อนกล้อง:\n  ช็อตที่ 1: ${getCameraMovementText(movement1.value)}\n`;
            }
            
            // ตรวจสอบมุมที่ 2 และ 3
            for (let i = 2; i <= 3; i++) {
                const angleElem = document.getElementById(`cameraAngle${i}`);
                const movementElem = document.getElementById(`cameraMovement${i}`);
                
                if (angleElem && angleElem.value) {
                    if (!prompt.includes('📷 มุมกล้อง:')) {
                        prompt += '📷 มุมกล้อง:\n';
                    }
                    prompt += `  มุมที่ ${i}: ${getCameraAngleText(angleElem.value)}\n`;
                }
                
                if (movementElem && movementElem.value) {
                    if (!prompt.includes('🎬 การเคลื่อนกล้อง:')) {
                        prompt += '🎬 การเคลื่อนกล้อง:\n';
                    }
                    prompt += `  ช็อตที่ ${i}: ${getCameraMovementText(movementElem.value)}\n`;
                }
            }
        }
        */
        
        /* โค้ดเดิมที่ comment out
        if (cameraAngleItems.length > 0) {
            let hasAngles = false;
            let hasMovements = false;
            let anglePrompt = '📷 มุมกล้อง:\n';
            let movementPrompt = '🎬 การเคลื่อนกล้อง:\n';
            
            cameraAngleItems.forEach((item, index) => {
                const angleSelect = item.querySelector('[id^="cameraAngle"]');
                const movementSelect = item.querySelector('[id^="cameraMovement"]');
                
                console.log(`มุมที่ ${index + 1}:`, {
                    angleSelect: angleSelect ? angleSelect.id : 'ไม่เจอ',
                    angleValue: angleSelect ? angleSelect.value : 'ไม่มีค่า',
                    movementSelect: movementSelect ? movementSelect.id : 'ไม่เจอ',
                    movementValue: movementSelect ? movementSelect.value : 'ไม่มีค่า'
                });
                
                if (angleSelect && angleSelect.value) {
                    hasAngles = true;
                    anglePrompt += `  มุมที่ ${index + 1}: ${getCameraAngleText(angleSelect.value)}\n`;
                }
                
                if (movementSelect && movementSelect.value) {
                    hasMovements = true;
                    movementPrompt += `  ช็อตที่ ${index + 1}: ${getCameraMovementText(movementSelect.value)}\n`;
                }
            });
            
            console.log('มีมุมกล้อง:', hasAngles);
            console.log('มีการเคลื่อนกล้อง:', hasMovements);
            
            if (hasAngles) {
                prompt += anglePrompt;
            }
            if (hasMovements) {
                prompt += movementPrompt;
            }
        }
        */
        
        if (timeOfDay) prompt += `🌅 แสง/เวลา: ${timeOfDay}\n`;
        if (visualStyle) prompt += `🎨 สไตล์: ${visualStyle}\n`;
        if (mood) prompt += `😊 อารมณ์: ${mood}\n`;
        if (soundType) prompt += `🔊 เสียง: ${soundType}\n`;
        if (duration) prompt += `⏱️ ความยาว: ${duration}\n`;
        
        prompt += `\n👥 จำนวนตัวละคร: ${templateCharCount} คน\n`;

        // Debug - ตรวจสอบค่าตัวละคร
console.log('=== ตรวจสอบข้อมูลตัวละคร ===');
console.log('จำนวนตัวละคร:', templateCharCount);

// ตรวจสอบค่าในแต่ละช่อง
for (let i = 1; i <= templateCharCount; i++) {
    const charInput = document.getElementById(`char${i}`);
    if (charInput) {
        console.log(`ช่องที่ ${i} มีข้อมูล:`, charInput.value ? 'มี' : 'ไม่มี');
        if (charInput.value) {
            console.log(`ข้อมูล: ${charInput.value.substring(0, 50)}...`);
        }
    } else {
        console.log(`ช่องที่ ${i}: ไม่พบ element`);
    }
}
        
        // Characters
        prompt += 'รายละเอียดตัวละคร:\n';
        // DEBUG - พิมพ์ค่าออกมาดู
console.log('=== DEBUG Character Values ===');
for (let i = 1; i <= templateCharCount; i++) {
    const charInput = document.getElementById(`char${i}`);
    console.log(`Character ${i}:`, {
        element: charInput ? 'Found' : 'Not Found',
        hasValue: charInput?.value ? 'Yes' : 'No',
        value: charInput?.value?.substring(0, 100) || 'Empty'
    });
}
console.log('===========================');
        for (let i = 1; i <= templateCharCount; i++) {
            const charInput = document.getElementById(`char${i}`);
            if (charInput && charInput.value) {
                prompt += `${i}. ${charInput.value}\n`;
            } else {
                prompt += `${i}. (ให้ AI สร้างให้เหมาะกับฉาก)\n`;
            }
        }
        
        // Effects
        const effects = [];
        document.querySelectorAll('.effects-checkboxes input:checked').forEach(cb => {
            const label = cb.nextElementSibling;
            if (label) {
                effects.push(label.textContent.trim());
            }
        });
        if (effects.length > 0) {
            prompt += `\n✨ Effects: ${effects.join(', ')}\n`;
        }
        
        if (dialogue) prompt += `\n💬 บทพูด:\n${dialogue}\n`;
        
        if (additionalDetails) prompt += `\n📝 รายละเอียดเพิ่มเติม: ${additionalDetails}\n`;
        
        prompt += '\n⚠️ สำคัญ: ต้องมี setting ละเอียด, ตัวละครชัดเจน, timing แม่นยำ, camera angles, audio layers และเอาท์พุตเป็นภาษาอังกฤษ';
    }
    
    // Insert prompt and close modal
    document.getElementById('messageInput').value = prompt;
    
    console.log('=== Final Prompt Generated ===');
    console.log(prompt);
    console.log('=== End of Prompt ===');
    
    closeTemplateForm();
    
    // Auto resize textarea
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    
    // Scroll to input
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    showNotification('📋 Template applied! กด "สร้าง Prompt" เพื่อดำเนินการ', 'success');
}

// Helper functions to get Thai text
function getVideoTypeText(type) {
    const types = {
        'cinematic': 'ภาพยนตร์ คุณภาพสูง',
        'documentary': 'สารคดี สมจริง',
        'commercial': 'โฆษณา น่าสนใจ',
        'musicvideo': 'มิวสิควิดีโอ',
        'action': 'แอ็คชั่นมันส์ๆ',
        'drama': 'ดราม่า อารมณ์',
        'horror': 'สยองขวัญ น่ากลัว',
        'comedy': 'ตลกขำขัน',
        'travel': 'ท่องเที่ยว',
        'nature': 'ธรรมชาติ'
    };
    return types[type] || type;
}

function getCameraAngleText(angle) {
    const angles = {
        'wide': 'Wide Shot - เห็นภาพรวม',
        'medium': 'Medium Shot - ระยะกลาง',
        'closeup': 'Close-up - ใกล้',
        'extreme-closeup': 'Extreme Close-up - ใกล้มาก',
        'aerial': 'Aerial/Drone - มุมสูง',
        'low-angle': 'Low Angle - มุมต่ำ',
        'dutch': 'Dutch Angle - มุมเอียง',
        'pov': 'POV - มุมมองบุคคลที่ 1',
        'tracking': 'Tracking Shot - กล้องตาม',
        'handheld': 'Handheld - ถือกล้อง'
    };
    return angles[angle] || angle;
}

function getTimeOfDayText(time) {
    const times = {
        'golden-hour': 'Golden Hour - แสงทอง',
        'blue-hour': 'Blue Hour - แสงน้ำเงิน',
        'sunrise': 'พระอาทิตย์ขึ้น',
        'sunset': 'พระอาทิตย์ตก',
        'midday': 'กลางวันแสงจ้า',
        'night': 'กลางคืน',
        'overcast': 'มืดครึ้ม',
        'studio': 'แสงสตูดิโอ'
    };
    return times[time] || time;
}

function getVisualStyleText(style) {
    const styles = {
        'realistic': 'สมจริง',
        'cinematic': 'สไตล์ภาพยนตร์',
        'vintage': 'ย้อนยุค',
        'modern': 'โมเดิร์น',
        'noir': 'Film Noir ขาวดำ',
        'vibrant': 'สีสดใส',
        'desaturated': 'สีจืด',
        'warm': 'โทนอุ่น',
        'cold': 'โทนเย็น'
    };
    return styles[style] || style;
}

function getSceneTypeText(type) {
    const types = {
        'dialogue': 'ฉากสนทนา',
        'action': 'ฉากแอ็คชั่น',
        'emotional': 'ฉากอารมณ์',
        'meeting': 'การประชุม/สัมภาษณ์',
        'party': 'งานปาร์ตี้',
        'dining': 'ฉากรับประทานอาหาร'
    };
    return types[type] || type;
}

function getCameraMovementText(movement) {
    const movements = {
        'static': 'กล้องนิ่ง',
        'pan': 'Pan - หมุนซ้าย-ขวา',
        'tilt': 'Tilt - หมุนบน-ล่าง',
        'dolly': 'Dolly - เคลื่อนเข้า-ออก',
        'tracking': 'Tracking - กล้องตาม',
        'handheld': 'Handheld - ถือกล้อง',
        'steadicam': 'Steadicam - นิ่มนวล',
        'drone': 'โดรน',
        '360': 'มุม 360 องศา',
        'crane': 'เครน/บูม',
        'whip-pan': 'หมุนเร็วมาก',
        'zoom': 'ซูมเข้า-ออก',
        'rack-focus': 'เปลี่ยนโฟกัส',
        'gimbal': 'กิมบอล',
        'slider': 'สไลเดอร์',
        'orbit': 'โคจรรอบ',
        'reveal': 'เปิดเผย',
        'push-in': 'ดันเข้า',
        'pull-out': 'ดึงออก'
    };
    return movements[movement] || movement;
}

function getMoodText(mood) {
    const moods = {
        'happy': 'สดใส ร่าเริง',
        'sad': 'เศร้า อารมณ์ลง',
        'serious': 'จริงจัง เคร่งเครียด',
        'romantic': 'โรแมนติก อบอุ่น',
        'mysterious': 'ลึกลับ น่าค้นหา',
        'energetic': 'กระฉับกระเฉง มีพลัง',
        'calm': 'สงบ ผ่อนคลาย',
        'tense': 'ตึงเครียด กดดัน',
        'nostalgic': 'คิดถึงอดีต ย้อนความหลัง'
    };
    return moods[mood] || mood;
}

function getSoundTypeText(soundType) {
    const sounds = {
        'dialogue': 'บทพูด',
        'music': 'ดนตรีประกอบ',
        'ambient': 'เสียงบรรยากาศ',
        'sfx': 'เอฟเฟกต์เสียง',
        'silent': 'ไม่มีเสียง',
        'natural': 'เสียงธรรมชาติ',
        'dramatic-music': 'ดนตรีดราม่า',
        'upbeat-music': 'ดนตรีสนุกสนาน'
    };
    return sounds[soundType] || soundType;
}

// Update switchMode to show/hide template button
const originalSwitchMode3 = window.switchMode;
window.switchMode = function(mode) {
    originalSwitchMode3(mode);
    updateTemplateButton();
};

// Function to update form fields based on character type
function updateCharacterFormFields() {
    const charType = document.getElementById('charType').value;
    const genderLabel = document.getElementById('genderLabel');
    const genderSelect = document.getElementById('charGender');
    const ethnicityGroup = document.getElementById('ethnicityGroup');
    const speciesGroup = document.getElementById('speciesGroup');
    
    // Reset all fields visibility
    ethnicityGroup.style.display = 'block';
    speciesGroup.style.display = 'none';
    
    // Update based on character type
    if (charType === 'animal') {
        // For animals
        genderLabel.textContent = 'เพศ:';
        genderSelect.innerHTML = `
            <option value="">-- เลือกเพศ --</option>
            <option value="Male">ตัวผู้</option>
            <option value="Female">ตัวเมีย</option>
            <option value="Unknown">ไม่ระบุ</option>
        `;
        ethnicityGroup.style.display = 'none';
        speciesGroup.style.display = 'block';
    } else if (charType === 'robot' || charType === 'creature') {
        // For robots and creatures
        genderLabel.textContent = 'ลักษณะเพศ:';
        genderSelect.innerHTML = `
            <option value="">-- เลือกลักษณะ --</option>
            <option value="Masculine">ลักษณะผู้ชาย</option>
            <option value="Feminine">ลักษณะผู้หญิง</option>
            <option value="Neutral">กลาง/ไม่มีเพศ</option>
        `;
        ethnicityGroup.style.display = 'none';
        speciesGroup.style.display = 'block';
    } else if (charType === 'cartoon') {
        // For cartoons
        genderLabel.textContent = 'เพศ:';
        genderSelect.innerHTML = `
            <option value="">-- เลือกเพศ --</option>
            <option value="Male">ชาย</option>
            <option value="Female">หญิง</option>
            <option value="Non-binary">ไม่ระบุ</option>
        `;
        ethnicityGroup.style.display = 'none';
        speciesGroup.style.display = 'block';
    } else {
        // Default (human)
        genderLabel.textContent = 'เพศ:';
        genderSelect.innerHTML = `
            <option value="">-- เลือกเพศ --</option>
            <option value="Male">ชาย</option>
            <option value="Female">หญิง</option>
            <option value="Non-binary">ไม่ระบุ</option>
        `;
        ethnicityGroup.style.display = 'block';
        speciesGroup.style.display = 'none';
    }
}

// Export functions
window.showTemplateForm = showTemplateForm;
window.closeTemplateForm = closeTemplateForm;
window.setTemplateCharCount = setTemplateCharCount;
window.generateFromTemplate = generateFromTemplate;
window.closeTemplateFormOnOutsideClick = closeTemplateFormOnOutsideClick;
window.toggleFieldVoice = toggleFieldVoice;
window.stopFieldVoice = stopFieldVoice;
window.updateCharacterFormFields = updateCharacterFormFields;

// Show current account token
function showMyToken() {
    const linkedAccount = localStorage.getItem('linkedAccount');
    if (!linkedAccount) {
        alert('❌ ไม่พบข้อมูลบัญชี');
        return;
    }
    
    try {
        const account = JSON.parse(linkedAccount);
        const loginToken = btoa(JSON.stringify({
            username: account.username,
            hashedPassword: account.hashedPassword,
            userId: account.userId,
            createdAt: account.createdAt
        }));
        
        // สร้าง modal แสดง token
        const tokenModal = document.createElement('div');
        tokenModal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            border: 2px solid var(--primary);
            border-radius: 12px;
            padding: 30px;
            z-index: 10001;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 10px 50px rgba(0,0,0,0.5);
        `;
        
        tokenModal.innerHTML = `
            <h3 style="color: var(--primary); margin: 0 0 15px 0;">🔑 Login Token ของคุณ</h3>
            <p style="color: #888; margin-bottom: 15px;">Username: <strong style="color: white;">${account.username}</strong></p>
            <textarea id="myTokenTextarea" style="
                width: 100%;
                height: 100px;
                padding: 10px;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 8px;
                color: white;
                font-family: monospace;
                font-size: 12px;
                resize: none;
                margin-bottom: 15px;
            " readonly>${loginToken}</textarea>
            <div style="display: flex; gap: 10px;">
                <button onclick="
                    document.getElementById('myTokenTextarea').select();
                    document.execCommand('copy');
                    this.textContent = '✅ Copied!';
                    setTimeout(() => this.textContent = '📋 Copy Token', 2000);
                " style="
                    flex: 1;
                    padding: 10px;
                    background: var(--primary);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: 'Kanit', sans-serif;
                ">📋 Copy Token</button>
                <button onclick="
                    this.parentElement.parentElement.remove();
                    document.getElementById('myTokenModalOverlay').remove();
                " style="
                    flex: 1;
                    padding: 10px;
                    background: #444;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: 'Kanit', sans-serif;
                ">ปิด</button>
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 15px; margin-bottom: 0;">
                💡 ใช้ token นี้เพื่อ login ในอุปกรณ์อื่น หรือ login ด้วย Username/Password ก็ได้
            </p>
        `;
        
        const overlay = document.createElement('div');
        overlay.id = 'myTokenModalOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(tokenModal);
        
        // Auto select text
        document.getElementById('myTokenTextarea').select();
        
    } catch (error) {
        console.error('Show token error:', error);
        alert('❌ เกิดข้อผิดพลาด');
    }
}

window.showMyToken = showMyToken;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    updateTemplateButton();
});

// ========== LOGIN SYSTEM FUNCTIONS ==========

// Show error message in login modal
function showLoginError(message) {
    const errorDiv = document.getElementById('loginErrorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// Show error message in link account form
function showLinkError(message) {
    const errorDiv = document.getElementById('linkErrorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        document.getElementById('linkSuccessMessage').style.display = 'none';
    }
}

// Show success message in link account form
function showLinkSuccess(message) {
    const successDiv = document.getElementById('linkSuccessMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        document.getElementById('linkErrorMessage').style.display = 'none';
    }
}

// Show login modal
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    const currentUser = ensureUserId(); // ใช้ ensureUserId() แทน getUserId()
    
    // Update current user ID display
    document.getElementById('currentUserIdDisplay').textContent = currentUser;
    
    // Check if already logged in
    const linkedAccount = localStorage.getItem('linkedAccount');
    if (linkedAccount) {
        const account = JSON.parse(linkedAccount);
        showLoggedInView(account);
    } else {
        showLoginForm();
    }
    
    modal.style.display = 'flex';
}

// Close login modal
function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// Show login form
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('linkAccountForm').style.display = 'none';
    document.getElementById('loggedInView').style.display = 'none';
    // Clear error messages
    const errorDiv = document.getElementById('loginErrorMessage');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
}

// Show link account form
function showLinkAccountForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('linkAccountForm').style.display = 'block';
    document.getElementById('loggedInView').style.display = 'none';
    
    // Clear error/success messages
    const errorDiv = document.getElementById('linkErrorMessage');
    const successDiv = document.getElementById('linkSuccessMessage');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
    if (successDiv) {
        successDiv.style.display = 'none';
        successDiv.textContent = '';
    }
    
    // Pre-fill current user ID
    const currentUser = ensureUserId();
    document.getElementById('currentUserIdDisplay').textContent = currentUser;
    document.getElementById('linkUserId').value = currentUser;
}

// Show logged in view
function showLoggedInView(account) {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('linkAccountForm').style.display = 'none';
    document.getElementById('loggedInView').style.display = 'block';
    
    document.getElementById('loggedInUsername').textContent = account.username;
    document.getElementById('loggedInUserId').textContent = account.userId;
    
    // Get credits from localStorage
    const credits = parseFloat(localStorage.getItem('totalCredits') || '0');
    document.getElementById('loggedInCredits').textContent = credits.toFixed(2);
}

// Simple hash function (for demo - should use proper hashing in production)
async function simpleHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Link account
async function linkAccount() {
    const userId = document.getElementById('linkUserId').value.trim();
    const username = document.getElementById('newUsername').value.trim().toLowerCase();
    const password = document.getElementById('newPassword').value;
    
    // Validation
    if (!userId || userId.length < 5) {
        showLinkError('❌ User ID ไม่ถูกต้อง');
        return;
    }
    
    if (!username || username.length < 3) {
        showLinkError('❌ Username ต้องมีอย่างน้อย 3 ตัวอักษร');
        return;
    }
    
    if (!/^[a-z0-9_]+$/.test(username)) {
        showLinkError('❌ Username ใช้ได้เฉพาะ a-z, 0-9, _ เท่านั้น');
        return;
    }
    
    if (!password || password.length < 6) {
        showLinkError('❌ Password ต้องมีอย่างน้อย 6 ตัว');
        return;
    }
    
    try {
        showLinkSuccess('🔄 กำลังผูกบัญชี...');
        
        // Hash password
        const hashedPassword = await simpleHash(password);
        
        // First check in localStorage for existing accounts
        const existingAccounts = JSON.parse(localStorage.getItem('localAccounts') || '{}');
        if (existingAccounts[username]) {
            showLinkError('❌ Username นี้ถูกใช้แล้ว');
            return;
        }
        
        // For now, only check local storage
        // ในอนาคตสามารถเพิ่ม backend API ได้
        
        // Save to localStorage first
        const account = {
            username: username,
            userId: userId,
            hashedPassword: hashedPassword,
            createdAt: new Date().toISOString()
        };
        
        // Save account mapping locally
        existingAccounts[username] = {
            userId: userId,
            createdAt: account.createdAt
        };
        localStorage.setItem('localAccounts', JSON.stringify(existingAccounts));
        
        // Save user data locally
        const currentCredits = parseFloat(localStorage.getItem('totalCredits') || '0');
        const userData = {
            linkedAccount: account,
            credits: currentCredits,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(`userData_${userId}`, JSON.stringify(userData));
        
        // Save linked account info
        localStorage.setItem('linkedAccount', JSON.stringify(account));
        
        // สร้าง login token สำหรับใช้ข้าม browser
        const loginToken = btoa(JSON.stringify({
            username: username,
            hashedPassword: hashedPassword,
            userId: userId,
            createdAt: account.createdAt
        }));
        
        // แสดงผลสำเร็จ
        showLinkSuccess('✅ ผูกบัญชีสำเร็จ!');
        
        // สร้าง modal แสดง token ที่ copy ได้
        setTimeout(() => {
            const tokenModal = document.createElement('div');
            tokenModal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1a1a1a;
                border: 2px solid var(--primary);
                border-radius: 12px;
                padding: 30px;
                z-index: 10001;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 50px rgba(0,0,0,0.5);
            `;
            
            tokenModal.innerHTML = `
                <h3 style="color: var(--primary); margin: 0 0 15px 0;">🔑 Login Token สำเร็จ!</h3>
                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; border-radius: 8px; padding: 12px; margin-bottom: 15px;">
                    <p style="margin: 0 0 8px 0; color: #3b82f6; font-size: 13px; font-weight: bold;">✨ Token นี้ช่วยให้คุณ:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #aaa; font-size: 12px; line-height: 1.5;">
                        <li>Login ได้ทุกอุปกรณ์ด้วย Token เดียว</li>
                        <li>ไม่ต้องจำ Username/Password</li>
                        <li>Sync เครดิตและตัวละครอัตโนมัติ</li>
                    </ul>
                </div>
                <p style="color: #888; margin-bottom: 15px; font-size: 13px;">Copy token ด้านล่างเพื่อใช้ login ในอุปกรณ์อื่น:</p>
                <textarea id="tokenTextarea" style="
                    width: 100%;
                    height: 100px;
                    padding: 10px;
                    background: #2a2a2a;
                    border: 1px solid #444;
                    border-radius: 8px;
                    color: white;
                    font-family: monospace;
                    font-size: 12px;
                    resize: none;
                    margin-bottom: 15px;
                " readonly>${loginToken}</textarea>
                <div style="display: flex; gap: 10px;">
                    <button onclick="
                        document.getElementById('tokenTextarea').select();
                        document.execCommand('copy');
                        this.textContent = '✅ Copied!';
                        setTimeout(() => this.textContent = '📋 Copy Token', 2000);
                    " style="
                        flex: 1;
                        padding: 10px;
                        background: var(--primary);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-family: 'Kanit', sans-serif;
                    ">📋 Copy Token</button>
                    <button onclick="
                        this.parentElement.parentElement.remove();
                        document.getElementById('tokenModalOverlay').remove();
                    " style="
                        flex: 1;
                        padding: 10px;
                        background: #444;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-family: 'Kanit', sans-serif;
                    ">ปิด</button>
                </div>
                <p style="color: #666; font-size: 12px; margin-top: 15px; margin-bottom: 0;">
                    💡 วิธีใช้: วาง token ในช่อง Username แล้วกด Login (ไม่ต้องใส่ Password)
                </p>
            `;
            
            const overlay = document.createElement('div');
            overlay.id = 'tokenModalOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                z-index: 10000;
            `;
            
            document.body.appendChild(overlay);
            document.body.appendChild(tokenModal);
            
            // Auto select text
            document.getElementById('tokenTextarea').select();
            
            showLoggedInView(account);
        }, 1000);
        
    } catch (error) {
        console.error('Link account error:', error);
        showLinkError('❌ เกิดข้อผิดพลาด: ' + error.message);
    }
}

// Login
async function doLogin() {
    let username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    // ตรวจสอบว่าเป็น token หรือไม่ (token จะยาวกว่า 50 ตัวอักษร)
    const isToken = username.length > 50 && !password;
    
    if (!username) {
        showLoginError('❌ กรุณากรอก Username หรือ Token');
        return;
    }
    
    if (!isToken && !password) {
        showLoginError('❌ กรุณากรอก Password');
        return;
    }
    
    // ถ้าไม่ใช่ token ให้ lowercase username
    if (!isToken) {
        username = username.toLowerCase();
    }
    
    try {
        // Clear any previous errors
        const errorDiv = document.getElementById('loginErrorMessage');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        
        // First check localStorage
        const localAccounts = JSON.parse(localStorage.getItem('localAccounts') || '{}');
        let accountData = null;
        
        if (!isToken && localAccounts[username]) {
            accountData = {
                userId: localAccounts[username].userId,
                hashedPassword: null // Will get from userData
            };
        }
        
        // ตรวจสอบว่าเป็น token login หรือไม่
        if (isToken) {
            try {
                const tokenData = JSON.parse(atob(username));
                if (tokenData.username && tokenData.hashedPassword && tokenData.userId) {
                    // Import account from token
                    accountData = tokenData;
                    
                    // Save to local storage
                    localAccounts[tokenData.username] = {
                        userId: tokenData.userId,
                        createdAt: tokenData.createdAt
                    };
                    localStorage.setItem('localAccounts', JSON.stringify(localAccounts));
                    
                    const userData = {
                        linkedAccount: tokenData,
                        credits: 0
                    };
                    localStorage.setItem(`userData_${tokenData.userId}`, JSON.stringify(userData));
                    
                    // Auto login with token
                    localStorage.setItem('userId', tokenData.userId);
                    localStorage.setItem('linkedAccount', JSON.stringify(tokenData));
                    
                    // แสดงข้อความสำเร็จด้วยสีเขียว
                    const errorDiv = document.getElementById('loginErrorMessage');
                    if (errorDiv) {
                        errorDiv.textContent = '✅ Login ด้วย token สำเร็จ! กำลังรีเฟรช...';
                        errorDiv.style.display = 'block';
                        errorDiv.style.background = 'rgba(34, 197, 94, 0.1)';
                        errorDiv.style.border = '1px solid #22c55e';
                        errorDiv.style.color = '#22c55e';
                    }
                    setTimeout(() => {
                        location.reload();
                    }, 1500);
                    return;
                }
            } catch (e) {
                showLoginError('❌ Token ไม่ถูกต้อง');
                return;
            }
        }
        
        if (!accountData) {
            showLoginError('❌ ไม่พบ username นี้');
            return;
        }
        
        // Get user data - first try localStorage
        let userData = null;
        const userId = accountData.userId;
        const localUserData = localStorage.getItem(`userData_${userId}`);
        
        if (localUserData) {
            userData = JSON.parse(localUserData);
        }
        
        // Verify password
        const hashedPassword = await simpleHash(password);
        let passwordValid = false;
        
        // Check password from multiple sources
        // 1. Check if accountData has hashedPassword (from token login)
        if (accountData.hashedPassword) {
            if (hashedPassword === accountData.hashedPassword) {
                passwordValid = true;
            }
        } 
        // 2. Check from userData linkedAccount
        else if (userData && userData.linkedAccount && userData.linkedAccount.hashedPassword) {
            if (hashedPassword === userData.linkedAccount.hashedPassword) {
                passwordValid = true;
                // Set hashedPassword for consistency
                accountData.hashedPassword = userData.linkedAccount.hashedPassword;
            }
        }
        
        if (!passwordValid) {
            if (!accountData.hashedPassword && (!userData || !userData.linkedAccount)) {
                showLoginError('❌ ข้อมูลบัญชีไม่ถูกต้อง');
            } else {
                showLoginError('❌ รหัสผ่านไม่ถูกต้อง');
            }
            return;
        }
        
        // Login successful - save original userId before switching
        const currentUserId = localStorage.getItem('userId');
        if (!localStorage.getItem('originalUserId')) {
            localStorage.setItem('originalUserId', currentUserId);
        }
        
        // Switch to logged in user
        localStorage.setItem('userId', userId);
        
        // Sync credits from cloud
        if (accountData.credits !== undefined) {
            localStorage.setItem('totalCredits', accountData.credits.toString());
        } else if (userData && userData.credits !== undefined) {
            localStorage.setItem('totalCredits', userData.credits.toString());
        }
        
        // Save login info
        const account = {
            username: username,
            userId: userId,
            hashedPassword: hashedPassword
        };
        localStorage.setItem('linkedAccount', JSON.stringify(account));
        
        // Login successful - no need to show success message as we're redirecting
        showLoggedInView(account);
        
        // Refresh page to update UI
        setTimeout(() => {
            location.reload();
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('❌ เกิดข้อผิดพลาด: ' + error.message);
    }
}

// Logout
function doLogout() {
    // Get current userId before logout
    const currentUserId = localStorage.getItem('userId');
    
    // Get the original userId (before any login) to restore it
    let originalUserId = localStorage.getItem('originalUserId');
    
    // Important: If no originalUserId saved, we cannot properly logout
    // This means user logged in before we implemented originalUserId tracking
    if (!originalUserId) {
        console.warn('No originalUserId found - generating new guest user');
        // Generate new guest user as fallback
        originalUserId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('originalUserId', originalUserId);
    }
    
    // Clear linked account
    localStorage.removeItem('linkedAccount');
    
    // Restore to original guest userId (NOT generate new one)
    localStorage.setItem('userId', originalUserId);
    userId = originalUserId;
    
    // Log for debugging
    console.log('Logout - Restored to original userId:', originalUserId);
    
    // Check if new day for free credits reset
    const today = new Date().toDateString();
    const lastResetDate = localStorage.getItem(`freeCreditsResetDate_${originalUserId}`);
    
    let usedFreeCredits = parseFloat(localStorage.getItem(`usedFreeCredits_${originalUserId}`) || '0');
    
    // Reset if new day
    if (lastResetDate !== today) {
        usedFreeCredits = 0;
        localStorage.setItem(`usedFreeCredits_${originalUserId}`, '0');
        localStorage.setItem(`freeCreditsResetDate_${originalUserId}`, today);
    }
    
    const remainingFreeCredits = Math.max(0, 5 - usedFreeCredits);
    
    // Set credits to remaining free credits for today
    localStorage.setItem('totalCredits', remainingFreeCredits.toString());
    
    // Clear user-specific purchased credits data
    localStorage.removeItem(`userData_${currentUserId}`);
    
    // Clear character library
    characterLibrary = [];
    
    // Update UI
    updateCreditsDisplay();
    updateUserId();
    
    showNotification('👋 ออกจากระบบแล้ว', 'info');
    closeLoginModal();
    
    // Refresh page to reset everything
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// Sync credits to cloud
async function syncCreditsToCloud() {
    const linkedAccount = localStorage.getItem('linkedAccount');
    if (!linkedAccount) return; // Not logged in
    
    try {
        const account = JSON.parse(linkedAccount);
        const currentCredits = parseFloat(localStorage.getItem('totalCredits') || '0');
        
        // Update credits in Firebase
        await fetch(`${window.FIREBASE_DATABASE_URL}/users/${account.userId}/credits.json`, {
            method: 'PUT',
            body: JSON.stringify(currentCredits)
        });
    } catch (error) {
        console.error('Sync credits error:', error);
    }
}

// Update cloud credits function
async function updateCloudCredits(userId, credits) {
    try {
        const response = await fetch(`${window.FIREBASE_DATABASE_URL}/users/${userId}/credits.json`, {
            method: 'PUT',
            body: JSON.stringify(credits)
        });
        
        if (!response.ok) {
            console.error('Failed to update cloud credits');
        } else {
            console.log('Cloud credits updated successfully:', credits);
        }
    } catch (error) {
        console.error('Error updating cloud credits:', error);
    }
}

// Export functions
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.showLoginForm = showLoginForm;
window.showLinkAccountForm = showLinkAccountForm;
window.linkAccount = linkAccount;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.syncCreditsToCloud = syncCreditsToCloud;

// Voice input for individual fields
let fieldRecognition = null;
let currentFieldId = null;

function toggleFieldVoice(fieldId) {
    const micBtn = document.querySelector(`[data-field="${fieldId}"]`);
    
    if (micBtn.classList.contains('listening')) {
        stopFieldVoice();
    } else {
        startFieldVoice(fieldId);
    }
}

function startFieldVoice(fieldId) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('เบราว์เซอร์ของคุณไม่รองรับการพูด');
        return;
    }
    
    // หยุดการฟังก่อนหน้า
    stopFieldVoice();
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    fieldRecognition = new SpeechRecognition();
    fieldRecognition.lang = 'th-TH';
    fieldRecognition.continuous = true;
    fieldRecognition.interimResults = true;
    
    currentFieldId = fieldId;
    const field = document.getElementById(fieldId);
    const micBtn = document.querySelector(`[data-field="${fieldId}"]`);
    
    micBtn.classList.add('listening');
    
    let finalTranscript = field.value || '';
    
    fieldRecognition.onresult = function(event) {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        field.value = finalTranscript + interimTranscript;
    };
    
    fieldRecognition.onerror = function(event) {
        console.error('Speech recognition error', event.error);
        stopFieldVoice();
    };
    
    fieldRecognition.onend = function() {
        micBtn.classList.remove('listening');
    };
    
    fieldRecognition.start();
}

function stopFieldVoice() {
    if (fieldRecognition) {
        fieldRecognition.stop();
        fieldRecognition = null;
    }
    
    // ลบ class listening จากทุกปุ่ม
    document.querySelectorAll('.mic-btn.listening').forEach(btn => {
        btn.classList.remove('listening');
    });
}

// หยุดการฟังเมื่อปิด modal
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('template-form-modal')) {
        stopFieldVoice();
    }
});

// ========== CHARACTER TEMPLATE SYSTEM ==========
// เพิ่มโค้ดนี้ที่ท้ายไฟล์ script.js

let characterTemplateData = {};

// ฟังก์ชันอัพเดทการแสดงปุ่ม Character Template
function updateCharacterTemplateButton() {
    const charTemplateSection = document.getElementById('characterTemplateButtonSection');
    
    if (charTemplateSection) {
        // แสดงเฉพาะในโหมด character
        if (currentMode === 'character') {
            charTemplateSection.style.display = 'inline-block';
        } else {
            charTemplateSection.style.display = 'none';
        }
    }
}

// Show Character Template Modal
function showCharacterTemplate() {
    document.getElementById('characterTemplateModal').style.display = 'flex';
    
    // Clear all fields - updated for 14 sections
    const fields = [
        // 1. Name/Role
        'charName', 'charNickname', 'charRole',
        // 2. Gender/Age/Ethnicity  
        'charGender', 'charAge', 'charEthnicity',
        // 3. Body/Skin
        'charBody', 'charHeightWeight', 'charSkin',
        // 4. Face
        'charFaceShape', 'charFaceFeatures',
        // 5. Eyes/Eyebrows
        'charEyes', 'charEyebrows',
        // 6. Lips
        'charLips',
        // 7. Hair
        'charHairStyle', 'charHairColor', 'charHairDetails',
        // 8. Outfit
        'charShirt', 'charBottoms', 'charOuterwear', 'charShoes', 'charFabric',
        // 9. Accessories
        'charHeadAccessories', 'charJewelry', 'charOtherAccessories',
        // 10. Personality
        'charPersonalityTraits', 'charConfidence', 'charCameraPresence',
        // 11. Starting Pose
        'charInitialPose', 'charBodyLanguage',
        // 12. Voice Tone
        'charVoicePitch', 'charSpeakingStyle', 'charAccent', 'charVoiceCharacteristics',
        // 13. Special Features
        'charUniqueTraits', 'charSpecialEffects',
        // 14. Visual Style
        'charRealismType'
    ];
    
    fields.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.value = '';
    });
}

// Close Character Template Modal
function closeCharacterTemplate() {
    const modal = document.getElementById('characterTemplateModal');
    modal.style.display = 'none';
    
    // Reset body overflow
    document.body.style.overflow = '';
    
    // Fix layout issues - force reflow
    setTimeout(() => {
        // Force browser to recalculate layout
        document.body.style.display = 'none';
        document.body.offsetHeight; // Trigger reflow
        document.body.style.display = '';
        
        // Reset chat interface styles
        const chatInterface = document.querySelector('.chat-interface');
        if (chatInterface) {
            chatInterface.style.position = '';
            chatInterface.style.zIndex = '';
            chatInterface.style.height = '';
            chatInterface.style.overflow = '';
        }
        
        // Reset chat messages container
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages) {
            chatMessages.style.height = '';
            chatMessages.style.overflow = '';
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }, 100);
}

// Generate Character Profile from Template
function generateFromCharacterTemplate() {
    // Get character type
    const charType = document.getElementById('charType')?.value || 'human';
    const species = document.getElementById('charSpecies')?.value || '';
    
    // Collect all data for 14 sections
    const data = {
        // Character Type
        type: charType,
        species: species,
        // 1. Name/Role
        name: document.getElementById('charName')?.value || '',
        nickname: document.getElementById('charNickname')?.value || '',
        role: document.getElementById('charRole')?.value || '',
        // 2. Gender/Age/Ethnicity
        gender: document.getElementById('charGender')?.value || '',
        age: document.getElementById('charAge')?.value || '',
        ethnicity: document.getElementById('charEthnicity')?.value || '',
        // 3. Body/Skin
        body: document.getElementById('charBody')?.value || '',
        heightWeight: document.getElementById('charHeightWeight')?.value || '',
        skin: document.getElementById('charSkin')?.value || '',
        // 4. Face
        faceShape: document.getElementById('charFaceShape')?.value || '',
        faceFeatures: document.getElementById('charFaceFeatures')?.value || '',
        // 5. Eyes/Eyebrows
        eyes: document.getElementById('charEyes')?.value || '',
        eyebrows: document.getElementById('charEyebrows')?.value || '',
        // 6. Lips
        lips: document.getElementById('charLips')?.value || '',
        // 7. Hair
        hairStyle: document.getElementById('charHairStyle')?.value || '',
        hairColor: document.getElementById('charHairColor')?.value || '',
        hairDetails: document.getElementById('charHairDetails')?.value || '',
        // 8. Outfit
        shirt: document.getElementById('charShirt')?.value || '',
        bottoms: document.getElementById('charBottoms')?.value || '',
        outerwear: document.getElementById('charOuterwear')?.value || '',
        shoes: document.getElementById('charShoes')?.value || '',
        fabric: document.getElementById('charFabric')?.value || '',
        // 9. Accessories
        headAccessories: document.getElementById('charHeadAccessories')?.value || '',
        jewelry: document.getElementById('charJewelry')?.value || '',
        otherAccessories: document.getElementById('charOtherAccessories')?.value || '',
        // 10. Personality
        personalityTraits: document.getElementById('charPersonalityTraits')?.value || '',
        confidence: document.getElementById('charConfidence')?.value || '',
        cameraPresence: document.getElementById('charCameraPresence')?.value || '',
        // 11. Starting Pose
        initialPose: document.getElementById('charInitialPose')?.value || '',
        bodyLanguage: document.getElementById('charBodyLanguage')?.value || '',
        // 12. Voice Tone
        voicePitch: document.getElementById('charVoicePitch')?.value || '',
        speakingStyle: document.getElementById('charSpeakingStyle')?.value || '',
        accent: document.getElementById('charAccent')?.value || '',
        voiceCharacteristics: document.getElementById('charVoiceCharacteristics')?.value || '',
        // 13. Special Features
        uniqueTraits: document.getElementById('charUniqueTraits')?.value || '',
        specialEffects: document.getElementById('charSpecialEffects')?.value || '',
        // 14. Visual Style
        realismType: document.getElementById('charRealismType')?.value || ''
    };
    
    // Store data for later use
    characterTemplateData = data;
    
    // Build character description using new 14-section format
    let characterTypeText = '';
    if (data.type === 'animal') {
        characterTypeText = `สัตว์ประเภท ${data.species || 'ไม่ระบุ'}`;
    } else if (data.type === 'cartoon') {
        characterTypeText = `ตัวการ์ตูน/แฟนตาซี ${data.species || ''}`;
    } else if (data.type === 'robot') {
        characterTypeText = `หุ่นยนต์/AI ${data.species || ''}`;
    } else if (data.type === 'creature') {
        characterTypeText = `สิ่งมีชีวิต ${data.species || ''}`;
    } else {
        characterTypeText = 'มนุษย์';
    }
    
    let prompt = `สร้าง Character Profile แบบละเอียดสำหรับ${characterTypeText} ตาม format 14 หัวข้อจากข้อมูลนี้:\n\n`;
    
    // 1. Name/Role
    if (data.name || data.nickname || data.role) {
        prompt += '👤 **1. ชื่อ / บทบาท (Name / Role)**\n';
        if (data.name) prompt += `* Name: ${data.name}\n`;
        if (data.nickname) prompt += `* Nickname: ${data.nickname}\n`;
        if (data.role) prompt += `* Role: ${data.role}\n`;
        prompt += '\n';
    }
    
    // 2. Gender/Age/Ethnicity or Species
    prompt += '🧑‍🎨 **2. ';
    if (data.type === 'human') {
        prompt += 'เพศ / อายุ / เชื้อชาติ (Gender / Age / Ethnicity)**\n';
        if (data.gender) prompt += `* Gender: ${data.gender}\n`;
        if (data.age) prompt += `* Age: ${data.age}\n`;
        if (data.ethnicity) prompt += `* Ethnicity: ${data.ethnicity}\n`;
    } else {
        prompt += `ประเภท / เพศ / อายุ (Type / Gender / Age)**\n`;
        prompt += `* Type: ${characterTypeText}\n`;
        if (data.species) prompt += `* Species: ${data.species}\n`;
        if (data.gender) prompt += `* Gender: ${data.gender}\n`;
        if (data.age) prompt += `* Age: ${data.age}\n`;
    }
    prompt += '\n';
    
    // 3. Body/Skin
    if (data.body || data.heightWeight || data.skin) {
        prompt += '💃 **3. รูปร่าง / ผิว (Body / Skin)**\n';
        if (data.body) prompt += `* Body type: ${data.body}\n`;
        if (data.heightWeight) prompt += `* Height & Weight: ${data.heightWeight}\n`;
        if (data.skin) prompt += `* Skin tone: ${data.skin}\n`;
        prompt += '\n';
    }
    
    // 4. Face
    if (data.faceShape || data.faceFeatures) {
        prompt += '👤 **4. ใบหน้า (Face)**\n';
        if (data.faceShape) prompt += `* Face shape: ${data.faceShape}\n`;
        if (data.faceFeatures) prompt += `* Face features: ${data.faceFeatures}\n`;
        prompt += '\n';
    }
    
    // 5. Eyes/Eyebrows
    if (data.eyes || data.eyebrows) {
        prompt += '👁️ **5. ดวงตา / คิ้ว (Eyes / Eyebrows)**\n';
        if (data.eyes) prompt += `* Eyes: ${data.eyes}\n`;
        if (data.eyebrows) prompt += `* Eyebrows: ${data.eyebrows}\n`;
        prompt += '\n';
    }
    
    // 6. Lips
    if (data.lips) {
        prompt += '👄 **6. ริมฝีปาก (Lips)**\n';
        prompt += `* Lips: ${data.lips}\n\n`;
    }
    
    // 7. Hair
    if (data.hairStyle || data.hairColor || data.hairDetails) {
        prompt += '💇‍♀️ **7. ผม (Hair)**\n';
        if (data.hairStyle) prompt += `* Hair style: ${data.hairStyle}\n`;
        if (data.hairColor) prompt += `* Hair color: ${data.hairColor}\n`;
        if (data.hairDetails) prompt += `* Hair details: ${data.hairDetails}\n`;
        prompt += '\n';
    }
    
    // 8. Outfit
    if (data.shirt || data.bottoms || data.outerwear || data.shoes || data.fabric) {
        prompt += '👗 **8. เครื่องแต่งกาย (Outfit)**\n';
        if (data.shirt) prompt += `* Top/Shirt: ${data.shirt}\n`;
        if (data.bottoms) prompt += `* Bottom/Pants/Skirt: ${data.bottoms}\n`;
        if (data.outerwear) prompt += `* Outerwear: ${data.outerwear}\n`;
        if (data.shoes) prompt += `* Shoes: ${data.shoes}\n`;
        if (data.fabric) prompt += `* Fabric/Material: ${data.fabric}\n`;
        prompt += '\n';
    }
    
    // 9. Accessories
    if (data.headAccessories || data.jewelry || data.otherAccessories) {
        prompt += '💎 **9. เครื่องประดับ (Accessories)**\n';
        if (data.headAccessories) prompt += `* Head accessories: ${data.headAccessories}\n`;
        if (data.jewelry) prompt += `* Jewelry: ${data.jewelry}\n`;
        if (data.otherAccessories) prompt += `* Other accessories: ${data.otherAccessories}\n`;
        prompt += '\n';
    }
    
    // 10. Personality
    if (data.personalityTraits || data.confidence || data.cameraPresence) {
        prompt += '🎭 **10. บุคลิกภาพ (Personality)**\n';
        if (data.personalityTraits) prompt += `* Personality traits: ${data.personalityTraits}\n`;
        if (data.confidence) prompt += `* Confidence level: ${data.confidence}\n`;
        if (data.cameraPresence) prompt += `* Camera presence: ${data.cameraPresence}\n`;
        prompt += '\n';
    }
    
    // 11. Starting Pose
    if (data.initialPose || data.bodyLanguage) {
        prompt += '🕴️ **11. ท่าทางเริ่มต้น (Starting Pose)**\n';
        if (data.initialPose) prompt += `* Initial pose: ${data.initialPose}\n`;
        if (data.bodyLanguage) prompt += `* Body language: ${data.bodyLanguage}\n`;
        prompt += '\n';
    }
    
    // 12. Voice Tone
    if (data.voicePitch || data.speakingStyle || data.accent || data.voiceCharacteristics) {
        prompt += '🎙️ **12. โทนเสียง (Voice Tone)**\n';
        if (data.voicePitch) prompt += `* Voice pitch: ${data.voicePitch}\n`;
        if (data.speakingStyle) prompt += `* Speaking style: ${data.speakingStyle}\n`;
        if (data.accent) prompt += `* Accent/Dialect: ${data.accent}\n`;
        if (data.voiceCharacteristics) prompt += `* Voice characteristics: ${data.voiceCharacteristics}\n`;
        prompt += '\n';
    }
    
    // 13. Special Features
    if (data.uniqueTraits || data.specialEffects) {
        prompt += '✨ **13. ลักษณะพิเศษ (Special Features)**\n';
        if (data.uniqueTraits) prompt += `* Unique traits: ${data.uniqueTraits}\n`;
        if (data.specialEffects) prompt += `* Special effects: ${data.specialEffects}\n`;
        prompt += '\n';
    }
    
    // 14. Visual Style
    if (data.realismType) {
        prompt += '🖼️ **14. ภาพความสมจริง (Visual Style)**\n';
        prompt += `* Realism type: ${data.realismType}\n\n`;
    }
    
    prompt += '⚠️ IMPORTANT: Generate the complete character profile in ENGLISH following the exact 14-section format above.';
    
    // Insert into message input
    document.getElementById('messageInput').value = prompt;
    
    // Close modal
    closeCharacterTemplate();
    
    // Auto resize textarea
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    
    // Show notification
    showNotification('📋 ข้อมูล Character พร้อมแล้ว! กด "สร้างตัวละคร" เพื่อสร้าง Profile', 'success');
}

// Export functions
window.showCharacterTemplate = showCharacterTemplate;
window.closeCharacterTemplate = closeCharacterTemplate;
window.generateFromCharacterTemplate = generateFromCharacterTemplate;
window.updateCharacterTemplateButton = updateCharacterTemplateButton;
window.saveEditedCharacter = saveEditedCharacter;
window.cancelEditCharacter = cancelEditCharacter;
window.confirmUpdateCharacter = confirmUpdateCharacter;
window.editCharacter = editCharacter;

// Override switchMode เพื่อเรียก updateCharacterTemplateButton
const originalSwitchModeForCharTemplate = window.switchMode;
window.switchMode = function(mode) {
    originalSwitchModeForCharTemplate(mode);
    updateTemplateButton();
    updateCharacterTemplateButton();
};

// เพิ่มการเรียกใช้เมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        updateCharacterTemplateButton();
    }, 100);
});

console.log('✅ Character Template System loaded!');

// ========== TEMPLATE BUTTON FIX ==========
// ฟังก์ชันตรวจสอบการแสดงปุ่ม
function verifyButtonVisibility() {
    const templateBtn = document.getElementById('templateButtonSection');
    const charTemplateBtn = document.getElementById('characterTemplateButtonSection');
    
    switch(currentMode) {
        case 'promptmaster':
        case 'multichar':
            // แสดงปุ่ม Template Form สีส้ม
            if (templateBtn) templateBtn.style.display = 'inline-block';
            // ซ่อนปุ่ม Character Template สีม่วง
            if (charTemplateBtn) charTemplateBtn.style.display = 'none';
            break;
            
        case 'character':
            // ซ่อนปุ่ม Template Form สีส้ม
            if (templateBtn) templateBtn.style.display = 'none';
            // แสดงปุ่ม Character Template สีม่วง
            if (charTemplateBtn) charTemplateBtn.style.display = 'inline-block';
            break;
            
        default:
            // ซ่อนทั้งสองปุ่มในโหมดอื่นๆ
            if (templateBtn) templateBtn.style.display = 'none';
            if (charTemplateBtn) charTemplateBtn.style.display = 'none';
            break;
    }
}

// เรียกใช้ทุกครั้งที่เปลี่ยนโหมด
const originalSwitchModeFixed = window.switchMode;
window.switchMode = function(mode) {
    originalSwitchModeFixed(mode);
    
    // เรียกตรวจสอบปุ่มหลังเปลี่ยนโหมด
    setTimeout(() => {
        verifyButtonVisibility();
    }, 50);
};

// เรียกตรวจสอบเมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        verifyButtonVisibility();
    }, 500);
});

console.log('✅ Template button visibility fix applied!');
// ========== END TEMPLATE BUTTON FIX ==========

// ========== FORCE HIDE TEMPLATE BUTTONS ==========
// สร้าง observer เพื่อเฝ้าดูการเปลี่ยนแปลง
const buttonObserver = new MutationObserver(function(mutations) {
    const templateBtn = document.getElementById('templateButtonSection');
    const charTemplateBtn = document.getElementById('characterTemplateButtonSection');
    
    if (!templateBtn || !charTemplateBtn) return;
    
    // ตรวจสอบโหมดปัจจุบันและซ่อน/แสดงปุ่มให้ถูกต้อง
    switch(currentMode) {
        case 'promptmaster':
        case 'multichar':
            templateBtn.style.display = 'inline-block';
            templateBtn.style.visibility = 'visible';
            charTemplateBtn.style.display = 'none';
            charTemplateBtn.style.visibility = 'hidden';
            break;
            
        case 'character':
            templateBtn.style.display = 'none';
            templateBtn.style.visibility = 'hidden';
            charTemplateBtn.style.display = 'inline-block';
            charTemplateBtn.style.visibility = 'visible';
            break;
            
        case 'chat':
        case 'image':
        case 'imagegen':
        case 'library':
            templateBtn.style.display = 'none';
            templateBtn.style.visibility = 'hidden';
            charTemplateBtn.style.display = 'none';
            charTemplateBtn.style.visibility = 'hidden';
            break;
    }
});

// เริ่ม observe เมื่อ DOM พร้อม
document.addEventListener('DOMContentLoaded', function() {
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) {
        buttonObserver.observe(uploadSection, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['style', 'class']
        });
    }
    
    // Force hide on load
    setTimeout(() => {
        const templateBtn = document.getElementById('templateButtonSection');
        const charTemplateBtn = document.getElementById('characterTemplateButtonSection');
        
        if (currentMode === 'chat' || currentMode === 'image' || currentMode === 'imagegen') {
            if (templateBtn) {
                templateBtn.style.display = 'none';
                templateBtn.style.visibility = 'hidden';
            }
            if (charTemplateBtn) {
                charTemplateBtn.style.display = 'none';
                charTemplateBtn.style.visibility = 'hidden';
            }
        }
    }, 1000);
});

// ========== END FORCE HIDE ==========

// ========== CHARACTER PICKER SYSTEM ==========
let currentCharacterFieldId = null;

// ฟังก์ชันเปิด Character Picker
function openCharacterPicker(fieldId) {
    currentCharacterFieldId = fieldId;
    
    // สร้าง modal
    const modal = document.createElement('div');
    modal.className = 'character-picker-modal';
    modal.innerHTML = `
        <div class="character-picker-content">
            <div class="picker-header">
                <h3>📚 เลือกตัวละครจาก Library</h3>
                <button class="close-btn" onclick="closeCharacterPicker()">✕</button>
            </div>
            
            <div class="picker-body">
                <div id="characterPickerList" class="character-picker-list">
                    <!-- รายการตัวละครจะแสดงที่นี่ -->
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // โหลดรายการตัวละคร
    loadCharacterPickerList();
}

// ฟังก์ชันโหลดรายการตัวละคร
function loadCharacterPickerList() {
    const listContainer = document.getElementById('characterPickerList');
    
    if (characterLibrary.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-picker">
                <p>ยังไม่มีตัวละครที่บันทึกไว้</p>
                <button onclick="closeCharacterPicker(); switchMode('character');" 
                        style="margin-top: 16px; padding: 8px 16px; background: var(--primary); 
                               color: white; border: none; border-radius: 8px; cursor: pointer;">
                    + สร้างตัวละครใหม่
                </button>
            </div>
        `;
        return;
    }
    
    // แสดงรายการตัวละคร
    listContainer.innerHTML = characterLibrary.map((char, index) => {
        // ดึงข้อมูลสรุปจาก profile
        const summary = extractCharacterSummary(char.profile || char.preview);
        
        return `
            <div class="character-picker-item" onclick="selectCharacterForField(${index})">
                <div class="picker-item-header">
                    <h4>${char.name}</h4>
                    <span class="select-indicator">เลือก</span>
                </div>
                <div class="picker-item-preview">
                    ${summary}
                </div>
            </div>
        `;
    }).join('');
}

// ฟังก์ชันดึงข้อมูลสรุปตัวละคร
function extractCharacterSummary(profile) {
    if (!profile) return 'ไม่มีข้อมูล';
    
    // พยายามดึงข้อมูลสำคัญ
    const lines = profile.split('\n');
    let summary = '';
    let foundInfo = false;
    
    for (let line of lines) {
        // หาข้อมูลเพศ อายุ การแต่งตัว
        if (line.includes('Gender:') || line.includes('Age:') || 
            line.includes('Appearance:') || line.includes('Clothing:') ||
            line.includes('เพศ:') || line.includes('อายุ:')) {
            summary += line.trim() + '<br>';
            foundInfo = true;
        }
        
        // ถ้าเจอข้อมูลพอแล้ว หยุด
        if (foundInfo && summary.length > 150) break;
    }
    
    return summary || profile.substring(0, 200) + '...';
}

// ฟังก์ชันเลือกตัวละครใส่ในช่อง
function selectCharacterForField(index) {
    const character = characterLibrary[index];
    const field = document.getElementById(currentCharacterFieldId);
    
    if (!field || !character) return;
    
    let cleanProfile = '';
    
    if (character.profile) {
        // ตรวจสอบว่าเป็น Scene Builder หรือ Template Form
        if (currentCharacterFieldId.startsWith('sceneChar')) {
            // Scene Builder - ใช้ข้อมูลสรุปสั้นๆ
            cleanProfile = extractCharacterSummary(character.profile);
        } else {
            // Template Form - ใช้ข้อมูลแบบละเอียด 14 ข้อ
            cleanProfile = extractMainCharacterInfo(character.profile);
        }
    } else {
        cleanProfile = character.preview || character.name;
    }
    
    // ใส่ข้อมูลในช่อง
    field.value = cleanProfile;

    // Trigger events เพื่อให้ preview อัพเดท
field.dispatchEvent(new Event('input', { bubbles: true }));
field.dispatchEvent(new Event('change', { bubbles: true }));

// Force update preview
setTimeout(() => {
    updateTemplatePreview();
    console.log('✅ Preview updated after character selection');
}, 100);
    
    // Trigger input event เพื่อให้ preview อัพเดท
    const event = new Event('input', { bubbles: true });
    field.dispatchEvent(event);
    
    // ถ้าเป็น Scene Builder
    if (currentCharacterFieldId.startsWith('sceneChar')) {
        const idx = parseInt(currentCharacterFieldId.replace('sceneChar', ''));
        sceneData.characters[idx] = cleanProfile;
    }
    
    // Force update preview
    if (typeof updateTemplatePreview === 'function') {
        setTimeout(() => {
            updateTemplatePreview();
        }, 100);
    }
    
    closeCharacterPicker();
    showNotification(`✅ เลือก "${character.name}" แล้ว!`, 'success');
}

// ฟังก์ชันดึงเฉพาะข้อมูล 8 หัวข้อหลัก
function extractMainCharacterInfo(profile) {
    if (!profile) return '';
    
    // หัวข้อที่ต้องการเก็บ - รองรับทั้ง 17 ข้อ (รวมมุมกล้อง)
    const wantedSections = [
        { emoji: '👤', number: '1.', keywords: ['nickname', 'role', 'ชื่อ', 'บทบาท'] },
        { emoji: '🧑‍🎨', number: '2.', keywords: ['gender', 'age', 'ethnicity', 'เพศ', 'อายุ', 'เชื้อชาติ'] },
        { emoji: '💃', number: '3.', keywords: ['body', 'skin', 'posture', 'รูปร่าง', 'ผิว'] },
        { emoji: '👁️', number: '4.', keywords: ['face', 'eyes', 'หน้าตา', 'ดวงตา'] },
        { emoji: '👄', number: '5.', keywords: ['mouth', 'lips', 'smile', 'ปาก', 'ริมฝีปาก'] },
        { emoji: '👃', number: '6.', keywords: ['nose', 'จมูก'] },
        { emoji: '💇‍♀️', number: '7.', keywords: ['hair', 'ผม', 'ทรงผม'] },
        { emoji: '👗', number: '8.', keywords: ['clothing', 'shirt', 'outfit', 'เครื่องแต่งกาย', 'เสื้อ'] },
        { emoji: '👖', number: '9.', keywords: ['pants', 'shorts', 'skirt', 'กางเกง', 'กระโปรง'] },
        { emoji: '👟', number: '10.', keywords: ['shoes', 'footwear', 'รองเท้า'] },
        { emoji: '💍', number: '11.', keywords: ['accessories', 'jewelry', 'เครื่องประดับ', 'สร้อย'] },
        { emoji: '🎙️', number: '12.', keywords: ['voice', 'speech', 'tone', 'โทนเสียง', 'การพูด'] },
        { emoji: '🎭', number: '13.', keywords: ['expression', 'emotion', 'สีหน้า', 'อารมณ์'] },
        { emoji: '🖼️', number: '14.', keywords: ['visual', 'style', 'ภาพ', 'ความสมจริง'] },
        { emoji: '📹', number: '15.', keywords: ['camera', 'angle', 'shot', 'มุมกล้อง', 'ระยะ'] },
        { emoji: '🎬', number: '16.', keywords: ['scene', 'movement', 'กล้อง', 'การเคลื่อนไหว'] },
        { emoji: '🎥', number: '17.', keywords: ['filming', 'transition', 'ถ่ายทำ', 'การเปลี่ยน'] }
    ];
    
    const lines = profile.split('\n');
    const result = [];
    let currentSection = null;
    let captureContent = false;
    
    for (let line of lines) {
        const trimmedLine = line.trim();
        const lowerLine = trimmedLine.toLowerCase();
        
        // ตรวจสอบว่าเป็นหัวข้อที่ต้องการหรือไม่
        for (let section of wantedSections) {
            // ตรวจสอบด้วย emoji หรือหมายเลข
            if (trimmedLine.includes(section.emoji) || trimmedLine.includes(section.number)) {
                currentSection = section;
                captureContent = true;
                result.push(trimmedLine); // เก็บบรรทัดหัวข้อ
                break;
            }
        }
        
        // ถ้ากำลังเก็บเนื้อหาของหัวข้อ
        if (captureContent && currentSection) {
            // ถ้าเป็นเนื้อหา (ขึ้นต้นด้วย * หรือ -)
            if (trimmedLine.startsWith('*') || trimmedLine.startsWith('-')) {
                result.push(trimmedLine);
            }
            // ถ้าเจอหัวข้อใหม่ที่ไม่ใช่ส่วนที่ต้องการ ให้หยุด
            else if (trimmedLine && !trimmedLine.startsWith('*') && !trimmedLine.startsWith('-')) {
                // ตรวจสอบว่าเป็นหัวข้อถัดไปหรือไม่
                let isNextSection = false;
                for (let section of wantedSections) {
                    if (trimmedLine.includes(section.emoji) || trimmedLine.includes(section.number)) {
                        isNextSection = true;
                        break;
                    }
                }
                
                // ถ้าไม่ใช่หัวข้อที่ต้องการ และไม่ใช่บรรทัดว่าง ให้หยุดเก็บ
                if (!isNextSection && trimmedLine.length > 0 && 
                    !lowerLine.includes('summary') && 
                    !lowerLine.includes('character profile') &&
                    !lowerLine.includes('template')) {
                    captureContent = false;
                }
            }
        }
        
        // หยุดถ้าเจอคำที่บ่งบอกว่าเป็นส่วนท้าย
        if (lowerLine.includes('summary') || 
            lowerLine.includes('this character profile') ||
            lowerLine.includes('comprehensive insight')) {
            break;
        }
    }
    
    // รวมผลลัพธ์และจัดรูปแบบ
    return result.join('\n').trim();
}

// ฟังก์ชันสรุปข้อมูลตัวละครแบบสั้นสำหรับ Scene Builder
function extractCharacterSummary(profile) {
    if (!profile) return '';
    
    const lines = profile.split('\n');
    const summary = [];
    
    // ดึงข้อมูลสำคัญจากทุกข้อ
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // ชื่อ
        if (trimmed.includes('ชื่อ:') || trimmed.includes('Name:')) {
            const name = trimmed.split(':')[1]?.trim();
            if (name) summary.push(`ชื่อ ${name}`);
        }
        
        // เพศและอายุ
        if (trimmed.includes('เพศ:') || trimmed.includes('Gender:')) {
            const gender = trimmed.split(':')[1]?.trim();
            if (gender) summary.push(gender === 'Male' ? 'ผู้ชาย' : 'ผู้หญิง');
        }
        if (trimmed.includes('อายุ:') || trimmed.includes('Age:')) {
            const age = trimmed.split(':')[1]?.trim();
            if (age) summary.push(`อายุ ${age}`);
        }
        
        // ผม
        if (trimmed.includes('ทรงผม:') || trimmed.includes('Hair style:')) {
            const hair = trimmed.split(':')[1]?.trim();
            if (hair) summary.push(`ผม${hair}`);
        }
        if (trimmed.includes('สีผม:') || trimmed.includes('Hair color:')) {
            const hairColor = trimmed.split(':')[1]?.trim();
            if (hairColor) summary.push(`สี${hairColor}`);
        }
        
        // เสื้อผ้า
        if (trimmed.includes('เสื้อ:') || trimmed.includes('Shirt:')) {
            const shirt = trimmed.split(':')[1]?.trim();
            if (shirt) summary.push(`ใส่${shirt}`);
        }
        if (trimmed.includes('กางเกง:') || trimmed.includes('Pants:')) {
            const pants = trimmed.split(':')[1]?.trim();
            if (pants) summary.push(pants);
        }
        
        // เครื่องประดับ
        if (trimmed.includes('เครื่องประดับ:') || trimmed.includes('Accessories:')) {
            const accessories = trimmed.split(':')[1]?.trim();
            if (accessories && accessories !== '-') summary.push(accessories);
        }
    });
    
    // รวมเป็นประโยค
    return summary.length > 0 ? summary.join(' ') : profile.substring(0, 200);
}

// Export function เพิ่มเติม
window.extractMainCharacterInfo = extractMainCharacterInfo;
window.extractCharacterSummary = extractCharacterSummary;

// ฟังก์ชันปิด Character Picker
function closeCharacterPicker() {
    const modal = document.querySelector('.character-picker-modal');
    if (modal) modal.remove();
    currentCharacterFieldId = null;
}

// Export functions
window.openCharacterPicker = openCharacterPicker;
window.closeCharacterPicker = closeCharacterPicker;
window.selectCharacterForField = selectCharacterForField;

// ========== DEBUG CHARACTER TEMPLATE ==========
window.debugTemplateCharacters = function() {
    console.log('=== Debug Template Characters ===');
    console.log('Character Count:', templateCharCount);
    
    for (let i = 1; i <= 5; i++) {
        const field = document.getElementById(`char${i}`);
        if (field) {
            console.log(`Character ${i}:`, field.value);
        }
    }
    
    console.log('=== Preview Update Test ===');
    updateTemplatePreview();
};
// ========== FORCE UPDATE CHARACTER VALUES ==========
// Override setTemplateCharCount เพื่อเก็บ reference ของ fields
window.templateCharFields = {};

const originalSetTemplateCharCount = window.setTemplateCharCount;
window.setTemplateCharCount = function(count, buttonElement) {
    // เรียกฟังก์ชันเดิม
    originalSetTemplateCharCount(count, buttonElement);
    
    // เก็บ reference ของทุก field
    window.templateCharFields = {};
    for (let i = 1; i <= count; i++) {
        const field = document.getElementById(`char${i}`);
        if (field) {
            window.templateCharFields[i] = field;
            
            // เพิ่ม event listener เพื่อเก็บค่าทันที
            field.addEventListener('input', function() {
                console.log(`Character ${i} updated:`, this.value.substring(0, 50) + '...');
            });
        }
    }
};

// Fix การดึงค่าตัวละครตอน generate
const fixedGenerateFromTemplate = window.generateFromTemplate;
window.generateFromTemplate = function() {
    console.log('🔧 Fixed Generate - Checking character values...');
    
    // Log ค่าทั้งหมดก่อน generate
    const charCount = window.templateCharCount || 0;
    const characterData = [];
    
    for (let i = 1; i <= charCount; i++) {
        const field = document.getElementById(`char${i}`);
        if (field) {
            const value = field.value;
            console.log(`Character ${i}: ${value ? 'Has data' : 'Empty'}`);
            if (value) {
                characterData.push(`${i}. ${value}`);
                console.log(`   Data: ${value.substring(0, 100)}...`);
            }
        }
    }
    
    // เรียกฟังก์ชันเดิมก่อน
    fixedGenerateFromTemplate();
    
    // ถ้ามีข้อมูลตัวละคร แต่ไม่มีใน prompt ให้เพิ่มเข้าไป
    if (characterData.length > 0) {
        const messageInput = document.getElementById('messageInput');
        let currentPrompt = messageInput.value;
        
        // ตรวจสอบว่ามีข้อมูลตัวละครใน prompt หรือไม่
        const hasCharacters = characterData.some(data => 
            currentPrompt.includes(data.substring(0, 30))
        );
        
        if (!hasCharacters) {
            console.log('❌ ไม่พบข้อมูลตัวละครใน prompt - กำลังเพิ่ม...');
            
            // หาตำแหน่งที่จะแทรก
            const insertPoint = currentPrompt.indexOf('⚠️ สำคัญ:');
            const characterSection = `\n👥 รายละเอียดตัวละคร:\n${characterData.join('\n')}\n`;
            
            if (insertPoint > -1) {
                currentPrompt = 
                    currentPrompt.slice(0, insertPoint) + 
                    characterSection + 
                    currentPrompt.slice(insertPoint);
            } else {
                currentPrompt = currentPrompt.replace(
                    'รายละเอียดตัวละคร:\n',
                    `รายละเอียดตัวละคร:\n${characterData.join('\n')}\n`
                );
            }
            
            messageInput.value = currentPrompt;
            console.log('✅ เพิ่มข้อมูลตัวละครเรียบร้อย!');
        }
    }
};

console.log('✅ Force Update Character Values Loaded!');

// ========== FIX TEMPLATE PREVIEW UPDATE ==========
// Override updateTemplatePreview ให้มี error handling
window.updateTemplatePreview = function() {
    console.log('📋 Updating template preview...');
    
    try {
        const preview = document.getElementById('templatePreview');
        if (!preview) {
            console.log('Preview element not found');
            return;
        }
        
        // ดึงค่าจากฟอร์มอย่างปลอดภัย
        const getValue = (id) => {
            const elem = document.getElementById(id);
            return elem ? elem.value : '';
        };
        
        // Get camera angles
        const cameraAngles = [];
        for (let i = 1; i <= 3; i++) {
            const angle = getValue(`cameraAngle${i}`);
            const movement = getValue(`cameraMovement${i}`);
            if (angle || movement) {
                cameraAngles.push({ angle, movement, index: i });
            }
        }
        
        const formData = {
            videoType: getValue('videoType'),
            cameraAngles: cameraAngles, // Use array instead of single values
            timeOfDay: getValue('timeOfDay'),
            visualStyle: getValue('visualStyle'),
            duration: getValue('duration'),
            location: getValue('location'),
            mood: getValue('mood'),
            soundType: getValue('soundType'),
            sceneType: getValue('sceneType')
        };
        
        // สร้าง preview HTML
        let previewHTML = '<strong>🔍 Preview:</strong><br><br>';
        
        // แสดงข้อมูลที่กรอก
        let hasData = false;
        Object.entries(formData).forEach(([key, value]) => {
            if (value) {
                hasData = true;
                previewHTML += `• ${key}: ${value}<br>`;
            }
        });
        
        // ตัวละคร
        const charCount = window.templateCharCount || 0;
        if (charCount > 0) {
            hasData = true;
            previewHTML += `<br>👥 จำนวนตัวละคร: ${charCount} คน<br>`;
            
            for (let i = 1; i <= charCount; i++) {
                const charValue = getValue(`char${i}`);
                if (charValue) {
                    previewHTML += `• ตัวละคร ${i}: ${charValue.substring(0, 50)}...<br>`;
                }
            }
        }
        
        if (!hasData) {
            preview.innerHTML = '<p style="color: #666; text-align: center;">กรอกข้อมูลด้านบนเพื่อดูตัวอย่าง...</p>';
        } else {
            preview.innerHTML = previewHTML;
        }
        
    } catch (error) {
        console.error('Error in updateTemplatePreview:', error);
    }
};


// ========== FIX GENERATE FROM TEMPLATE ==========
window.generateFromTemplate = function() {
    console.log('Generating prompt from template...');
    
    try {
        // ตรวจสอบ mode
        if (!window.currentMode) {
            alert('เกิดข้อผิดพลาด: ไม่พบโหมดปัจจุบัน');
            return;
        }
        
        let prompt = '';
        
        // ฟังก์ชันดึงค่าอย่างปลอดภัย
        const getValue = (id) => {
            const elem = document.getElementById(id);
            const value = elem ? elem.value : '';
            console.log(`Getting ${id}: "${value}"`);
            return value;
        };
        
        if (currentMode === 'promptmaster' || currentMode === 'multichar') {
            // รวบรวมข้อมูล
            const videoType = getValue('videoType');
            
            // Get camera angles from dynamic elements
            const cameraAngles = [];
            const cameraAngleItems = document.querySelectorAll('.camera-angle-item');
            cameraAngleItems.forEach((item, index) => {
                const angleSelect = item.querySelector('[id^="cameraAngle"]');
                const movementSelect = item.querySelector('[id^="cameraMovement"]');
                
                if (angleSelect && movementSelect) {
                    const angle = angleSelect.value;
                    const movement = movementSelect.value;
                    if (angle || movement) {
                        cameraAngles.push({ 
                            angle: angle, 
                            movement: movement, 
                            index: index + 1
                        });
                    }
                }
            });
            
            const timeOfDay = getValue('timeOfDay');
            const visualStyle = getValue('visualStyle');
            const duration = getValue('duration');
            const location = getValue('location');
            const mood = getValue('mood');
            const soundType = getValue('soundType');
            const sceneType = getValue('sceneType');
            const dialogueText = getValue('dialogueText');
            const additionalDetails = getValue('additionalDetails');
            
            // สร้าง prompt header
            prompt = currentMode === 'promptmaster' ? 
                'สร้าง Multi-Character Scene แบบละเอียดมาก:\n\n' :
                'สร้าง Multi-Character Scene แบบละเอียดมาก:\n\n';
            
            // เพิ่มข้อมูลที่มี
            if (videoType) prompt += `🎬 ประเภท: ${getVideoTypeText(videoType)}\n`;
            if (sceneType) prompt += `🎭 ประเภทฉาก: ${getSceneTypeText(sceneType)}\n`;
            if (location) prompt += `📍 สถานที่: ${location}\n`;
            
            // Add camera angles
            if (cameraAngles.length > 0) {
                // แยกแสดงมุมกล้องและการเคลื่อนกล้อง
                const hasAngles = cameraAngles.some(cam => cam.angle);
                const hasMovements = cameraAngles.some(cam => cam.movement);
                
                if (hasAngles) {
                    prompt += '📷 มุมกล้อง:\n';
                    cameraAngles.forEach((cam) => {
                        if (cam.angle) {
                            prompt += `  มุมที่ ${cam.index}: ${getCameraAngleText(cam.angle)}\n`;
                        }
                    });
                }
                
                if (hasMovements) {
                    prompt += '🎬 การเคลื่อนกล้อง:\n';
                    cameraAngles.forEach((cam) => {
                        if (cam.movement) {
                            prompt += `  ช็อตที่ ${cam.index}: ${getCameraMovementText(cam.movement)}\n`;
                        }
                    });
                }
            }
            
            if (timeOfDay) prompt += `🌅 แสง/เวลา: ${getTimeOfDayText(timeOfDay)}\n`;
            if (visualStyle) prompt += `🎨 สไตล์: ${getVisualStyleText(visualStyle)}\n`;
            if (mood) prompt += `😊 อารมณ์: ${getMoodText(mood)}\n`;
            if (soundType) prompt += `🔊 เสียง: ${getSoundTypeText(soundType)}\n`;
            if (duration) prompt += `⏱️ ความยาว: ${duration}\n`;
            
            // ตัวละคร
            const charCount = window.templateCharCount || 0;
            if (charCount > 0) {
                prompt += `\n👥 จำนวนตัวละคร: ${charCount} คน\n`;
                prompt += 'รายละเอียดตัวละคร:\n';
                
                for (let i = 1; i <= charCount; i++) {
                    const charValue = getValue(`char${i}`);
                    if (charValue) {
                        prompt += `${i}. ${charValue}\n`;
                    } else {
                        prompt += `${i}. (ให้ AI สร้างให้เหมาะกับฉาก)\n`;
                    }
                }
            }
            
            // Effects
            const effects = [];
            document.querySelectorAll('.effects-checkboxes input:checked').forEach(cb => {
                const label = cb.nextElementSibling;
                if (label) {
                    effects.push(label.textContent.trim());
                }
            });
            if (effects.length > 0) {
                prompt += '\n✨ Effects: ';
                effects.forEach((effect, index) => {
                    if (index === 0) {
                        prompt += effect;
                    } else {
                        prompt += `, ${effect}`;
                    }
                });
                prompt += '\n';
            }
            
            // Dialogue
            if (dialogueText) {
                prompt += `\n💬 บทพูด:\n${dialogueText}\n`;
            }
            
            // Additional details
            if (additionalDetails) {
                prompt += `\n📝 รายละเอียดเพิ่มเติม: ${additionalDetails}\n`;
            }
            
            // Footer
            prompt += '\n⚠️ สำคัญ: ต้องมีรายละเอียด cinematography, มุมกล้อง, แสง, การเคลื่อนไหว และเอาท์พุตเป็นภาษาอังกฤษ';
        }
        
        // ตรวจสอบว่ามี prompt หรือไม่
        if (!prompt || prompt.trim().length === 0) {
            alert('กรุณากรอกข้อมูลอย่างน้อย 1 ช่องก่อนสร้าง Prompt');
            return;
        }
        
        // ใส่ prompt ใน textarea
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = prompt;
            
            // Auto resize
            messageInput.style.height = 'auto';
            messageInput.style.height = messageInput.scrollHeight + 'px';
            
            // ปิด modal
            closeTemplateForm();
            
            // แจ้งเตือน
            if (typeof showNotification === 'function') {
                showNotification('📋 สร้าง Prompt สำเร็จ! กด "สร้าง Prompt ✨" เพื่อดำเนินการ', 'success');
            }
            
            console.log('✅ Prompt generated successfully!');
        } else {
            alert('ไม่พบช่องกรอกข้อความ');
        }
        
    } catch (error) {
        console.error('Error generating prompt:', error);
        alert('เกิดข้อผิดพลาด: ' + error.message);
    }
};

// ========== ERROR RECOVERY SYSTEM ==========
// ฟังก์ชันฉุกเฉินเมื่อเกิด error
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Global error:', {msg, url, lineNo, columnNo, error});
    
    // ถ้าเป็น error จาก template form
    if (msg.includes('template') || msg.includes('preview')) {
        console.log('🔧 Attempting to fix template error...');
        
        // Reset template state
        if (typeof closeTemplateForm === 'function') {
            closeTemplateForm();
        }
        
        // แจ้งเตือนผู้ใช้
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        
        return true; // ป้องกันไม่ให้แสดง error ใน console
    }
    
    return false;
};

// ตรวจสอบว่าทุก element พร้อมใช้งาน
function checkTemplateElements() {
    const requiredElements = [
        'templateFormModal',
        'videoType',
        'cameraAngle', 
        'timeOfDay',
        'visualStyle',
        'duration',
        'messageInput'
    ];
    
    let allReady = true;
    requiredElements.forEach(id => {
        const elem = document.getElementById(id);
        if (!elem) {
            console.error(`❌ Element not found: ${id}`);
            allReady = false;
        }
    });
    
    return allReady;
}

// เรียกใช้เมื่อเปิด template form
const originalShowTemplateForm = window.showTemplateForm;
window.showTemplateForm = function() {
    // ตรวจสอบ elements ก่อน
    if (!checkTemplateElements()) {
        alert('ระบบยังไม่พร้อม กรุณารอสักครู่แล้วลองใหม่');
        return;
    }
    
    // เรียกฟังก์ชันเดิม
    if (originalShowTemplateForm) {
        originalShowTemplateForm();
    }
};

console.log('✅ Template Form Error Fix Applied!');

// ========== TEMPLATE FORM FINAL FIX ==========
// ลบ listeners เก่าทั้งหมดก่อน
if (window._templateFormInitialized) {
    console.log('Template form already initialized, skipping...');
} else {
    window._templateFormInitialized = true;
    
    // Fix showTemplateForm only once
    if (!window._originalShowTemplateForm) {
        window._originalShowTemplateForm = window.showTemplateForm;
        
        window.showTemplateForm = function() {
            console.log('Opening template form...');
            
            const modal = document.getElementById('templateFormModal');
            if (!modal) {
                alert('Template form not found!');
                return;
            }
            
            // Show modal
            modal.style.display = 'flex';
            
            // Reset form
            document.querySelectorAll('.template-input, .template-textarea, .template-select').forEach(field => {
                field.value = '';
            });
            
            // Set default character count
            if (typeof setTemplateCharCount === 'function') {
                setTemplateCharCount(2);
            }
            
            // Initialize listeners
            setTimeout(() => {
                initTemplateFormListeners();
            }, 100);
        };
    }
    
    // Initialize template form listeners
    function initTemplateFormListeners() {
        // Remove old listeners first
        const oldListeners = window._templateListeners || {};
        Object.keys(oldListeners).forEach(id => {
            const elem = document.getElementById(id);
            if (elem && oldListeners[id]) {
                elem.removeEventListener('change', oldListeners[id]);
                elem.removeEventListener('input', oldListeners[id]);
            }
        });
        
        window._templateListeners = {};
        
        // Add new listeners
        const fields = [
            'videoType', 'cameraAngle', 'timeOfDay', 'visualStyle',
            'duration', 'sceneType', 'mood', 'soundType', 'cameraMovement',
            'location', 'additionalDetails', 'dialogueText'
        ];
        
        fields.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                const handler = function() {
                    if (typeof updateTemplatePreview === 'function') {
                        updateTemplatePreview();
                    }
                };
                
                elem.addEventListener('change', handler);
                elem.addEventListener('input', handler);
                window._templateListeners[id] = handler;
            }
        });
        
        console.log('✅ Template form listeners initialized');
    }
}

// Ensure functions are available globally
window.initTemplateFormListeners = initTemplateFormListeners;

console.log('✅ Template Form Final Fix Applied!');

// ========== CAMERA ANGLE FUNCTIONS ==========
let cameraAngleCount = 1;

function addCameraAngle() {
    if (cameraAngleCount >= 3) {
        return;
    }
    
    cameraAngleCount++;
    const container = document.getElementById('cameraAnglesContainer');
    
    const newAngleDiv = document.createElement('div');
    newAngleDiv.className = 'camera-angle-item';
    newAngleDiv.setAttribute('data-angle-index', cameraAngleCount);
    
    newAngleDiv.innerHTML = `
        <div class="camera-angle-header">
            <h5>📷 มุมกล้องที่ ${cameraAngleCount}</h5>
            <button type="button" class="remove-camera-angle-btn" onclick="removeCameraAngle(${cameraAngleCount})">
                ❌ ลบ
            </button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>มุมกล้อง</label>
                <select id="cameraAngle${cameraAngleCount}" class="template-select" onchange="updateTemplatePreview()">
                    <option value="">-- เลือกมุมกล้อง --</option>
                    <option value="wide">มุมกว้าง (Wide Shot)</option>
                    <option value="medium">มุมกลาง (Medium Shot)</option>
                    <option value="closeup">มุมใกล้ (Close-up)</option>
                    <option value="extreme-closeup">มุมใกล้มาก (Extreme Close-up)</option>
                    <option value="aerial">มุมสูง/โดรน (Aerial/Drone)</option>
                    <option value="low-angle">มุมต่ำ (Low Angle)</option>
                    <option value="dutch">มุมเอียง (Dutch Angle)</option>
                    <option value="pov">มุมมองบุคคลที่ 1 (POV)</option>
                    <option value="tracking">กล้องตามวัตถุ (Tracking Shot)</option>
                    <option value="selfie">เซลฟี่/ถือกล้องเอง (Selfie/Handheld)</option>
                    <option value="twoshot">สองคนในเฟรม (Two Shot)</option>
                    <option value="over-shoulder">ข้ามไหล่ (Over the Shoulder)</option>
                    <option value="establishing">แนะนำสถานที่ (Establishing Shot)</option>
                    <option value="insert">ภาพแทรก (Insert Shot)</option>
                    <option value="cutaway">ภาพตัดไป (Cutaway)</option>
                    <option value="reaction">ภาพปฏิกิริยา (Reaction Shot)</option>
                    <option value="birds-eye">มุมนกมอง (Bird's Eye View)</option>
                    <option value="worms-eye">มุมหนอนมอง (Worm's Eye View)</option>
                    <option value="profile">มุมข้าง (Profile Shot)</option>
                    <option value="full-body">เต็มตัว (Full Body Shot)</option>
                    <option value="cowboy">คาวบอย (Cowboy Shot)</option>
                    <option value="master">มาสเตอร์ช็อต (Master Shot)</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>การเคลื่อนกล้อง</label>
                <select id="cameraMovement${cameraAngleCount}" class="template-select" onchange="updateTemplatePreview()">
                    <option value="">-- เลือกการเคลื่อนกล้อง --</option>
                    <option value="static">กล้องนิ่ง (Static)</option>
                    <option value="pan">หมุนซ้าย-ขวา (Pan)</option>
                    <option value="tilt">หมุนบน-ล่าง (Tilt)</option>
                    <option value="dolly">เคลื่อนเข้า-ออก (Dolly)</option>
                    <option value="tracking">กล้องตาม (Tracking)</option>
                    <option value="handheld">สไตล์ Vlog (Handheld/Vlog)</option>
                    <option value="steadicam">กล้องนิ่มนวล (Steadicam)</option>
                    <option value="drone">โดรน (Drone)</option>
                    <option value="360">มุม 360 องศา (360 Degree)</option>
                    <option value="crane">เครน/บูม (Crane/Boom)</option>
                    <option value="whip-pan">หมุนเร็วมาก (Whip Pan)</option>
                    <option value="zoom">ซูมเข้า-ออก (Zoom In/Out)</option>
                    <option value="rack-focus">เปลี่ยนโฟกัส (Rack Focus)</option>
                    <option value="gimbal">กิมบอล (Gimbal)</option>
                    <option value="slider">สไลเดอร์ (Slider)</option>
                    <option value="orbit">โคจรรอบ (Orbit)</option>
                    <option value="reveal">เปิดเผย (Reveal Shot)</option>
                    <option value="push-in">ดันเข้า (Push In)</option>
                    <option value="pull-out">ดึงออก (Pull Out)</option>
                </select>
            </div>
        </div>
    `;
    
    container.appendChild(newAngleDiv);
    
    // Update button state
    if (cameraAngleCount >= 3) {
        document.querySelector('.add-camera-angle-btn').disabled = true;
    }
    
    updateTemplatePreview();
}

function removeCameraAngle(index) {
    const angleItem = document.querySelector(`[data-angle-index="${index}"]`);
    if (angleItem) {
        angleItem.remove();
    }
    
    // Renumber remaining angles
    const remainingAngles = document.querySelectorAll('.camera-angle-item');
    cameraAngleCount = remainingAngles.length;
    
    remainingAngles.forEach((item, idx) => {
        const newIndex = idx + 1;
        item.setAttribute('data-angle-index', newIndex);
        item.querySelector('h5').textContent = `📷 มุมกล้องที่ ${newIndex}`;
        
        // Update IDs
        const angleSelect = item.querySelector('select[id^="cameraAngle"]');
        const movementSelect = item.querySelector('select[id^="cameraMovement"]');
        if (angleSelect) angleSelect.id = `cameraAngle${newIndex}`;
        if (movementSelect) movementSelect.id = `cameraMovement${newIndex}`;
        
        // Update remove button
        const removeBtn = item.querySelector('.remove-camera-angle-btn');
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeCameraAngle(${newIndex})`);
        }
    });
    
    // Enable add button
    document.querySelector('.add-camera-angle-btn').disabled = false;
    
    updateTemplatePreview();
}

window.addCameraAngle = addCameraAngle;
window.removeCameraAngle = removeCameraAngle;

window.showTemplateForm = function() {
    const modal = document.getElementById('templateFormModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    // Reset camera angles to 1
    cameraAngleCount = 1;
    const container = document.getElementById('cameraAnglesContainer');
    if (container) {
        const extraAngles = container.querySelectorAll('.camera-angle-item[data-angle-index]:not([data-angle-index="1"])');
        extraAngles.forEach(item => item.remove());
    }
    
    // Enable add button
    const addBtn = document.querySelector('.add-camera-angle-btn');
    if (addBtn) addBtn.disabled = false;
    
    // Reset template data
    templateFormData = {
        characterCount: 2,
        characters: {}
    };
    window.templateCharCount = 2;
    
    // Clear form
    document.querySelectorAll('.template-input, .template-textarea, .template-select').forEach(field => {
        field.value = '';
    });
    
    // Set default character count
    setTemplateCharCount(2);
    
    // Initialize listeners
    setTimeout(() => {
        initTemplateFormListeners();
    }, 100);
};

// ========== FAB MENU SYSTEM ==========
let fabMenuOpen = false;

function toggleFabMenu() {
    const container = document.querySelector('.fab-menu-container');
    fabMenuOpen = !fabMenuOpen;
    
    if (fabMenuOpen) {
        container.classList.add('active');
        // Disable scrolling
        document.body.style.overflow = 'hidden';
        
        // Haptic feedback บนมือถือ
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    } else {
        closeFabMenu();
    }
}

function closeFabMenu() {
    const container = document.querySelector('.fab-menu-container');
    container.classList.remove('active');
    fabMenuOpen = false;
    
    // Re-enable scrolling
    document.body.style.overflow = '';
}

// ปิดเมนูเมื่อ scroll
let lastScrollY = window.scrollY;
window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    
    if (Math.abs(currentScrollY - lastScrollY) > 50 && fabMenuOpen) {
        closeFabMenu();
    }
    
    lastScrollY = currentScrollY;
});

// อัพเดท badge count
function updateFabBadge() {
    const badge = document.querySelector('.fab-badge');
    let count = 0;
    
    // นับจำนวน features/updates
    if (!sessionStorage.getItem('announcement_viewed')) count++;
    if (!sessionStorage.getItem('course_viewed')) count++;
    // เพิ่มเงื่อนไขอื่นๆ ตามต้องการ
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// เพิ่ม function สำหรับเปิด video analyzer (ถ้ายังไม่มี)
function openVideoAnalyzer() {
    // เปิด video analyzer
    window.open('https://your-video-analyzer-url.com', '_blank');
    closeFabMenu();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateFabBadge();
    
    // Hide individual FABs on mobile
    if (window.innerWidth <= 768) {
        document.querySelectorAll('.fab-announcement, .fab-course, .fab-tools, .fab-music, .fab-video-analyzer').forEach(fab => {
            fab.style.display = 'none';
        });
    }
});

// Export functions
window.toggleFabMenu = toggleFabMenu;
window.closeFabMenu = closeFabMenu;
window.updateFabBadge = updateFabBadge;
window.openVideoAnalyzer = openVideoAnalyzer;

// ========== END CHARACTER TEMPLATE SYSTEM ==========

// ========== IMAGE PROMPT FORM FUNCTIONS ==========

// Apply quick template
function applyImageTemplate(templateType) {
    const templates = {
        portrait: {
            theme: 'พนักงานสาวออฟฟิศยิ้มแย้ม',
            style: 'photorealistic',
            mood: 'happy',
            gender: 'female',
            age: '25',
            clothing: 'ชุดทำงานสุภาพ เสื้อเชิ้ตขาว',
            location: 'ออฟฟิศสมัยใหม่',
            cameraAngle: 'portrait',
            lens: '85mm',
            aperture: 'f/2.8',
            resolution: '4K'
        },
        landscape: {
            theme: 'ทิวทัศน์ภูเขาตอนพระอาทิตย์ขึ้น',
            style: 'photorealistic',
            mood: 'peaceful',
            location: 'ภูเขา',
            time: 'golden_hour',
            cameraAngle: 'wide_angle',
            lens: '24mm'
        },
        product: {
            theme: 'ถ่ายภาพสินค้า',
            style: 'photorealistic',
            mood: 'happy',
            cameraAngle: 'close_up',
            lens: '50mm',
            aperture: 'f/5.6'
        },
        fantasy: {
            theme: 'โลกแฟนตาซีมหัศจรรย์',
            style: 'digital_art',
            mood: 'mysterious',
            atmosphere: 'หมอกจางๆ แสงมหัศจรรย์'
        }
    };
    
    const template = templates[templateType];
    if (!template) return;
    
    // Apply template values
    if (template.theme) document.getElementById('imageTheme').value = template.theme;
    if (template.style) document.getElementById('imageStyle').value = template.style;
    if (template.mood) document.getElementById('imageMood').value = template.mood;
    if (template.gender) {
        document.querySelectorAll('input[name="imageGender"]').forEach(radio => {
            radio.checked = radio.value === template.gender;
        });
    }
    if (template.age) document.getElementById('imageAge').value = template.age;
    if (template.clothing) document.getElementById('imageClothing').value = template.clothing;
    if (template.location) document.getElementById('imageLocation').value = template.location;
    if (template.time) document.getElementById('imageTime').value = template.time;
    if (template.atmosphere) document.getElementById('imageAtmosphere').value = template.atmosphere;
    if (template.cameraAngle) document.getElementById('imageCameraAngle').value = template.cameraAngle;
    if (template.lens) document.getElementById('imageLens').value = template.lens;
    if (template.aperture) document.getElementById('imageAperture').value = template.aperture;
    if (template.resolution) document.getElementById('imageResolution').value = template.resolution;
}

// Clear form
function clearImagePromptForm() {
    const form = document.querySelector('.image-prompt-form');
    if (!form) return;
    
    // Clear all inputs
    form.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(input => {
        input.value = '';
    });
    
    // Reset all selects
    form.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
    });
    
    // Reset radio buttons
    form.querySelectorAll('input[type="radio"]').forEach(radio => {
        if (radio.value === '') radio.checked = true;
        else radio.checked = false;
    });
}

// Generate prompt from form
async function generateImagePromptFromForm() {
    const formData = {
        theme: document.getElementById('imageTheme').value,
        style: document.getElementById('imageStyle').value,
        mood: document.getElementById('imageMood').value,
        gender: document.querySelector('input[name="imageGender"]:checked')?.value || '',
        age: document.getElementById('imageAge').value,
        ethnicity: document.getElementById('imageEthnicity').value,
        pose: document.getElementById('imagePose').value,
        clothing: document.getElementById('imageClothing').value,
        location: document.getElementById('imageLocation').value,
        time: document.getElementById('imageTime').value,
        atmosphere: document.getElementById('imageAtmosphere').value,
        cameraAngle: document.getElementById('imageCameraAngle').value,
        lens: document.getElementById('imageLens').value,
        aperture: document.getElementById('imageAperture').value,
        iso: document.getElementById('imageISO').value,
        resolution: document.getElementById('imageResolution').value,
        aspectRatio: document.getElementById('imageAspectRatio').value,
        additionalDetails: document.getElementById('imageAdditionalDetails').value
    };
    
    // Check if at least theme is provided
    if (!formData.theme) {
        alert('กรุณาระบุหัวเรื่อง/ธีมของภาพ');
        return;
    }
    
    // Build prompt message
    let promptMessage = `สร้าง image prompt แบบละเอียดสำหรับ: ${formData.theme}`;
    
    // Add character details if provided
    if (formData.gender || formData.age || formData.ethnicity || formData.pose || formData.clothing) {
        promptMessage += '\n\nตัวละคร:';
        if (formData.gender) promptMessage += `\n- เพศ: ${formData.gender === 'male' ? 'ชาย' : formData.gender === 'female' ? 'หญิง' : 'ไม่ระบุ'}`;
        if (formData.age) promptMessage += `\n- อายุ: ${formData.age} ปี`;
        if (formData.ethnicity) promptMessage += `\n- เชื้อชาติ: ${formData.ethnicity}`;
        if (formData.pose) promptMessage += `\n- ท่าทาง: ${formData.pose}`;
        if (formData.clothing) promptMessage += `\n- เครื่องแต่งกาย: ${formData.clothing}`;
    }
    
    // Add background details
    if (formData.location || formData.time || formData.atmosphere) {
        promptMessage += '\n\nฉากหลัง:';
        if (formData.location) promptMessage += `\n- สถานที่: ${formData.location}`;
        if (formData.time) promptMessage += `\n- เวลา: ${formData.time}`;
        if (formData.atmosphere) promptMessage += `\n- บรรยากาศ: ${formData.atmosphere}`;
    }
    
    // Add camera settings
    if (formData.cameraAngle || formData.lens || formData.aperture || formData.iso) {
        promptMessage += '\n\nการตั้งค่ากล้อง:';
        if (formData.cameraAngle) promptMessage += `\n- มุมกล้อง: ${formData.cameraAngle}`;
        if (formData.lens) promptMessage += `\n- เลนส์: ${formData.lens}`;
        if (formData.aperture) promptMessage += `\n- Aperture: ${formData.aperture}`;
        if (formData.iso) promptMessage += `\n- ISO: ${formData.iso}`;
    }
    
    // Add quality settings
    if (formData.resolution || formData.aspectRatio) {
        promptMessage += '\n\nคุณภาพ:';
        if (formData.resolution) promptMessage += `\n- ความละเอียด: ${formData.resolution}`;
        if (formData.aspectRatio) promptMessage += `\n- อัตราส่วน: ${formData.aspectRatio}`;
    }
    
    // Add additional details
    if (formData.additionalDetails) {
        promptMessage += `\n\nรายละเอียดเพิ่มเติม: ${formData.additionalDetails}`;
    }
    
    // Add style and mood
    if (formData.style) promptMessage += `\n\nสไตล์ภาพ: ${formData.style}`;
    if (formData.mood) promptMessage += `\nอารมณ์: ${formData.mood}`;
    
    // Request to create professional prompt
    promptMessage += '\n\nกรุณาสร้าง prompt ภาษาอังกฤษแบบละเอียดและมืออาชีพ พร้อม negative prompt ด้วย';
    
    // Set message and send
    const messageInput = document.getElementById('messageInput');
    messageInput.value = promptMessage;
    
    // Trigger send
    await sendMessage();
}

// ========== DEBUG AND RECOVERY FUNCTIONS ==========

// Debug login function - helps diagnose login issues
window.debugLogin = function(username) {
    console.log('=== DEBUG LOGIN ===');
    console.log('Username:', username);
    
    // Check local accounts
    const localAccounts = JSON.parse(localStorage.getItem('localAccounts') || '{}');
    console.log('Local accounts:', localAccounts);
    
    if (localAccounts[username]) {
        const userId = localAccounts[username].userId;
        console.log('Found user ID:', userId);
        
        // Check user data
        const userData = localStorage.getItem(`userData_${userId}`);
        if (userData) {
            const parsed = JSON.parse(userData);
            console.log('User data found:', parsed);
            
            if (parsed.linkedAccount) {
                console.log('Linked account info:', {
                    username: parsed.linkedAccount.username,
                    hasPassword: !!parsed.linkedAccount.hashedPassword,
                    createdAt: parsed.linkedAccount.createdAt
                });
            }
        } else {
            console.log('No user data found for ID:', userId);
        }
    } else {
        console.log('Username not found in local accounts');
    }
    
    console.log('=== END DEBUG ===');
};

// Recovery function - helps recover account access
window.recoverAccount = function(username) {
    const localAccounts = JSON.parse(localStorage.getItem('localAccounts') || '{}');
    
    if (!localAccounts[username]) {
        console.error('Username not found');
        return;
    }
    
    const userId = localAccounts[username].userId;
    const userData = localStorage.getItem(`userData_${userId}`);
    
    if (!userData) {
        console.error('No user data found');
        return;
    }
    
    const parsed = JSON.parse(userData);
    if (parsed.linkedAccount) {
        // Generate recovery token
        const recoveryToken = btoa(JSON.stringify({
            username: parsed.linkedAccount.username,
            hashedPassword: parsed.linkedAccount.hashedPassword,
            userId: parsed.linkedAccount.userId,
            createdAt: parsed.linkedAccount.createdAt
        }));
        
        console.log('=== RECOVERY TOKEN ===');
        console.log(recoveryToken);
        console.log('Use this token to login');
        return recoveryToken;
    }
    
    console.error('No linked account data found');
};

// ========== END IMAGE PROMPT FORM FUNCTIONS ==========