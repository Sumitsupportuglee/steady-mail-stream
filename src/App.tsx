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

// Reload once if a lazy chunk fails to load (stale hash after redeploy)
const lazyWithRetry = <T,>(factory: () => Promise<{ default: React.ComponentType<T> }>) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (/dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
        const key = "__lovable_chunk_reload__";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
          return { default: (() => null) as unknown as React.ComponentType<T> };
        }
      }
      throw err;
    }
  });

const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const SenderIdentities = lazyWithRetry(() => import("./pages/SenderIdentities"));
const Contacts = lazyWithRetry(() => import("./pages/Contacts"));
const Campaigns = lazyWithRetry(() => import("./pages/Campaigns"));
const CampaignWizard = lazyWithRetry(() => import("./pages/CampaignWizard"));
const CampaignDetail = lazyWithRetry(() => import("./pages/CampaignDetail"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const LeadFinder = lazyWithRetry(() => import("./pages/LeadFinder"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Clients = lazyWithRetry(() => import("./pages/Clients"));
const ClientReport = lazyWithRetry(() => import("./pages/ClientReport"));
const CRM = lazyWithRetry(() => import("./pages/CRM"));
const PartnershipInquiry = lazyWithRetry(() => import("./pages/PartnershipInquiry"));
const Contact = lazyWithRetry(() => import("./pages/Contact"));
const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"));
const PartnershipInquiry = lazyWithRetry(() => import("./pages/PartnershipInquiry"));

const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const UserManagement = lazyWithRetry(() => import("./pages/admin/UserManagement"));
const SESIdentities = lazyWithRetry(() => import("./pages/admin/SESIdentities"));
const RateLimits = lazyWithRetry(() => import("./pages/admin/RateLimits"));
const MasterDirectory = lazyWithRetry(() => import("./pages/admin/MasterDirectory"));

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
                <Route path="/partnership" element={<PartnershipInquiry />} />
                <Route path="/contact" element={<Contact />} />

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
