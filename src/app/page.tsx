import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { signout } from './auth/actions'
import NoRoleFallback from './no-role-fallback'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile to get the role
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role) {
    const role = profile.role as string

    if (role === 'super_admin') {
      redirect('/super-admin')
    } else if (role === 'admin') {
      redirect('/admin')
    } else if (role === 'teacher') {
      redirect('/teacher')
    } else if (role === 'student') {
      redirect('/student')
    } else if (role === 'parent') {
      redirect('/parent')
    } else if (role === 'school_staff') {
      redirect('/admin')
    }
  }

  // Fallback if no role or unknown role
  return (
    <NoRoleFallback
      userId={user.id}
      role={profile?.role ?? null}
      errorMessage={error?.message ?? null}
      signOutAction={signout}
    />
  )
}


