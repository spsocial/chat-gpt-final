# 📋 คู่มือสำหรับ Admin - Veo Prompt Generator

## 🎯 การจัดการเครดิต

### 1. เมื่อได้รับการแจ้งโอนเงิน

หลังจากลูกค้าส่งสลิปมาทาง Line แล้ว:

```bash
# ตรวจสอบจำนวนเงินที่โอน และเติมเครดิตตามแพ็กเกจ:

# แพ็กเริ่มต้น (5 บาท = 5 เครดิต)
npm run add-credits user_xxx 5 "Payment 5 THB - Receipt#12345"

# แพ็กคุ้ม (50 บาท = 60 เครดิต)
npm run add-credits user_xxx 60 "Payment 50 THB - Receipt#12345"

# แพ็กพิเศษ (100 บาท = 150 เครดิต)
npm run add-credits user_xxx 150 "Payment 100 THB - Receipt#12345"
```

### 2. ตรวจสอบเครดิตของ User

```bash
# เช็คเครดิตและประวัติ
npm run check-credits user_xxx
```

### 3. Command ทั้งหมด

| คำสั่ง | การใช้งาน | ตัวอย่าง |
|--------|-----------|----------|
| `npm run add-credits` | เติมเครดิต | `npm run add-credits user_123 60 "Paid 50B"` |
| `npm run check-credits` | เช็คเครดิต | `npm run check-credits user_123` |

## 📱 ขั้นตอนการทำงาน

1. **ลูกค้าแจ้งโอนเงินทาง Line**
   - ตรวจสอบสลิป
   - ตรวจสอบจำนวนเงิน
   - ดู User ID ที่ลูกค้าส่งมา

2. **เติมเครดิต**
   ```bash
   npm run add-credits [USER_ID] [จำนวนเครดิต] "[หมายเหตุ]"
   ```

3. **แจ้งลูกค้า**
   - "เครดิตเข้าแล้วครับ ✅"
   - "ตรวจสอบได้ที่หน้าเว็บ"

## 💰 ตารางแพ็กเกจ

| แพ็กเกจ | ราคา | เครดิต | คำสั่งเติม |
|---------|------|--------|------------|
| เริ่มต้น | 5 บาท | 5 | `npm run add-credits user_xxx 5` |
| คุ้ม | 50 บาท | 60 | `npm run add-credits user_xxx 60` |
| พิเศษ | 100 บาท | 150 | `npm run add-credits user_xxx 150` |

## 🔧 การแก้ปัญหา

### ลูกค้าบอกว่าเครดิตไม่เข้า
1. เช็คเครดิตปัจจุบัน: `npm run check-credits user_xxx`
2. ดูประวัติการเติม
3. หากยังไม่เข้าจริง ให้เติมใหม่

### ต้องการยกเลิก/คืนเครดิต
```bash
# ใช้เครื่องหมายลบเพื่อหักเครดิต
npm run add-credits user_xxx -60 "Refund - Wrong payment"
```

## 📞 ติดต่อ Developer

หากมีปัญหาทางเทคนิค:
- Check logs ใน Railway Dashboard
- ดู error messages
- ติดต่อ developer

---

⚠️ **หมายเหตุ**: ระบบนี้เป็นแบบ Manual ต้องเติมเครดิตเองทุกครั้ง ในอนาคตอาจพัฒนาเป็นระบบอัตโนมัติ