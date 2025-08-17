import React, { Suspense } from 'react';

// Enhanced lazy loading with error boundaries and retry logic
export const createLoadableComponent = (importFn, fallback = null) => {
  const LazyComponent = React.lazy(() => 
    importFn().catch(err => {
      console.error('Failed to load component:', err);
      // Retry once after a short delay
      return new Promise(resolve => 
        setTimeout(() => resolve(importFn()), 1000)
      );
    })
  );

  return React.forwardRef((props, ref) => (
    <Suspense fallback={fallback || <ComponentLoader />}>
      <LazyComponent {...props} ref={ref} />
    </Suspense>
  ));
};

// Optimized loading component
const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Preload components based on user interaction
export const preloadComponent = (importFn) => {
  const componentImport = importFn();
  return componentImport;
};

// Preload on hover for better UX
export const usePreloadOnHover = (importFn) => {
  const handleMouseEnter = () => {
    preloadComponent(importFn);
  };
  
  return { onMouseEnter: handleMouseEnter };
};
