export interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  ADMIN_IDS?: string;
  BOT_NAME?: string;
  WEBHOOK_PATH?: string;
  ALLOWED_ADMIN_ONLY?: string;
  WORKER_API_URL?: string;
  WORKER_API_TOKEN?: string;
}

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type: string; username?: string; first_name?: string };
  from?: { id: number; is_bot?: boolean; first_name?: string; username?: string };
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from: { id: number; first_name?: string; username?: string };
  message?: TelegramMessage;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function parseAdminIds(env: Env): Set<number> {
  return new Set(
    (env.ADMIN_IDS || "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x))
  );
}

function isAdmin(userId: number | undefined, env: Env): boolean {
  const adminOnly = (env.ALLOWED_ADMIN_ONLY || "true").toLowerCase() !== "false";
  if (!adminOnly) return true;
  if (!userId) return false;
  const admins = parseAdminIds(env);
  return admins.size === 0 ? false : admins.has(userId);
}

async function telegram(env: Env, method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error("Telegram API error", method, data);
  return data;
}

async function sendMessage(env: Env, chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return telegram(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

async function answerCallbackQuery(env: Env, callbackQueryId: string, text?: string) {
  return telegram(env, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text || "تم",
  });
}

function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🚀 توليد مشروع", callback_data: "generate" },
        { text: "📌 الحالة", callback_data: "status" },
      ],
      [
        { text: "🧩 القوالب", callback_data: "templates" },
        { text: "ℹ️ المساعدة", callback_data: "help" },
      ],
    ],
  };
}

function helpText(env: Env) {
  return `🤖 <b>${env.BOT_NAME || "Personal Builder Bot"}</b>\n\nهذا بوت شخصي خفيف يعمل على Cloudflare Workers عبر Webhook.\n\nالأوامر:\n/start - بدء البوت\n/help - شرح سريع\n/status - حالة الربط\n/templates - عرض القوالب\n/generate وصف المشروع - إرسال طلب توليد\n\nمثال:\n<code>/generate ابنِ لي مشروع Next.js عربي RTL مع داشبورد وتوليد ZIP</code>\n\nملاحظة: Cloudflare Worker مناسب للواجهة الخفيفة والWebhook. التوليد الثقيل يجب أن يتم عبر API خارجي مثل Replit/Railway/VPS.`;
}

