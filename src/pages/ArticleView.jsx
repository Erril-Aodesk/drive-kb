import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function ArticleView() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('articles')
      .select('*, author:profiles(full_name)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setArticle(data)
        setLoading(false)
      })
  }, [id])

  async function handleDelete() {
    if (!confirm('Delete this article?')) return
    const { error } = await supabase.from('articles').delete().eq('id', id)
    if (error) return alert(error.message)
    navigate('/')
  }

  if (loading) return <div className="splash">Loading…</div>
  if (!article) return <div className="splash">Article not found. <Link to="/">Back</Link></div>

  return (
    <article className="article-view">
      <Link to="/" className="back">← All articles</Link>
      <div className="article-head">
        <h1>{article.title}</h1>
        {isAdmin && (
          <div className="actions">
            <button className="link" onClick={() => navigate(`/edit/${id}`)}>Edit</button>
            <button className="link danger" onClick={handleDelete}>Delete</button>
          </div>
        )}
      </div>
      <p className="meta">
        {article.author?.full_name ?? 'Unknown'} · last updated{' '}
        {new Date(article.updated_at).toLocaleString()}
      </p>
      {/* Plain text rendered with line breaks preserved. Swap in a markdown
          renderer here later if you want rich formatting. */}
      <div className="article-body">{article.content}</div>
    </article>
  )
}
