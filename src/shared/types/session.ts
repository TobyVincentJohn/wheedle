export interface GameSession {
  sessionId: string;
  sessionCode: string;
  hostUserId: string;
  hostUsername: string;
  players: SessionPlayer[];
  status: 'waiting' | 'countdown' | 'in-game' | 'completed';
  createdAt: number;
  maxPlayers: number;
  gameStartedAt?: number;
  countdownStartedAt?: number; // When the 10-second countdown began
  dealerId?: number; // Dealer image ID for consistency across all players
}

export interface SessionPlayer {
  userId: string;
  username: string;
  joinedAt: number;
  isHost: boolean;
}

export interface CreateSessionRequest {
  maxPlayers?: number;
}

export interface CreateSessionResponse {
  status: 'success' | 'error';
  message?: string;
  data?: GameSession;
}

export interface JoinSessionRequest {
  sessionId: string;
}

export interface JoinSessionResponse {
  status: 'success' | 'error';
  message?: string;
  data?: GameSession;
}

export interface GetPublicSessionsResponse {
  status: 'success' | 'error';
  message?: string;
  data?: GameSession[];
}

export interface LeaveSessionResponse {
  status: 'success' | 'error';
  message?: string;
}

export interface StartCountdownResponse {
  status: 'success' | 'error';
  message?: string;
  data?: GameSession;
}