import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { validateAttestation } from '../services/attestation-rules.js';

export const attestationsRouter = Router({ mergeParams: true });

// POST /validate — validate an attestation payload
attestationsRouter.post('/validate', (req: Request, res: Response) => {
  const attestation = req.body;
  const db = getDb();

  const { valid, results } = validateAttestation(db, attestation);

  if (valid) {
    res.status(200).json({ valid, results });
  } else {
    res.status(422).json({ valid, results });
  }
});
