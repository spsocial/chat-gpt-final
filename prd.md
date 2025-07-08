Product Requirements Document (PRD)
Veo 3 Prompt Generator - AI-Powered Video & Content Creation Platform
1. Executive Summary
Product Name: Prompt D - Generator (Veo 3 Prompt Generator)
Version: 5.0.1
Platform: Web Application
Target Users: Content creators, video producers, และผู้ที่ต้องการสร้างวิดีโอด้วย AI (Veo 3)
Product Vision: แพลตฟอร์มที่ช่วยให้ผู้ใช้สามารถสร้าง prompt คุณภาพสูงสำหรับ AI video generation (Veo 3) ได้อย่างง่ายดาย พร้อมฟีเจอร์เสริมอื่นๆ เช่น การสร้างภาพ AI Chat และการจัดการตัวละคร
2. Core Features
2.1 Prompt Generation Modes
2.1.1 General Prompt Mode

Purpose: สร้าง cinematic prompt สำหรับวิดีโอทั่วไป
Features:

รองรับการแนบรูปภาพเป็น reference
Voice input (ภาษาไทย)
Template form สำหรับกรอกข้อมูลแบบมีโครงสร้าง
Quick templates library
Favorites system



2.1.2 Prompt Master Mode (เดิมชื่อ Multi-Character)

Purpose: สร้าง prompt สำหรับฉากที่ซับซ้อน รองรับหลายตัวละคร
Features:

Scene Builder form (รองรับ 2-5 ตัวละคร)
บทพูดพร้อม timing
Camera angles และ movements
Audio layers management
Quick presets (interview, dialogue, action, etc.)



2.1.3 Character Creator Mode

Purpose: สร้าง character profile แบบละเอียด
Features:

Character template form (8 หัวข้อหลัก)
บันทึก character ไว้ใช้ซ้ำ
Character library management
Import character จากรูปภาพ



2.1.4 Image Generation Mode

Purpose: สร้างภาพด้วย AI (Flux models)
Features:

2 models: Express (Flux Schnell) และ Premium (Flux Dev)
5 aspect ratios
Prompt enhancement
Download ภาพความละเอียดสูง
Voice input สำหรับ prompt ภาษาไทย



2.1.5 AI Chat Mode

Purpose: สนทนากับ AI แบบทั่วไป
Features:

5 AI models (GPT-3.5, GPT-4o mini, GPT-4o, Gemini Flash, Gemini Pro)
รองรับการแนบรูปภาพเพื่อวิเคราะห์
บันทึกประวัติการสนทนาใน localStorage
Voice input
Model selection with cost display



2.2 Supporting Features
2.2.1 Credit & Payment System

Daily Free Credits: 5 บาท/วัน
Credit Packages: หลายแพ็คเกจ (50-500 บาท)
Payment Methods:

PromptPay QR Code generation
Slip verification (ESY Slip API)
Auto credit addition upon verification


BYOK (Bring Your Own Key): ผู้ใช้สามารถใช้ OpenAI API key ของตัวเอง

2.2.2 Music Video Template System

Pre-configured Templates: Isaan Trap และอื่นๆ
Customizable Fields:

Singer/character description
Lyrics
Music style
Background/location
Visual tone
Advanced options (camera, props)



2.2.3 User Experience Features

Voice Recognition: พูดแทนพิมพ์ (ภาษาไทย)
Templates & Favorites: บันทึก prompt ที่ชอบ
Rating System: ให้คะแนน prompt ที่สร้าง
Character Library: จัดการตัวละครที่สร้างไว้
Mobile Responsive: รองรับทุกขนาดหน้าจอ
FAB Menu System: Quick access to features

3. Technical Architecture
3.1 Frontend

Technologies: Vanilla JavaScript, HTML5, CSS3
Key Libraries:

Web Speech API (voice recognition)
LocalStorage API (data persistence)
Fetch API (backend communication)


UI Components:

Chat interface
Modal systems
Template forms
Image preview
Voice status indicators



3.2 Backend

Framework: Express.js (Node.js)
APIs & Services:

OpenAI Assistants API (prompt generation)
Google Generative AI (Gemini models)
Replicate API (image generation)
ESY Slip API (payment verification)


