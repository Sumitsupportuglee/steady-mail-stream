import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClientProvider } from "@/contexts/ClientContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import SenderIdentities from "./pages/SenderIdentities";
import Contacts from "./pages/Contacts";
import Campaigns from "./pages/Campaigns";
import CampaignWizard from "./pages/CampaignWizard";
import CampaignDetail from "./pages/CampaignDetail";
import Settings from "./pages/Settings";
import LeadFinder from "./pages/LeadFinder";
import Pricing from "./pages/Pricing";
import Landing from "./pages/Landing";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import Clients from "./pages/Clients";
import ClientReport from "./pages/ClientReport";
import CRM from "./pages/CRM";
import Integrations from "./pages/Integrations";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import SESIdentities from "./pages/admin/SESIdentities";
import RateLimits from "./pages/admin/RateLimits";
import MasterDirectory from "./pages/admin/MasterDirectory";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClientProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Protected routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
              <Route path="/client-report" element={<ProtectedRoute><ClientReport /></ProtectedRoute>} />
              <Route path="/identities" element={<ProtectedRoute><SenderIdentities /></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
              <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
              <Route path="/campaigns/new" element={<ProtectedRoute><CampaignWizard /></ProtectedRoute>} />
              <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute><LeadFinder /></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
              <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
              
              {/* Admin routes */}
              <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminRoute><UserManagement /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/ses-identities" element={<ProtectedRoute><AdminRoute><SESIdentities /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/rate-limits" element={<ProtectedRoute><AdminRoute><RateLimits /></AdminRoute></ProtectedRoute>} />
              <Route path="/admin/directory" element={<ProtectedRoute><AdminRoute><MasterDirectory /></AdminRoute></ProtectedRoute>} />
              
              <Route path="/terms" element={<Terms />} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ClientProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
