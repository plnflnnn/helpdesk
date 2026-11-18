import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Role } from '@helpdesk/shared';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { createQueryClient } from '@/lib/queryClient';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { UsersPage } from '@/pages/UsersPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TicketsPage />} />
        <Route
          path="users"
          element={
            <ProtectedRoute role={Role.admin}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
