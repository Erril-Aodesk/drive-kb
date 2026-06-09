import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  member: 'Member',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

export default function Layout({ children }) {
  const { profile, isAdmin, isSuperAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const navLink = (path, label) => (
    <Link
      to={path}
      className={'nav-link ' + (location.pathname === path ? 'active' : '')}
    >
      {label}
    </Link>
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand">
            <img
              src="/logo.png"
              alt="Drive Personnel"
              className="brand-logo"
              onError={e => { e.target.style.display = 'none' }}
            />
            <div className="brand-text">
              <span className="brand-name">Drive Personnel</span>
              <span className="brand-tagline">Knowledge Base</span>
            </div>
          </Link>
<nav className="topbar-nav">
  {navLink('/', 'Wiki')}
  {navLink('/rates', 'Rates')}
  {navLink('/induction', 'Induction Links')}
  {navLink('/host-clients', 'Host Clients')}
</nav>
        </div>

        <div className="topbar-right">
          {isAdmin && (
            <button className="primary sm" onClick={() => navigate('/new')}>
              + New Article
            </button>
          )}
          {isSuperAdmin && (
            <button className="outline sm" onClick={() => navigate('/admin')}>
              Manage Users
            </button>
          )}
          <span className={'role-badge role-' + profile?.role}>
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