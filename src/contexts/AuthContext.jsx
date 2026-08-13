import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Carregar dados de perfil e permissões do Supabase
  const loadProfileData = async (userId) => {
    if (!userId) {
      setProfile(null);
      setPermissions({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, permissions, full_name, email')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
        setPermissions(data.permissions || {});
      }
    } catch (err) {
      console.error("Erro ao carregar permissões do usuário:", err);
    }
  };

  useEffect(() => {
    // Obter sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        loadProfileData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Escutar mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        loadProfileData(session.user.id);
      } else {
        setProfile(null);
        setPermissions({});
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Helper para checar se o usuário tem permissão de visualizar uma aba/setor
  const canView = (moduleKey) => {
    if (!user) return false;
    // Se for admin ou se ainda não tem perfil (ou perfil padrão), dá acesso total
    if (!profile || profile?.role === 'admin' || profile?.role !== 'staff') return true; 
    const modPerm = permissions[moduleKey];
    if (!modPerm) return false;
    return typeof modPerm === 'boolean' ? modPerm : !!modPerm.ver;
  };

  // Helper para checar se o usuário tem permissão de editar num setor
  const canEdit = (moduleKey) => {
    if (!user) return false;
    if (!profile || profile?.role === 'admin' || profile?.role !== 'staff') return true; 
    const modPerm = permissions[moduleKey];
    if (!modPerm) return false;
    return typeof modPerm === 'boolean' ? modPerm : !!modPerm.edit;
  };

  const signIn = async (email, password) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    return { data, error };
  };

  const signUp = async (email, password, fullName = '') => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    setLoading(false);
    return { data, error };
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setPermissions({});
    setLoading(false);
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      permissions,
      loading,
      canView,
      canEdit,
      reloadProfile: () => loadProfileData(user?.id),
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

export default AuthContext;
