import { Request, Response } from 'express';

export class HealthController {
  /**
   * Liveness probe: returns 200 OK as long as the process is alive.
   */
  public getLiveness = (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Readiness probe: checks dependencies (e.g. DB connection in later phases).
   */
  public getReadiness = (_req: Request, res: Response): void => {
    // In Phase 1, the app is ready once booted. DB/Redis readiness check hooks in Phase 2.
    res.status(200).json({
      status: 'READY',
      checks: {
        server: 'UP',
      },
      timestamp: new Date().toISOString(),
    });
  };
}

export const healthController = new HealthController();
