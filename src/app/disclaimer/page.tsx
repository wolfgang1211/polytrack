import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: 'AlphaBoard financial disclaimer — important information about the nature of our analytics platform.',
  alternates: { canonical: '/disclaimer' },
};

export default function DisclaimerPage() {
  return (
    <article className="mx-auto max-w-3xl py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Disclaimer</h1>
      <p className="text-xs text-white/30 mb-10">Last updated: June 1, 2026</p>

      {/* ── Prominent warning box ── */}
      <div
        className="mb-10 rounded-2xl p-6"
        style={{
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div>
            <h2 className="text-sm font-bold text-amber-300 mb-2">Important Notice</h2>
            <p className="text-sm text-white/70 leading-relaxed">
              AlphaBoard is an <strong>independent analytics tool</strong> for informational purposes only.
              Nothing on this website constitutes financial advice, investment advice, or a recommendation
              to buy, sell, or hold any position in any prediction market. <strong>You could lose all of
              your money.</strong> Always do your own research before making any financial decisions.
            </p>
          </div>
        </div>
      </div>

      <div className="prose-custom space-y-8">
        <section>
          <h2>1. Not Financial Advice</h2>
          <p>
            All content provided on AlphaBoard — including but not limited to trader rankings, Smart Scores,
            market analytics, liquidity data, P&amp;L figures, LP estimates, and trade signals — is provided
            strictly for <strong>informational and educational purposes</strong>. None of the information
            constitutes:
          </p>
          <ul>
            <li>Financial or investment advice</li>
            <li>A solicitation to buy, sell, or hold any asset or market position</li>
            <li>Tax, legal, or accounting advice</li>
            <li>A guarantee of future performance or results</li>
          </ul>
        </section>

        <section>
          <h2>2. No Affiliation with Polymarket</h2>
          <p>
            AlphaBoard is an <strong>independent third-party analytics tool</strong>. We are not affiliated
            with, endorsed by, or officially connected to Polymarket or any of its subsidiaries. All
            Polymarket-related data is sourced from publicly available APIs and blockchain data.
          </p>
        </section>

        <section>
          <h2>3. Accuracy of Data</h2>
          <p>
            While we strive to provide accurate and up-to-date information, we make <strong>no warranties
            or representations</strong> regarding the accuracy, completeness, reliability, or timeliness of
            any data displayed on our platform. Data may be delayed, incomplete, or contain errors.
            Specifically:
          </p>
          <ul>
            <li>Trader P&amp;L and rankings are estimates based on available on-chain data and may not
              reflect actual realized profits.</li>
            <li>Smart Scores are proprietary metrics and not a guarantee of future performance.</li>
            <li>LP estimates, APR calculations, and reward simulations are approximations and actual
              results may differ significantly.</li>
            <li>Market prices, volumes, and liquidity figures may be delayed or inaccurate.</li>
          </ul>
        </section>

        <section>
          <h2>4. Risk Warning</h2>
          <p>
            Prediction markets involve <strong>significant risk of loss</strong>. You should be aware that:
          </p>
          <ul>
            <li>You can lose some or all of your invested capital.</li>
            <li>Past performance of any trader or strategy does not guarantee future results.</li>
            <li>Copying or following top traders does not guarantee profits.</li>
            <li>Market conditions can change rapidly and unpredictably.</li>
            <li>Prediction markets may be subject to regulatory changes in your jurisdiction.</li>
            <li>Liquidity provision carries risks including impermanent loss and smart contract risk.</li>
          </ul>
          <p>
            <strong>Never invest more than you can afford to lose.</strong> If you are unsure about the risks
            involved, seek independent financial advice from a qualified professional.
          </p>
        </section>

        <section>
          <h2>5. No Guarantee of Availability</h2>
          <p>
            We do not guarantee that the Service will be available at all times. The platform may experience
            downtime, technical issues, or data feed interruptions. We are not liable for any losses
            resulting from Service unavailability.
          </p>
        </section>

        <section>
          <h2>6. Regulatory Compliance</h2>
          <p>
            It is <strong>your sole responsibility</strong> to determine whether your use of prediction
            markets is legal in your jurisdiction. AlphaBoard does not provide any assurances regarding the
            legality of prediction markets in any jurisdiction. We do not facilitate trading and are not
            registered as a broker, exchange, or financial advisor in any jurisdiction.
          </p>
        </section>

        <section>
          <h2>7. Third-Party Content</h2>
          <p>
            Links to external websites and services (including Polymarket) are provided for convenience only.
            We do not endorse or assume responsibility for any content, products, or services offered by
            third parties.
          </p>
        </section>

        <section>
          <h2>8. Limitation of Liability</h2>
          <p>
            Under no circumstances shall AlphaBoard, its owners, operators, employees, or affiliates be
            liable for any direct, indirect, incidental, special, or consequential damages resulting from
            your use of or inability to use the Service, including but not limited to financial losses from
            trading decisions made based on information provided on this platform.
          </p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>
            If you have questions about this Disclaimer, contact us at:{' '}
            <strong>legal@alphaboard.xyz</strong>
          </p>
        </section>
      </div>
    </article>
  );
}
