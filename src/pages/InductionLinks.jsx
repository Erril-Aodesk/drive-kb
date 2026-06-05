import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const EMPTY_FORM = { title: '', url: '', description: '' }

export default function InductionLinks() {
  const { isAdmin } = useAuth()
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function loadLinks() {
    setLoading(true)
    const { data } = await supabase
      .from('induction_links')
      .select('*')
      .order('sort_order')
      .order('created_at')
    setLinks(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadLinks() }, [])

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  function openEdit(link) {
    setEditingId(link.id)
    setForm({ title: link.title, url: link.url, description: link.description || '' })
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function saveLink() {
    if (!form.title.trim()) return setError('Title is required.')
    if (!form.url.trim()) return setError('URL is required.')

    let url = form.url.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url

    setSaving(true)
    setError(null)

    const payload = {
      title: form.title.trim(),
      url,
      description: form.description.trim() || null,
    }

    let err
    if (editingId) {
      const res = await supabase.from('induction_links').update(payload).eq('id', editingId)
      err = res.error
    } else {
      const res = await supabase.from('induction_links').insert(payload)
      err = res.error
    }

    setSaving(false)
    if (err) return setError(err.message)
    cancelForm()
    await loadLinks()
  }

  async function deleteLink(id) {
    if (!confirm('Delete this link?')) return
    await supabase.from('induction_links').delete().eq('id', id)
    await loadLinks()
  }

  return (
    <div className="induction-page">
      <div className="induction-header">
        <div>
          <h1>Induction Links</h1>
          <p className="muted">Click any link to open it in a new tab.</p>
        </div>
        {isAdmin && !showForm && (
          <button className="primary sm" onClick={openAdd}>+ Add Link</button>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="link-form">
          <h3>{editingId ? 'Edit Link' : 'Add New Link'}</h3>
          <label className="field-label">Title</label>
          <input
            placeholder="e.g. Workplace Health and Safety"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <label className="field-label">URL</label>
          <input
            placeholder="e.g. https://example.com/induction"
            value={form.url}
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          />
          <label className="field-label">Description (optional)</label>
          <input
            placeholder="Short description of what this link is for"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          {error && <p className="auth-msg">{error}</p>}
          <div className="form-actions">
            <button className="link" onClick={cancelForm}>Cancel</button>
            <button className="primary" onClick={saveLink} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add link'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading...</p>
      ) : links.length === 0 ? (
        <div className="empty-links">
          <p className="muted">No induction links yet.</p>
          {isAdmin && (
            <button className="link" onClick={openAdd}>+ Add the first one</button>
          )}
        </div>
      ) : (
        <ul className="link-list">
          {links.map(link => (
            <li key={link.id} className="link-card">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-card-main"
              >
                <div className="link-icon">&#128279;</div>
                <div className="link-info">
                  <span className="link-title">{link.title}</span>
                  {link.description && (
                    <span className="link-desc">{link.description}</span>
                  )}
                  <span className="link-url">{link.url}</span>
                </div>
                <div className="link-arrow">&#8599;</div>
              </a>
              {isAdmin && (
                <div className="link-actions">
                  <button className="link" onClick={() => openEdit(link)}>Edit</button>
                  <button className="link danger" onClick={() => deleteLink(link.id)}>Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}