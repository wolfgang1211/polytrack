import Script from 'next/script';
import { clarityBootstrap, clarityProjectId, shouldLoadClarity } from '@/lib/clarity';

/** Microsoft Clarity (heatmaps / session replay). Renders nothing unless NEXT_PUBLIC_CLARITY_ID is set in a production build. */
export default function ClarityScript() {
  const id = clarityProjectId(process.env.NEXT_PUBLIC_CLARITY_ID);
  if (!id || !shouldLoadClarity({ nodeEnv: process.env.NODE_ENV, id })) return null;
  return <Script id="ms-clarity" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: clarityBootstrap(id) }} />;
}
