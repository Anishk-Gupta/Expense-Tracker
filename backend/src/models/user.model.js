import mongoose from "mongoose"

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
const userSchema = new mongoose.Schema({
    username : {
        type : String,
        required : true,
        unique : true,
        lowercase : true,
        trim : true
    },
    name : {
        type : String,
        required : true,
        trim : true,
    },
    email : {
        type : String,
        required : true,
        lowercase : true,
        unique : true,
        trim : true,
        match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
    },
    password : {
        type : String,
        required : [true,"password is required"]

    }
},{timestamps : true})

userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password,10);
})

userSchema.methods.comparePassword = async function(enteredPassword){
    return await bcrypt.compare(enteredPassword,this.password)
}

userSchema.methods.generateToken = function(){
    return jwt.sign(
        {
            _id : this._id,
            email : this.email,
            username : this.username
        },
        process.env.JWT_SECRET,
        {expiresIn : process.env.JWT_EXPIRY}
    )
}

export const User = mongoose.model("User",userSchema)
