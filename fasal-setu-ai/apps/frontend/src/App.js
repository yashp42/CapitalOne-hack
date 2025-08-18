import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import { createLoadableComponent, preloadComponent } from './utils/loadable';

// Enhanced lazy loading with error handling and retries
const Home = createLoadableComponent(() => import('./pages/Home'));
const Login = createLoadableComponent(() => import('./pages/Login'));
const Chatbot = createLoadableComponent(() => import('./pages/Chatbot'));
const CropSimulation = createLoadableComponent(() => import('./pages/CropSimulation'));
const MyFarm = createLoadableComponent(() => import('./pages/MyFarm'));
const Profile = createLoadableComponent(() => import('./pages/Profile'));

// Preload critical routes on app load
setTimeout(() => {
  preloadComponent(() => import('./pages/Home'));
  preloadComponent(() => import('./pages/Login'));
}, 100);

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-600 text-sm">Loading...</p>
    </div>
  </div>
);

function AppContent() {
  const location = useLocation();
  const hiddenNavbarRoutes = ['/chatbot'];
  const shouldShowNavbar = !hiddenNavbarRoutes.some(route => location.pathname.startsWith(route));

  return (
    <div className='max-w-[100vw]'>
      {shouldShowNavbar && <Navbar />}
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/chatbot/:conversationId" element={<Chatbot />} />
          <Route path="/crop-simulation/:cropId" element={<CropSimulation />} />
          <Route path="/my-farm" element={<MyFarm />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
