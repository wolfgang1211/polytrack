import { permanentRedirect } from 'next/navigation';

/* The World Cup hub was consolidated at /worldcup (richer page: match center,
   odds race, pro positions, upset radar, share cards). Hermes's nation-colored
   card styling was merged into the hub. Keep this route as a 308 redirect so
   old links and search results don't break. */
export default function WorldCupRedirect() {
  permanentRedirect('/worldcup');
}
