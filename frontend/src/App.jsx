import { useState, useEffect } from 'react'
import Landing   from './pages/Landing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import DriverView from './pages/DriverView.jsx'

function getPage() {
  const h = window.location.hash
  if (h.startsWith('#/dashboard')) return 'dashboard'
  if (h.startsWith('#/driver'))    return 'driver'
  return 'landing'
}

export default function App() {
  const [page, setPage] = useState(getPage)

  useEffect(() => {
    const onHash = () => setPage(getPage())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (page === 'dashboard') return <Dashboard />
  if (page === 'driver')    return <DriverView />
  return <Landing />
}
