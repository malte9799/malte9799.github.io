import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '../styles/global.css';
import './projects.css';
import { LangContext, pageLang } from '../i18n';
import Projects from './Projects';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangContext value={pageLang()}>
      <MotionConfig reducedMotion="user">
        <Projects />
      </MotionConfig>
    </LangContext>
  </StrictMode>
);
