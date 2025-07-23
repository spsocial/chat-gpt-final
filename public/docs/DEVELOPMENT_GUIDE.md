# คู่มือสำหรับนักพัฒนา

## 🚀 เริ่มต้นพัฒนา

### ขั้นตอนการติดตั้ง
1. Clone repository
2. เปิดไฟล์ `index.html` ใน browser
3. ใช้ Live Server extension ใน VS Code สำหรับ hot reload

### โครงสร้าง Code ที่สำคัญ

#### 1. การจัดการโหมด (Mode Management)
```javascript
// ตัวแปร global สำคัญ
let currentMode = 'general';  // โหมดปัจจุบัน
let characterLibrary = [];    // array เก็บตัวละคร
let templateCharCount = 2;    // จำนวนตัวละครในฟอร์ม

// ฟังก์ชันเปลี่ยนโหมด
function switchMode(mode) {
    currentMode = mode;
    updateUI();
    // ... update various UI elements
}
```

#### 2. ระบบฟอร์ม Template
```javascript
// ID ของ input fields ที่สำคัญ
// มุมกล้อง: cameraAngle1, cameraAngle2, cameraAngle3
// การเคลื่อนกล้อง: cameraMovement1, cameraMovement2, cameraMovement3
// ตัวละคร: char1, char2, char3, char4, char5

// ฟังก์ชันสร้าง prompt
function generateFromTemplate() {
    // ใน script.js → สำหรับ multichar mode
    // ใน index.html → สำหรับ promptmaster mode
}
```

#### 3. Character System
```javascript
// โครงสร้างข้อมูลตัวละคร
const character = {
    id: 'char_xxxxx',
    name: 'ชื่อตัวละคร',
    profile: 'ข้อมูล 17 ข้อ...',
    preview: 'ข้อมูลสรุป...',
    timestamp: Date.now()
};

// บันทึกตัวละคร
async function saveCharacterToLibrary(characterData) {
    // POST to /api/characters/:userId
}

// ดึงตัวละครทั้งหมด
async function loadCharacterLibrary() {
    // GET from /api/characters/:userId
}
```

#### 4. Storage System
```javascript
// Keys ที่ใช้ใน localStorage
const STORAGE_KEYS = {
    USER_ID: 'promptd_user_id',
    USERNAME: 'promptd_username',
    TOKEN: 'promptd_token',
    THEME: 'theme',
    HISTORY: 'veo_{mode}_history_{userId}',
    FAVORITES: 'veo_favorites_{userId}'
};
```

## 🐛 การ Debug

### Console Commands สำหรับ Debug
```javascript
// ดูข้อมูลตัวละครทั้งหมด
console.log(characterLibrary);

// ดูโหมดปัจจุบัน
console.log(currentMode);

// ดู template form data
console.log({
    charCount: templateCharCount,
    angle1: document.getElementById('cameraAngle1')?.value,
    movement1: document.getElementById('cameraMovement1')?.value
});

// Force update preview
updateTemplatePreview();
```

### จุดที่ต้องระวัง
1. **Duplicate IDs**: ระวังการใช้ ID ซ้ำระหว่าง modes
2. **Event Listeners**: ต้อง remove listeners เก่าก่อนเพิ่มใหม่
3. **Async Operations**: ใช้ try-catch ครอบ API calls ทุกครั้ง
4. **Character Data**: ตรวจสอบ encoding ภาษาไทยให้ดี

## 📋 Checklist สำหรับเพิ่มฟีเจอร์ใหม่

### เพิ่มฟิลด์ใหม่ในฟอร์ม
- [ ] เพิ่ม HTML element ใน index.html
- [ ] เพิ่ม ID ใน event listener list
- [ ] อัพเดต updateTemplatePreview()
- [ ] อัพเดต generateFromTemplate() ทั้ง 2 ที่
- [ ] เพิ่มใน preset ถ้าจำเป็น

### เพิ่มโหมดใหม่
- [ ] เพิ่มปุ่มใน mode selector
- [ ] เพิ่ม case ใน switchMode()
- [ ] สร้าง UI section สำหรับโหมดนั้น
- [ ] เพิ่ม storage key ถ้าต้องเก็บประวัติ
- [ ] อัพเดต updateModeUI()

### การแก้ไข Character System
- [ ] ทดสอบกับภาษาไทยและอังกฤษ
- [ ] ตรวจสอบ character picker
- [ ] ทดสอบ import/export
- [ ] ตรวจสอบการแสดงผลใน library

## 🔥 Tips & Tricks

### Performance
- ใช้ debounce สำหรับ input events
- Lazy load สำหรับ character library ขนาดใหญ่
- ใช้ DocumentFragment เมื่อ append elements จำนวนมาก

### UX
- เพิ่ม loading states สำหรับ async operations
- ใส่ confirmation dialog สำหรับการลบ
- Auto-save drafts ใน localStorage
- แสดง error messages ที่ user-friendly

### Security
- Sanitize user input ก่อนแสดงผล
- ไม่เก็บ sensitive data ใน localStorage
- Validate data ทั้ง client และ server side