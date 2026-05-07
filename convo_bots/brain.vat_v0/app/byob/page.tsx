import { redirect } from 'next/navigation'

// BYOB is now a modal on the main page — redirect legacy route
export default function BYOBPage() {
  redirect('/')
}
