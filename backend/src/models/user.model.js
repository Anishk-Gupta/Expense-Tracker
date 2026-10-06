import mongoose from "mongoose"

import bcrypt from "bcryptjs"

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


export const User = mongoose.model("User",userSchema)
