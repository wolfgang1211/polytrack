import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'AlphaBoard terms of service: rules and conditions for using our platform.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-xs text-white/30 mb-10">Last updated: June 1, 2026</p>

      <div className="prose-custom space-y-8">
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using AlphaBoard (&ldquo;the Service&rdquo;), operated at{' '}
            <strong>alphaboard.xyz</strong>, you agree to be bound by these Terms of Service. If you do not
            agree with any part of these terms, you must not use the Service.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            AlphaBoard is an independent analytics and data visualization platform for Polymarket prediction
            markets. We provide leaderboards, wallet tracking, market analysis, liquidity tools, and trade
            activity feeds. We are <strong>not</strong> a trading platform and do not facilitate, execute, or
            custody any trades or funds.
          </p>
        </section>

        <section>
          <h2>3. Eligibility</h2>
          <p>
            You must be at least 18 years old to use the Service. By using AlphaBoard, you represent and
            warrant that you meet this age requirement and that your use complies with all applicable laws
            in your jurisdiction.
          </p>
        </section>

        <section>
          <h2>4. User Accounts</h2>
          <ul>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You are responsible for all activities that occur under your account.</li>
            <li>You agree to provide accurate and complete information when creating an account.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
          </ul>
        </section>

        <section>
          <h2>5. Acceptable Use</h2>
          <p>You agree <strong>not</strong> to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose.</li>
            <li>Attempt to gain unauthorized access to any part of the Service.</li>
            <li>Use automated tools (bots, scrapers) to access the Service without our written permission.</li>
            <li>Interfere with or disrupt the Service or its infrastructure.</li>
            <li>Impersonate any person or entity.</li>
            <li>Use the Service to manipulate markets or engage in fraudulent activity.</li>
          </ul>
        </section>

        <section>
          <h2>6. Intellectual Property</h2>
          <p>
            All content, features, and functionality of the Service, including but not limited to text,
            graphics, logos, icons, the Smart Score algorithm, and software, are owned by AlphaBoard and
            protected by intellectual property laws. You may not reproduce, distribute, or create derivative
            works without our express written consent.
          </p>
        </section>

        <section>
          <h2>7. Data and Content</h2>
          <ul>
            <li>Market data displayed is sourced from Polymarket and public blockchain data.</li>
            <li>We strive for accuracy but do not guarantee that all data is complete, current, or error-free.</li>
            <li>Trader rankings, scores, and analytics are calculated using our proprietary methods and are
              provided for informational purposes only.</li>
          </ul>
        </section>

        <section>
          <h2>8. No Financial Advice</h2>
          <p>
            The Service is for <strong>informational and educational purposes only</strong>. Nothing on
            AlphaBoard constitutes financial advice, investment advice, trading advice, or any other sort
            of advice. You should not treat any of the Service&apos;s content as such. We do not recommend
            that any asset, security, or prediction market position should be bought, sold, or held by you.
          </p>
          <p>
            Please read our full <a href="/disclaimer" className="underline text-purple-400 hover:text-purple-300">Disclaimer</a>.
          </p>
        </section>

        <section>
          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, AlphaBoard and its operators shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages, including but not limited to
            loss of profits, data, or funds, arising from your use of the Service. Our total liability shall
            not exceed the amount you paid us (if any) in the 12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2>10. Disclaimer of Warranties</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of
            any kind, whether express or implied, including but not limited to implied warranties of
            merchantability, fitness for a particular purpose, and non-infringement.
          </p>
        </section>

        <section>
          <h2>11. Third-Party Services</h2>
          <p>
            The Service contains links to Polymarket and other third-party services. We are not responsible
            for the content, policies, or practices of any third-party services. Your interactions with
            third-party services are solely between you and the third party.
          </p>
        </section>

        <section>
          <h2>12. Modifications</h2>
          <p>
            We reserve the right to modify these Terms at any time. Changes take effect immediately upon
            posting. Your continued use of the Service after modifications constitutes acceptance of the
            revised Terms.
          </p>
        </section>

        <section>
          <h2>13. Termination</h2>
          <p>
            We may terminate or suspend your access to the Service immediately, without prior notice, for
            any reason, including breach of these Terms.
          </p>
        </section>

        <section>
          <h2>14. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction
            in which AlphaBoard operates, without regard to conflict of law provisions.
          </p>
        </section>

        <section>
          <h2>15. Contact</h2>
          <p>
            For questions about these Terms, contact us at: <strong>legal@alphaboard.xyz</strong>
          </p>
        </section>
      </div>
    </article>
  );
}
