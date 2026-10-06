import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import {asyncHandler} from "../utils/asyncHandler.js"
import {apiResponse} from "../utils/apiResponse.js"

const registerUser = asyncHandler(async (req , res , next) => {
    const {username , name , email , password } = req.body;

    // check for all fields present or not
    if([username , email , password , name].some((field) => field?.trim() === "" )){
        throw new apiError(400,"All fields are required")
    }

    // check ki email or username ka same candidate phle se exist to nhi karta na 

    const existedUser = await User.findOne({
        $or : [{username},{email}]
    })

    if(existedUser){
        throw new apiError(409,"User with this email or username already exist")
    }

    // user create kro
    const user = await User.create({
        username : username.toLowerCase(),
        email,
        password,
        name
    })

    const createdUser = await User.findById(user._id).select("-password")

    if(!createdUser){
        throw new apiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json( new apiResponse(
        201 , createdUser , "User registered successfully"
    ))

})

const loginUser = asyncHandler(async(req,res,next)=>{
    const {email , password} = req.body
    if([email,password].some((field) => field?.trim()==="")){
        throw new apiError(400,"Email and Password are required")
    }

    const user = await User.findOne({email});

    if(!user){
        throw new apiError(404,"User does not exist")
    }

    const isPasswordValid = await user.comparePassword(password);
    if(!isPasswordValid){
        throw new apiError(401,"Invalid credentials")
    }

    const token = user.generateToken();

    const loggedInUser = await User.findById(user._id).select("-password")

    return res.status(200).json(new apiResponse(
        200,
        {user : loggedInUser , token},
        "User logged in successfully"
    ))
})
export {registerUser,loginUser};