import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Reset the window scroll position to the top on every route change.
 */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Always scroll to the top-left corner when navigating to a new route
    window.scrollTo(0, 0);
  }, [pathname]);

  // This component does not render anything in the DOM
  return null;
};
