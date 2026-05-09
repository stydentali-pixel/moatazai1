# Cloudflare Telegram Personal Bot

نسخة خفيفة لتشغيل بوت تليجرام شخصي على Cloudflare Workers عبر Webhook.

هذه النسخة لا تشغّل Python ولا aiogram. هي مناسبة كتجربة شخصية سريعة على Cloudflare، وتعمل كبوابة Webhook خفيفة. التوليد الثقيل مثل ZIP أو بناء مشاريع كاملة يجب أن يتم عبر API خارجي اختياري `WORKER_API_URL` على Replit/Railway/VPS.

## الملفات

```txt
src/index.ts             كود البوت والWebhook
wrangler.toml            إعداد Cloudflare Worker
package.json             أوامر التشغيل والنشر
scripts/set-webhook.mjs  تسجيل Webhook في Telegram
scripts/delete-webhook.mjs حذف Webhook
.dev.vars.example        مثال أسرار محلية للتجربة
```

## المتطلبات

- حساب Cloudflare.
- Node.js 20 أو أحدث.
- Telegram Bot Token من BotFather.
- رقم حسابك في تليجرام `ADMIN_IDS` من @userinfobot.

## التشغيل المحلي

```bash
npm install
cp .dev.vars.example .dev.vars
# عدّل .dev.vars وضع BOT_TOKEN و WEBHOOK_SECRET و ADMIN_IDS
npm run dev
```

افتح:

```txt
http://127.0.0.1:8787/health
```

## النشر على Cloudflare

سجل الدخول:

```bash
npx wrangler login
```

أضف الأسرار:

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put ADMIN_IDS
```

اختياريًا لو عندك API خارجي للتوليد:

```bash
npx wrangler secret put WORKER_API_TOKEN
```

ولو عندك رابط Worker خارجي، ضعه في `wrangler.toml`:

```toml
WORKER_API_URL = "https://your-replit-or-vps.example.com"
```

انشر:

```bash
npm run deploy
```

سيظهر لك رابط شبيه بـ:

```txt
https://telegram-personal-bot.USERNAME.workers.dev
```

## تسجيل Webhook في Telegram

استبدل الرابط برابط Worker الذي ظهر بعد النشر:

```bash
BOT_TOKEN="123456:ABC" \
WORKER_URL="https://telegram-personal-bot.USERNAME.workers.dev" \
WEBHOOK_SECRET="نفس_القيمة_التي_وضعتها_في_Cloudflare" \
npm run set-webhook
```

لو ظهر:

```json
{"ok": true}
```

اذهب إلى تليجرام وأرسل للبوت:

```txt
/start
```

## الأوامر

```txt
/start
/help
/status
/templates
/generate وصف المشروع
```

## حذف Webhook

```bash
BOT_TOKEN="123456:ABC" npm run delete-webhook
```

## ملاحظات مهمة

- لا تضع `BOT_TOKEN` داخل `wrangler.toml`؛ استخدم `wrangler secret put`.
- `WEBHOOK_SECRET` يجب أن يكون نفس القيمة في Cloudflare ونفس القيمة عند `setWebhook`.
- لو ظهر خطأ 401 في Telegram، غالبًا السر غير متطابق.
- Cloudflare Workers ممتاز كتجربة شخصية وWebhook خفيف، وليس مكانًا مناسبًا لتوليد ZIP كبير أو تشغيل أوامر طويلة.
