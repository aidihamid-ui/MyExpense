import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — MyExpense',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link href="/login" className="text-sm text-slate-500 hover:underline">
            &larr; Back to MyExpense
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: May 2026</p>

        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">Who we are</h2>
            <p>
              MyExpense is a personal expense tracking app operated by an individual for personal
              and family use. The app is hosted on a private server (Hostinger VPS, Malaysia region).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">What data we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your name and email address — used for account login only</li>
              <li>
                Expense records: amounts, dates, categories, payment methods, and optional notes
              </li>
              <li>Receipt images you upload — stored securely on our server</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">How we use your data</h2>
            <p>
              Your data is used solely to provide the features of this app — recording and
              displaying your personal expenses. We do not use your data for advertising,
              analytics, or any other purpose.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              Who we share your data with
            </h2>
            <p className="font-medium text-slate-900">
              Nobody. We do not sell, rent, or share your personal or financial data with any
              third party.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              Where your data is stored
            </h2>
            <p>
              Your data is stored on a private server hosted by Hostinger. All connections to
              the app are encrypted via HTTPS (TLS). Receipt images are stored on the same
              server and are only accessible to your account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              How long we keep your data
            </h2>
            <p>
              Your data is retained for as long as your account exists. You may delete your
              account at any time from{' '}
              <strong>Settings &rarr; Delete account</strong>, which permanently removes all
              your expenses, receipts, and account information from our servers.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              Your rights under PDPA 2010
            </h2>
            <p className="mb-2">
              Under Malaysia&apos;s Personal Data Protection Act 2010, you have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate personal data</li>
              <li>
                Request deletion of your data — use Settings &rarr; Delete account, or contact
                us directly
              </li>
              <li>Withdraw consent at any time by deleting your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">Contact</h2>
            <p>
              For privacy-related questions or data requests, contact:{' '}
              <a
                href="mailto:aidi.hamid@yahoo.com.my"
                className="text-blue-600 hover:underline"
              >
                aidi.hamid@yahoo.com.my
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
