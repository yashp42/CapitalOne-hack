export class AppError extends Error { constructor(msg, code=500){ super(msg); this.code=code; } }
