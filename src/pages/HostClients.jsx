import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DEPARTMENTS = ['CRT', 'MECH', 'CMC']
const EMPTY_FORM = { siteName: '', clients: [''] }

export default function HostClients() {
  const { isAdmin } = useAuth()
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState(null)
  const [selectedSite, setSelectedSite] = useState(null)
  const [activeTab, setActiveTab] = useState('CRT')

  // Inline host client editing
  const [editingClients, setEditingClients] = useState(false)
  const [clientDraft, setClientDraft] = useState([])
  const [savingClients, setSavingClients] = useState(false)

  // Notes
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Attachments
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  // Add/Edit site modal
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

  async function loadAttachments(siteId) {
    const { data } = await supabase
      .from('site_attachments')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
    setAttachments(data ?? [])
  }

  useEffect(() => { loadSites() }, [])

  async function openSite(site) {
    setSelectedSite(site)
    setActiveTab('CRT')
    setNotes(site.notes ?? '')
    setNotesSaved(false)
    setEditingClients(false)
    await loadAttachments(site.id)
  }

  function closeSite() {
    setSelectedSite(null)
    setAttachments([])
    setNotes('')
    setEditingClients(false)
  }

  // Inline host client editing
  function startEditClients() {
    setClientDraft(
      selectedSite.host_clients.length > 0
        ? selectedSite.host_clients.map(c => c.name)
        : ['']
    )
    setEditingClients(true)
  }

  function cancelEditClients() {
    setEditingClients(false)
    setClientDraft([])
  }

  async function saveClients() {
    const valid = clientDraft.filter(n => n.trim())
    if (valid.length === 0) return
    setSavingClients(true)
    await supabase.from('host_clients').delete().eq('site_id', selectedSite.id)
    await supabase.from('host_clients').insert(
      valid.map(name => ({ site_id: selectedSite.id, name: name.trim() }))
    )
    const { data } = await supabase
      .from('mining_sites')
      .select('*, host_clients(*)')
      .eq('id', selectedSite.id)
      .single()
    setSelectedSite(data)
    setEditingClients(false)
    setSavingClients(false)
    await loadSites()
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('mining_sites').update({ notes }).eq('id', selectedSite.id)
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 3000)
    await loadSites()
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const filePath = selectedSite.id + '/' + Date.now() + '_' + file.name
    const { error: uploadError } = await supabase.storage
      .from('site-attachments')
      .upload(filePath, file)
    if (uploadError) { alert(uploadError.message); setUploading(false); return }
    await supabase.from('site_attachments').insert({
      site_id: selectedSite.id,
      filename: file.name,
      file_path: filePath,
      file_size: file.size,
    })
    await loadAttachments(selectedSite.id)
    setUploading(false)
    fileRef.current.value = ''
  }

  async function deleteAttachment(att) {
    if (!confirm('Delete this attachment?')) return
    await supabase.storage.from('site-attachments').remove([att.file_path])
    await supabase.from('site_attachments').delete().eq('id', att.id)
    await loadAttachments(selectedSite.id)
  }

  function getFileUrl(filePath) {
    const { data } = supabase.storage.from('site-attachments').getPublicUrl(filePath)
    return data.publicUrl
  }

  function formatSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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
    setForm({ siteName: site.name, clients: [''] })
    setError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingSite(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function saveSite() {
    if (!form.siteName.trim()) return setError('Site name is required.')
    setSaving(true); setError(null)
    try {
      if (editingSite) {
        await supabase.from('mining_sites').update({ name: form.siteName.trim() }).eq('id', editingSite.id)
      } else {
        await supabase.from('mining_sites').insert({ name: form.siteName.trim() })
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
    if (!confirm('Delete this site and all its data?')) return
    await supabase.from('mining_sites').delete().eq('id', id)
    if (selectedSite && selectedSite.id === id) setSelectedSite(null)
    await loadSites()
  }

  return (
    <div className="host-page">
      <div className="host-header">
        <div>
          <h1>Host Clients</h1>
          <p className="muted">Hover a site to preview. Click to open full details.</p>
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
              className={'site-card clickable' + (hoveredId === site.id ? ' hovered' : '')}
              onMouseEnter={() => setHoveredId(site.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => openSite(site)}
            >
              <div className="site-main">
                <div className="site-icon">&#9935;</div>
                <div className="site-info">
                  <span className="site-name">{site.name}</span>
                  <span className="site-count">
                    {site.host_clients.length} host client{site.host_clients.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {hoveredId === site.id && site.host_clients.length > 0 && (
                <div className="site-tooltip">
                  <p className="tooltip-label">Host Clients</p>
                  <ul className="tooltip-list">
                    {site.host_clients.map(c => (
                      <li key={c.id}>{c.name}</li>
                    ))}
                  </ul>
                </div>
              )}

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

            {/* Header */}
            <div className="modal-header">
              <h2>{selectedSite.name}</h2>
              <button className="modal-close" onClick={closeSite}>X</button>
            </div>

            {/* Host Clients section - right below the title */}
            <div className="site-section">
              <div className="site-section-head">
                <span className="site-section-title">Host Clients</span>
                {isAdmin && !editingClients && (
                  <button className="outline sm" onClick={startEditClients}>Edit</button>
                )}
              </div>

              {!editingClients ? (
                selectedSite.host_clients.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>No host clients added yet.</p>
                ) : (
                  <ul className="dept-client-list">
                    {selectedSite.host_clients.map(c => (
                      <li key={c.id} className="dept-client-item">
                        <span className="dept-client-dot" />
                        <span>{c.name}</span>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div className="client-edit-inline">
                  {clientDraft.map((name, i) => (
                    <div key={i} className="client-input-row">
                      <input
                        placeholder={'Host client ' + (i + 1)}
                        value={name}
                        onChange={e => {
                          const d = [...clientDraft]
                          d[i] = e.target.value
                          setClientDraft(d)
                        }}
                        style={{ margin: 0 }}
                      />
                      <button
                        className="link danger"
                        onClick={() => setClientDraft(clientDraft.filter((_, idx) => idx !== i))}
                        style={{ flexShrink: 0 }}
                      >
                        X
                      </button>
                    </div>
                  ))}
                  <button
                    className="link"
                    onClick={() => setClientDraft([...clientDraft, ''])}
                    style={{ fontSize: 13, marginTop: 4 }}
                  >
                    + Add client
                  </button>
                  <div className="editor-actions" style={{ marginTop: 10 }}>
                    <button className="link" onClick={cancelEditClients}>Cancel</button>
                    <button className="primary sm" onClick={saveClients} disabled={savingClients}>
                      {savingClients ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Department tabs - CRT, MECH, CMC */}
            <div className="dept-tabs">
              {DEPARTMENTS.map(dept => (
                <button
                  key={dept}
                  className={'dept-tab' + (activeTab === dept ? ' active' : '')}
                  onClick={() => setActiveTab(dept)}
                >
                  {dept}
                </button>
              ))}
            </div>

            <div className="dept-content">
              <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
                {activeTab} department
              </p>
            </div>

            {/* Notes */}
            <div className="site-section">
              <div className="site-section-head">
                <span className="site-section-title">Notes</span>
                {isAdmin && (
                  <button className="primary sm" onClick={saveNotes} disabled={savingNotes}>
                    {savingNotes ? 'Saving...' : notesSaved ? 'Saved' : 'Save notes'}
                  </button>
                )}
              </div>
              <textarea
                className="notes-area"
                placeholder="Add notes about this site..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                readOnly={!isAdmin}
                rows={4}
              />
            </div>

            {/* Attachments */}
            <div className="site-section">
              <div className="site-section-head">
                <span className="site-section-title">Attachments</span>
                {isAdmin && (
                  <div>
                    <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
                    <button className="outline sm" onClick={() => fileRef.current.click()} disabled={uploading}>
                      {uploading ? 'Uploading...' : '+ Upload file'}
                    </button>
                  </div>
                )}
              </div>
              {attachments.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>No attachments yet.</p>
              ) : (
                <ul className="attachment-list">
                  {attachments.map(att => (
                    <li key={att.id} className="attachment-item">
                      <a
                        href={getFileUrl(att.file_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="attachment-link"
                      >
                        <span className="attachment-icon">&#128196;</span>
                        <div className="attachment-info">
                          <span className="attachment-name">{att.filename}</span>
                          <span className="attachment-size">{formatSize(att.file_size)}</span>
                        </div>
                        <span className="attachment-download">Download</span>
                      </a>
                      {isAdmin && (
                        <button className="link danger" onClick={() => deleteAttachment(att)}>X</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="modal-footer">
              {isAdmin && (
                <button className="outline sm" onClick={e => openEdit(selectedSite, e)}>Edit site name</button>
              )}
              <button className="primary sm" onClick={closeSite}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit site modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSite ? 'Edit Site Name' : 'Add Mining Site'}</h2>
              <button className="modal-close" onClick={closeModal}>X</button>
            </div>
            <div className="modal-body">
              <label className="field-label">Mining Site Name</label>
              <input
                placeholder="e.g. Boggabri Coal Mine"
                value={form.siteName}
                onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))}
              />
              {error && <p className="auth-msg" style={{ marginTop: 8 }}>{error}</p>}
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