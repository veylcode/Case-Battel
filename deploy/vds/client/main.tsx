import { createRoot } from 'react-dom/client';
import Game from '../../../app/ui/game';
import Admin from '../../../app/ui/admin';
import { LanguageProvider } from '../../../app/ui/language';
import '../../../app/globals.css';

const Page = location.pathname.startsWith('/admin') ? Admin : Game;
createRoot(document.getElementById('root')!).render(
  <LanguageProvider><Page /></LanguageProvider>,
);
