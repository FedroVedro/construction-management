import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Home from './pages/Home';
import Cities from './pages/Cities';
import ConstructionStages from './pages/ConstructionStages';
import DocumentSchedule from './pages/DocumentSchedule';
import HRSchedule from './pages/HRSchedule';
import ProcurementSchedule from './pages/ProcurementSchedule';
import ConstructionSchedule from './pages/ConstructionSchedule';
import DirectiveSchedule from './pages/DirectiveSchedule';
import MarketingSchedule from './pages/MarketingSchedule';
import ProjectOffice from './pages/ProjectOffice';
import StrategicMap from './pages/StrategicMap';
import TelegramSettings from './pages/TelegramSettings';
import ProcessManagement from './pages/ProcessManagement';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<PrivateRoute />}>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="cities" element={<Cities />} />
                  <Route path="construction-stages" element={<ConstructionStages />} />
                  <Route path="document-schedule" element={<DocumentSchedule />} />
                  <Route path="hr-schedule" element={<HRSchedule />} />
                  <Route path="procurement-schedule" element={<ProcurementSchedule />} />
                  <Route path="construction-schedule" element={<ConstructionSchedule />} />
                  <Route path="directive-schedule" element={<DirectiveSchedule />} />
                  <Route path="marketing-schedule" element={<MarketingSchedule />} />
                  <Route path="project-office" element={<ProjectOffice />} />
                  <Route path="strategic-map" element={<StrategicMap />} />
                  <Route path="process-management" element={<ProcessManagement />} />
                  <Route path="telegram-settings" element={<TelegramSettings />} />
                </Route>
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
