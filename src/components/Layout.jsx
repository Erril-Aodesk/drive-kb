import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">§</span>
          <span className="brand-name">Team Wiki</span>
        </Link>
        <div className="topbar-right">
          {isAdmin && (
            <button className="primary sm" onClick={() => navigate('/new')}>
              + New article
            </button>
          )}
          <span className={`role-badge ${isAdmin ? 'admin' : ''}`}>
            {profile?.role ?? 'member'}
          </span>
          <span className="who">{profile?.full_name ?? profile?.email}</span>
          <button className="link" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}
