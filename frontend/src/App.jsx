import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import ApplicationDetail from './pages/ApplicationDetail';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Privacy from './pages/Privacy';
import Resumes from './pages/Resumes';

function AppLayout({ children }) {
  const location = useLocation();
  const isStandalonePage = location.pathname === '/' || location.pathname === '/privacy';

  if (isStandalonePage) {
    return children;
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
        <Route path="/resumes" element={<Resumes />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/signup" element={<Navigate to="/dashboard" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
