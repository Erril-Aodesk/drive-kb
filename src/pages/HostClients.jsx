import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const EMPTY_FORM = { siteName: '', clients: [''] }

export default function HostClients() {
  const { isAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingSite, setEditingSite] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function loadSites() {
    setLoading(true)
    const { data: sitesData } = await supabase
      .from('mining_sites')
      .select('*, host_clients(*)')
      .order('name')
    setSites(sitesData ?? [])
    setLoading(false)
  }

  useEffect(() => { loadSites() }, [])

  function openAdd() {
    setEditingSite(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowModal(true)
  }

  function openEdit(site) {
    setEditingSite(site)
    setForm({
      siteName: site.name,
      clients: site.host_clients.length > 0
        ? site.host_clients.map(c => c.name)
        : [''],
    })
    setError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingSite(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  function updateClient(index, value) {
    setForm(f => {
      const clients = [...f.clients]
      clients[index] = value
      return { ...f, clients }
    })
  }

  function addClientRow() {
    setForm(f => ({ ...f, clients: [...f.clients, ''] }))
  }

  function removeClientRow(index) {
    setForm(f => ({
      ...f,
      clients: f.clients.length === 1
        ? ['']
        : f.clients.filter((_, i) => i !== index),
    }))
  }

  async function saveSite() {
    if (!form.siteName.trim()) return setError('Site name is required.')
    const validClients = form.clients.filter(c => c.trim())
    if (validClients.length === 0) return setError('Add at least one host client.')
    setSaving(true); setError(null)

    try {
      let siteId

      if (editingSite) {
        await supabase
          .from('mining_sites')
          .update({ name: form.siteName.trim() })
          .eq('id', editingSite.id)
        siteId = editingSite.id
        // Replace all host clients
        await supabase.from('host_clients').delete().eq('site_id', siteId)
      } else {
        const { data } = await supabase
          .from('mining_sites')
          .insert({ name: form.siteName.trim() })
          .select('id')
          .single()
        siteId = data.id
      }

      await supabase.from('host_clients').insert(
        validClients.map(name => ({ site_id: siteId, name: name.trim() }))
      )

      closeModal()
      await loadSites()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteSite(id) {
    if (!confirm('Delete this site and all its host clients?')) return
    await supabase.from('mining_sites').delete().eq('id', id)
    await loadSites()
  }

  return (
    <div className="host-page">
      <div className="host-header">
        <div>
          <h1>Host Clients</h1>
          <p className="muted">Hover over a site to see its host clients.</p>
        </div>
        {isAdmin && (
          <button className="primary sm" onClick={openAdd}>+ Add New</button>
        )}
      </div>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : sites.length === 0 ? (
        <div className="empty-links">
          <p className="muted">No mining sites yet.</p>
          {isAdmin && <button className="link" onClick={openAdd}>+ Add the first one</button>}
        </div>
      ) : (
        <div className="sites-grid">
          {sites.map(site => (
            <div
              key={site.id}
              className={'site-card' + (hoveredId === site.id ? ' hovered' : '')}
              onMouseEnter={() => setHoveredId(site.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="site-main">
                <div className="site-icon">⛏</div>
                <div className="site-info">
                  <span className="site-name">{site.name}</span>
                  <span className="site-count">
                    {site.host_clients.length} host client{site.host_clients.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Hover tooltip */}
              {hoveredId === site.id && (
                <div className="site-tooltip">
                  <p className="tooltip-label">Host Clients</p>
                  {site.host_clients.length === 0 ? (
                    <p className="tooltip-empty">No host clients added.</p>
                  ) : (
                    <ul className="tooltip-list">
                      {site.host_clients.map(c => (
                        <li key={c.id}>{c.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {isAdmin && (
                <div className="site-actions">
                  <button className="link" onClick={() => openEdit(site)}>Edit</button>
                  <button className="link danger" onClick={() => deleteSite(site.id)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSite ? 'Edit Site' : 'Add Mining Site'}</h2>
              <button className="modal-close" onClick={closeModal}>X</button>
            </div>

            <div className="modal-body">
              <label className="field-label">Mining Site Name</label>
              <input
                placeholder="e.g. Boggabri Coal Mine"
                value={form.siteName}
                onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))}
              />

              <label className="field-label">Host Clients</label>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10, marginTop: -8 }}>
                Add multiple host clients for this site.
              </p>

              {form.clients.map((client, index) => (
                <div key={index} className="client-input-row">
                  <input
                    placeholder={'Host client ' + (index + 1)}
                    value={client}
                    onChange={e => updateClient(index, e.target.value)}
                    style={{ margin: 0 }}
                  />
                  <button
                    className="link danger"
                    onClick={() => removeClientRow(index)}
                    style={{ flexShrink: 0 }}
                  >
                    X
                  </button>
                </div>
              ))}

              <button className="link" onClick={addClientRow} style={{ marginTop: 4 }}>
                + Add another client
              </button>

              {error && <p className="auth-msg" style={{ marginTop: 12 }}>{error}</p>}
            </div>

            <div className="modal-footer">
              <button className="link" onClick={closeModal}>Cancel</button>
              <button className="primary" onClick={saveSite} disabled={saving}>
                {saving ? 'Saving...' : editingSite ? 'Save changes' : 'Add site'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}