async function handleGenerate(env: Env, chatId: number, userId: number, prompt: string) {
  if (!prompt.trim()) {
    await sendMessage(
      env,
      chatId,
      "اكتب وصف المشروع بعد الأمر.\n\nمثال:\n<code>/generate بوت تليجرام لإدارة مهام الأسرة مع Supabase</code>"
    );
    return;
  }

  if (!env.WORKER_API_URL) {
    await sendMessage(
      env,
      chatId,
      `✅ استلمت وصف المشروع، لكن لم يتم ربط API خارجي للتوليد بعد.\n\nالوصف:\n<code>${escapeHtml(prompt.slice(0, 1800))}</code>\n\nللتفعيل الحقيقي أضف WORKER_API_URL يشير إلى Replit/Railway/VPS ينفذ التوليد ويعيد رابط ZIP.`
    );
    return;
  }

  await sendMessage(env, chatId, "⏳ تم إرسال طلبك إلى الوركر الخارجي. سأرجع لك بالنتيجة إن عاد الرابط.");

  try {
    const res = await fetch(`${env.WORKER_API_URL.replace(/\/$/, "")}/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.WORKER_API_TOKEN ? { authorization: `Bearer ${env.WORKER_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ chat_id: chatId, user_id: userId, prompt }),
    });

    const data = await res.json().catch(() => ({})) as { ok?: boolean; zip_url?: string; message?: string; error?: string };

    if (!res.ok || data.ok === false) {
      await sendMessage(env, chatId, `❌ فشل الوركر الخارجي:\n<code>${escapeHtml(data.error || res.statusText)}</code>`);
      return;
    }

    if (data.zip_url) {
      await sendMessage(env, chatId, `✅ تم تجهيز الملف:\n${escapeHtml(data.zip_url)}`);
      return;
    }

    await sendMessage(env, chatId, `✅ رد الوركر:\n${escapeHtml(data.message || "تم تنفيذ الطلب.")}`);
  } catch (err) {
    await sendMessage(env, chatId, `❌ تعذر الاتصال بالوركر الخارجي:\n<code>${escapeHtml(String(err))}</code>`);
  }
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function handleMessage(env: Env, msg: TelegramMessage) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!isAdmin(userId, env)) {
    await sendMessage(env, chatId, "🚫 هذا بوت شخصي. حسابك غير مصرح له.");
    return;
  }

  const text = (msg.text || "").trim();

  if (text === "/start") {
    await sendMessage(env, chatId, helpText(env), { reply_markup: mainKeyboard() });
    return;
  }

  if (text === "/help") {
    await sendMessage(env, chatId, helpText(env), { reply_markup: mainKeyboard() });
    return;
  }

  if (text === "/status") {
    await sendMessage(
      env,
      chatId,
      `✅ البوت يعمل على Cloudflare Workers.\n\nWebhook: نشط\nExternal Worker: ${env.WORKER_API_URL ? "مربوط" : "غير مربوط"}\nAdmin Only: ${(env.ALLOWED_ADMIN_ONLY || "true")}`
    );
    return;
  }

  if (text === "/templates") {
    await sendMessage(
      env,
      chatId,
      "🧩 القوالب المقترحة:\n\n1) Next.js Arabic CMS\n2) Flutter Android App\n3) FastAPI Backend\n4) Telegram Bot\n5) Dashboard + Supabase\n\nاكتب: <code>/generate</code> ثم وصف ما تريد."
    );
    return;
  }

  if (text.startsWith("/generate")) {
    await handleGenerate(env, chatId, userId || 0, text.replace("/generate", "").trim());
    return;
  }

  await sendMessage(
    env,
    chatId,
    "أرسل /help للأوامر، أو استخدم:\n<code>/generate وصف المشروع المطلوب</code>",
    { reply_markup: mainKeyboard() }
  );
}

async function handleCallback(env: Env, cb: TelegramCallbackQuery) {
  const userId = cb.from.id;
  const chatId = cb.message?.chat.id;
  if (!chatId) return;

  if (!isAdmin(userId, env)) {
    await answerCallbackQuery(env, cb.id, "غير مصرح");
    await sendMessage(env, chatId, "🚫 هذا بوت شخصي. حسابك غير مصرح له.");
    return;
  }

  await answerCallbackQuery(env, cb.id);

  switch (cb.data) {
    case "generate":
      await sendMessage(env, chatId, "اكتب طلبك بهذا الشكل:\n<code>/generate ابنِ لي مشروع ...</code>");
      break;
    case "status":
      await sendMessage(env, chatId, `✅ Cloudflare Worker يعمل.\nExternal Worker: ${env.WORKER_API_URL ? "مربوط" : "غير مربوط"}`);
      break;
    case "templates":
      await sendMessage(env, chatId, "🧩 Next.js CMS / Flutter App / FastAPI / Telegram Bot / Dashboard + Supabase");
      break;
    case "help":
    default:
      await sendMessage(env, chatId, helpText(env), { reply_markup: mainKeyboard() });
  }
}

async function handleTelegramUpdate(env: Env, update: TelegramUpdate) {
  if (update.message) await handleMessage(env, update.message);
  if (update.callback_query) await handleCallback(env, update.callback_query);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const webhookPath = env.WEBHOOK_PATH || "/telegram/webhook";

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: env.BOT_NAME || "telegram-personal-bot", mode: "cloudflare-worker-webhook" });
    }

    if (request.method === "POST" && url.pathname === webhookPath) {
      const incomingSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (!env.WEBHOOK_SECRET || incomingSecret !== env.WEBHOOK_SECRET) {
        return json({ ok: false, error: "Invalid webhook secret" }, 401);
      }

      let update: TelegramUpdate;
      try {
        update = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON" }, 400);
      }

      // نرجع 200 بعد المعالجة. للبوت الشخصي هذا مناسب وبسيط.
      await handleTelegramUpdate(env, update);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Not found", health: "/health", webhook: webhookPath }, 404);
  },
};
