import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { useAuth } from './contexts/AuthContext';
import { CategoriesPage } from './pages/CategoriesPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { DashboardPage } from './pages/DashboardPage';
import { EquipmentDetailPage } from './pages/EquipmentDetailPage';
import { EquipmentFormPage } from './pages/EquipmentFormPage';
import { EquipmentListPage } from './pages/EquipmentListPage';
import { LabelsPage } from './pages/LabelsPage';
import { LoginPage } from './pages/LoginPage';
import { MovementDetailPage } from './pages/MovementDetailPage';
import { MovementsPage } from './pages/MovementsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReturnPage } from './pages/ReturnPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { ScannerPage } from './pages/ScannerPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';

function ProtectedLayout() {
  const { user } = useAuth();
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/equipamentos" element={<EquipmentListPage />} />
      <Route path="/equipamentos/novo" element={<EquipmentFormPage />} />
      <Route path="/equipamentos/:id" element={<EquipmentDetailPage />} />
      <Route path="/equipamentos/:id/editar" element={<EquipmentFormPage />} />
      <Route path="/scanner" element={<ScannerPage />} />
      <Route path="/saidas" element={<MovementsPage />} />
      <Route path="/saidas/nova" element={<CheckoutPage />} />
      <Route path="/saidas/:id" element={<MovementDetailPage />} />
      <Route path="/devolucoes" element={<ReturnsPage />} />
      <Route path="/devolucoes/:id" element={<ReturnPage />} />
      <Route path="/etiquetas" element={<LabelsPage />} />
      <Route path="/relatorios" element={<ReportsPage />} />
      <Route path="/admin/categorias" element={<AdminOnly><CategoriesPage /></AdminOnly>} />
      <Route path="/admin/usuarios" element={<AdminOnly><UsersPage /></AdminOnly>} />
      <Route path="/admin/configuracoes" element={<AdminOnly><SettingsPage /></AdminOnly>} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>;
}
