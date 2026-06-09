import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  member: 'Member',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

const NAV_LINKS = [
  { path: '/', label: 'Wiki' },
  { path: '/rates', label: 'Rates' },
  { path: '/induction', label: 'Induction Links' },
  { path: '/host-clients', label: 'Host Client/Sites' },
]

export default function Layout({ children }) {
  const { profile, isAdmin, isSuperAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() { setMenuOpen(false) }

  function handleNav(path) {
    navigate(path)
    closeMenu()
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand" onClick={closeMenu}>
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
          <nav className="topbar-nav desktop-nav">
            {NAV_LINKS.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={'nav-link' + (location.pathname === path ? ' active' : '')}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="topbar-right desktop-right">
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

        {/* Mobile hamburger */}
        <button
          className="hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="mobile-menu">
          <div className="mobile-user">
            <span className={'role-badge role-' + profile?.role}>
              {ROLE_LABELS[profile?.role] ?? 'Member'}
            </span>
            <span className="mobile-who">{profile?.full_name ?? profile?.email}</span>
          </div>

          <nav className="mobile-nav">
            {NAV_LINKS.map(({ path, label }) => (
              <button
                key={path}
                className={'mobile-nav-link' + (location.pathname === path ? ' active' : '')}
                onClick={() => handleNav(path)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="mobile-actions">
            {isAdmin && (
              <button className="primary" style={{ width: '100%' }} onClick={() => handleNav('/new')}>
                + New Article
              </button>
            )}
            {isSuperAdmin && (
              <button className="outline" style={{ width: '100%' }} onClick={() => handleNav('/admin')}>
                Manage Users
              </button>
            )}
            <button className="link" style={{ width: '100%', textAlign: 'left', padding: '10px 0' }} onClick={() => { signOut(); closeMenu() }}>
              Sign out
            </button>
          </div>
        </div>
      )}

      <main className="content" onClick={menuOpen ? closeMenu : undefined}>
        {children}
      </main>
      <footer className="footer">
        <span>Drive Personnel · Building Better Teams</span>
      </footer>
    </div>
  )
}