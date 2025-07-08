# Xavfsizlik Qoidalari va Ko'rsatmalar (Security Guidelines)

## 📋 Asosiy Xavfsizlik Qoidalari

### 1. Muhim Ma'lumotlarni Himoyalash
- **Bot Token**: `BOT_TOKEN` ni hech qachon kodda yozmang
- **Database URL**: `DATABASE_URL` ni environment variable sifatida saqlang
- **API Kalitlar**: Barcha API kalitlarni .env faylida saqlang
- **Parollar**: Hech qachon plain text formatda parol saqlamang

### 2. Foydalanuvchi Ma'lumotlari
- **Telefon raqamlar**: Faqat ro'yxatdan o'tish uchun so'rang
- **Shaxsiy ma'lumotlar**: Minimal kerakli ma'lumotlarni yig'ing
- **Manzil**: To'liq manzil o'rniga hudud/tuman bilan cheklab qo'ying

### 3. Admin Huquqlari
- **Admin Chat ID**: Faqat ma'lum chatId larni admin qiling
- **Maxfiy funksiyalar**: Admin panel faqat tekshirilgan adminlarga
- **Broadcast**: Faqat adminlar ommaviy xabar yubora oladi

## 🛡️ Texnik Xavfsizlik Choralari

### 1. Input Validation (Kiritilgan Ma'lumotlarni Tekshirish)
```javascript
// Telefon raqam tekshiruvi
function validatePhoneNumber(phone) {
    const phoneRegex = /^\+998[0-9]{9}$/;
    return phoneRegex.test(phone);
}

// Tug'ilgan sana tekshiruvi
function validateBirthDate(dateStr) {
    const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
    return dateRegex.test(dateStr);
}
```

### 2. SQL Injection Himoyasi
- Doimo parametrlashtirilgan query lardan foydalaning
- Foydalanuvchi kiritgan ma'lumotlarni to'g'ridan-to'g'ri SQL ga qo'shmang
- Supabase client orqali xavfsiz operatsiyalar

### 3. Rate Limiting (So'rovlarni Cheklash)
- Bir foydalanuvchidan juda ko'p so'rov kelishini oldini oling
- Session timeout larini to'g'ri sozlang
- Spam xabarlarni aniqlash

## 🔐 Environment Variables

### Majburiy O'zgaruvchilar
```env
BOT_TOKEN=your_telegram_bot_token
DATABASE_URL=your_supabase_database_url
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Qo'shimcha Xavfsizlik
```env
NODE_ENV=production
WEBHOOK_SECRET=random_secret_string
ADMIN_CHAT_IDS=123456789,987654321
```

## 🚨 Xavfli Holatlar va Ulardan Qochish

### 1. Callback Data Manipulation
- **Muammo**: Foydalanuvchi callback_data ni o'zgartirishi mumkin
- **Yechim**: Har doim ma'lumotlarni tekshiring
```javascript
// Noto'g'ri
const orderId = data.split('_')[1];
await processOrder(orderId);

