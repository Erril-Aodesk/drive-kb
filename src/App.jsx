import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import ArticleList from './pages/ArticleList'
import ArticleView from './pages/ArticleView'
import ArticleEditor from './pages/ArticleEditor'
import AdminPanel from './pages/AdminPanel'
import Rates from './pages/Rates'
import InductionLinks from './pages/InductionLinks'
import HostClients from './pages/HostClients'

export default function App() {
  const { session, isAdmin, isSuperAdmin, loading } = useAuth()

  if (loading) return <div className="splash">Loading...</div>

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
        <Route path="/new" element={isAdmin ? <ArticleEditor /> : <Navigate to="/" />} />
        <Route path="/edit/:id" element={isAdmin ? <ArticleEditor /> : <Navigate to="/" />} />
        <Route path="/admin" element={isSuperAdmin ? <AdminPanel /> : <Navigate to="/" />} />
        <Route path="/rates" element={<Rates />} />
        <Route path="/induction" element={<InductionLinks />} />
        <Route path="/host-clients" element={<HostClients />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}