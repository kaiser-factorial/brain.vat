import { AuthProvider } from '@/lib/auth-context'
import { BrainVat } from '@/components/brain-vat'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <main className="min-h-screen">
      <AuthProvider>
        <BrainVat />
      </AuthProvider>
    </main>
  )
}
