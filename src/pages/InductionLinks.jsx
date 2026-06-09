import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const EMPTY_FORM = { title: '', url: '', description: '' }
const PER_PAGE = 10

export default function InductionLinks() {
  const { isAdmin } = useAuth()
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
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
      .order('title')
    setLinks(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadLinks() }, [])

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1) }, [search])

  const filtered = links.filter(l =>
    !search.trim() ||
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    (l.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
    l.url.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function openAdd() {
    setEditingId(null); setForm(EMPTY_FORM); setError(null); setShowForm(true)
  }

  function openEdit(link) {
    setEditingId(link.id)
    setForm({ title: link.title, url: link.url, description: link.description || '' })
    setError(null); setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setError(null)
  }

  async function saveLink() {
    if (!form.title.trim()) return setError('Title is required.')
    if (!form.url.trim()) return setError('URL is required.')
    let url = form.url.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    setSaving(true); setError(null)
    const payload = { title: form.title.trim(), url, description: form.description.trim() || null }
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
    cancelForm(); await loadLinks()
  }

  async function deleteLink(id) {
    if (!confirm('Delete this link?')) return
    await supabase.from('induction_links').delete().eq('id', id)
    await loadLinks()
  }

  // Generate page numbers with ellipsis
  function getPageNumbers() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = []
    if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages)
    } else if (page >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)
    }
    return pages
  }

  const startItem = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const endItem = Math.min(page * PER_PAGE, filtered.length)

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

      {/* Add / Edit form */}
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

      {/* Search bar */}
      {!showForm && (
        <div className="induction-search-row">
          <input
            className="search"
            style={{ maxWidth: 400, margin: 0 }}
            placeholder="Search all induction links..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <span className="muted" style={{ fontSize: 13 }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-links">
          <p className="muted">{search ? 'No results found.' : 'No induction links yet.'}</p>
          {isAdmin && !search && !showForm && (
            <button className="link" onClick={openAdd}>+ Add the first one</button>
          )}
        </div>
      ) : (
        <>
          {/* Count label */}
          <div className="induction-count">
            Showing {startItem}–{endItem} of {filtered.length} link{filtered.length !== 1 ? 's' : ''}
          </div>

          {/* Links list */}
          <div className="induction-list">
            {paginated.map((link, index) => (
              <div key={link.id} className="induction-row">
                <span className="induction-row-number">
                  {(page - 1) * PER_PAGE + index + 1}
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="induction-row-link"
                >
                  <div className="induction-row-info">
                    <span className="induction-row-title">{link.title}</span>
                    {link.description && (
                      <span className="induction-row-desc">{link.description}</span>
                    )}
                  </div>
                  <span className="induction-row-arrow">&#8599;</span>
                </a>
                {isAdmin && (
                  <div className="induction-row-actions">
                    <button className="link" onClick={() => openEdit(link)}>Edit</button>
                    <button className="link danger" onClick={() => deleteLink(link.id)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>

              <div className="page-numbers">
                {getPageNumbers().map((p, i) =>
                  p === '...' ? (
                    <span key={'ellipsis-' + i} className="page-ellipsis">...</span>
                  ) : (
                    <button
                      key={p}
                      className={'page-num' + (page === p ? ' active' : '')}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                className="page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}