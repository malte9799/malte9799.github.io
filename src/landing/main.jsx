import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '../styles/global.css';
import './landing.css';
import Landing from './Landing';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Landing />
    </MotionConfig>
  </StrictMode>
);