Database: PostgreSQL
Authentication: User ID based (stored in localStorage)

3.3 AI Models & Assistants

Standard Assistants (GPT-4o-mini):

General prompt assistant
Character creation assistant
Multi-character assistant
Chat assistant


BYOK Assistants (GPT-4o): Enhanced versions for users with own API key
Image Models: Flux Schnell, Flux Dev
Chat Models: GPT-3.5-turbo, GPT-4o-mini, GPT-4o, Gemini Flash, Gemini Pro

4. Database Schema
4.1 Core Tables

users: User profiles and BYOK settings
usage_logs: Token usage tracking
daily_limits: Daily usage limits per user
characters: Saved character profiles
prompt_ratings: User ratings for generated prompts
user_credits: Credit balance management
credit_transactions: Credit transaction history
payment_verifications: Slip verification records

4.2 Supporting Tables

credit_packages: Available credit packages
payment_logs: Payment history
daily_free_credits: Free daily credit tracking

5. User Flows
5.1 First-Time User Flow

Land on homepage → Auto-generate user ID
See welcome message explaining features
Try free features (5 บาท daily limit)
Hit limit → Prompt to add credits or use BYOK
Choose payment method or add API key

5.2 Prompt Generation Flow

Select mode (General/Prompt Master/Character)
Input via text/voice/image
(Optional) Use template/form
Generate prompt
Review result
Copy/save to favorites/rate
(Optional) Continue scene

5.3 Payment Flow

Click "เติมเครดิต"
Select package
Generate QR code
Make payment
Upload slip
Auto verification
Credits added instantly

6. Business Model
6.1 Revenue Streams

Credit Sales: Main revenue from credit packages
Course Sales: Veo 3 training courses (3 types)

Group course: 499 บาท
Online 1-on-1: 999 บาท
Onsite: 2,999 บาท



6.2 Pricing Strategy

Freemium Model: 5 บาท free daily credits
Usage-Based: Pay per token/generation
BYOK Option: Use own API key for unlimited usage

7. Key Differentiators

Thai Language Support: Full Thai voice input and UI
Specialized for Veo 3: Optimized prompts for video generation
Character Persistence: Save and reuse characters across projects
Multi-Modal Input: Text, voice, image reference
Template System: Pre-configured templates for common scenarios
Integrated Payment: Seamless Thai payment methods

8. Success Metrics

User Metrics:

Daily Active Users (DAU)
User retention rate
Average prompts per user


Financial Metrics:

Credit purchase conversion rate
Average revenue per user (ARPU)
Course enrollment rate


Usage Metrics:

Prompts generated per day
Most used features/modes
API usage and costs



9. Future Roadmap Opportunities

Enhanced AI Models: Integration with newer AI models
Video Preview: Show AI-generated video previews
Team Collaboration: Share characters and prompts
API Access: Developer API for third-party integration
Mobile App: Native iOS/Android applications
Export Features: Export to various video production tools
Advanced Analytics: Usage insights and recommendations

10. Technical Requirements
10.1 Performance

Page load time < 3 seconds
Voice recognition latency < 1 second
API response time < 5 seconds
Image generation < 30 seconds

10.2 Scalability

Support 10,000+ concurrent users
Handle 100,000+ prompts per day
Database optimization for millions of records

10.3 Security

API key encryption (AES-256)
Secure payment verification
Rate limiting per user
Input validation and sanitization

10.4 Browser Support

Chrome (latest 2 versions)
Safari (latest 2 versions)
Edge (latest 2 versions)
Mobile browsers (iOS Safari, Chrome Android)

11. Dependencies & Integrations

OpenAI API: Core AI functionality
Google AI API: Gemini models
Replicate API: Image generation
ESY Slip API: Payment verification
PostgreSQL: Data storage
Railway/Heroku: Hosting platform
Cloudflare CDN: Static assets

12. Compliance & Legal

Data Privacy: User data stored securely
Payment Security: PromptPay compliance
API Usage: Compliance with OpenAI/Google terms
Content Policy: Filtering inappropriate content
Thai Regulations: Compliance with Thai digital payment laws


Document Version: 1.0
Last Updated: January 2025
Status: Active Development