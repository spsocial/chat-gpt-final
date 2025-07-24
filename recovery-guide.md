# คู่มือการกู้คืนข้อมูลผู้ใช้ในระบบ Chat-GPT

## 1. วิธีการกู้คืนข้อมูลผู้ใช้

### วิธีที่ 1: ใช้ Login Token (แนะนำ)
1. ขอ Login Token จากผู้ใช้ (ผู้ใช้ต้องเคยผูกบัญชีไว้แล้ว)
2. ใส่ Login Token ในช่อง Username (ไม่ต้องใส่ Password)
3. กด Login
4. ระบบจะกู้คืนข้อมูล:
   - User ID เดิม
   - จำนวนเครดิต
   - ตัวละครที่บันทึกไว้

### วิธีที่ 2: ใช้ Username/Password
1. ขอ Username และ Password จากผู้ใช้
2. Login ด้วย Username/Password ที่เคยตั้งไว้
3. ระบบจะกู้คืนข้อมูลเช่นเดียวกับวิธีที่ 1

### วิธีที่ 3: กู้คืนจาก Browser เดิม
หากผู้ใช้ยังเข้าถึง browser/อุปกรณ์เดิมได้:
1. เปิด Developer Console (F12)
2. ไปที่ Application/Storage > Local Storage
3. ค้นหา key เหล่านี้:
   - `linkedAccount` - ข้อมูลบัญชีที่ผูก
   - `userData_{userId}` - ข้อมูลผู้ใช้
   - `userId` - ID ปัจจุบัน
4. Copy ข้อมูลและนำไปใส่ใน browser ใหม่

## 2. โครงสร้างข้อมูลที่เก็บ

### linkedAccount:
```json
{
  "username": "ชื่อผู้ใช้",
  "userId": "user_xxxxxxxxx",
  "hashedPassword": "รหัสที่ hash แล้ว"
}
```

### userData_{userId}:
```json
{
  "linkedAccount": { /* ข้อมูล account */ },
  "credits": 100,
  "updatedAt": "2025-01-24T..."
}
```

## 3. ข้อจำกัดของระบบ

1. **ไม่มี Backend Sync จริง** - ข้อมูลเก็บใน localStorage เท่านั้น
2. **ไม่มีการ backup อัตโนมัติ** - หาก clear browser data จะหายทั้งหมด
3. **Login Token ใช้ได้เฉพาะกับ account ที่ผูกแล้ว** - ต้องผูกบัญชีก่อนถึงจะมี token

## 4. วิธีสร้าง Login Token ใหม่ (สำหรับ Admin)

หากต้องการช่วยผู้ใช้สร้าง token ใหม่:
```javascript
// ใน browser console
const account = {
  username: "username_ที่ต้องการ",
  userId: "user_id_ที่ต้องการกู้คืน",
  hashedPassword: "hash_ของ_password"
};
const token = btoa(JSON.stringify(account));
console.log("Login Token:", token);
```

## 5. Script สำหรับกู้คืนข้อมูล

```javascript
// Script สำหรับกู้คืนข้อมูลผู้ใช้
function recoverUserData(userId, credits, username, password) {
  // สร้าง hashed password
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  hashPassword(password).then(hashedPassword => {
    const account = {
      username: username,
      userId: userId,
      hashedPassword: hashedPassword
    };
    
    const userData = {
      linkedAccount: account,
      credits: credits,
      updatedAt: new Date().toISOString()
    };
    
    // บันทึกข้อมูล
    localStorage.setItem('linkedAccount', JSON.stringify(account));
    localStorage.setItem(`userData_${userId}`, JSON.stringify(userData));
    localStorage.setItem('userId', userId);
    localStorage.setItem('totalCredits', credits.toString());
    
    console.log('✅ กู้คืนข้อมูลสำเร็จ!');
    console.log('Login Token:', btoa(JSON.stringify(account)));
  });
}

// ตัวอย่างการใช้งาน:
// recoverUserData('user_abc123', 500, 'john_doe', 'password123');
```

## 6. การป้องกันปัญหาในอนาคต

### แนะนำให้ผู้ใช้:
1. **บันทึก Login Token ไว้** - หลังจากผูกบัญชี
2. **ใช้ Password ที่จำง่าย** - แต่ปลอดภัย
3. **Screenshot User ID** - เผื่อต้องการติดต่อ admin
4. **Login เป็นประจำ** - เพื่อให้ข้อมูล sync อยู่เสมอ

### สำหรับ Admin:
1. ควรมีระบบ backup ข้อมูลผู้ใช้ใน database จริง
2. ควรมี API endpoint สำหรับกู้คืนข้อมูล
3. ควรมีระบบ reset password
4. ควรมีการเก็บ log การ login/sync