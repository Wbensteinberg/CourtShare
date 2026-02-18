"use client";

import Link from "next/link";
import AppHeader from "@/components/AppHeader";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="prose prose-slate prose-lg max-w-none">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            Last updated: January 2025
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              1. Introduction
            </h2>
            <p className="text-slate-600 leading-relaxed">
              CourtShare (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the CourtShare platform and related services. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services. By using CourtShare, you agree to the practices described in this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              2. Information We Collect
            </h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              We may collect information that you provide directly, including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-1 mb-3">
              <li>Account information (email, name, profile picture when you sign in with Google or create an account)</li>
              <li>Booking details (court, date, time, payment-related information)</li>
              <li>Listing information (if you are a court owner: court details, address, availability, photos)</li>
              <li>Communications (messages or support inquiries you send us)</li>
            </ul>
            <p className="text-slate-600 leading-relaxed">
              We also collect certain information automatically, such as device and browser information, IP address, and usage data when you use our site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              3. How We Use Your Information
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We use the information we collect to provide, maintain, and improve our services; to process bookings and payments; to send booking confirmations and notifications; to communicate with you; and to comply with legal obligations. We may also use aggregated or anonymized data for analytics and product improvement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              4. Third-Party Services
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We use third-party services that may collect or process your data, including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-1 mb-3">
              <li><strong>Google</strong> – for sign-in and account authentication</li>
              <li><strong>Firebase</strong> – for hosting, authentication, database, and storage</li>
              <li><strong>Stripe</strong> – for payment processing</li>
              <li><strong>Resend</strong> – for transactional emails</li>
            </ul>
            <p className="text-slate-600 leading-relaxed">
              Each of these services has its own privacy policy governing how they handle your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              5. Data Security and Retention
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We take reasonable measures to protect your information. We retain your data for as long as your account is active or as needed to provide services, resolve disputes, and comply with legal obligations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              6. Your Rights and Choices
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Depending on your location, you may have the right to access, correct, or delete your personal information, or to object to or restrict certain processing. You can update account details in your profile and contact us for other requests.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-4">
          <Link
            href="/terms"
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Terms of Service
          </Link>
          <Link
            href="/courts"
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Back to CourtShare
          </Link>
        </div>
      </main>
    </div>
  );
}
