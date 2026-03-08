import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Client {
  id: string;
  name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_encryption: string | null;
  created_at: string;
}

interface ClientContextType {
  clients: Client[];
  activeClient: Client | null;
  activeClientId: string | null;
  setActiveClientId: (id: string | null) => void;
  loading: boolean;
  refetchClients: () => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClientId, setActiveClientIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveClientId = (id: string | null) => {
    setActiveClientIdState(id);
    if (id) {
      localStorage.setItem('activeClientId', id);
    } else {
      localStorage.removeItem('activeClientId');
    }
  };

  const fetchClients = async () => {
    if (!user) {
      setClients([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setClients(data || []);

      // Restore active client from localStorage
      const stored = localStorage.getItem('activeClientId');
      if (stored && data?.some(c => c.id === stored)) {
        setActiveClientIdState(stored);
      } else if (data && data.length > 0) {
        // Auto-select first client if none stored
        setActiveClientIdState(data[0].id);
        localStorage.setItem('activeClientId', data[0].id);
      } else {
        setActiveClientIdState(null);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [user]);

  const activeClient = clients.find(c => c.id === activeClientId) || null;

  return (
    <ClientContext.Provider value={{
      clients,
      activeClient,
      activeClientId,
      setActiveClientId,
      loading,
      refetchClients: fetchClients,
    }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
}
