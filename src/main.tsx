import {createRoot} from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App.tsx';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import './index.css';
import './workspace.css';
import './workbench.css';

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    {import.meta.env.PROD && <Analytics />}
  </>
);
