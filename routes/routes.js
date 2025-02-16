import { Router } from "express";
import protectRoute from "../middleware/protectRoute.js";
import Signup from "../controllers/Signup.js";
import login from "../controllers/Login.js";
import PostArticle from "../controllers/PostArticles.js";
import GetArticles from "../controllers/GetArticles.js";
import GetAnArticle from "../controllers/GetAnArticle.js";
import VisitorData from "../controllers/VisitorData.js";
import PostContact from "../controllers/PostContact.js";
import GetContacts from "../controllers/GetContacts.js";

const router = Router();

//router.post("/signup", Signup);
router.post("/login", login);

router.post("/postarticles", protectRoute, PostArticle);
router.get("/getarticles", GetArticles);
router.get("/article/:id", GetAnArticle);
router.post("/track", VisitorData);

router.post("/submit", PostContact);
router.get("/messages", protectRoute, GetContacts);

export default router;
