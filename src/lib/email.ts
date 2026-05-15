import { Resend } from "resend";
import { theme } from "./theme";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const brandGreen = theme.colors.brandGreen;
const brandGreenSoft = theme.colors.brandGreenSoft;
const ownerRequestPrimaryGreen = brandGreen;
const textColor = "#10231d";
const mutedTextColor = "#64756f";
const borderColor = "#dce7e2";
const pageBg = "#f6faf8";
const cardBg = "#ffffff";
const ownerRequestShellBg =
  "linear-gradient(135deg, #f4fbf8 0%, #dff2eb 48%, #bddfd3 100%)";
const ownerRequestHeroBg =
  "linear-gradient(135deg, #103c31 0%, #17624d 54%, #0d8a68 100%)";
const ownerRequestShellBorder = "#b8d9ce";
const ownerRequestShellMuted = "#527368";
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://courtshare.co").replace(
  /\/$/,
  ""
);

// Get the "from" email address - use env var or default to a test domain
const getFromEmail = () => {
  if (process.env.RESEND_FROM_EMAIL) {
    return process.env.RESEND_FROM_EMAIL;
  }
  // Default to a test domain (you'll need to verify your domain in Resend for production)
  return "CourtShare <onboarding@resend.dev>";
};

const emailHeader = (title: string) => `
  <div style="background: ${cardBg}; padding: 28px 32px 18px; border-radius: 28px 28px 0 0; border: 1px solid ${borderColor}; border-bottom: none;">
    <div style="color: ${brandGreen}; font-size: 34px; line-height: 1; font-weight: 900; letter-spacing: -0.06em; margin: 0 0 22px;">CourtShare</div>
    <div style="background: ${brandGreen}; border-radius: 24px; padding: 28px; box-shadow: 0 18px 45px rgba(0, 134, 101, 0.18);">
      <p style="margin: 0 0 10px; color: rgba(255,255,255,0.78); font-size: 12px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;">Booking request</p>
      <h1 style="color: white; margin: 0; font-size: 30px; line-height: 1.15; letter-spacing: -0.04em;">${title}</h1>
    </div>
  </div>
`;

const ownerBookingRequestHeader = (title: string) => `
  <div style="background: ${ownerRequestShellBg}; padding: 30px 32px 0; border-radius: 30px 30px 0 0; border: 1px solid ${ownerRequestShellBorder}; border-bottom: none;">
    <div style="color: ${ownerRequestPrimaryGreen}; font-size: 34px; line-height: 1; font-weight: 900; letter-spacing: -0.06em; margin: 0 0 22px;">CourtShare</div>
    <div style="background: ${ownerRequestHeroBg}; border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 26px; padding: 28px; box-shadow: 0 24px 70px rgba(0, 134, 101, 0.24);">
      <p style="margin: 0 0 10px; color: ${ownerRequestPrimaryGreen}; font-size: 12px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase;">Booking request</p>
      <h1 style="color: #ffffff; margin: 0; font-size: 30px; line-height: 1.15; letter-spacing: -0.04em;">${title}</h1>
    </div>
  </div>
`;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatBookingEmailDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const sendEmail = async ({
  to,
  subject,
  html,
  logLabel,
}: {
  to: string;
  subject: string;
  html: string;
  logLabel: string;
}) => {
  if (!resend) {
    console.warn(`[EMAIL] Resend not initialized, skipping ${logLabel}`);
    return;
  }

  const result = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject,
    html,
  });

  if (result.error) {
    throw new Error(result.error.message || `Failed to send ${logLabel}`);
  }
};

export interface BookingEmailData {
  bookingId: string;
  conversationId?: string;
  courtName: string;
  courtAddress?: string;
  courtLocation?: string;
  courtImageUrl?: string;
  playerName?: string;
  playerEmail: string;
  ownerName?: string;
  ownerEmail: string;
  date: string;
  time: string;
  duration: number;
  durationMinutes?: number;
  courtNumber?: number;
  guestCount?: number;
  price: number;
  initialMessage?: string;
}

type PaymentReleaseStatus = "authorization_released" | "refunded" | "no_payment";
type PaymentCopyAudience = "player" | "host";

