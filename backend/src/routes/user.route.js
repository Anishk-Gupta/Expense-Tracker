import {Router} from "express"
import { registerUser } from "../controllers/user.controller.js";
import {loginUser} from "../controllers/user.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser)

router.route("/profile").get(verifyJWT , (req,res)=>{
    res.status(200).json({
        message : "you are authenticated",
        user : req.user
    })
})
export default router;