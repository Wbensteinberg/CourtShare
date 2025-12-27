import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Get the "from" email address - use env var or default to a test domain
const getFromEmail = () => {
  if (process.env.RESEND_FROM_EMAIL) {
    return process.env.RESEND_FROM_EMAIL;
  }
  // Default to a test domain (you'll need to verify your domain in Resend for production)
  return "CourtShare <onboarding@resend.dev>";
};

export interface BookingEmailData {
  bookingId: string;
  courtName: string;
  courtAddress?: string;
  playerName?: string;
  playerEmail: string;
  ownerName?: string;
  ownerEmail: string;
  date: string;
  time: string;
  duration: number;
  price: number;
}

/**
 * Send email to court owner when a new booking is created
 */
export async function sendOwnerBookingNotification(
  data: BookingEmailData
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[EMAIL] RESEND_API_KEY not configured, skipping email");
    return;
  }

  const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!resend) {
    console.error("[EMAIL] Resend not initialized, skipping email");
    return;
  }

  try {
    console.log("[EMAIL] Attempting to send owner notification...");
    console.log("[EMAIL] From:", getFromEmail());
    console.log("[EMAIL] To:", data.ownerEmail);
    const result = await resend.emails.send({
      from: getFromEmail(),
      to: data.ownerEmail,
      subject: `New Booking Request: ${data.courtName} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Booking Request</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #286a3a 0%, #2d7a47 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎾 New Booking Request</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">Hello${
                data.ownerName ? ` ${data.ownerName}` : ""
              },</p>
              
              <p style="font-size: 16px;">You have received a new booking request for <strong>${
                data.courtName
              }</strong>.</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #286a3a;">
                <h2 style="margin-top: 0; color: #286a3a; font-size: 20px;">Booking Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; width: 120px;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; color: #111827;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Time:</strong></td>
                    <td style="padding: 8px 0; color: #111827;">${data.time} (${
        data.duration
      } hour${data.duration > 1 ? "s" : ""})</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Player:</strong></td>
                    <td style="padding: 8px 0; color: #111827;">${
                      data.playerName || data.playerEmail
                    }</td>
                  </tr>
                  ${
                    data.courtAddress
                      ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Location:</strong></td>
                    <td style="padding: 8px 0; color: #111827;">${data.courtAddress}</td>
                  </tr>
                  `
                      : ""
                  }
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Total Amount:</strong></td>
                    <td style="padding: 8px 0; color: #111827; font-weight: bold;">$${data.price.toFixed(
                      2
                    )}</td>
                  </tr>
                </table>
              </div>
              
              <p style="font-size: 16px;">Please log in to your <a href="${
                process.env.NEXT_PUBLIC_APP_URL || "https://courtshare.app"
              }/dashboard/owner" style="color: #286a3a; text-decoration: none; font-weight: 600;">owner dashboard</a> to accept or reject this booking request.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <a href="${
                  process.env.NEXT_PUBLIC_APP_URL || "https://courtshare.app"
                }/dashboard/owner" style="display: inline-block; background: #286a3a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px;">View Dashboard</a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px; margin-bottom: 0;">This is an automated notification from CourtShare.</p>
            </div>
          </body>
        </html>
      `,
    });
    console.log(
      "[EMAIL] Resend API response:",
      JSON.stringify(result, null, 2)
    );

    if (result.error) {
      console.error("[EMAIL] ❌ Resend API returned an error:", result.error);
      const errorMessage = result.error.message || "Failed to send email";

      // Don't fail the webhook if it's just a test domain limitation
      if (errorMessage.includes("only send testing emails to your own email")) {
        console.warn(
          "[EMAIL] ⚠️ Test domain limitation - email not sent. Verify a domain in Resend to send to other addresses."
        );
        return; // Silently skip - don't throw
      }

      throw new Error(errorMessage);
    }

    if (!result.data) {
      console.error("[EMAIL] ❌ Resend API returned no data:", result);
      throw new Error("Resend API returned no data");
    }

    console.log(
      "[EMAIL] ✅ Owner notification sent successfully to:",
      data.ownerEmail,
      "Email ID:",
      result.data.id
    );
  } catch (error: any) {
    console.error("[EMAIL] ❌ Failed to send owner notification:", error);
    console.error("[EMAIL] Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw error;
  }
}

/**
 * Send email to player when owner accepts their booking
 */
export async function sendPlayerBookingConfirmation(
  data: BookingEmailData
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    const error = new Error("RESEND_API_KEY not configured");
    console.error("[EMAIL] ❌ RESEND_API_KEY not configured, skipping email");
    throw error;
  }

  const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!resend) {
    const error = new Error("Resend client not initialized");
    console.error("[EMAIL] ❌ Resend not initialized, skipping email");
    throw error;
  }

  try {
    console.log("[EMAIL] Attempting to send player confirmation...");
    console.log("[EMAIL] From:", getFromEmail());
    console.log("[EMAIL] To:", data.playerEmail);
    const result = await resend.emails.send({
      from: getFromEmail(),
      to: data.playerEmail,
      subject: `Booking Confirmed: ${data.courtName} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Booking Confirmed</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #286a3a 0%, #2d7a47 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">✅ Booking Confirmed!</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">Hello${
                data.playerName ? ` ${data.playerName}` : ""
              },</p>
              
              <p style="font-size: 16px;">Great news! Your booking request for <strong>${
                data.courtName
              }</strong> has been confirmed by the court owner.</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <h2 style="margin-top: 0; color: #286a3a; font-size: 20px;">Booking Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; width: 120px;"><strong>Court:</strong></td>
                    <td style="padding: 8px 0; color: #111827;">${
                      data.courtName
                    }</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; color: #111827;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Time:</strong></td>
                    <td style="padding: 8px 0; color: #111827;">${data.time} (${
        data.duration
      } hour${data.duration > 1 ? "s" : ""})</td>
                  </tr>
                  ${
                    data.courtAddress
                      ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Location:</strong></td>
                    <td style="padding: 8px 0; color: #111827;">${data.courtAddress}</td>
                  </tr>
                  `
                      : ""
                  }
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Total Paid:</strong></td>
                    <td style="padding: 8px 0; color: #111827; font-weight: bold;">$${data.price.toFixed(
                      2
                    )}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <p style="margin: 0; font-size: 14px; color: #065f46;">
                  <strong>📅 Don't forget!</strong> Your booking is confirmed. Please arrive on time and enjoy your game!
                </p>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <a href="${
                  process.env.NEXT_PUBLIC_APP_URL || "https://courtshare.app"
                }/booking/${
        data.bookingId
      }" style="display: inline-block; background: #286a3a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px;">View Booking Details</a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px; margin-bottom: 0;">This is an automated confirmation from CourtShare.</p>
            </div>
          </body>
        </html>
      `,
    });
    console.log(
      "[EMAIL] ✅ Resend API response:",
      JSON.stringify(result, null, 2)
    );
    if (result.data) {
      console.log(
        "[EMAIL] ✅ Player confirmation sent successfully to:",
        data.playerEmail,
        "Email ID:",
        result.data.id
      );
    } else if (result.error) {
      console.error("[EMAIL] ❌ Resend API error:", result.error);
      throw new Error(result.error.message || "Failed to send email");
    }
  } catch (error: any) {
    console.error("[EMAIL] Failed to send player confirmation:", error);
    throw error;
  }
}
