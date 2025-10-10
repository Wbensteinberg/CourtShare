# CourtShare Project Brief 

CourtShare, a mobile-first tennis court rental platform.
It allows players to find and book private tennis courts by the hour, and lets court owners list their available courts, manage bookings, and receive payments.

## 🛠️ Tech Stack
- **Frontend:** Next.js (App Router) + Tailwind CSS + TypeScript
- **Backend:** Firebase (Auth, Firestore, Storage)
- **Payments:** Stripe (Checkout + Connect)
- **AI Tools:** Using Cursor for dev, GitHub Copilot for autocomplete, and ChatGPT for architecture/planning

## 🔑 Core Features
- Player login via email/Google
- Court listing form (images, location, price, availability)
- Court browsing + filtering
- Booking calendar with time slots
- Stripe integration for booking payments
- Owner dashboard (see bookings, manage courts)
- Player dashboard (upcoming bookings)

## Project Phases
This project is structured in 4 phases:
1. **Firebase/Auth**
2. **Booking Flow**
3. **Dashboards**
4. **Testing/Deployment**

We're building for mobile-first users, optimizing for fast booking and clean UX.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

