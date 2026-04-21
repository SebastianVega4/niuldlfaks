import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const adminGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Check Supabase session
  const { data } = await supabase.client.auth.getSession();
  
  if (data.session) {
    supabase.isAdmin.set(true);
    return true;
  }

  // Not logged in, redirect to home
  supabase.isAdmin.set(false);
  return router.parseUrl('/login');
};
