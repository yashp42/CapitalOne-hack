import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Chatbot from './pages/Chatbot';

function App() {
  return (
    <Router>
      <div className='max-w-[100vw]'>
        <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/chatbot" element={<Chatbot />} />
          </Routes>
      </div>
    </Router>
  );
}

export default App;
