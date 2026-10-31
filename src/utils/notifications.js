import { toast } from 'sonner'
import { createNotificationQueue } from './notificationQueue.js'

const errorQueue = createNotificationQueue((message, onComplete) => {
  toast.error(message, {
    duration: 5000,
    onAutoClose: onComplete,
    onDismiss: onComplete,
  })
})

export function notifyError(message) {
  errorQueue(message)
}
