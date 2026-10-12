import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '../styles/global.css';
import './landing.css';
import { LangContext, pageLang } from '../i18n';
import Landing from './Landing';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangContext value={pageLang()}>
      <MotionConfig reducedMotion="user">
        <Landing />
      </MotionConfig>
    </LangContext>
  </StrictMode>
);
