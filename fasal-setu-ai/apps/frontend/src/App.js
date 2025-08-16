import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Chatbot from './pages/Chatbot';
import CropSimulation from './pages/CropSimulation';
import MyFarm from './pages/MyFarm';
import Profile from './pages/Profile';

function AppContent() {
  const location = useLocation();
  const hiddenNavbarRoutes = ['/chatbot'];
  const shouldShowNavbar = !hiddenNavbarRoutes.includes(location.pathname);

  return (
    <div className='max-w-[100vw]'>
      {shouldShowNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/chatbot" element={<Chatbot />} />
        <Route path="/crop-simulation/:cropId" element={<CropSimulation />} />
        <Route path="/my-farm" element={<MyFarm />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
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