// To'g'ri
const orderId = data.split('_')[1];
if (await isValidOrderId(orderId, chatId)) {
    await processOrder(orderId);
}
```

### 2. Admin Privileges Escalation
- **Muammo**: Oddiy foydalanuvchi admin bo'lishga urinishi
- **Yechim**: Har doim admin huquqlarini tekshiring
```javascript
if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, "Bu funksiya faqat adminlar uchun!");
    return;
}
```

### 3. Database Access Control
- **Muammo**: Foydalanuvchi boshqa foydalanuvchi ma'lumotlarini ko'rishi
- **Yechim**: RLS (Row Level Security) yoqing
```sql
-- Foydalanuvchilar faqat o'z ma'lumotlarini ko'rishi
CREATE POLICY "Users can only view own data" ON orders
FOR SELECT USING (user_chat_id = current_setting('app.current_user_id'));
```

## 📝 Best Practices (Eng Yaxshi Amaliyotlar)

### 1. Error Handling
- Xatoliklarni foydalanuvchiga to'liq ko'rsatmang
- Loglarni xavfsiz joyda saqlang
- Maxfiy ma'lumotlarni loglarga yozmang

### 2. Session Management
- Session ma'lumotlarini xotirada cheklangan vaqt saqlang
- Foydalanuvchi chiqib ketganda sessionni o'chiring
- Maxfiy ma'lumotlarni sessionda saqlamang

### 3. Data Sanitization
- Foydalanuvchi kiritgan barcha ma'lumotlarni tozalang
- HTML/Script injection dan saqlaning
- Faqat ruxsat etilgan belgilarni qabul qiling

## 🔍 Monitoring va Logging

### 1. Xavfsizlik Loglar
```javascript
// Shubhali faoliyatni log qilish
function logSuspiciousActivity(chatId, action) {
    console.log(`[SECURITY] User ${chatId} attempted: ${action} at ${new Date()}`);
}
```

### 2. Kuzatish Kerak Bo'lgan Holatlar
- Juda ko'p muvaffaqiyatsiz urinishlar
- Admin funksiyalarga ruxsatsiz kirish
- Noto'g'ri formatdagi ma'lumotlar yuborish
- Tez-tez session yaratish/o'chirish

## 🚀 Deployment Xavfsizligi

### 1. Vercel Environment
- Environment variables ni Vercel dashboard orqali qo'shing
- .env fayllarini git ga commit qilmang
- Production va development uchun alohida environment

### 2. Webhook Xavfsizligi
- HTTPS dan foydalaning
- Webhook URL ni maxfiy saqlang
- Telegram dan kelayotgan so'rovlarni tekshiring

## 📞 Incident Response (Hodisa Javob Berish)

### Agar Xavfsizlik Buzilsa:
1. **Tezkor Harakat**: Bot tokenni zudlik bilan almashtiring
2. **Ma'lumotlarni Tekshirish**: Database da noto'g'ri ma'lumotlar bormi?
3. **Foydalanuvchilarni Xabardor Qilish**: Zarur bo'lsa foydalanuvchilarni ogohlantiring
4. **Loglarni Tahlil Qilish**: Qanday sodir bo'lganini aniqlang
5. **Himoya Choralarini Kuchaytirish**: Xatolikni takrorlanishini oldini oling

## ✅ Xavfsizlik Tekshiruv Ro'yxati

- [ ] Bot token xavfsiz joyda saqlanganmi?
- [ ] Admin chatId lari to'g'ri sozlanganmi?
- [ ] Foydalanuvchi kiritgan ma'lumotlar tekshirilayaptimi?
- [ ] Database da RLS (Row Level Security) yoqilganmi?
- [ ] Error handling to'g'ri ishlayaptimi?
- [ ] Session lar xavfsiz boshqarilayaptimi?
- [ ] Webhook HTTPS orqali ishlaydimi?
- [ ] Environment variables to'g'ri sozlanganmi?
- [ ] Loglar maxfiy ma'lumotlarni o'z ichiga olmaydimi?
- [ ] Rate limiting mavjudmi?

## 🔄 Muntazam Tekshiruvlar

### Haftalik:
- Bot loglarini tekshirish
- Noto'g'ri kirish urinishlarini kuzatish
- Database performance monitoring

### Oylik:
- Environment variables ni yangilash
- Xavfsizlik yamoqlarini qo'llash
- Backup strategiyasini tekshirish

### Choraklik:
- To'liq xavfsizlik audit
- Penetration testing (agar mumkin bo'lsa)
- Incident response planini yangilash

---

**Eslatma**: Bu qoidalarga amal qilish sizning bot va foydalanuvchi ma'lumotlarini himoya qiladi. Xavfsizlik - bu bir martalik ish emas, balki doimiy jarayon!