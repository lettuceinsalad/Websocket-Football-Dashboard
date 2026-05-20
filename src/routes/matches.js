import { Router } from 'express';
import { createMatchSchema, listMatchesQuerySchema } from '../validation/matches';
import { matches } from '../db/schema.js';
import { db } from '../db/db.js';
import { getMatchStatus } from '../utils/match-status';
import { desc } from 'drizzle-orm';

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get('/', (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query", details: JSON.stringify(parsed.error) });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

    try {
        const data = await db
            .select()
            .from(matches)
            .orderBy((desc(matches.createdAt)))
            .limit(limit); 

        res.status(200).json({ data: data });
    } catch (error) {
        return res.status(500).json({ error: "Error fetching matches", details: JSON.stringify(error)});
    }
});

matchRouter.post('/', async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);
    const { data: { startTime, endTime, homeScore, awayScore } } = parsed;

    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload", details: JSON.stringify(parsed.error) });
    }

    try {
        const [event] = await db.insert(matches).values({
            ...parsed.data,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime),
        }).returning();

        res.status(201).json({data: event});
    } catch (error) {
        return res.status(500).json({ error: "Error creating match", details: JSON.stringify(error)});
    }
});
