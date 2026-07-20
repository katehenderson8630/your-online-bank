import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth, RequireAdmin } from "@/components/Guards";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AppLayout from "./layouts/AppLayout";
import AdminLayout from "./layouts/AdminLayout";
import Dashboard from "./pages/app/Dashboard";
import Transactions from "./pages/app/Transactions";
import Transfers from "./pages/app/Transfers";
import DepositWithdraw from "./pages/app/DepositWithdraw";
import Cards from "./pages/app/Cards";
import Bills from "./pages/app/Bills";
import Profile from "./pages/app/Profile";
import Loans from "./pages/app/Loans";
import ATC from "./pages/app/ATC";
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import Approvals from "./pages/admin/Approvals";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AuditLog from "./pages/admin/AuditLog";
import AdminSupport from "./pages/admin/Support";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="transfers" element={<Transfers />} />
              <Route path="deposit" element={<DepositWithdraw />} />
              <Route path="cards" element={<Cards />} />
              <Route path="bills" element={<Bills />} />
              <Route path="loans" element={<Loans />} />
              <Route path="atc" element={<ATC />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
              <Route index element={<AdminOverview />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="approvals" element={<Approvals />} />
              <Route path="transactions" element={<AdminTransactions />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="support" element={<AdminSupport />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
