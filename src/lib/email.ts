import { Resend } from "resend";
import { theme } from "./theme";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const brandGreen = theme.colors.brandGreen;
const brandGreenSoft = theme.colors.brandGreenSoft;
const textColor = "#10231d";
const mutedTextColor = "#64756f";
const borderColor = "#dce7e2";
const pageBg = "#f6faf8";
const cardBg = "#ffffff";

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

type PaymentReleaseStatus = "authorization_released" | "refunded" | "no_payment";

const paymentReleaseCopy = (
  status?: PaymentReleaseStatus,
  amount?: number
): string => {
  if (status === "refunded") {
    return `A refund of $${(amount || 0).toFixed(
      2
    )} has been issued to the original payment method. It may take a few business days to appear.`;
  }

  if (status === "authorization_released") {
    return `The card authorization for $${(amount || 0).toFixed(
      2
    )} has been released. The player was not charged.`;
  }

  return "No payment was captured for this booking.";
};

/**
 * Send email to court host when a new booking is created
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
    console.log("[EMAIL] Attempting to send host notification...");
    console.log("[EMAIL] From:", getFromEmail());
    console.log("[EMAIL] To:", data.ownerEmail);
    const result = await resend.emails.send({
      from: getFromEmail(),
      to: data.ownerEmail,
      subject: `New booking request: ${data.courtName} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Booking Request</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 600px; margin: 0 auto; padding: 20px; background: ${pageBg};">
            <div style="background: ${brandGreen}; padding: 28px; text-align: left; border-radius: 14px 14px 0 0;">
              <p style="color: rgba(255,255,255,0.78); margin: 0 0 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">CourtShare</p>
              <h1 style="color: white; margin: 0; font-size: 26px; line-height: 1.25;">New booking request</h1>
            </div>
            
            <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">Hello${
                data.ownerName ? ` ${data.ownerName}` : ""
              },</p>
              
              <p style="font-size: 16px;">You have received a new booking request for <strong>${
                data.courtName
              }</strong>. The player's card has been authorized; payment will only be captured if you accept within 24 hours.</p>
              
              <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
                <h2 style="margin-top: 0; color: ${brandGreen}; font-size: 20px;">Booking Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor}; width: 120px;"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor};">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor};"><strong>Time:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor};">${data.time} (${
        data.duration
      } hour${data.duration > 1 ? "s" : ""})</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor};"><strong>Player:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor};">${
                      data.playerName || data.playerEmail
                    }</td>
                  </tr>
                  ${
                    data.courtAddress
                      ? `
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor};"><strong>Location:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor};">${data.courtAddress}</td>
                  </tr>
                  `
                      : ""
                  }
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor};"><strong>Authorized:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor}; font-weight: bold;">$${data.price.toFixed(
                      2
                    )}</td>
                  </tr>
                </table>
              </div>
              
              <p style="font-size: 16px;">Please log in to your <a href="${
                process.env.NEXT_PUBLIC_APP_URL || "https://courtshare.co"
              }/host" style="color: ${brandGreen}; text-decoration: none; font-weight: 600;">host dashboard</a> to accept or decline this request.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <a href="${
                  process.env.NEXT_PUBLIC_APP_URL || "https://courtshare.co"
                }/host" style="display: inline-block; background: ${brandGreen}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px;">View Dashboard</a>
              </div>
              
              <p style="font-size: 14px; color: ${mutedTextColor}; margin-top: 30px; margin-bottom: 0;">This request expires after 24 hours if no action is taken.</p>
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
      const errorMessage = result.error.message || "Failed to send email";
      console.error("[EMAIL] Resend API error:", errorMessage);

      // Don't fail the webhook if it's Resend's test-domain restriction (can only send to your Resend account email)
      const isTestDomainRestriction =
        /only send.*your own email|testing emails to your own|verify.*domain/i.test(
          errorMessage
        );
      if (isTestDomainRestriction) {
        console.warn(
          "[EMAIL] Resend test-domain restriction: from=onboarding@resend.dev can only send to your Resend account email. Add a verified domain in Resend and set RESEND_FROM_EMAIL (e.g. CourtShare <notifications@courtshare.co>) in Vercel."
        );
        return;
      }

      throw new Error(errorMessage);
    }

    if (!result.data) {
      console.error("[EMAIL] Resend API returned no data:", result);
      throw new Error("Resend API returned no data");
    }

    console.log(
      "[EMAIL] Host notification sent successfully to:",
      data.ownerEmail,
      "Email ID:",
      result.data.id
    );
  } catch (error: any) {
    console.error("[EMAIL] Failed to send host notification:", error);
    console.error("[EMAIL] Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw error;
  }
}

/**
 * Send email to player when host accepts their booking
 */
