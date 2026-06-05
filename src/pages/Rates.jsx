import { useEffect, useState } from 'react'
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

  // Rate form
  const [showRateForm, setShowRateForm] = useState(false)
  const [rateForm, setRateForm] = useState({ position: '', rate: '', unit: 'per hour', notes: '' })
  const [savingRate, setSavingRate] = useState(false)

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
    await supabase.from('clients').insert({ name: newClient.trim() })
    setNewClient('')
    await loadClients()
    setAddingClient(false)
  }

  async function deleteClient(id) {
    if (!confirm('Delete this client and all their rates?')) return
    await supabase.from('clients').delete().eq('id', id)
    if (selectedId === id) setSelectedId('')
    await loadClients()
  }

  async function saveRate() {
    if (!rateForm.position.trim() || !rateForm.rate) return
    setSavingRate(true)
    await supabase.from('rates').insert({
      client_id: selectedId,
      position: rateForm.position.trim(),
      rate: parseFloat(rateForm.rate),
      unit: rateForm.unit,
      notes: rateForm.notes.trim() || null,
    })
    setRateForm({ position: '', rate: '', unit: 'per hour', notes: '' })
    setShowRateForm(false)
    await loadRates(selectedId)
    setSavingRate(false)
  }

  async function deleteRate(id) {
    if (!confirm('Delete this rate?')) return
    await supabase.from('rates').delete().eq('id', id)
    await loadRates(selectedId)
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

      {/* Rates table */}
      {selectedId && (
        <div className="rates-table-wrap">
          <div className="rates-table-head">
            <h2>{selectedClient?.name}</h2>
            {isAdmin && (
              <button className="primary sm" onClick={() => setShowRateForm(!showRateForm)}>
                + Add rate
              </button>
            )}
          </div>

          {/* Add rate form */}
          {showRateForm && isAdmin && (
            <div className="rate-form">
              <input
                placeholder="Position / role (e.g. Casual Labour)"
                value={rateForm.position}
                onChange={e => setRateForm(f => ({ ...f, position: e.target.value }))}
              />
              <div className="rate-form-row">
                <input
                  type="number"
                  placeholder="Rate (e.g. 35.00)"
                  value={rateForm.rate}
                  onChange={e => setRateForm(f => ({ ...f, rate: e.target.value }))}
                  style={{ margin: 0 }}
                />
                <select
                  value={rateForm.unit}
                  onChange={e => setRateForm(f => ({ ...f, unit: e.target.value }))}
                  style={{ margin: 0 }}
                >
                  <option>per hour</option>
                  <option>per day</option>
                  <option>per week</option>
                  <option>per shift</option>
                  <option>flat rate</option>
                </select>
              </div>
              <input
                placeholder="Notes (optional)"
                value={rateForm.notes}
                onChange={e => setRateForm(f => ({ ...f, notes: e.target.value }))}
              />
              <div className="editor-actions">
                <button className="link" onClick={() => setShowRateForm(false)}>Cancel</button>
                <button className="primary" onClick={saveRate} disabled={savingRate}>
                  {savingRate ? 'Saving…' : 'Save rate'}
                </button>
              </div>
            </div>
          )}

          {loadingRates ? (
            <p className="muted">Loading…</p>
          ) : rates.length === 0 ? (
            <p className="muted empty">No rates added yet.</p>
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
    </div>
  )
}