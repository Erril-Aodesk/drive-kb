import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  member: 'Member',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

export default function Layout({ children }) {
  const { profile, isAdmin, isSuperAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img
            src="/logo.png"
            alt="Drive Personnel"
            className="brand-logo"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div className="brand-text">
            <span className="brand-name">Drive Personnel</span>
            <span className="brand-tagline">Knowledge Base</span>
          </div>
        </Link>

        <div className="topbar-right">
          {isAdmin && (
            <button className="primary sm" onClick={() => navigate('/new')}>
              + New Article
            </button>
          )}
          {isSuperAdmin && (
            <button className="outline sm" onClick={() => navigate('/admin')}>
              ⚙ Manage Users
            </button>
          )}
          <span className={`role-badge role-${profile?.role}`}>
            {ROLE_LABELS[profile?.role] ?? 'Member'}
          </span>
          <span className="who">{profile?.full_name ?? profile?.email}</span>
          <button className="link" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="content">{children}</main>
      <footer className="footer">
        <span>Drive Personnel · Building Better Teams</span>
      </footer>
    </div>
  )
}