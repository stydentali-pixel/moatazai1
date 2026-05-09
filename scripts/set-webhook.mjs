import process from "node:process";

const token = process.env.BOT_TOKEN;
const workerUrl = process.env.WORKER_URL;
const webhookPath = process.env.WEBHOOK_PATH || "/telegram/webhook";
const secret = process.env.WEBHOOK_SECRET;

if (!token || !workerUrl || !secret) {
  console.error("Missing BOT_TOKEN, WORKER_URL, or WEBHOOK_SECRET env variables.");
  console.error("Example:");
  console.error("BOT_TOKEN=123:abc WORKER_URL=https://telegram-personal-bot.USER.workers.dev WEBHOOK_SECRET=my_secret npm run set-webhook");
  process.exit(1);
}

const webhookUrl = `${workerUrl.replace(/\/$/, "")}${webhookPath}`;
const apiUrl = `https://api.telegram.org/bot${token}/setWebhook`;

const res = await fetch(apiUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secret,
    drop_pending_updates: true,
    allowed_updates: ["message", "callback_query"],
  }),
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
console.log("Webhook URL:", webhookUrl);
