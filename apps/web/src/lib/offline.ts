import Dexie, { type EntityTable } from 'dexie'
import { api, ApiError } from './api'

export type PendingMutation = {
  id: string
  createdAt: number
  method: 'POST' | 'PATCH' | 'DELETE'
  path: string
  body: Record<string, unknown>
  idempotencyKey?: string
  status: 'pending' | 'conflict'
  error?: string
}

type ReminderFire = { id: string; firedAt: number }

const offlineDb = new Dexie('calora-offline') as Dexie & {
  mutations: EntityTable<PendingMutation, 'id'>
  reminderFires: EntityTable<ReminderFire, 'id'>
}
offlineDb.version(1).stores({ mutations: 'id, status, createdAt', reminderFires: 'id, firedAt' })

export async function queueMutation(mutation: Omit<PendingMutation, 'id' | 'createdAt' | 'status'>) {
  const id = crypto.randomUUID()
  await offlineDb.mutations.add({ ...mutation, id, createdAt: Date.now(), status: 'pending' })
  return id
}

export async function pendingMutations() { return offlineDb.mutations.orderBy('createdAt').toArray() }
export async function discardMutation(id: string) { await offlineDb.mutations.delete(id) }
export async function retryMutation(id: string) { await offlineDb.mutations.update(id, { status: 'pending', error: undefined }) }

export async function flushMutationQueue() {
  if (!navigator.onLine) return
  const mutations = await offlineDb.mutations.where('status').equals('pending').sortBy('createdAt')
  for (const mutation of mutations) {
    try {
      await api(mutation.path, { method: mutation.method, body: mutation.body, headers: mutation.idempotencyKey ? { 'Idempotency-Key': mutation.idempotencyKey } : undefined })
      await offlineDb.mutations.delete(mutation.id)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) await offlineDb.mutations.update(mutation.id, { status: 'conflict', error: error.message })
      else break
    }
  }
}

export async function hasFiredReminder(id: string) { return Boolean(await offlineDb.reminderFires.get(id)) }
export async function markReminderFired(id: string) { await offlineDb.reminderFires.put({ id, firedAt: Date.now() }) }
