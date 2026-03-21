import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/auth.store';

export function useAuth() {
  const { user, setUser, businessId, setBusinessId } = useAuthStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email });
        } else {
          setUser(null);
        }
      }
    );

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser]);

  return { user, businessId, setBusinessId };
}