export async function sendPlayerBookingConfirmation(
  data: BookingEmailData
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    const error = new Error("RESEND_API_KEY not configured");
    console.error("[EMAIL] RESEND_API_KEY not configured, skipping email");
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
    console.error("[EMAIL] Resend not initialized, skipping email");
    throw error;
  }

  try {
    console.log("[EMAIL] Attempting to send player confirmation...");
    console.log("[EMAIL] From:", getFromEmail());
    console.log("[EMAIL] To:", data.playerEmail);
    const result = await resend.emails.send({
      from: getFromEmail(),
      to: data.playerEmail,
      subject: `Booking confirmed: ${data.courtName} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Booking Confirmed</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 600px; margin: 0 auto; padding: 20px; background: ${pageBg};">
            <div style="background: ${brandGreen}; padding: 28px; text-align: left; border-radius: 14px 14px 0 0;">
              <p style="color: rgba(255,255,255,0.78); margin: 0 0 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">CourtShare</p>
              <h1 style="color: white; margin: 0; font-size: 26px; line-height: 1.25;">Booking confirmed</h1>
            </div>
            
            <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">Hello${
                data.playerName ? ` ${data.playerName}` : ""
              },</p>
              
              <p style="font-size: 16px;">Your booking request for <strong>${
                data.courtName
              }</strong> has been accepted by the court host. Your payment has now been captured.</p>
              
              <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
                <h2 style="margin-top: 0; color: ${brandGreen}; font-size: 20px;">Booking Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor}; width: 120px;"><strong>Court:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor};">${
                      data.courtName
                    }</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor};"><strong>Date:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor};">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor};"><strong>Time:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor};">${data.time} (${
        data.duration
      } hour${data.duration > 1 ? "s" : ""})</td>
                  </tr>
                  ${
                    data.courtAddress
                      ? `
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor};"><strong>Location:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor};">${data.courtAddress}</td>
                  </tr>
                  `
                      : ""
                  }
                  <tr>
                    <td style="padding: 8px 0; color: ${mutedTextColor};"><strong>Payment captured:</strong></td>
                    <td style="padding: 8px 0; color: ${textColor}; font-weight: bold;">$${data.price.toFixed(
                      2
                    )}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background: ${brandGreenSoft}; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
                <p style="margin: 0; font-size: 14px; color: ${brandGreen};">
                  <strong>You're all set.</strong> Please arrive on time and follow any access instructions from the court host.
                </p>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <a href="${
                  process.env.NEXT_PUBLIC_APP_URL || "https://courtshare.co"
                }/booking/${
        data.bookingId
      }" style="display: inline-block; background: ${brandGreen}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px;">View Booking Details</a>
              </div>
              
              <p style="font-size: 14px; color: ${mutedTextColor}; margin-top: 30px; margin-bottom: 0;">This is an automated confirmation from CourtShare.</p>
            </div>
          </body>
        </html>
      `,
    });
    console.log(
      "[EMAIL] Resend API response:",
      JSON.stringify(result, null, 2)
    );
    if (result.data) {
      console.log(
        "[EMAIL] Player confirmation sent successfully to:",
        data.playerEmail,
        "Email ID:",
        result.data.id
      );
    } else if (result.error) {
      console.error("[EMAIL] Resend API error:", result.error);
      throw new Error(result.error.message || "Failed to send email");
    }
  } catch (error: any) {
    console.error("[EMAIL] Failed to send player confirmation:", error);
    throw error;
  }
}

export interface CancellationEmailData {
  courtName: string;
  ownerEmail: string;
  ownerName?: string;
  playerName?: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  paymentStatus?: PaymentReleaseStatus;
}

/**
 * Send email to court host when a player cancels their booking
 */
export async function sendOwnerCancellationNotification(
  data: CancellationEmailData
): Promise<void> {
  if (!resend) {
    console.warn("[EMAIL] Resend not initialized, skipping host cancellation email");
    return;
  }

  const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: data.ownerEmail,
      subject: `Booking cancelled: ${data.courtName} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 600px; margin: 0 auto; padding: 20px; background: ${pageBg};">
            <div style="background: ${brandGreen}; padding: 28px; text-align: left; border-radius: 14px 14px 0 0;">
              <p style="color: rgba(255,255,255,0.78); margin: 0 0 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">CourtShare</p>
              <h1 style="color: white; margin: 0; font-size: 26px;">Booking cancelled</h1>
            </div>
            <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
              <p style="font-size: 16px;">Hello${data.ownerName ? ` ${data.ownerName}` : ""},</p>
              <p style="font-size: 16px;">A player has cancelled their booking for <strong>${data.courtName}</strong>.</p>
              <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
                <p style="margin: 0 0 8px;"><strong>Player:</strong> ${data.playerName || "Guest"}</p>
                <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 0 0 8px;"><strong>Time:</strong> ${data.time} (${data.duration}h)</p>
                <p style="margin: 0;"><strong>Payment:</strong> ${paymentReleaseCopy(data.paymentStatus, data.price)}</p>
              </div>
              <p style="font-size: 14px; color: ${mutedTextColor};">This is an automated notification from CourtShare.</p>
            </div>
          </body>
        </html>
      `,
    });
    console.log("[EMAIL] Host cancellation notification sent to:", data.ownerEmail);
  } catch (error: any) {
    console.error("[EMAIL] Failed to send host cancellation email:", error);
    throw error;
  }
}

