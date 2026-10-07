import {asyncHandler} from "../utils/asyncHandler.js"
import {apiError} from "../utils/apiError.js"
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js"
const verifyJWT = asyncHandler(async (req , res , next) => {
    const authHeader = req.headers["authorization"]

    if(!authHeader || !authHeader.startsWith("Bearer ")){
        throw new apiError(401 , "Unauthorized Error");
    }

    const token = authHeader.split(" ")[1];

    const decodedToken = jwt.verify(token,process.env.JWT_SECRET)

    const user = await User.findById(decodedToken._id).select("-password")

    if(!user){
        throw new apiError(401 , "Invalid Token")
    }
    req.user = user;
    next();
})

export {verifyJWT}