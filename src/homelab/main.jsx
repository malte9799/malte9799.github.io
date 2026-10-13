import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '../styles/global.css';
import './homelab.css';
import Dashboard from './Dashboard';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Dashboard />
    </MotionConfig>
  </StrictMode>
);
