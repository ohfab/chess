import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../game/store'

/** The apps' daily reminder: on or off, and at which hour (planned by native/reminders.ts). */
interface ReminderState {
  on: boolean
  /** local hour of the reminder */
  hour: number
}

export const useReminder = create<ReminderState>()(persist((): ReminderState => ({ on: false, hour: 18 }), { name: 'rookly-reminder', storage: safeStorage, version: 1 }))