const paymentReleaseCopy = (
  status?: PaymentReleaseStatus,
  amount?: number,
  audience: PaymentCopyAudience = "player"
): string => {
  if (status === "refunded") {
    const paymentMethod =
      audience === "player"
        ? "your original payment method"
        : "the player's original payment method";
    return `A refund of $${(amount || 0).toFixed(
      2
    )} has been issued to ${paymentMethod}. It may take a few business days to appear.`;
  }

  if (status === "authorization_released") {
    if (audience === "player") {
      return `Your card authorization for $${(amount || 0).toFixed(
        2
      )} has been released. You were not charged.`;
    }

    return `The player's card authorization for $${(amount || 0).toFixed(
      2
    )} has been released. The player was not charged.`;
  }

  return "No payment was completed for this booking.";
};

const formatDurationLabel = (data: Pick<BookingEmailData, "duration" | "durationMinutes">) => {
  const minutes =
    typeof data.durationMinutes === "number" && data.durationMinutes > 0
      ? data.durationMinutes
      : Math.round((data.duration || 1) * 60);
  const hours = minutes / 60;

  if (minutes % 60 === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const wholeHours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return wholeHours > 0
    ? `${wholeHours} hour${wholeHours === 1 ? "" : "s"} ${remainingMinutes} minutes`
    : `${remainingMinutes} minutes`;
};

const bookingResponseUrl = (data: BookingEmailData) => {
  const conversationId =
    typeof data.conversationId === "string" && data.conversationId.trim()
      ? data.conversationId.trim()
      : `booking_${data.bookingId}`;
  return `${appUrl}/messages?conversationId=${encodeURIComponent(conversationId)}`;
};

export const buildOwnerBookingNotificationEmail = (data: BookingEmailData) => {
  const formattedDate = formatBookingEmailDate(data.date);
  const playerLabel = data.playerName?.trim() || data.playerEmail;
  const durationLabel = formatDurationLabel(data);
  const responseUrl = bookingResponseUrl(data);
  const locationLabel = data.courtAddress || data.courtLocation;
  const courtNumberLabel =
    typeof data.courtNumber === "number" && data.courtNumber > 0
      ? `Court ${data.courtNumber}`
      : "Court";
  const guestCount =
    typeof data.guestCount === "number" && data.guestCount > 0
      ? data.guestCount
      : null;
  const safePlayerLabel = escapeHtml(playerLabel);
  const safeCourtName = escapeHtml(data.courtName);

  return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Respond to ${safePlayerLabel}'s Request</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 680px; margin: 0 auto; padding: 28px 16px; background: ${ownerRequestShellBg};">
            ${ownerBookingRequestHeader(`Respond to ${safePlayerLabel}'s request`)}

            <div style="background: ${ownerRequestShellBg}; padding: 18px 32px 32px; border-radius: 0 0 30px 30px; border: 1px solid ${ownerRequestShellBorder}; border-top: none;">
              <div style="background: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 26px; padding: 28px; box-shadow: 0 24px 70px rgba(16, 35, 29, 0.16);">
              <p style="font-size: 16px; margin-top: 0;">Hello${data.ownerName ? ` ${escapeHtml(data.ownerName)}` : ""},</p>
              <p style="font-size: 16px; margin-bottom: 22px; color: ${mutedTextColor};">${safePlayerLabel} requested to book <strong style="color: ${textColor};">${safeCourtName}</strong>. Their payment method is authorized, and they will only be charged if you accept before the request expires.</p>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${responseUrl}" style="display: inline-block; width: 100%; max-width: 360px; background: ${ownerRequestPrimaryGreen}; color: white; padding: 15px 22px; text-decoration: none; border-radius: 999px; font-weight: 900; font-size: 16px; box-shadow: 0 14px 30px rgba(0, 184, 132, 0.24);">Accept / Decline</a>
              </div>

              <div style="border: 1px solid ${borderColor}; border-radius: 24px; overflow: hidden; margin: 24px 0; background: ${cardBg}; box-shadow: 0 18px 55px rgba(16, 35, 29, 0.08);">
                ${
                  data.courtImageUrl
                    ? `<img src="${escapeHtml(data.courtImageUrl)}" alt="${safeCourtName}" style="display: block; width: 100%; max-height: 250px; object-fit: cover;">`
                    : ""
                }
                <div style="padding: 24px;">
                  <p style="margin: 0 0 6px; color: ${ownerRequestPrimaryGreen}; font-size: 12px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase;">New booking request</p>
                  <h2 style="margin: 0 0 4px; color: ${textColor}; font-size: 24px; line-height: 1.2; letter-spacing: -0.04em;">${safeCourtName}</h2>
                  ${locationLabel ? `<p style="margin: 0; color: ${mutedTextColor}; font-size: 14px;">${escapeHtml(locationLabel)}</p>` : ""}

                  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr>
                      <td style="padding: 12px 0; color: ${mutedTextColor}; border-top: 1px solid ${borderColor}; width: 42%;">Check-in</td>
                      <td style="padding: 12px 0; color: ${textColor}; border-top: 1px solid ${borderColor}; font-weight: 700;">${formattedDate}<br><span style="font-weight: 600;">${escapeHtml(data.time)}</span></td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; color: ${mutedTextColor}; border-top: 1px solid ${borderColor};">Duration</td>
                      <td style="padding: 12px 0; color: ${textColor}; border-top: 1px solid ${borderColor}; font-weight: 700;">${durationLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; color: ${mutedTextColor}; border-top: 1px solid ${borderColor};">Court</td>
                      <td style="padding: 12px 0; color: ${textColor}; border-top: 1px solid ${borderColor}; font-weight: 700;">${courtNumberLabel}</td>
                    </tr>
                    ${
                      guestCount
                        ? `<tr>
                      <td style="padding: 12px 0; color: ${mutedTextColor}; border-top: 1px solid ${borderColor};">Guests</td>
                      <td style="padding: 12px 0; color: ${textColor}; border-top: 1px solid ${borderColor}; font-weight: 700;">${guestCount}</td>
                    </tr>`
                        : ""
                    }
                    <tr>
                      <td style="padding: 12px 0; color: ${mutedTextColor}; border-top: 1px solid ${borderColor};">Authorized amount</td>
                      <td style="padding: 12px 0; color: ${textColor}; border-top: 1px solid ${borderColor}; font-weight: 800;">$${data.price.toFixed(2)}</td>
                    </tr>
                  </table>
                </div>
              </div>

              <div style="background: ${brandGreenSoft}; border: 1px solid #c7efe3; border-radius: 22px; padding: 20px; margin: 22px 0;">
                <p style="margin: 0 0 8px; color: ${textColor}; font-weight: 800;">${safePlayerLabel}</p>
                <p style="margin: 0; color: ${mutedTextColor}; font-size: 14px;">${escapeHtml(data.playerEmail)}</p>
                ${
                  data.initialMessage?.trim()
                    ? `<div style="background: ${cardBg}; border-radius: 16px; margin-top: 14px; padding: 14px; border: 1px solid rgba(0, 184, 132, 0.12);">
                <p style="margin: 0 0 6px; color: ${mutedTextColor}; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;">Message from player</p>
                <p style="white-space: pre-wrap; margin: 0; color: ${textColor};">${escapeHtml(data.initialMessage)}</p>
              </div>`
                    : ""
                }
              </div>

              <div style="background: #f3faf7; border: 1px solid ${borderColor}; border-radius: 20px; padding: 18px; margin-top: 22px;">
                <p style="margin: 0 0 8px; color: ${textColor}; font-weight: 800;">Payment status</p>
                <p style="margin: 0; color: ${mutedTextColor}; font-size: 14px;">The player has not been charged yet. If you accept before the request expires, the booking is confirmed and payment is completed automatically.</p>
              </div>

              <p style="font-size: 14px; color: ${mutedTextColor}; margin-top: 24px; margin-bottom: 0;">Open the request to view the booking conversation, the player&apos;s profile, and the accept or decline controls.</p>
              </div>
              <p style="margin: 22px 0 0; color: ${ownerRequestShellMuted}; font-size: 12px; text-align: center;">CourtShare sends this request because you host ${safeCourtName}.</p>
            </div>
          </body>
        </html>
      `;
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

  const formattedDate = formatBookingEmailDate(data.date);

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
      html: buildOwnerBookingNotificationEmail(data),
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
            ${emailHeader("Booking confirmed")}
            
            <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
              <p style="font-size: 16px; margin-top: 0;">Hello${
                data.playerName ? ` ${data.playerName}` : ""
              },</p>
              
              <p style="font-size: 16px;">Your booking request for <strong>${
                data.courtName
              }</strong> has been accepted by the court host. Your payment is complete and the reservation is confirmed.</p>
              
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
                    <td style="padding: 8px 0; color: ${mutedTextColor};"><strong>Payment completed:</strong></td>
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
                  appUrl
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
            ${emailHeader("Booking cancelled")}
            <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
              <p style="font-size: 16px;">Hello${data.ownerName ? ` ${data.ownerName}` : ""},</p>
              <p style="font-size: 16px;">A player has cancelled their booking for <strong>${data.courtName}</strong>.</p>
              <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
                <p style="margin: 0 0 8px;"><strong>Player:</strong> ${data.playerName || "Guest"}</p>
                <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 0 0 8px;"><strong>Time:</strong> ${data.time} (${data.duration}h)</p>
                <p style="margin: 0;"><strong>Payment:</strong> ${paymentReleaseCopy(data.paymentStatus, data.price, "host")}</p>
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
            ${emailHeader("Reservation cancelled")}
            <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
              <p style="font-size: 16px;">Hello${data.playerName ? ` ${data.playerName}` : ""},</p>
              <p style="font-size: 16px;">You have successfully cancelled your reservation for <strong>${data.courtName}</strong>.</p>
              <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
                <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 0 0 8px;"><strong>Time:</strong> ${data.time} (${data.duration}h)</p>
                <p style="margin: 0;"><strong>Payment:</strong> ${paymentReleaseCopy(data.paymentStatus, data.price, "player")}</p>
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

export async function sendPlayerHostCancellationNotification(
  data: PlayerCancellationConfirmationData
): Promise<void> {
  const formattedDate = formatBookingEmailDate(data.date);

  await sendEmail({
    to: data.playerEmail,
    subject: `Host cancelled: ${data.courtName} on ${formattedDate}`,
    logLabel: "player host cancellation email",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 600px; margin: 0 auto; padding: 20px; background: ${pageBg};">
          ${emailHeader("Booking cancelled by host")}
          <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
            <p style="font-size: 16px;">Hello${data.playerName ? ` ${escapeHtml(data.playerName)}` : ""},</p>
            <p style="font-size: 16px;">The host cancelled your reservation for <strong>${escapeHtml(data.courtName)}</strong>.</p>
            <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
              <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 0 0 8px;"><strong>Time:</strong> ${escapeHtml(data.time)} (${data.duration}h)</p>
              <p style="margin: 0;"><strong>Payment:</strong> ${paymentReleaseCopy(data.paymentStatus, data.price, "player")}</p>
            </div>
            <div style="margin-top: 20px; text-align: center;">
              <a href="${appUrl}/courts" style="display: inline-block; background: ${brandGreen}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Browse Courts</a>
            </div>
          </div>
        </body>
      </html>
    `,
  });
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
  declineReason?: string;
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
            ${emailHeader("Booking declined")}
            <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
              <p style="font-size: 16px;">Hello${data.playerName ? ` ${data.playerName}` : ""},</p>
              <p style="font-size: 16px;">The court host declined your booking request for <strong>${data.courtName}</strong>.</p>
              <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
                <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 0 0 8px;"><strong>Time:</strong> ${data.time} (${data.duration}h)</p>
                ${
                  data.declineReason
                    ? `<p style="margin: 0 0 8px;"><strong>Host's reason:</strong> ${escapeHtml(data.declineReason)}</p>`
                    : ""
                }
              </div>
              <div style="background: #ecfdf5; padding: 16px 18px; border-radius: 10px; margin: 18px 0; border: 1px solid #bbf7d0;">
                <p style="margin: 0; color: ${textColor};"><strong>Payment:</strong> ${paymentReleaseCopy(data.paymentStatus, data.price, "player")}</p>
              </div>
              <p style="font-size: 16px;">You can browse other courts and book a different time.</p>
              <div style="margin-top: 20px; text-align: center;">
                <a href="${appUrl}/courts" style="display: inline-block; background: ${brandGreen}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Browse Courts</a>
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

export interface ExpiredBookingEmailData {
  courtName: string;
  playerEmail: string;
  playerName?: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  paymentStatus?: PaymentReleaseStatus;
}

export async function sendPlayerBookingExpiredNotification(
  data: ExpiredBookingEmailData
): Promise<void> {
  const formattedDate = formatBookingEmailDate(data.date);

  await sendEmail({
    to: data.playerEmail,
    subject: `Booking request expired: ${data.courtName} on ${formattedDate}`,
    logLabel: "player booking expired email",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 600px; margin: 0 auto; padding: 20px; background: ${pageBg};">
          ${emailHeader("Booking request expired")}
          <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
            <p style="font-size: 16px;">Hello${data.playerName ? ` ${escapeHtml(data.playerName)}` : ""},</p>
            <p style="font-size: 16px;">Your booking request for <strong>${escapeHtml(data.courtName)}</strong> expired because the host did not accept it within 24 hours.</p>
            <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
              <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 0 0 8px;"><strong>Time:</strong> ${escapeHtml(data.time)} (${data.duration}h)</p>
              <p style="margin: 0;"><strong>Payment:</strong> ${paymentReleaseCopy(data.paymentStatus, data.price, "player")}</p>
            </div>
            <div style="margin-top: 20px; text-align: center;">
              <a href="${appUrl}/courts" style="display: inline-block; background: ${brandGreen}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Browse Courts</a>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}

export interface ConversationMessageEmailData {
  recipientEmail: string;
  recipientName?: string;
  senderName?: string;
  courtName?: string;
  messageBody: string;
  conversationId: string;
}

export async function sendConversationMessageEmail(
  data: ConversationMessageEmailData
): Promise<void> {
  const sender = data.senderName?.trim() || "CourtShare";
  const courtLine = data.courtName?.trim()
    ? ` about ${escapeHtml(data.courtName)}`
    : "";

  await sendEmail({
    to: data.recipientEmail,
    subject: `New message from ${sender}${data.courtName ? ` about ${data.courtName}` : ""}`,
    logLabel: "conversation message email",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 600px; margin: 0 auto; padding: 20px; background: ${pageBg};">
          ${emailHeader("New message")}
          <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
            <p style="font-size: 16px;">Hello${data.recipientName ? ` ${escapeHtml(data.recipientName)}` : ""},</p>
            <p style="font-size: 16px;"><strong>${escapeHtml(sender)}</strong> sent you a message${courtLine}.</p>
            <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
              <p style="white-space: pre-wrap; margin: 0; color: ${textColor};">${escapeHtml(data.messageBody)}</p>
            </div>
            <div style="margin-top: 20px; text-align: center;">
              <a href="${appUrl}/messages?conversationId=${encodeURIComponent(data.conversationId)}" style="display: inline-block; background: ${brandGreen}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reply in CourtShare</a>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}

export interface ReviewReminderEmailData {
  recipientEmail: string;
  recipientName?: string;
  bookingId: string;
  courtName: string;
  date: string;
  time: string;
  revieweeName?: string;
}

export async function sendReviewReminderEmail(
  data: ReviewReminderEmailData
): Promise<void> {
  const formattedDate = formatBookingEmailDate(data.date);
  const revieweeText = data.revieweeName?.trim()
    ? ` for ${escapeHtml(data.revieweeName)}`
    : "";

  await sendEmail({
    to: data.recipientEmail,
    subject: `Reminder: review ${data.courtName}`,
    logLabel: "review reminder email",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: ${textColor}; max-width: 600px; margin: 0 auto; padding: 20px; background: ${pageBg};">
          ${emailHeader("Leave a review")}
          <div style="background: ${cardBg}; padding: 30px; border-radius: 0 0 14px 14px; border: 1px solid ${borderColor}; border-top: none;">
            <p style="font-size: 16px;">Hello${data.recipientName ? ` ${escapeHtml(data.recipientName)}` : ""},</p>
            <p style="font-size: 16px;">Please leave a review${revieweeText} from your booking at <strong>${escapeHtml(data.courtName)}</strong>.</p>
            <div style="background: ${pageBg}; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${brandGreen};">
              <p style="margin: 0 0 8px;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin: 0;"><strong>Time:</strong> ${escapeHtml(data.time)}</p>
            </div>
            <div style="margin-top: 20px; text-align: center;">
              <a href="${appUrl}/booking/${encodeURIComponent(data.bookingId)}" style="display: inline-block; background: ${brandGreen}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Leave Review</a>
            </div>
          </div>
        </body>
      </html>
    `,
  });
}
