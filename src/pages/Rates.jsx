import { useEffect, useState, useRef } from 'react'
import { read, utils } from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const SHIFTS = ['Day Shift', 'Night Shift', 'Afternoon Shift', 'Weekend', 'Public Holiday', 'Casual', 'On-Call']
const EMPTY_ROW = () => ({ _id: crypto.randomUUID(), _new: true, position: '', shift: 'Day Shift', rate: '' })

export default function Rates() {
  const { isAdmin } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [importMsg, setImportMsg] = useState(null)

  const [newClient, setNewClient] = useState('')
  const [addingClient, setAddingClient] = useState(false)

  const fileRef = useRef()

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('sort_order').order('name')
    setClients(data ?? [])
  }

  async function loadRates(clientId) {
    setLoading(true)
    const { data } = await supabase
      .from('rates')
      .select('*')
      .eq('client_id', clientId)
      .order('position')
    setRows((data ?? []).map(r => ({ ...r, _id: r.id, _new: false, shift: r.unit })))
    setDirty(false)
    setLoading(false)
  }

  useEffect(() => { loadClients() }, [])

  useEffect(() => {
    if (selectedId) loadRates(selectedId)
    else { setRows([]); setDirty(false) }
  }, [selectedId])

  async function addClient() {
    if (!newClient.trim()) return
    setAddingClient(true)
    const { data } = await supabase
      .from('clients')
      .insert({ name: newClient.trim() })
      .select('id').single()
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

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r))
    setDirty(true)
  }

  function addRow() {
    setRows(prev => [...prev, EMPTY_ROW()])
    setDirty(true)
  }

  async function deleteRow(row) {
    if (!row._new && !confirm('Delete this row?')) return
    if (!row._new) await supabase.from('rates').delete().eq('id', row.id)
    setRows(prev => prev.filter(r => r._id !== row._id))
    setDirty(true)
  }

  async function saveAll() {
    const invalid = rows.find(r => !r.position.trim() || !r.rate || isNaN(parseFloat(r.rate)))
    if (invalid) return alert('All rows need a Role and a valid Rate.')
    setSaving(true)

    const newRows = rows.filter(r => r._new)
    const existingRows = rows.filter(r => !r._new)

    if (newRows.length > 0) {
      await supabase.from('rates').insert(
        newRows.map(r => ({
          client_id: selectedId,
          position: r.position.trim(),
          rate: parseFloat(r.rate),
          unit: r.shift,
        }))
      )
    }

    for (const r of existingRows) {
      await supabase.from('rates').update({
        position: r.position.trim(),
        rate: parseFloat(r.rate),
        unit: r.shift,
      }).eq('id', r.id)
    }

    await loadRates(selectedId)
    setSaving(false)
    setDirty(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 3000)
  }

  // Import Excel
  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportMsg(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = read(evt.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawRows = utils.sheet_to_json(ws, { defval: '' })

        if (rawRows.length === 0) {
          setImportMsg('No data found in the file.')
          return
        }

        // Normalize column headers (case-insensitive)
        const parsed = rawRows.map(row => {
          const lower = {}
          Object.keys(row).forEach(k => { lower[k.toLowerCase().trim()] = row[k] })

          const position = String(
            lower['role'] || lower['position'] || lower['title'] || lower['name'] || ''
          ).trim()

          const rawRate = lower['rate'] || lower['amount'] || lower['pay'] || lower['wage'] || ''
          const rate = parseFloat(String(rawRate).replace(/[^0-9.]/g, '')) || ''

          const rawShift = String(
            lower['shift'] || lower['unit'] || lower['type'] || lower['period'] || ''
          ).trim()

          // Match to a known shift or default
          const shift = SHIFTS.find(s => s.toLowerCase() === rawShift.toLowerCase()) || 'Day Shift'

          return { _id: crypto.randomUUID(), _new: true, position, shift, rate: rate.toString() }
        }).filter(r => r.position && r.rate)

        if (parsed.length === 0) {
          setImportMsg('Could not read any valid rows. Make sure your file has Role and Rate columns.')
          return
        }

        setRows(prev => [...prev, ...parsed])
        setDirty(true)
        setImportMsg(parsed.length + ' rows imported. Review then click Save changes.')
        setTimeout(() => setImportMsg(null), 6000)
      } catch (err) {
        setImportMsg('Error reading file: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
    // Reset so same file can be re-imported
    e.target.value = ''
  }

  const selectedClient = clients.find(c => c.id === selectedId)

  return (
    <div className="rates-page">
      <div className="rates-header">
        <h1>Rates</h1>
        <p className="muted">Select a client to view and edit their rates.</p>
      </div>

      <div className="client-row">
        <select
          className="client-select"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">Select a client...</option>
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

      {isAdmin && (
        <div className="add-client-row">
          <input
            placeholder="New client name..."
            value={newClient}
            onChange={e => setNewClient(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addClient()}
            style={{ maxWidth: 280, margin: 0 }}
          />
          <button className="outline sm" onClick={addClient} disabled={addingClient || !newClient.trim()}>
            {addingClient ? '...' : '+ Add client'}
          </button>
        </div>
      )}

      {selectedId && (
        <div className="sheet-wrap">
          <div className="rates-table-head">
            <h2>{selectedClient?.name}</h2>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {savedMsg && <span className="saved-msg">Saved</span>}
                {importMsg && <span className="import-msg">{importMsg}</span>}
                {dirty && (
                  <button className="primary sm" onClick={saveAll} disabled={saving}>
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                )}
                <button className="outline sm" onClick={addRow}>+ Add row</button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={handleImport}
                />
                <button className="outline sm" onClick={() => fileRef.current.click()}>
                  Import Excel
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="muted">Loading...</p>
          ) : (
            <div className="sheet-scroll">
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}>Role</th>
                    <th style={{ width: '30%' }}>Shift</th>
                    <th style={{ width: '25%' }}>Rate ($)</th>
                    {isAdmin && <th style={{ width: 60 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row._id} className={row._new ? 'row-new' : ''}>
                      <td>
                        {isAdmin ? (
                          <input
                            className="cell-input"
                            placeholder="e.g. Casual Labour"
                            value={row.position}
                            onChange={e => updateRow(row._id, 'position', e.target.value)}
                          />
                        ) : row.position}
                      </td>
                      <td>
                        {isAdmin ? (
                          <select
                            className="cell-input"
                            value={row.shift}
                            onChange={e => updateRow(row._id, 'shift', e.target.value)}
                          >
                            {SHIFTS.map(s => <option key={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className="muted">{row.shift}</span>
                        )}
                      </td>
                      <td>
                        {isAdmin ? (
                          <input
                            className="cell-input"
                            type="number"
                            placeholder="0.00"
                            value={row.rate}
                            onChange={e => updateRow(row._id, 'rate', e.target.value)}
                          />
                        ) : (
                          <span className="rate-amount">${parseFloat(row.rate).toFixed(2)}</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td>
                          <button className="link danger" onClick={() => deleteRow(row)}>X</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 4 : 3} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                        {isAdmin
                          ? <button className="link" onClick={addRow}>+ Add first row</button>
                          : 'No rates added yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Excel format hint */}
          {isAdmin && (
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Excel import expects columns: <strong>Role</strong>, <strong>Shift</strong>, <strong>Rate</strong>. Header row is required.
            </p>
          )}
        </div>
      )}
    </div>
  )
}