export type UserRole = 'ATHLETE' | 'RECRUITER' | 'COACH' | 'ADMIN'

export interface DossierData {
  identity?: {
    sport?: string
    position?: string
    nationality?: string
    graduationYear?: number
  }
  performance?: {
    stats?: Record<string, number>
    leagueLevel?: string
    highlightUrls?: string[]
  }
  academic?: {
    gpa?: number
    satAct?: number
    intendedMajor?: string
    ncaaEligibility?: boolean
  }
  availability?: {
    transferPortal?: boolean
    preferredRegions?: string[]
    scholarshipNeed?: boolean
  }
}

export interface JerryMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface ApiResponse<T> {
  data: T
  error?: string
  success: boolean
}
