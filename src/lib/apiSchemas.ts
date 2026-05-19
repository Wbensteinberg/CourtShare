import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const idSchema = z.string().trim().min(1).max(200);
const shortTextSchema = z.string().trim().min(1).max(200);

export const bookingIdBodySchema = z.object({
  bookingId: idSchema,
});

export const rejectBookingBodySchema = bookingIdBodySchema.extend({
  declineReason: z.string().trim().min(1).max(1000),
});

export const expirePendingBookingsBodySchema = z.object({
  bookingIds: z.array(idSchema).max(50).default([]),
});

export const finalizeCheckoutBodySchema = z.object({
  sessionId: z.string().trim().min(1).max(255),
});

export const sendMessageBodySchema = z.object({
  conversationId: idSchema,
  body: z.string().trim().min(1).max(4000),
});

export const reviewPostBodySchema = z.object({
  bookingId: idSchema,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(""),
});

export const createCheckoutBodySchema = z.object({
  courtId: idSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: shortTextSchema,
  durationMinutes: z.coerce.number().int().min(1).max(180),
  courtNumber: z.coerce.number().int().min(1).max(100).optional(),
  guestCount: z.coerce.number().int().min(1).max(100).optional(),
  initialMessage: z.string().trim().max(500).optional().default(""),
});

export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  return result.data;
}
