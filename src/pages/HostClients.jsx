import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DEPARTMENTS = ['CRT', 'MECH', 'CMC']
const EMPTY_FORM = { siteName: '', clients: [{ name: '', department: 'CRT' }] }

export default function HostClients() {
  const { isAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState(null)
  const [activeTab, setActiveTab] = useState('CRT')
  const [showModal, setShowModal] = useState(false)
  const [editingSite, setEditingSite] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function loadSites() {
    setLoading(true)
    const { data } = await supabase
      .from('mining_sites')
      .select('*, host_clients(*)')
      .order('name')
    setSites(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadSites() }, [])

  function openSite(site) {
    setSelectedSite(site)
    setActiveTab('CRT')
  }

  function closeSite() {
    setSelectedSite(null)
  }

  function openAdd() {
    setEditingSite(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowModal(true)
  }

  function openEdit(site, e) {
    e.stopPropagation()
    setEditingSite(site)
    setForm({
      siteName: site.name,
      clients: site.host_clients.length > 0
        ? site.host_clients.map(c => ({ name: c.name, department: c.department }))
        : [{ name: '', department: 'CRT' }],
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

  function updateClient(index, field, value) {
    setForm(f => {
      const clients = [...f.clients]
      clients[index] = { ...clients[index], [field]: value }
      return { ...f, clients }
    })
  }

  function addClientRow() {
    setForm(f => ({ ...f, clients: [...f.clients, { name: '', department: 'CRT' }] }))
  }

  function removeClientRow(index) {
    setForm(f => ({
      ...f,
      clients: f.clients.length === 1
        ? [{ name: '', department: 'CRT' }]
        : f.clients.filter((_, i) => i !== index),
    }))
  }

  async function saveSite() {
    if (!form.siteName.trim()) return setError('Site name is required.')
    const validClients = form.clients.filter(c => c.name.trim())
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
        validClients.map(c => ({
          site_id: siteId,
          name: c.name.trim(),
          department: c.department,
        }))
      )

      // Refresh selected site if open
      if (selectedSite && selectedSite.id === siteId) {
        const { data } = await supabase
          .from('mining_sites')
          .select('*, host_clients(*)')
          .eq('id', siteId)
          .single()
        setSelectedSite(data)
      }

      closeModal()
      await loadSites()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteSite(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this site and all its host clients?')) return
    await supabase.from('mining_sites').delete().eq('id', id)
    if (selectedSite?.id === id) setSelectedSite(null)
    await loadSites()
  }

  const tabClients = selectedSite
    ? (selectedSite.host_clients ?? []).filter(c => c.department === activeTab)
    : []

  return (
    <div className="host-page">
      <div className="host-header">
        <div>
          <h1>Sites</h1>
          <p className="muted">Click a mining site to view its host clients by department.</p>
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
              className="site-card clickable"
              onClick={() => openSite(site)}
            >
              <div className="site-main">
                <div className="site-icon">&#9935;</div>
                <div className="site-info">
                  <span className="site-name">{site.name}</span>
                  <div className="site-dept-counts">
                    {DEPARTMENTS.map(dept => {
                      const count = site.host_clients.filter(c => c.department === dept).length
                      return count > 0 ? (
                        <span key={dept} className={'dept-pill dept-' + dept.toLowerCase()}>
                          {dept}: {count}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="site-actions">
                  <button className="link" onClick={e => openEdit(site, e)}>Edit</button>
                  <button className="link danger" onClick={e => deleteSite(site.id, e)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Site detail popup */}
      {selectedSite && (
        <div className="modal-overlay" onClick={closeSite}>
          <div className="modal site-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedSite.name}</h2>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {selectedSite.host_clients.length} host client{selectedSite.host_clients.length !== 1 ? 's' : ''} across {DEPARTMENTS.length} departments
                </p>
              </div>
              <button className="modal-close" onClick={closeSite}>X</button>
            </div>

            {/* Department tabs */}
            <div className="dept-tabs">
              {DEPARTMENTS.map(dept => (
                <button
                  key={dept}
                  className={'dept-tab' + (activeTab === dept ? ' active' : '')}
                  onClick={() => setActiveTab(dept)}
                >
                  {dept}
                  <span className="dept-tab-count">
                    {(selectedSite.host_clients ?? []).filter(c => c.department === dept).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="dept-content">
              {tabClients.length === 0 ? (
                <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
                  No host clients under {activeTab} for this site.
                </p>
              ) : (
                <ul className="dept-client-list">
                  {tabClients.map(c => (
                    <li key={c.id} className="dept-client-item">
                      <span className="dept-client-dot" />
                      <span>{c.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="modal-footer">
              {isAdmin && (
                <button className="outline sm" onClick={e => openEdit(selectedSite, e)}>
                  Edit site
                </button>
              )}
              <button className="primary sm" onClick={closeSite}>Close</button>
            </div>
          </div>
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
              <p className="muted" style={{ fontSize: 12, marginBottom: 12, marginTop: -6 }}>
                Add host clients and assign each to a department.
              </p>

              <div className="client-input-header">
                <span>Name</span>
                <span>Department</span>
                <span />
              </div>

              {form.clients.map((client, index) => (
                <div key={index} className="client-input-row">
                  <input
                    placeholder={'Host client ' + (index + 1)}
                    value={client.name}
                    onChange={e => updateClient(index, 'name', e.target.value)}
                    style={{ margin: 0 }}
                  />
                  <select
                    value={client.department}
                    onChange={e => updateClient(index, 'department', e.target.value)}
                    style={{ margin: 0 }}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <button
                    className="link danger"
                    onClick={() => removeClientRow(index)}
                    style={{ flexShrink: 0, padding: '0 6px' }}
                  >
                    X
                  </button>
                </div>
              ))}

              <button className="link" onClick={addClientRow} style={{ marginTop: 6 }}>
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