import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import DailyView from "./pages/DailyView";
import OppsList from "./pages/OppsList";
import OppDetail from "./pages/OppDetail";
import BidCalendarPage from "./pages/BidCalendarPage";
import CompaniesList from "./pages/CompaniesList";
import CompanyDetail from "./pages/CompanyDetail";
import ContactsList from "./pages/ContactsList";
import ContactDetail from "./pages/ContactDetail";
import ReportsPage from "./pages/ReportsPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DailyView />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/opportunities"
            element={
              <ProtectedRoute>
                <AppShell>
                  <OppsList />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/opp/:id"
            element={
              <ProtectedRoute>
                <AppShell>
                  <OppDetail />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/companies"
            element={
              <ProtectedRoute>
                <AppShell>
                  <CompaniesList />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/companies/:id"
            element={
              <ProtectedRoute>
                <AppShell>
                  <CompanyDetail />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ContactsList />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts/:id"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ContactDetail />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <AppShell>
                  <BidCalendarPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ReportsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
