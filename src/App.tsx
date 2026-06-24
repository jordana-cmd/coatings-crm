import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import DailyView from "./pages/DailyView";
import OppsList from "./pages/OppsList";
import OppDetail from "./pages/OppDetail";
import BidCalendarPage from "./pages/BidCalendarPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
            path="/calendar"
            element={
              <ProtectedRoute>
                <AppShell>
                  <BidCalendarPage />
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
