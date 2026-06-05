import { useEffect, useState, useRef } from 'react'
import { read, utils } from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Rates() {
  const { isAdmin } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [rates, setRates] = useState([])
  const [loadingRates, setLoadingRates] = useState(false)

  // Client form
  const [newClient, setNewClient] = useState('')
  const [addingClient, setAddingClient] = useState(false)

  // Excel modal
  const [showModal, setShowModal] = useState(false)
  const [preview, setPreview] = useState([])
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('sort_order').order('name')
    setClients(data ?? [])
  }

  async function loadRates(clientId) {
    setLoadingRates(true)
    const { data } = await supabase
      .from('rates')
      .select('*')
      .eq('client_id', clientId)
      .order('position')
    setRates(data ?? [])
    setLoadingRates(false)
  }

  useEffect(() => { loadClients() }, [])

  useEffect(() => {
    if (selectedId) loadRates(selectedId)
    else setRates([])
  }, [selectedId])

  async function addClient() {
    if (!newClient.trim()) return
    setAddingClient(true)
    const { data } = await supabase
      .from('clients')
      .insert({ name: newClient.trim() })
      .select('id')
      .single()
    setNewClient('')
    await loadClients()
    if (data) setSelectedId(data.id)
    setAddingClient(false)
  }

  async function deleteClient(id) {
    if (!confirm('Delete this client and all their rates?')) return
    await supabase.from('clients').delete().eq('id', id)
    if (selectedId === id) setSelectedId('')
    await loadClients()
  }

  async function deleteRate(id) {
    if (!confirm('Delete this rate?')) return
    await supabase.from('rates').delete().eq('id', id)
    await loadRates(selectedId)
  }

  // Parse Excel file into preview rows
  function parseFile(file) {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = read(e.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = utils.sheet_to_json(ws, { defval: '' })
      // Normalize column names (case-insensitive)
      const normalized = rows.map(row => {
        const lower = {}
        Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = row[k] })
        return {
          position: lower['position'] || lower['role'] || lower['title'] || lower['name'] || '',
          rate:     parseFloat(lower['rate'] || lower['amount'] || lower['pay'] || 0) || 0,
          unit:     lower['unit'] || lower['period'] || lower['type'] || 'per hour',
          notes:    lower['notes'] || lower['note'] || lower['comments'] || '',
        }
      }).filter(r => r.position && r.rate > 0)
      setPreview(normalized)
    }
    reader.readAsArrayBuffer(file)
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    parseFile(e.dataTransfer.files[0])
  }

  async function saveToSupabase() {
    if (!selectedId || preview.length === 0) return
    setSaving(true)
    const rows = preview.map(r => ({ ...r, client_id: selectedId }))
    const { error } = await supabase.from('rates').insert(rows)
    if (error) { alert(error.message); setSaving(false); return }
    setShowModal(false)
    setPreview([])
    setFileName('')
    await loadRates(selectedId)
    setSaving(false)
  }

  function closeModal() {
    setShowModal(false); setPreview([]); setFileName('')
  }

  const selectedClient = clients.find(c => c.id === selectedId)

  return (
    <div className="rates-page">
      <div className="rates-header">
        <h1>Rates</h1>
        <p className="muted">Select a client to view their rates.</p>
      </div>

      {/* Client dropdown */}
      <div className="client-row">
        <select
          className="client-select"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">— Select a client —</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {isAdmin && selectedId && (
          <button className="link danger" onClick={() => deleteClient(selectedId)}>
            Delete client
          </button>
        )}
      </div>

      {/* Add client (admin) */}
      {isAdmin && (
        <div className="add-client-row">
          <input
            placeholder="New client name…"
            value={newClient}
            onChange={e => setNewClient(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addClient()}
            style={{ maxWidth: 280, margin: 0 }}
          />
          <button className="outline sm" onClick={addClient} disabled={addingClient || !newClient.trim()}>
            {addingClient ? '…' : '+ Add client'}
          </button>
        </div>
      )}

      {/* Rates section */}
      {selectedId && (
        <div className="rates-table-wrap">
          <div className="rates-table-head">
            <h2>{selectedClient?.name}</h2>
            {isAdmin && (
              <button className="primary sm" onClick={() => setShowModal(true)}>
                + Add New
              </button>
            )}
          </div>

          {loadingRates ? (
            <p className="muted">Loading…</p>
          ) : rates.length === 0 ? (
            <p className="muted empty">No rates yet. Click "Add New" to upload an Excel file.</p>
          ) : (
            <table className="user-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Position / Role</th>
                  <th>Rate</th>
                  <th>Unit</th>
                  <th>Notes</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rates.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.position}</strong></td>
                    <td className="rate-amount">${parseFloat(r.rate).toFixed(2)}</td>
                    <td className="muted">{r.unit}</td>
                    <td className="muted">{r.notes || '—'}</td>
                    {isAdmin && (
                      <td>
                        <button className="link danger" onClick={() => deleteRate(r.id)}>Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Excel upload modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Rates from Excel</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <p className="muted" style={{ marginBottom: 16 }}>
              Your Excel file should have columns: <strong>Position, Rate, Unit, Notes</strong>
              <br />The first row should be the header row.
            </p>

            {/* Drop zone */}
            <div
              className={`drop-zone ${dragOver ? 'drag-over' : ''} ${fileName ? 'has-file' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={e => parseFile(e.target.files[0])}
              />
              {fileName ? (
                <>
                  <div className="drop-icon">📊</div>
                  <p className="drop-label">{fileName}</p>
                  <p className="muted">{preview.length} rows found — click to change</p>
                </>
              ) : (
                <>
                  <div className="drop-icon">📂</div>
                  <p className="drop-label">Drop your Excel file here</p>
                  <p className="muted">or click to browse</p>
                </>
              )}
            </div>

            {/* Preview table */}
            {preview.length > 0 && (
              <div className="preview-wrap">
                <p className="preview-label">Preview — {preview.length} rows to import</p>
                <div className="preview-scroll">
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Position / Role</th>
                        <th>Rate</th>
                        <th>Unit</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i}>
                          <td>{r.position}</td>
                          <td className="rate-amount">${r.rate.toFixed(2)}</td>
                          <td className="muted">{r.unit}</td>
                          <td className="muted">{r.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button className="link" onClick={closeModal}>Cancel</button>
              <button
                className="primary"
                onClick={saveToSupabase}
                disabled={saving || preview.length === 0}
              >
                {saving ? 'Saving…' : `Import ${preview.length} rows`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}