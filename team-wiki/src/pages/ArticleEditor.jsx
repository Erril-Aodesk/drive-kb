import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function ArticleEditor() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!editing) return
    supabase.from('articles').select('*').eq('id', id).single().then(({ data }) => {
      if (data) { setTitle(data.title); setContent(data.content) }
    })
  }, [id, editing])

  async function handleSave() {
    if (!title.trim()) return setError('Title is required.')
    setBusy(true); setError(null)

    let res
    if (editing) {
      res = await supabase.from('articles').update({ title, content }).eq('id', id)
    } else {
      res = await supabase
        .from('articles')
        .insert({ title, content, author_id: user.id })
        .select('id')
        .single()
    }

    setBusy(false)
    if (res.error) return setError(res.error.message)
    navigate(editing ? `/article/${id}` : `/article/${res.data.id}`)
  }

  return (
    <div className="editor">
      <h1>{editing ? 'Edit article' : 'New article'}</h1>
      <input
        className="title-input"
        placeholder="Article title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="content-input"
        placeholder="Write the article…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={18}
      />
      {error && <p className="auth-msg">{error}</p>}
      <div className="editor-actions">
        <button className="link" onClick={() => navigate(-1)}>Cancel</button>
        <button className="primary" onClick={handleSave} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
