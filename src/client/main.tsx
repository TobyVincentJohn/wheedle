import './index.css';
import './HomePage.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Check if we should show initial loading screen
const shouldShowInitialLoading = !sessionStorage.getItem('wheedle_assets_loaded');

// Set initial route based on whether assets have been loaded
if (shouldShowInitialLoading) {
  // Redirect to initial loading screen
  window.location.hash = '#/initial-loading';
  // Mark that we've shown the loading screen for this session
  sessionStorage.setItem('wheedle_assets_loaded', 'true');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
