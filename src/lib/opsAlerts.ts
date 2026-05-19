const ALERT_WEBHOOK_URL =
  process.env.WEBHOOK_ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;

export async function sendOpsAlert(title: string, details: string) {
  if (!ALERT_WEBHOOK_URL) return;
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `:rotating_light: ${title}\n${details}` }),
    });
  } catch (err) {
    console.error("[OPS-ALERT] Failed to send alert:", err);
  }
}
