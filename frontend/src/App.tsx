import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "./stores/authStore";
import { useDataStore } from "./stores/dataStore";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ClientDetailsPage } from "./pages/ClientDetailsPage";
import { ToastContainer } from "react-toastify";
import { api } from "./utils/api";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const loadData = useDataStore((state) => state.loadData);

  React.useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user, loadData]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="min-h-screen"
      >
        <Routes location={location}>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/:clientId"
            element={
              <ProtectedRoute>
                <ClientDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
          />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const [checking, setChecking] = React.useState(true);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  React.useEffect(() => {
    const verify = async () => {
      if (user) {
        try {
          const res = await api.get("/api/me", {
            headers: { "x-username": user.username },
          });
          if (!res.data.user) {
            logout();
          } else {
            // حمّل الداتا قبل ما تظهر الصفحة
            await useDataStore.getState().loadData();
          }
        } catch {
          logout();
        }
      }
      setChecking(false);
    };
    void verify();
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen login-bg">
        <div className="w-12 h-12 border-4 border-yellow-500 rounded-full border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AnimatedRoutes />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl
        pauseOnFocusLoss
        draggable
        theme="colored"
      />
    </BrowserRouter>
  );
};

export default App;
