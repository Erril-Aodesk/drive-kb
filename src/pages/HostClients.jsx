import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DEPARTMENTS = ['CRT', 'MECH', 'CMC']

export default function HostClients() {
  const { isAdmin } = useAuth()
  const [hostClients, setHostClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState(null)
  const [selectedHC, setSelectedHC] = useState(null)
  const [activeTab, setActiveTab] = useState('CRT')
  const [search, setSearch] = useState('')

  // Notes
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Attachments
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  // Add modal — name only
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)

  // Edit modal — name + sites (free text)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingHC, setEditingHC] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSites, setEditSites] = useState([{ site_name: '', department: 'CRT' }])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase
      .from('host_clients')
      .select('*, hc_sites(*)')
      .order('name')
    setHostClients(data ?? [])
    setLoading(false)
  }

  async function loadAttachments(hcId) {
    const { data } = await supabase
      .from('hc_attachments')
      .select('*')
      .eq('host_client_id', hcId)
      .order('created_at', { ascending: false })
    setAttachments(data ?? [])
  }

  useEffect(() => { loadAll() }, [])

  // Search: match by host client name OR site name
  const filtered = hostClients.filter(hc => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const nameMatch = hc.name.toLowerCase().includes(q)
    const siteMatch = (hc.hc_sites ?? []).some(s =>
      s.site_name.toLowerCase().includes(q)
    )
    return nameMatch || siteMatch
  })

  function getMatchedSite(hc) {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    if (hc.name.toLowerCase().includes(q)) return null
    const match = (hc.hc_sites ?? []).find(s => s.site_name.toLowerCase().includes(q))
    return match ? match.site_name : null
  }

  async function openHC(hc) {
    setSelectedHC(hc)
    setActiveTab('CRT')
    setNotes(hc.notes ?? '')
    setNotesSaved(false)
    await loadAttachments(hc.id)
  }

  function closeHC() {
    setSelectedHC(null)
    setAttachments([])
    setNotes('')
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('host_clients').update({ notes }).eq('id', selectedHC.id)
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 3000)
    await loadAll()
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const filePath = selectedHC.id + '/' + Date.now() + '_' + file.name
    const { error: uploadError } = await supabase.storage
      .from('site-attachments')
      .upload(filePath, file)
    if (uploadError) { alert(uploadError.message); setUploading(false); return }
    await supabase.from('hc_attachments').insert({
      host_client_id: selectedHC.id,
      filename: file.name,
      file_path: filePath,
      file_size: file.size,
    })
    await loadAttachments(selectedHC.id)
    setUploading(false)
    fileRef.current.value = ''
  }

  async function deleteAttachment(att) {
    if (!confirm('Delete this attachment?')) return
    await supabase.storage.from('site-attachments').remove([att.file_path])
    await supabase.from('hc_attachments').delete().eq('id', att.id)
    await loadAttachments(selectedHC.id)
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

  // Add host client — name only
  function openAdd() {
    setAddName('')
    setAddError(null)
    setShowAddModal(true)
  }

  function closeAdd() {
    setShowAddModal(false)
    setAddName('')
    setAddError(null)
  }

  async function saveAdd() {
    if (!addName.trim()) return setAddError('Host client name is required.')
    setAddSaving(true); setAddError(null)
    const { error } = await supabase.from('host_clients').insert({ name: addName.trim() })
    setAddSaving(false)
    if (error) return setAddError(error.message)
    closeAdd()
    await loadAll()
  }

  // Edit host client — name + free-text sites
  function openEdit(hc, e) {
    e.stopPropagation()
    setEditingHC(hc)
    setEditName(hc.name)
    setEditSites(
      hc.hc_sites.length > 0
        ? hc.hc_sites.map(s => ({ site_name: s.site_name, department: s.department }))
        : [{ site_name: '', department: 'CRT' }]
    )
    setEditError(null)
    setShowEditModal(true)
  }

  function closeEdit() {
    setShowEditModal(false)
    setEditingHC(null)
    setEditName('')
    setEditSites([{ site_name: '', department: 'CRT' }])
    setEditError(null)
  }

  function updateEditSite(index, field, value) {
    setEditSites(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  async function saveEdit() {
    if (!editName.trim()) return setEditError('Host client name is required.')
    const validSites = editSites.filter(s => s.site_name.trim())
    setEditSaving(true); setEditError(null)
    try {
      await supabase.from('host_clients').update({ name: editName.trim() }).eq('id', editingHC.id)
      await supabase.from('hc_sites').delete().eq('host_client_id', editingHC.id)
      if (validSites.length > 0) {
        await supabase.from('hc_sites').insert(
          validSites.map(s => ({
            host_client_id: editingHC.id,
            site_name: s.site_name.trim(),
            department: s.department,
          }))
        )
      }
      if (selectedHC && selectedHC.id === editingHC.id) {
        const { data } = await supabase
          .from('host_clients')
          .select('*, hc_sites(*)')
          .eq('id', editingHC.id)
          .single()
        setSelectedHC(data)
      }
      closeEdit()
      await loadAll()
    } catch (e) {
      setEditError(e.message)
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteHC(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this host client and all its data?')) return
    await supabase.from('host_clients').delete().eq('id', id)
    if (selectedHC && selectedHC.id === id) setSelectedHC(null)
    await loadAll()
  }

  const tabSites = selectedHC
    ? (selectedHC.hc_sites ?? []).filter(s => s.department === activeTab)
    : []

  return (
    <div className="host-page">
      <div className="host-header">
        <div>
          <h1>Host Clients</h1>
          <p className="muted">Hover a client to see their sites. Click to open full details.</p>
        </div>
        {isAdmin && (
          <button className="primary sm" onClick={openAdd}>+ Add New</button>
        )}
      </div>

      {/* Search */}
      <div className="hc-search-row">
        <input
          className="search"
          style={{ maxWidth: 360, margin: 0 }}
          placeholder="Search by host client or site name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <span className="muted" style={{ fontSize: 13 }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-links">
          <p className="muted">{search ? 'No results found.' : 'No host clients yet.'}</p>
          {isAdmin && !search && (
            <button className="link" onClick={openAdd}>+ Add the first one</button>
          )}
        </div>
      ) : (
        <div className="sites-grid">
          {filtered.map(hc => {
            const matchedSite = getMatchedSite(hc)
            return (
              <div
                key={hc.id}
                className={'site-card clickable' + (hoveredId === hc.id ? ' hovered' : '')}
                onMouseEnter={() => setHoveredId(hc.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => openHC(hc)}
              >
                <div className="site-main">
                  <div className="site-icon">&#127968;</div>
                  <div className="site-info">
                    <span className="site-name">{hc.name}</span>
                    <span className="site-count">
                      {hc.hc_sites.length} site{hc.hc_sites.length !== 1 ? 's' : ''}
                    </span>
                    {matchedSite && (
                      <span className="hc-match-label">Found via site: {matchedSite}</span>
                    )}
                  </div>
                </div>

                {hoveredId === hc.id && hc.hc_sites.length > 0 && (
                  <div className="site-tooltip">
                    <p className="tooltip-label">Mining Sites</p>
                    <ul className="tooltip-list">
                      {hc.hc_sites.map(s => (
                        <li key={s.id}>
                          <span className={'dept-pill dept-' + s.department.toLowerCase()} style={{ marginRight: 6 }}>
                            {s.department}
                          </span>
                          {s.site_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isAdmin && (
                  <div className="site-actions">
                    <button className="link" onClick={e => openEdit(hc, e)}>Edit</button>
                    <button className="link danger" onClick={e => deleteHC(hc.id, e)}>Delete</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Detail popup */}
      {selectedHC && (
        <div className="modal-overlay" onClick={closeHC}>
          <div className="modal site-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedHC.name}</h2>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {selectedHC.hc_sites.length} mining site{selectedHC.hc_sites.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button className="modal-close" onClick={closeHC}>X</button>
            </div>

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
              {tabSites.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', fontSize: 13, padding: '16px 0' }}>
                  No sites under {activeTab}.
                </p>
              ) : (
                <ul className="dept-client-list">
                  {tabSites.map(s => (
                    <li key={s.id} className="dept-client-item">
                      <span className="dept-client-dot" />
                      <span>{s.site_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
                placeholder="Add notes about this host client..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                readOnly={!isAdmin}
                rows={4}
              />
            </div>

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
                <button className="outline sm" onClick={e => openEdit(selectedHC, e)}>Edit</button>
              )}
              <button className="primary sm" onClick={closeHC}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal — name only */}
      {showAddModal && (
        <div className="modal-overlay" onClick={closeAdd}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Host Client</h2>
              <button className="modal-close" onClick={closeAdd}>X</button>
            </div>
            <div className="modal-body">
              <label className="field-label">Host Client Name</label>
              <input
                placeholder="e.g. Rio Tinto"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveAdd()}
              />
              {addError && <p className="auth-msg">{addError}</p>}
            </div>
            <div className="modal-footer">
              <button className="link" onClick={closeAdd}>Cancel</button>
              <button className="primary" onClick={saveAdd} disabled={addSaving}>
                {addSaving ? 'Saving...' : 'Add host client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — name + free-text sites */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Host Client</h2>
              <button className="modal-close" onClick={closeEdit}>X</button>
            </div>
            <div className="modal-body">
              <label className="field-label">Host Client Name</label>
              <input
                placeholder="e.g. Rio Tinto"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />

              <label className="field-label">Mining Sites</label>
              <p className="muted" style={{ fontSize: 12, marginBottom: 12, marginTop: -6 }}>
                Type the site name and select a department.
              </p>

              <div className="client-input-header">
                <span>Site Name</span>
                <span>Department</span>
                <span />
              </div>

              {editSites.map((row, i) => (
                <div key={i} className="client-input-row">
                  <input
                    placeholder="e.g. Brockman 4"
                    value={row.site_name}
                    onChange={e => updateEditSite(i, 'site_name', e.target.value)}
                    style={{ margin: 0 }}
                  />
                  <select
                    value={row.department}
                    onChange={e => updateEditSite(i, 'department', e.target.value)}
                    style={{ margin: 0 }}
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <button
                    className="link danger"
                    onClick={() => setEditSites(editSites.filter((_, idx) => idx !== i))}
                    style={{ flexShrink: 0, padding: '0 6px' }}
                  >
                    X
                  </button>
                </div>
              ))}

              <button
                className="link"
                onClick={() => setEditSites([...editSites, { site_name: '', department: 'CRT' }])}
                style={{ marginTop: 6 }}
              >
                + Add another site
              </button>

              {editError && <p className="auth-msg" style={{ marginTop: 12 }}>{editError}</p>}
            </div>
            <div className="modal-footer">
              <button className="link" onClick={closeEdit}>Cancel</button>
              <button className="primary" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}