import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DEPARTMENTS = ['CRT', 'MECH', 'CMC']
const EMPTY_NOTES = { CRT: '', MECH: '', CMC: '' }

export default function HostClients() {
  const { isAdmin } = useAuth()
  const [hostClients, setHostClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedHC, setSelectedHC] = useState(null)
  const [activeTab, setActiveTab] = useState('CRT')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')

  // Per-site notes
  const [siteNotes, setSiteNotes] = useState({})
  const [activeSite, setActiveSite] = useState(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)

  // Attachments
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingHC, setEditingHC] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSites, setEditSites] = useState([{ site_name: '', departments: ['CRT'] }])
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

  async function loadSiteNotes(hcId) {
    const { data } = await supabase
      .from('hc_site_notes')
      .select('site_name, notes')
      .eq('host_client_id', hcId)
    const mapped = {}
    if (data) data.forEach(row => { mapped[row.site_name] = row.notes })
    setSiteNotes(mapped)
  }

  useEffect(() => { loadAll() }, [])

  const filtered = hostClients.filter(hc => {
    const q = search.toLowerCase()
    const searchOk = !search.trim() || (
      hc.name.toLowerCase().includes(q) ||
      (hc.hc_sites ?? []).some(s => s.site_name.toLowerCase().includes(q))
    )
    const deptOk = deptFilter === 'All' ||
      (hc.hc_sites ?? []).some(s => s.department === deptFilter)
    return searchOk && deptOk
  })

  function getMatchedSite(hc) {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    if (hc.name.toLowerCase().includes(q)) return null
    const match = (hc.hc_sites ?? []).find(s => s.site_name.toLowerCase().includes(q))
    return match ? match.site_name : null
  }

  function getUniqueSites(hcSites) {
    const map = {}
    ;(hcSites ?? []).forEach(s => {
      if (!map[s.site_name]) map[s.site_name] = []
      if (!map[s.site_name].includes(s.department)) map[s.site_name].push(s.department)
    })
    return Object.entries(map).map(([name, depts]) => ({ name, depts }))
  }

  async function openHC(hc) {
    setSelectedHC(hc)
    setActiveTab('CRT')
    setActiveSite(null)
    setNotesSaved(false)
    setNotesExpanded(false)
    await Promise.all([loadSiteNotes(hc.id), loadAttachments(hc.id)])
  }

  function closeHC() {
    setSelectedHC(null)
    setAttachments([])
    setSiteNotes({})
    setActiveSite(null)
    setNotesSaved(false)
    setNotesExpanded(false)
  }

  function selectSite(siteName) {
    setActiveSite(prev => prev === siteName ? null : siteName)
    setNotesSaved(false)
    setNotesExpanded(false)
  }

  async function saveNotes() {
    if (!activeSite) return
    setSavingNotes(true)
    await supabase
      .from('hc_site_notes')
      .upsert(
        {
          host_client_id: selectedHC.id,
          site_name: activeSite,
          notes: siteNotes[activeSite] ?? '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'host_client_id,site_name' }
      )
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 3000)
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

  function openAdd() { setAddName(''); setAddError(null); setShowAddModal(true) }
  function closeAdd() { setShowAddModal(false); setAddName(''); setAddError(null) }

  async function saveAdd() {
    if (!addName.trim()) return setAddError('Host client name is required.')
    setAddSaving(true); setAddError(null)
    const { error } = await supabase.from('host_clients').insert({ name: addName.trim() })
    setAddSaving(false)
    if (error) return setAddError(error.message)
    closeAdd(); await loadAll()
  }

  function openEdit(hc, e) {
    e.stopPropagation()
    setEditingHC(hc)
    setEditName(hc.name)
    const grouped = {}
    ;(hc.hc_sites ?? []).forEach(s => {
      if (!grouped[s.site_name]) grouped[s.site_name] = []
      if (!grouped[s.site_name].includes(s.department)) grouped[s.site_name].push(s.department)
    })
    const arr = Object.entries(grouped).map(([site_name, departments]) => ({ site_name, departments }))
    setEditSites(arr.length > 0 ? arr : [{ site_name: '', departments: ['CRT'] }])
    setEditError(null)
    setShowEditModal(true)
  }

  function closeEdit() {
    setShowEditModal(false); setEditingHC(null)
    setEditName(''); setEditSites([{ site_name: '', departments: ['CRT'] }]); setEditError(null)
  }

  function updateEditSiteName(index, value) {
    setEditSites(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], site_name: value }
      return updated
    })
  }

  function toggleDept(index, dept) {
    setEditSites(prev => {
      const updated = [...prev]
      const depts = updated[index].departments
      updated[index] = {
        ...updated[index],
        departments: depts.includes(dept)
          ? depts.filter(d => d !== dept)
          : [...depts, dept],
      }
      return updated
    })
  }

  async function saveEdit() {
    if (!editName.trim()) return setEditError('Host client name is required.')
    const validSites = editSites.filter(s => s.site_name.trim() && s.departments.length > 0)
    setEditSaving(true); setEditError(null)
    try {
      await supabase.from('host_clients').update({ name: editName.trim() }).eq('id', editingHC.id)
      await supabase.from('hc_sites').delete().eq('host_client_id', editingHC.id)
      if (validSites.length > 0) {
        const rows = validSites.flatMap(s =>
          s.departments.map(dept => ({
            host_client_id: editingHC.id,
            site_name: s.site_name.trim(),
            department: dept,
          }))
        )
        await supabase.from('hc_sites').insert(rows)
      }
      if (selectedHC && selectedHC.id === editingHC.id) {
        const { data } = await supabase
          .from('host_clients').select('*, hc_sites(*)')
          .eq('id', editingHC.id).single()
        setSelectedHC(data)
      }
      closeEdit(); await loadAll()
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
    ? getUniqueSites(selectedHC.hc_sites).filter(s => s.depts.includes(activeTab))
    : []

  return (
    <div className="host-page">
      <div className="host-header">
        <div>
          <h1>Host Clients</h1>
          <p className="muted">Click a client to open full details.</p>
        </div>
        {isAdmin && (
          <button className="primary sm" onClick={openAdd}>+ Add New</button>
        )}
      </div>

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

      <div className="dept-filter-row">
        {['All', ...DEPARTMENTS].map(dept => (
          <button
            key={dept}
            className={'dept-filter-btn' + (deptFilter === dept ? ' active dept-filter-' + dept.toLowerCase() : '')}
            onClick={() => setDeptFilter(dept)}
          >
            {dept}
          </button>
        ))}
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
        <div className="hc-list">
          {filtered.map(hc => {
            const matchedSite = getMatchedSite(hc)
            const uniqueSites = getUniqueSites(hc.hc_sites)
            const displaySites = deptFilter === 'All'
              ? uniqueSites
              : uniqueSites.filter(s => s.depts.includes(deptFilter))
            return (
              <div
                key={hc.id}
                className="hc-row"
                onClick={() => openHC(hc)}
              >
                <div className="hc-row-icon">&#127968;</div>
                <div className="hc-row-name">
                  <span className="hc-name">{hc.name}</span>
                  {matchedSite && (
                    <span className="hc-match-label">via: {matchedSite}</span>
                  )}
                </div>
                <div className="hc-row-sites">
                  {displaySites.length > 0 ? (
                    displaySites.map(s => (
                      <span key={s.name} className="hc-site-pill">
                        {s.name}
                        <span className="hc-site-depts">
                          {s.depts
                            .filter(d => deptFilter === 'All' || d === deptFilter)
                            .map(d => (
                              <span key={d} className={'dept-pill dept-' + d.toLowerCase()}>{d}</span>
                            ))}
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>No sites</span>
                  )}
                </div>
                {isAdmin && (
                  <div className="hc-row-actions" onClick={e => e.stopPropagation()}>
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
                  {getUniqueSites(selectedHC.hc_sites).length} mining site{getUniqueSites(selectedHC.hc_sites).length !== 1 ? 's' : ''}
                </p>
              </div>
              <button className="modal-close" onClick={closeHC}>X</button>
            </div>

            {/* Dept tabs */}
            <div className="dept-tabs">
              {DEPARTMENTS.map(dept => (
                <button
                  key={dept}
                  className={'dept-tab' + (activeTab === dept ? ' active' : '')}
                  onClick={() => {
                    setActiveTab(dept)
                    setActiveSite(null)
                    setNotesSaved(false)
                    setNotesExpanded(false)
                  }}
                >
                  {dept}
                </button>
              ))}
            </div>

            {/* Scrollable sites list — click to select */}
            <div className="dept-content">
              {tabSites.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', fontSize: 13, padding: '16px 0' }}>
                  No sites under {activeTab}.
                </p>
              ) : (
                <ul className="site-select-list">
                  {tabSites.map(s => (
                    <li
                      key={s.name}
                      className={'site-select-item' + (activeSite === s.name ? ' selected' : '')}
                      onClick={() => selectSite(s.name)}
                    >
                      <span className="dept-client-dot" />
                      <span>{s.name}</span>
                      {siteNotes[s.name] && (
                        <span className="site-has-notes">has notes</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Per-site notes */}
            <div className="site-section">
              <div className="site-section-head">
                <span className="site-section-title">
                  {activeSite ? 'Notes — ' + activeSite : 'Notes'}
                </span>
                {activeSite && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="outline sm" onClick={() => setNotesExpanded(n => !n)}>
                      {notesExpanded ? 'Collapse' : 'Expand'}
                    </button>
                    {isAdmin && (
                      <button className="primary sm" onClick={saveNotes} disabled={savingNotes}>
                        {savingNotes ? 'Saving...' : notesSaved ? 'Saved' : 'Save notes'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!activeSite ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  Select a site above to view or add notes.
                </p>
              ) : (
                <textarea
                  className={'notes-area' + (notesExpanded ? ' notes-expanded' : '')}
                  placeholder={'Add notes for ' + activeSite + '...'}
                  value={siteNotes[activeSite] ?? ''}
                  onChange={e => setSiteNotes(n => ({ ...n, [activeSite]: e.target.value }))}
                  readOnly={!isAdmin}
                  rows={notesExpanded ? 16 : 4}
                />
              )}
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
                <button className="outline sm" onClick={e => openEdit(selectedHC, e)}>Edit</button>
              )}
              <button className="primary sm" onClick={closeHC}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
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

      {/* Edit modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Host Client</h2>
              <button className="modal-close" onClick={closeEdit}>X</button>
            </div>
            <div className="modal-body scrollable-body">
              <label className="field-label">Host Client Name</label>
              <input
                placeholder="e.g. Rio Tinto"
                value={editName}
                onChange={e => setEditName(e.target.value)}
              />
              <label className="field-label">Mining Sites</label>
              <p className="muted" style={{ fontSize: 12, marginBottom: 12, marginTop: -6 }}>
                Type the site name and tick which departments apply.
              </p>
              {editSites.map((row, i) => (
                <div key={i} className="edit-site-row">
                  <div className="edit-site-top">
                    <input
                      placeholder="e.g. Brockman 4"
                      value={row.site_name}
                      onChange={e => updateEditSiteName(i, e.target.value)}
                      style={{ margin: 0, flex: 1 }}
                    />
                    <button
                      className="link danger"
                      onClick={() => setEditSites(editSites.filter((_, idx) => idx !== i))}
                      style={{ flexShrink: 0, padding: '0 8px' }}
                    >
                      X
                    </button>
                  </div>
                  <div className="dept-checkboxes">
                    {DEPARTMENTS.map(d => (
                      <label key={d} className={'dept-check-label' + (row.departments.includes(d) ? ' checked' : '')}>
                        <input
                          type="checkbox"
                          checked={row.departments.includes(d)}
                          onChange={() => toggleDept(i, d)}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                className="link"
                onClick={() => setEditSites([...editSites, { site_name: '', departments: ['CRT'] }])}
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