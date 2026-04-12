export type Speaker = 'MAUK' | 'ABACI' | string
export type Role = 'bot' | 'user'
export type Bot = 'a' | 'b'
export type Space = 'bot_a' | 'bot_b' | 'shared'

export interface Message {
  id: string
  speaker: Speaker
  text: string
  role: Role
  user_id: string | null
  created_at: string
}

export interface MemoryConcept {
  id: string
  bot: Bot
  concept: string
  weight: number
  updated_at: string
}

export interface WorkspaceFile {
  id: string
  space: Space
  name: string
  content: string
  updated_at: string
}

export interface Profile {
  id: string
  display_name: string
  created_at: string
}
