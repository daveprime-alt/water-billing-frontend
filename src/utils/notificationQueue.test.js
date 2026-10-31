import assert from 'node:assert/strict'
import test from 'node:test'
import { createNotificationQueue } from './notificationQueue.js'

test('notification queue displays errors sequentially and suppresses duplicates', () => {
  const displayed = []
  const notify = createNotificationQueue((message, onComplete) => {
    displayed.push({ message, onComplete })
  })

  notify('Invalid login')
  notify('Invalid login')
  notify('Password update failed')

  assert.deepEqual(displayed.map(({ message }) => message), ['Invalid login'])
  displayed[0].onComplete()
  assert.deepEqual(displayed.map(({ message }) => message), ['Invalid login', 'Password update failed'])
})

test('notification queue drops the oldest pending error to retain recent errors', () => {
  const displayed = []
  const notify = createNotificationQueue((message, onComplete) => {
    displayed.push({ message, onComplete })
  }, 2)

  notify('First')
  notify('Second')
  notify('Third')
  notify('Newest')

  displayed[0].onComplete()
  assert.deepEqual(displayed.map(({ message }) => message), ['First', 'Third'])
  displayed[1].onComplete()
  assert.deepEqual(displayed.map(({ message }) => message), ['First', 'Third', 'Newest'])
})
