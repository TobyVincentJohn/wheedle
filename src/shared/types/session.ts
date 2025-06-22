export interface GameSession {
  sessionId: string;
  sessionCode: string;
  host: {
    userId: string;
    username: string;
  };
  players: SessionPlayer[];
  previousPlayers: SessionPlayer[]; // Players who have left but can rejoin
  status: 'waiting' | 'countdown' | 'in-game' | 'responding' | 'reveal' | 'complete';
  createdAt: number;
  maxPlayers: number;
  countdownStartedAt?: number;
  gameStartedAt?: number;
  completedAt?: number; // When the game was completed
  winnerId?: string; // ID of the winning player
  winnerUsername?: string; // Username of the winning player
  dealerId?: number; // Dealer image ID for consistency across all players
  isPrivate: boolean; // Whether this is a private session
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