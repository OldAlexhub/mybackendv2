import { Router } from "express";
import protectRoute from "../middleware/protectRoute.js";
import Signup from "../controllers/Signup.js";
import login from "../controllers/Login.js";
import PostArticle from "../controllers/PostArticles.js";
import GetArticles from "../controllers/GetArticles.js";
import GetAnArticle from "../controllers/GetAnArticle.js";
import TrackVisitor from "../controllers/TrackVisitor.js";
import GetVisitorSummary from "../controllers/GetVisitorSummary.js";
import GetVisitorAnalytics from "../controllers/GetVisitorAnalytics.js";
import PostContact from "../controllers/PostContact.js";
import GetContacts from "../controllers/GetContacts.js";

const router = Router();

//router.post("/signup", Signup);
router.post("/login", login);

router.post("/postarticles", protectRoute, PostArticle);
router.get("/getarticles", GetArticles);
router.get("/article/:id", GetAnArticle);
router.post("/track", TrackVisitor);
router.get("/visitors/summary", GetVisitorSummary);
router.get("/visitors/analytics", protectRoute, GetVisitorAnalytics);

router.post("/submit", PostContact);
router.get("/messages", protectRoute, GetContacts);

export default router;
