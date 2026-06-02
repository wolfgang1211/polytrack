import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'AlphaBoard privacy policy: how we collect, use and protect your data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-xs text-white/30 mb-10">Last updated: June 1, 2026</p>

      <div className="prose-custom space-y-8">
        <section>
          <h2>1. Introduction</h2>
          <p>
            AlphaBoard (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the website{' '}
            <strong>alphaboard.xyz</strong> (the &ldquo;Service&rdquo;). This Privacy Policy explains how we
            collect, use, disclose, and safeguard your information when you visit our Service.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <h3>2.1 Information You Provide</h3>
          <ul>
            <li><strong>Account Data:</strong> When you sign up, we collect your name and email address.</li>
            <li><strong>Wallet Addresses:</strong> Ethereum wallet addresses you submit for tracking are public blockchain data.</li>
            <li><strong>Watchlist Data:</strong> Markets and traders you add to your watchlist.</li>
          </ul>

          <h3>2.2 Automatically Collected Information</h3>
          <ul>
            <li><strong>Usage Data:</strong> Pages visited, features used, time spent, referral source.</li>
            <li><strong>Device Data:</strong> Browser type, operating system, screen resolution.</li>
            <li><strong>Cookies:</strong> We use essential cookies for authentication and session management.</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>Provide, maintain and improve the Service.</li>
            <li>Send you alerts and notifications you have opted into (e.g., Telegram alerts).</li>
            <li>Analyze usage patterns to improve user experience.</li>
            <li>Prevent fraud and ensure security.</li>
            <li>Comply with legal obligations.</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Sharing</h2>
          <p>We do <strong>not</strong> sell your personal information. We may share data with:</p>
          <ul>
            <li><strong>Service Providers:</strong> Hosting (Vercel), analytics, and email services that help us operate.</li>
            <li><strong>Legal Requirements:</strong> If required by law, subpoena, or government request.</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. You can request deletion of your
            account and associated data at any time by contacting us.
          </p>
        </section>

        <section>
          <h2>6. Data Security</h2>
          <p>
            We implement industry-standard security measures including HTTPS encryption, secure headers,
            and access controls. However, no method of electronic transmission is 100% secure.
          </p>
        </section>

        <section>
          <h2>7. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data.</li>
            <li>Object to or restrict processing.</li>
            <li>Data portability.</li>
          </ul>
          <p>To exercise these rights, contact us at <strong>privacy@alphaboard.xyz</strong>.</p>
        </section>

        <section>
          <h2>8. Third-Party Links</h2>
          <p>
            Our Service contains links to Polymarket and other third-party websites. We are not responsible
            for their privacy practices. We encourage you to review their privacy policies.
          </p>
        </section>

        <section>
          <h2>9. Children&apos;s Privacy</h2>
          <p>
            Our Service is not directed to individuals under 18. We do not knowingly collect personal
            information from children.
          </p>
        </section>

        <section>
          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by
            posting the new policy on this page and updating the &ldquo;Last updated&rdquo; date.
          </p>
        </section>

        <section>
          <h2>11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at:{' '}
            <strong>privacy@alphaboard.xyz</strong>
          </p>
        </section>
      </div>
    </article>
  );
}
