import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClientProvider } from "@/contexts/ClientContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";

// Landing eagerly imported (LCP) — everything else lazy
import Landing from "./pages/Landing";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SenderIdentities = lazy(() => import("./pages/SenderIdentities"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignWizard = lazy(() => import("./pages/CampaignWizard"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const LeadFinder = lazy(() => import("./pages/LeadFinder"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientReport = lazy(() => import("./pages/ClientReport"));
const CRM = lazy(() => import("./pages/CRM"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const PartnershipInquiry = lazy(() => import("./pages/PartnershipInquiry"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const SESIdentities = lazy(() => import("./pages/admin/SESIdentities"));
const RateLimits = lazy(() => import("./pages/admin/RateLimits"));
const MasterDirectory = lazy(() => import("./pages/admin/MasterDirectory"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
      <span className="status-dot" /> loading
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClientProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/partnership" element={<PartnershipInquiry />} />

                {/* Landing */}
                <Route path="/" element={<Landing />} />

                {/* Protected routes */}
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
            </Suspense>
          </ClientProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
