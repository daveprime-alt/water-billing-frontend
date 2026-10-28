import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Search } from 'lucide-react'
import { api } from '../../services/api.js'
import { ErrorState, LoadingState } from '../ui/index.jsx'

const roleNames = {
  ADMIN: 'Administrator',
  READER: 'Meter reader',
  CONSUMER: 'Consumer',
}

export function UserDirectorySearch({
  roles = ['ADMIN', 'READER', 'CONSUMER'],
  roleFilter = true,
  locationFilter = false,
  onSelect,
  onResetPassword,
  onPhoneUpdate,
  onPhoneRemove,
  onDelete,
  selectedId,
}) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [role, setRole] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [showConsumerPicker, setShowConsumerPicker] = useState(true)
  const [openMenuId, setOpenMenuId] = useState(null)
  const openMenuRef = useRef(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    if (!openMenuId) return undefined
    const closeOnOutsideClick = (event) => {
      if (!openMenuRef.current?.contains(event.target)) setOpenMenuId(null)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenMenuId(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openMenuId])

  const directoryQuery = useQuery({
    queryKey: ['user-directory', debouncedSearch, page, roleFilter ? role : '', roles.join(',')],
    enabled: !locationFilter,
    queryFn: () => api.getUserDirectory({
      search: debouncedSearch || undefined,
      page,
      pageSize: 20,
      role: roleFilter ? role || undefined : roles[0],
    }),
  })
  const allConsumersQuery = useQuery({
    queryKey: ['user-directory-all-consumers', roles.join(',')],
    enabled: locationFilter,
    queryFn: async () => {
      const users = []
      let currentPage = 1

      while (true) {
        const result = await api.getUserDirectory({ page: currentPage, pageSize: 100, role: roles[0] })
        users.push(...result.users)
        if (!result.hasNextPage) return users
        currentPage += 1
      }
    },
  })
  const activeQuery = locationFilter ? allConsumersQuery : directoryQuery
  const allUsers = locationFilter ? allConsumersQuery.data || [] : directoryQuery.data?.users || []
  const locations = locationFilter
    ? [...new Set(allUsers.map((user) => user.location?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    : []
  const filteredUsers = locationFilter
    ? allUsers.filter((user) => {
      const matchesLocation = !selectedLocation || user.location?.trim() === selectedLocation
      const searchText = [user.firstName, user.middleName, user.lastName, user.accountNumber, user.phoneNumber].filter(Boolean).join(' ').toLowerCase()
      return matchesLocation && searchText.includes(debouncedSearch.toLowerCase())
    })
    : allUsers
  const pageSize = locationFilter ? 20 : directoryQuery.data?.pageSize || 20
  const pageCount = locationFilter ? Math.ceil(filteredUsers.length / pageSize) : directoryQuery.data?.totalPages
  const users = locationFilter ? filteredUsers.slice((page - 1) * pageSize, page * pageSize) : filteredUsers
  const hasNextPage = locationFilter
    ? page < pageCount
    : Boolean(directoryQuery.data?.hasNextPage)

  return (
    <div className="user-directory">
      {locationFilter && selectedId && !showConsumerPicker && (
        <button type="button" className="button button-secondary" onClick={() => setShowConsumerPicker(true)}>
          Choose a different consumer
        </button>
      )}
      {(!locationFilter || !selectedId || showConsumerPicker) && <>
      <div className="directory-controls">
        <label className="directory-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search users</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search name, account number, or phone"
          />
        </label>
        {locationFilter && (
          <label className="directory-location">
            <span className="sr-only">Filter consumers by location</span>
            <select value={selectedLocation} onChange={(event) => {
              setSelectedLocation(event.target.value)
              setPage(1)
            }}>
              <option value="">All locations</option>
              {locations.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        )}
        {roleFilter && (
          <label className="directory-role">
            <span className="sr-only">Filter by role</span>
            <select value={role} onChange={(event) => {
              setRole(event.target.value)
              setPage(1)
            }}>
              <option value="">All roles</option>
              {roles.map((value) => <option key={value} value={value}>{roleNames[value]}</option>)}
            </select>
          </label>
        )}
      </div>

      {activeQuery.isLoading ? <LoadingState label={locationFilter ? 'Loading consumer locations' : 'Loading the user directory'} /> :
        activeQuery.error ? <ErrorState error={activeQuery.error} onRetry={() => activeQuery.refetch()} /> :
          users.length === 0 ? (
            <div className="directory-empty">{locationFilter
              ? 'No consumers match these filters.'
              : search.trim() ? 'No users match this search.' : 'No users found.'}</div>
          ) : (
            <div className="table-scroll directory-table">
              <table>
                <thead><tr><th>Name</th><th>Account</th><th>Phone</th><th>Role</th>{(onSelect || onResetPassword || onPhoneUpdate || onPhoneRemove || onDelete) && <th>Actions</th>}</tr></thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        {onSelect && locationFilter
                          ? <button type="button" className="directory-consumer-select" onClick={() => {
                            onSelect(user)
                            setShowConsumerPicker(false)
                          }} aria-label={`Select ${[user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ') || 'unnamed consumer'}`}>
                            <b>{[user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ') || 'Unnamed user'}</b>
                          </button>
                          : <b>{[user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ') || 'Unnamed user'}</b>}
                        <small className="table-subtext">{user.location || user.id}</small>
                      </td>
                      <td>{user.accountNumber || '—'}</td>
                      <td>{user.phoneNumber || '—'}</td>
                      <td><span className="role-chip">{roleNames[user.role] || user.role}</span></td>
                      {(onSelect || onResetPassword || onPhoneUpdate || onPhoneRemove || onDelete) && <td>
                        {locationFilter
                          ? <button className={`button button-small ${selectedId === user.id ? 'button-primary' : 'button-secondary'}`} onClick={() => onSelect?.(user)}>{selectedId === user.id ? 'Selected' : 'Select'}</button>
                          : <div className="user-row-menu" ref={openMenuId === user.id ? openMenuRef : null}>
                            <button
                              type="button"
                              className="user-row-menu-trigger"
                              aria-label={`Actions for ${[user.firstName, user.lastName].filter(Boolean).join(' ') || 'user'}`}
                              aria-haspopup="menu"
                              aria-expanded={openMenuId === user.id}
                              onClick={() => setOpenMenuId((current) => current === user.id ? null : user.id)}
                            >
                              <MoreHorizontal size={20} />
                            </button>
                            {openMenuId === user.id && <div className="user-row-menu-popover" role="menu">
                              {onSelect && <button type="button" role="menuitem" onClick={() => { onSelect(user); setOpenMenuId(null) }}>{selectedId === user.id ? 'Selected' : 'Select user'}</button>}
                              {onResetPassword && <button type="button" role="menuitem" onClick={() => { onResetPassword(user); setOpenMenuId(null) }}>Reset password</button>}
                              {onPhoneUpdate && <button type="button" role="menuitem" onClick={() => { onPhoneUpdate(user); setOpenMenuId(null) }}>{user.phoneNumber ? 'Edit phone number' : 'Add phone number'}</button>}
                              {onPhoneRemove && user.phoneNumber && <button type="button" role="menuitem" onClick={() => { onPhoneRemove(user); setOpenMenuId(null) }}>Remove phone number</button>}
                              {onDelete && <button type="button" role="menuitem" className="user-row-menu-danger" onClick={() => { onDelete(user); setOpenMenuId(null) }}>Delete account</button>}
                            </div>}
                          </div>}
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

      {!activeQuery.error && users.length > 0 && (
        <div className="directory-pagination">
          <span>{locationFilter ? `${filteredUsers.length} consumers` : directoryQuery.data.total !== undefined ? `${directoryQuery.data.total} users` : `Page ${page}${pageCount ? ` of ${pageCount}` : ''}`}</span>
          <div>
            <button className="button button-small button-secondary" disabled={page <= 1 || activeQuery.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <button className="button button-small button-secondary" disabled={!hasNextPage || activeQuery.isFetching} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      )}
      </>}
    </div>
  )
}
