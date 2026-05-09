import process from "node:process";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("Missing BOT_TOKEN env variable.");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ drop_pending_updates: true }),
});

console.log(JSON.stringify(await res.json(), null, 2));
