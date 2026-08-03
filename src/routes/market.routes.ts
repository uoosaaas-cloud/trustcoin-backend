import { Router } from "express";
import { getMarketsOverviewHandler } from "../controllers/market.controller";

const router = Router();

router.get("/overview", getMarketsOverviewHandler);

export default router;
