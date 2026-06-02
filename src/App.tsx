import { lazy, Suspense } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { AdminAppShell } from './components/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { TotpVerifyPage } from './features/auth/TotpVerifyPage';
import { TotpSetupPage } from './features/auth/TotpSetupPage';

// Data screens are code-split — each is its own chunk, fetched on first visit.
// Keeps Leaflet, the charts, and the big tables out of the initial bundle.
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => import('./features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const RidersPage = lazy(() => import('./features/riders/RidersPage').then((m) => ({ default: m.RidersPage })));
const CashPage = lazy(() => import('./features/cash/CashPage').then((m) => ({ default: m.CashPage })));
const RevenuePage = lazy(() => import('./features/revenue/RevenuePage').then((m) => ({ default: m.RevenuePage })));
const CatalogPage = lazy(() => import('./features/catalog/CatalogPage').then((m) => ({ default: m.CatalogPage })));
const ServiceAreasPage = lazy(() => import('./features/serviceAreas/ServiceAreasPage').then((m) => ({ default: m.ServiceAreasPage })));
const VendorsPage = lazy(() => import('./features/vendors/VendorsPage').then((m) => ({ default: m.VendorsPage })));
const DiscountsPage = lazy(() => import('./features/discounts/DiscountsPage').then((m) => ({ default: m.DiscountsPage })));
const UsersPage = lazy(() => import('./features/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const PaymentsPage = lazy(() => import('./features/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));

function PageLoader() {
  return (
    <Center h="60vh">
      <Loader color="brand" />
    </Center>
  );
}

function ShellLayout() {
  return (
    <AdminAppShell>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </AdminAppShell>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/totp" element={<TotpVerifyPage />} />
      <Route path="/totp/setup" element={<TotpSetupPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<ShellLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/riders" element={<RidersPage />} />
          <Route path="/cash" element={<CashPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/service-areas" element={<ServiceAreasPage />} />
          <Route path="/vendors" element={<VendorsPage />} />
          <Route path="/discounts" element={<DiscountsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/revenue" element={<RevenuePage />} />
          <Route path="/payments" element={<PaymentsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
