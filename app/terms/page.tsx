import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use — KasiKira',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link href="/login" className="text-sm text-slate-500 hover:underline">
            &larr; Back to KasiKira
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Terms of Use</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">1. Service basis</h2>
            <p>
              KasiKira is provided on a best-endeavour basis. No uptime, availability, or
              performance guarantees are made. The service may be temporarily unavailable for
              maintenance, updates, or unforeseen issues without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">2. No liability</h2>
            <p>
              The service is provided &ldquo;as is&rdquo; without warranty of any kind. We are
              not liable for any loss of data, financial decisions made based on information in
              the app, or any other damages arising from use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">3. Pricing</h2>
            <p>
              KasiKira is currently free of charge. This may change in the future as new features
              are added. If pricing is introduced, existing users will be notified in advance
              before any charges apply.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              4. Service discontinuation
            </h2>
            <p>
              We reserve the right to stop or discontinue the service at any time. Where
              possible, users will be given at least <strong>14 days&apos; notice</strong> before
              the service is shut down, to allow time to export or back up their data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">5. Your data</h2>
            <p className="mb-2">
              Your expense data is stored securely and is not shared with third parties. You are
              responsible for ensuring that any data you enter does not belong to or identify
              others without their consent.
            </p>
            <p>
              You may request an export of your data in <strong>CSV format</strong> at any time
              by contacting us at the email address below. You may also request deletion of your
              account and all associated data by emailing us directly, or via{' '}
              <strong>Settings &rarr; Delete account</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">6. Acceptable use</h2>
            <p>
              This service is for personal expense tracking only. You agree not to attempt to
              access other users&apos; data or misuse the service in any way.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">7. Governing law</h2>
            <p>
              These terms are governed by and construed in accordance with the laws of Malaysia.
              Any disputes arising from use of this service shall be subject to the jurisdiction
              of the courts of Malaysia.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              8. Changes to these terms
            </h2>
            <p>
              These terms may be updated from time to time. Continued use of the service after
              changes are posted constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">9. Contact</h2>
            <p>
              For questions, data requests, or any concerns regarding these terms, contact:{' '}
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
