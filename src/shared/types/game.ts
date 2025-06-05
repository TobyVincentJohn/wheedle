type Response<T> = { status: 'error'; message: string } | ({ status: 'success' } & T);

export type LetterState = 'initial' | 'correct' | 'present' | 'absent';

export type CheckResponse = Response<{
  exists?: boolean;
  solved: boolean;
  correct: [LetterState, LetterState, LetterState, LetterState, LetterState];
}>;

export type InitResponse = Response<{
  postId: string;
}>;
