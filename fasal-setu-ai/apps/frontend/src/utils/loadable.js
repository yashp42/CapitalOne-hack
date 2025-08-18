import React, { Suspense } from 'react';

// Enhanced lazy loading with error boundaries and simplified retry logic
export const createLoadableComponent = (importFn, fallback = null) => {
  const LazyComponent = React.lazy(() => 
    importFn().catch(err => {
      console.error('Failed to load component:', err);
      // Return a fallback component instead of retrying to prevent infinite loops
      return {
        default: () => (
          <div className="flex items-center justify-center p-8 text-gray-600">
            <div className="text-center">
              <p>Component failed to load</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600"
              >
                Reload Page
              </button>
            </div>
          </div>
        )
      };
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
  try {
    const componentImport = importFn();
    return componentImport;
  } catch (error) {
    console.error('Failed to preload component:', error);
    return null;
  }
};

// Preload on hover for better UX
export const usePreloadOnHover = (importFn) => {
  const handleMouseEnter = () => {
    preloadComponent(importFn);
  };
  
  return { onMouseEnter: handleMouseEnter };
};
