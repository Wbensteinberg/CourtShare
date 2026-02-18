"use client";

import Link from "next/link";
import AppHeader from "@/components/AppHeader";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="prose prose-slate prose-lg max-w-none">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            Last updated: January 2025
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              1. Acceptance of Terms
            </h2>
            <p className="text-slate-600 leading-relaxed">
              By accessing or using CourtShare (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. We may update these terms from time to time; continued use after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              2. Description of Service
            </h2>
            <p className="text-slate-600 leading-relaxed">
              CourtShare is a platform that connects court owners with players for booking tennis (and similar) courts. We provide the technology for listing courts, managing availability, processing bookings, and payments. We are not the owner of the courts nor the provider of the underlying facilities.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              3. Accounts and Eligibility
            </h2>
            <p className="text-slate-600 leading-relaxed">
              You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Service. You are responsible for maintaining the security of your account and for all activity under it. You may sign in via email/password or Google; in each case you must provide accurate information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              4. Bookings and Payments
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Bookings are subject to availability and acceptance by the court owner. Payments are processed through Stripe. Refund and cancellation policies are determined by the court owner and/or our platform policies. We may charge fees as described at the time of booking or in your account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              5. Listings and Owner Responsibilities
            </h2>
            <p className="text-slate-600 leading-relaxed">
              If you list a court, you represent that you have the right to offer it for booking and that your listing is accurate. You are responsible for honoring accepted bookings, maintaining a safe facility, and complying with applicable laws. We may remove listings or suspend accounts for violations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              6. Prohibited Conduct
            </h2>
            <p className="text-slate-600 leading-relaxed">
              You may not use the Service for any illegal purpose, to misrepresent yourself, to harass others, or to circumvent our systems or policies. You may not scrape, reverse-engineer, or resell the Service without permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">
              7. Disclaimers and Limitation of Liability
            </h2>
            <p className="text-slate-600 leading-relaxed">
              The Service is provided &quot;as is.&quot; We do not guarantee uninterrupted or error-free operation. To the fullest extent permitted by law, CourtShare and its operators are not liable for indirect, incidental, special, or consequential damages arising from your use of the Service or from interactions with other users or third parties.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-4">
          <Link
            href="/privacy"
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Privacy Policy
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