export interface PlayerCancellationConfirmationData {
  courtName: string;
  playerEmail: string;
  playerName?: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  paymentStatus?: PaymentReleaseStatus;
}

/**
 * Send email to player confirming they successfully cancelled their reservation
 */
export async function sendPlayerCancellationConfirmation(
  data: PlayerCancellationConfirmationData
): Promise<void> {
  if (!resend) {
    console.warn("[EMAIL] Resend not initialized, skipping player cancellation confirmation");
    return;
  }

  const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: data.playerEmail,
      subject: `Reservation cancelled: ${data.courtName} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 600px; margin: 0 auto; padding: 20px; background: ${pageBg};">
            <div style="background: ${brandGreen}; padding: 28px; text-align: left; border-radius: 14px 14px 0 0;">
              <p style="color: rgba(255,255,255,0.78); margin: 0 0 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">CourtShare</p>
              <h1 style="color: white; margin: 0; font-size: 26px;">Reservation cancelled</h1>
            </div>
            <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
              <p style="font-size: 16px;">Hello${data.playerName ? ` ${data.playerName}` : ""},</p>
              <p style="font-size: 16px;">You have successfully cancelled your reservation for <strong>${data.courtName}</strong>.</p>
              <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
                <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 0 0 8px;"><strong>Time:</strong> ${data.time} (${data.duration}h)</p>
                <p style="margin: 0;"><strong>Payment:</strong> ${paymentReleaseCopy(data.paymentStatus, data.price)}</p>
              </div>
              <p style="font-size: 14px; color: ${mutedTextColor};">This is an automated confirmation from CourtShare.</p>
            </div>
          </body>
        </html>
      `,
    });
    console.log("[EMAIL] Player cancellation confirmation sent to:", data.playerEmail);
  } catch (error: any) {
    console.error("[EMAIL] Failed to send player cancellation confirmation:", error);
    throw error;
  }
}

export interface RejectionEmailData {
  courtName: string;
  playerEmail: string;
  playerName?: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  paymentStatus?: PaymentReleaseStatus;
}

/**
 * Send email to player when host rejects their booking
 */
export async function sendPlayerRejectionNotification(
  data: RejectionEmailData
): Promise<void> {
  if (!resend) {
    console.warn("[EMAIL] Resend not initialized, skipping player rejection email");
    return;
  }

  const formattedDate = new Date(data.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: data.playerEmail,
      subject: `Booking declined: ${data.courtName} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 600px; margin: 0 auto; padding: 20px; background: ${pageBg};">
            <div style="background: ${brandGreen}; padding: 28px; text-align: left; border-radius: 14px 14px 0 0;">
              <p style="color: rgba(255,255,255,0.78); margin: 0 0 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">CourtShare</p>
              <h1 style="color: white; margin: 0; font-size: 26px;">Booking declined</h1>
            </div>
            <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
              <p style="font-size: 16px;">Hello${data.playerName ? ` ${data.playerName}` : ""},</p>
              <p style="font-size: 16px;">The court host declined your booking request for <strong>${data.courtName}</strong>.</p>
              <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
                <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 0 0 8px;"><strong>Time:</strong> ${data.time} (${data.duration}h)</p>
                <p style="margin: 0;"><strong>Payment:</strong> ${paymentReleaseCopy(data.paymentStatus, data.price)}</p>
              </div>
              <p style="font-size: 16px;">You can browse other courts and book a different time.</p>
              <div style="margin-top: 20px; text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://courtshare.co"}/search" style="display: inline-block; background: ${brandGreen}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Browse Courts</a>
              </div>
              <p style="font-size: 14px; color: ${mutedTextColor}; margin-top: 30px;">This is an automated notification from CourtShare.</p>
            </div>
          </body>
        </html>
      `,
    });
    console.log("[EMAIL] Player rejection notification sent to:", data.playerEmail);
  } catch (error: any) {
    console.error("[EMAIL] Failed to send player rejection email:", error);
    throw error;
  }
}
