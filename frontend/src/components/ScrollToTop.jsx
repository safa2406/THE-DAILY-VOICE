import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Reusable Global ScrollToTop Component
 * Resets window and container scroll positions to top on route pathname changes.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // 1. Reset standard window/document scrolling to (0, 0) instantly
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });

    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // 2. Reset scroll position on any scrollable content containers if present
    const scrollContainers = document.querySelectorAll('main, [data-scroll-container]');
    scrollContainers.forEach((container) => {
      if (container && container.scrollTop > 0) {
        container.scrollTop = 0;
      }
    });
  }, [pathname]);

  return null;
}
