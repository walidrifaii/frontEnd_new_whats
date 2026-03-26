import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useAuthStore from './store/authStore';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import CampaignPage from './pages/CampaignPage';
import CampaignDetailPage from './pages/CampaignDetailPage';
import LogsPage from './pages/LogsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuthStore();
  if (loading) return <div className="loading-screen">Loading...</div>;
  return token ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { user, token, loading } = useAuthStore();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (!(user?.isAdmin || user?.role === 'admin')) return <Navigate to="/" replace />;
  return children;
};

const HomeRoute = () => {
  const { user } = useAuthStore();
  if (user?.isAdmin || user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  return <DashboardPage />;
};

function App() {
  const { loadUser } = useAuthStore();

  useEffect(() => { loadUser(); }, [loadUser]);

  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomeRoute />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="campaigns" element={<CampaignPage />} />
          <Route path="campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
          <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
