import { redirect } from 'next/navigation'

// Self-registration has been replaced by invitation-based registration
// Redirect to login page
export default function SignupPage() {
    redirect('/login')
}
