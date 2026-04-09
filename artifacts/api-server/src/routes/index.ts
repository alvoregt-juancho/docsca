import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import pagesRouter from "./pages.js";
import documentsRouter from "./documents.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/pages", pagesRouter);
router.use("/ocr", pagesRouter);
router.use("/documents", documentsRouter);

export default router;
