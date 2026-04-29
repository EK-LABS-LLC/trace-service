import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { ToastProvider } from "./contexts/ToastContext";
import { Layout } from "./components/layout/Layout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { queryClient } from "./lib/queryClient";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Traces from "./pages/Traces";
import TraceDetail from "./pages/TraceDetail";
import Sessions from "./pages/Sessions";
import SessionDetail from "./pages/SessionDetail";
import Analytics from "./pages/Analytics";
import ApiKeys from "./pages/ApiKeys";
import Settings from "./pages/Settings";
import Account from "./pages/Account";

function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-neutral-100 mb-4">404</h1>
        <p className="text-neutral-400 mb-6">Page not found</p>
        <Link to="/" className="text-accent hover:underline">
          Go home
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProjectProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Login />} />

                {/* Protected dashboard routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="traces" element={<Traces />} />
                  <Route path="traces/:id" element={<TraceDetail />} />
                  <Route path="sessions" element={<Sessions />} />
                  <Route path="sessions/:id" element={<SessionDetail />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="api-keys" element={<ApiKeys />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="account" element={<Account />} />
                </Route>

                {/* Catch-all for 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </ProjectProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
