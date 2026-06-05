import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import ArticleList from './pages/ArticleList'
import ArticleView from './pages/ArticleView'
import ArticleEditor from './pages/ArticleEditor'

export default function App() {
  const { session, isAdmin, loading } = useAuth()

  if (loading) return <div className="splash">Loading…</div>

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ArticleList />} />
        <Route path="/article/:id" element={<ArticleView />} />
        {/* Editor routes are admin-only; members get bounced home. */}
        <Route path="/new" element={isAdmin ? <ArticleEditor /> : <Navigate to="/" />} />
        <Route path="/edit/:id" element={isAdmin ? <ArticleEditor /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}
