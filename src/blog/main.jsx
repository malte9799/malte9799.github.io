import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '../styles/global.css';
import './blog.css';
import { LangContext, pageLang } from '../i18n';
import Blog from './Blog';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangContext value={pageLang()}>
      <MotionConfig reducedMotion="user">
        <Blog />
      </MotionConfig>
    </LangContext>
  </StrictMode>
);
