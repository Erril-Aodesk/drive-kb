import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const EMPTY_FORM = { position: '', rate: '', unit: 'per hour', notes: '' }
const UNITS = ['per hour', 'per day', 'per week', 'per shift', 'flat rate']

export default function Rates() {
  const { isAdmin } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [rates, setRates] = useState([])
  const [loadingRates, setLoadingRates] = useState(false)

  // Client form
  const [newClient, setNewClient] = useState('')
  const [addingClient, setAddingClient] = useState(false)

  // Rate modal
  const [showModal, setShowModal] = useState(false)
  const [editingRate, setEditingRate] = useState(null) // null = new, object = editing
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

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

  function openAdd() {
    setEditingRate(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowModal(true)
  }

  function openEdit(rate) {
    setEditingRate(rate)
    setForm({
      position: rate.position,
      rate: rate.rate.toString(),
      unit: rate.unit,
      notes: rate.notes || '',
    })
    setError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingRate(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function saveRate() {
    if (!form.position.trim()) return setError('Position is required.')
    if (!form.rate || isNaN(parseFloat(form.rate))) return setError('Enter a valid rate.')
    setSaving(true); setError(null)

    const payload = {
      position: form.position.trim(),
      rate: parseFloat(form.rate),
      unit: form.unit,
      notes: form.notes.trim() || null,
    }

    let err
    if (editingRate) {
      const res = await supabase.from('rates').update(payload).eq('id', editingRate.id)
      err = res.error
    } else {
      const res = await supabase.from('rates').insert({ ...payload, client_id: selectedId })
      err = res.error
    }

    setSaving(false)
    if (err) return setError(err.message)
    closeModal()
    await loadRates(selectedId)
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

      {/* Rates table */}
      {selectedId && (
        <div className="rates-table-wrap">
          <div className="rates-table-head">
            <h2>{selectedClient?.name}</h2>
            {isAdmin && (
              <button className="primary sm" onClick={openAdd}>
                + Add New
              </button>
            )}
          </div>

          {loadingRates ? (
            <p className="muted">Loading…</p>
          ) : rates.length === 0 ? (
            <p className="muted empty">No rates yet. Click "+ Add New" to get started.</p>
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
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="link" onClick={() => openEdit(r)}>Edit</button>
                          <button className="link danger" onClick={() => deleteRate(r.id)}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRate ? 'Edit Rate' : 'Add New Rate'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body">
              <label className="field-label">Position / Role</label>
              <input
                placeholder="e.g. Casual Labour, Supervisor"
                value={form.position}
                onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
              />

              <label className="field-label">Rate ($)</label>
              <input
                type="number"
                placeholder="e.g. 35.00"
                value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
              />

              <label className="field-label">Unit</label>
              <select
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              >
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>

              <label className="field-label">Notes (optional)</label>
              <input
                placeholder="e.g. Weekdays only"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />

              {error && <p className="auth-msg">{error}</p>}
            </div>

            <div className="modal-footer">
              <button className="link" onClick={closeModal}>Cancel</button>
              <button className="primary" onClick={saveRate} disabled={saving}>
                {saving ? 'Saving…' : editingRate ? 'Save changes' : 'Add rate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}