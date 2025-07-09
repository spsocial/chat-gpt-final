# 🔐 Security Update Guide

## สำหรับผู้ใช้งานเดิม

การอัพเดทนี้เพิ่มความปลอดภัยให้กับระบบ **โดยไม่กระทบการใช้งานของผู้ใช้ทั่วไป**

### ⚡ สิ่งที่ต้องทำทันที (สำหรับ Admin)

1. **สร้าง ENCRYPTION_KEY ใหม่:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```
   เอา output ที่ได้ไปใส่ใน `.env` file:
   ```
   ENCRYPTION_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

2. **อัพเดท Dependencies:**
   ```bash
   npm install
   ```

3. **Restart Server:**
   ```bash
   npm start
   ```

### 📋 สิ่งที่เปลี่ยนแปลง

1. **Admin Endpoints ต้องใช้ Authentication:**
   - ต้องส่ง header `X-Admin-Key` พร้อมกับ `ADMIN_SECRET_KEY`
   - ตัวอย่าง:
   ```javascript
   fetch('/api/credits/manual-add', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'X-Admin-Key': 'your-admin-secret-key'
     },
     body: JSON.stringify({ userId, amount, note })
   })
   ```

2. **Rate Limiting:**
   - API ทั่วไป: 100 requests/15 นาที
   - Slip verification: 10 requests/15 นาที

3. **Security Headers เพิ่มเติม:**
   - Helmet.js สำหรับป้องกัน XSS, Clickjacking
   - Content Security Policy

### ✅ สิ่งที่ไม่เปลี่ยน

- ✅ ผู้ใช้ทั่วไปยังใช้งานได้ตามปกติ
- ✅ Credits และข้อมูลเดิมยังคงอยู่
- ✅ UI/UX เหมือนเดิม
- ✅ ไม่ต้อง login ใหม่

### 🚨 สำคัญมาก

**ลบ `.env` file ออกจาก Git repository ทันที:**
```bash
git rm --cached .env
git commit -m "Remove .env from repository"
git push
```

### 📞 ติดต่อ

หากมีปัญหาในการอัพเดท กรุณาติดต่อทีมพัฒนา