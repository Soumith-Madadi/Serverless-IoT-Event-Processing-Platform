import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Alerts from './pages/Alerts';
import Commands from './pages/Commands';
import Events from './pages/Events';
import Replay from './pages/Replay';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import { useEventStore } from './stores/eventStore';
import { useWebSocketStore } from './stores/websocketStore';

const App: React.FC = () => {
  const { isConnected } = useWebSocketStore();
  const { events } = useEventStore();

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          <Route path="/*" element={
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-50">
                <Header />
                
                <div className="flex">
                  <Sidebar />
                  
                  <main className="flex-1 p-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/devices" element={<Devices />} />
                        <Route path="/alerts" element={<Alerts />} />
                        <Route path="/commands" element={<Commands />} />
                        <Route path="/events" element={<Events />} />
                        <Route path="/replay" element={<Replay />} />
                        <Route path="/settings" element={<Settings />} />
                      </Routes>
                    </motion.div>
                  </main>
                </div>
                
                <div className="fixed bottom-4 right-4 z-50">
                  <div className={`
                    flex items-center space-x-2 px-3 py-2 rounded-full shadow-lg
                    ${isConnected 
                      ? 'bg-success-100 text-success-800 border border-success-200' 
                      : 'bg-danger-100 text-danger-800 border border-danger-200'
                    }
                  `}>
                    <div className={`
                      w-2 h-2 rounded-full animate-pulse
                      ${isConnected ? 'bg-success-500' : 'bg-danger-500'}
                    `} />
                    <span className="text-sm font-medium">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                
                <div className="fixed bottom-4 left-4 z-50">
                  <div className="bg-white px-3 py-2 rounded-full shadow-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-600">
                      Events: {events.length}
                    </span>
                  </div>
                </div>
              </div>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
