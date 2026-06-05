import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const SHIFTS = ['Day Shift', 'Night Shift', 'Afternoon Shift', 'Weekend', 'Public Holiday', 'Casual', 'On-Call']
const EMPTY_ROW = () => ({ _id: crypto.randomUUID(), _new: true, position: '', shift: 'Day Shift', rate: '', notes: '' })

export default function Rates() {
  const { isAdmin } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  // Client form
  const [newClient, setNewClient] = useState('')
  const [addingClient, setAddingClient] = useState(false)

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
          notes: r.notes.trim() || null,
        }))
      )
    }

    for (const r of existingRows) {
      await supabase.from('rates').update({
        position: r.position.trim(),
        rate: parseFloat(r.rate),
        unit: r.shift,
        notes: r.notes.trim() || null,
      }).eq('id', r.id)
    }

    await loadRates(selectedId)
    setSaving(false)
    setDirty(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 3000)
  }

  const selectedClient = clients.find(c => c.id === selectedId)

  return (
    <div className="rates-page">
      <div className="rates-header">
        <h1>Rates</h1>
        <p className="muted">Select a client to view and edit their rates.</p>
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

      {/* Add client */}
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

      {/* Spreadsheet */}
      {selectedId && (
        <div className="sheet-wrap">
          <div className="rates-table-head">
            <h2>{selectedClient?.name}</h2>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {savedMsg && <span className="saved-msg">✓ Saved</span>}
                {dirty && (
                  <button className="primary sm" onClick={saveAll} disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                )}
                <button className="outline sm" onClick={addRow}>+ Add row</button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <div className="sheet-scroll">
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Role</th>
                    <th style={{ width: '20%' }}>Shift</th>
                    <th style={{ width: '15%' }}>Rate ($)</th>
                    <th>Notes</th>
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
                      <td>
                        {isAdmin ? (
                          <input
                            className="cell-input"
                            placeholder="Optional notes"
                            value={row.notes}
                            onChange={e => updateRow(row._id, 'notes', e.target.value)}
                          />
                        ) : (
                          <span className="muted">{row.notes || '—'}</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td>
                          <button className="link danger" onClick={() => deleteRow(row)}>✕</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
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
        </div>
      )}
    </div>
  )
}