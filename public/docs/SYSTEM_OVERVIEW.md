# ภาพรวมระบบ Prompt D AI

## 🎯 วัตถุประสงค์หลัก
ระบบ AI Assistant สำหรับสร้าง prompt ในการสร้างวิดีโอและรูปภาพ โดยเน้นการใช้งานที่ง่าย รองรับภาษาไทย และมีฟีเจอร์ครบครัน

## 🚀 ฟีเจอร์หลัก

### 1. โหมดการทำงาน (Modes)
- **General Mode** - โหมดทั่วไป สำหรับสร้าง prompt อิสระ
- **Character Mode** - สร้างและจัดการตัวละคร พร้อมบันทึกเป็น library
- **Prompt Master** - สร้างวิดีโอด้วยฟอร์มที่ออกแบบมาเฉพาะ
- **Scene Builder (Multi-char)** - สร้างฉากที่มีหลายตัวละคร
- **Image Mode** - สร้าง prompt สำหรับรูปภาพ
- **Chat Mode** - คุยกับ AI แบบทั่วไป

### 2. ระบบจัดการตัวละคร (Character System)
- **Character Library** - บันทึกและจัดการตัวละครที่สร้างไว้
- **Character Template** - ฟอร์มสร้างตัวละครแบบละเอียด 17 ข้อ
- **Character Picker** - เลือกตัวละครจาก library มาใช้ในฟอร์มต่างๆ
- **Import/Export** - นำเข้า/ส่งออกตัวละครเป็น JSON

### 3. ฟอร์มสร้าง Prompt
- **Template Form (แบบง่าย)** - ฟอร์มพื้นฐานสำหรับ prompt master
- **Detailed Form** - ฟอร์มแบบละเอียด รองรับ:
  - มุมกล้องได้สูงสุด 3 มุม
  - การเคลื่อนกล้องได้ 3 แบบ
  - ตัวละครได้สูงสุด 5 คน
  - Effects พิเศษต่างๆ
- **Quick Presets** - เทมเพลตสำเร็จรูป (interview, vlog, music video ฯลฯ)

### 4. ระบบเสียง (Voice System)
- **Voice Input** - พูดเพื่อกรอกข้อมูลในฟอร์ม
- **Text-to-Speech** - อ่านข้อความตอบกลับ
- รองรับทั้งภาษาไทยและอังกฤษ

### 5. ระบบจัดการข้อมูล
- **Auto-save** - บันทึกประวัติการสนทนาอัตโนมัติ
- **Favorites** - บันทึก prompt ที่ชื่นชอบ
- **History** - ดูประวัติการใช้งานย้อนหลัง
- **Local Storage** - เก็บข้อมูลใน browser

### 6. ระบบ Credits
- แสดงจำนวน credits คงเหลือ
- ประวัติการใช้ credits
- ระบบเติม credits (ผ่าน admin)

### 7. UI/UX Features
- **Dark/Light Mode** - ปรับธีมตามความชอบ
- **Responsive Design** - ใช้ได้ทั้ง desktop และ mobile
- **Live Preview** - ดูตัวอย่าง prompt แบบ real-time
- **Markdown Support** - แสดงผลข้อความแบบ formatted
- **Copy Button** - คัดลอก prompt ได้ง่ายๆ

### 8. ฟีเจอร์พิเศษ
- **Music Video Templates** - เทมเพลตพิเศษสำหรับ MV
- **Camera Angle Guide** - คำแนะนำมุมกล้อง
- **Scene Effects** - เอฟเฟกต์พิเศษ (ควัน, ฝน, หิมะ ฯลฯ)
- **API Integration** - เชื่อมต่อกับ backend API

## 📁 โครงสร้างไฟล์หลัก
```
public/
├── index.html          # หน้าหลัก + โค้ด promptmaster mode
├── script.js          # โค้ด JavaScript หลัก + multichar mode
├── style.css          # ไฟล์ CSS
├── auth.html          # หน้า login
├── admin.html         # หน้า admin
└── docs/              # เอกสารระบบ
    ├── SYSTEM_OVERVIEW.md
    └── UPDATES_2025-01-23.md
```

## 🔧 เทคโนโลยีที่ใช้
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Storage**: LocalStorage, SessionStorage
- **API**: RESTful API (Node.js backend)
- **Auth**: Token-based authentication
- **Voice**: Web Speech API

## 🎨 Design System
- **Primary Color**: #ff4757 (แดง)
- **Font**: Sarabun (ไทย), Inter (อังกฤษ)
- **Icons**: Emoji-based for better compatibility
- **Layout**: Flexbox & CSS Grid

## 📝 หมายเหตุสำคัญ
1. ระบบมี 2 ที่สำหรับสร้าง prompt:
   - `script.js` → multichar mode
   - `index.html` → promptmaster mode
2. ข้อมูลผู้ใช้เก็บใน localStorage ไม่ sync ข้ามอุปกรณ์
3. รองรับ browser ที่สนับสนุน ES6+
4. ต้องมี internet สำหรับเชื่อมต่อ API