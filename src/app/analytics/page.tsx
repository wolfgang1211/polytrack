import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Local Analytics',
  description: 'Local-only aggregate QA funnel. Not production visitor or conversion data.',
  robots: { index: false, follow: false },
};
export default function AnalyticsPage() {
  if (process.env.ALPHABOARD_ANALYTICS_LOCAL !== '1') notFound();
  return <AnalyticsDashboard />;
}
