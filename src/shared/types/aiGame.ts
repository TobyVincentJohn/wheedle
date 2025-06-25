export interface AIGameData {
  aiPersona: string;
  clues: [string, string, string];
  userPersonas: string[];
  sessionId: string;
  createdAt: number;
  playerPersonas?: { [userId: string]: string }; // Map of userId to assigned persona
}

export interface ClueDisplayState {
  currentClueIndex: number;
  clueStartTime: number;
  isComplete: boolean;
}

export interface GetAIGameDataResponse {
  status: 'success' | 'error';
  message?: string;
  data?: AIGameData;
}