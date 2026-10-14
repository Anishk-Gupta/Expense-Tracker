import {Router} from "express"
import { changeCurrentPassword, registerUser , loginUser, logOut, updateAccountDetails, refreshAccessToken } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser)
router.route("/change-password").patch(verifyJWT,changeCurrentPassword)
router.route("/logout").post(verifyJWT,logOut)
router.route("/update-account").patch(verifyJWT,updateAccountDetails)
router.route("/refresh-token").post(refreshAccessToken)
export default router;