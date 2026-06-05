import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ArticleList() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase
      .from('articles')
      .select('id, title, content, updated_at, author:profiles(full_name)')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setArticles(data ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = articles.filter(
    (a) =>
      a.title.toLowerCase().includes(q.toLowerCase()) ||
      a.content.toLowerCase().includes(q.toLowerCase())
  )

  if (loading) return <div className="splash">Loading articles…</div>

  return (
    <div className="list-page">
      <div className="list-head">
        <h1>Welcome to Drive Personnel Admin Bible</h1>
        <input
          className="search"
          placeholder="Search articles…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="muted empty">No articles yet.</p>
      ) : (
        <ul className="article-list">
          {filtered.map((a) => (
            <li key={a.id}>
              <Link to={`/article/${a.id}`} className="article-card">
                <h3>{a.title}</h3>
                <p className="excerpt">{a.content.slice(0, 160) || 'No content yet.'}</p>
                <span className="meta">
                  {a.author?.full_name ?? 'Unknown'} · {new Date(a.updated_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
