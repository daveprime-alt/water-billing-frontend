export function createNotificationQueue(showNotification, maxPending = 3) {
  const pending = []
  const queuedMessages = new Set()
  let activeMessage = null

  const showNext = () => {
    if (activeMessage !== null || pending.length === 0) return

    activeMessage = pending.shift()
    const message = activeMessage
    let completed = false
    showNotification(message, () => {
      if (completed) return
      completed = true
      queuedMessages.delete(message)
      activeMessage = null
      showNext()
    })
  }

  return (value) => {
    const message = String(value ?? '').trim()
    if (!message || queuedMessages.has(message)) return

    queuedMessages.add(message)
    if (pending.length >= maxPending) {
      queuedMessages.delete(pending.shift())
    }
    pending.push(message)
    showNext()
  }
}
