import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ROLES = ['member', 'admin', 'super_admin']
const ROLE_LABELS = { member: 'Member', admin: 'Admin', super_admin: 'Super Admin' }

export default function AdminPanel() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [msg, setMsg] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function changeRole(profileId, newRole) {
    setSaving(profileId); setMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId)
    if (error) setMsg('Error: ' + error.message)
    else setMsg('Role updated successfully.')
    await load()
    setSaving(null)
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) return <div className="splash">Loading users…</div>

  return (
    <div className="admin-panel">
      <h1>User Management</h1>
      <p className="muted">Only super admins can change roles. Changes take effect immediately.</p>
      {msg && <p className="banner">{msg}</p>}

      <div className="user-table-wrap">
        <table className="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Change role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.id === user.id ? 'self' : ''}>
                <td>{u.full_name || '—'}</td>
                <td className="email-cell">{u.email}</td>
                <td>
                  <span className={`role-badge role-${u.role}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  {u.id === user.id ? (
                    <span className="muted" style={{ fontSize: 13 }}>You</span>
                  ) : (
                    <select
                      value={u.role}
                      disabled={saving === u.id}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}