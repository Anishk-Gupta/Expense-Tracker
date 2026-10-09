import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
    category : {
        type : String,
        required : true,
        trim : true
    },
    amount : {
        type : Number,
        required : true
    },
    description : {
        type : String,
        trim : true
    },
    date : {
        type : Date,
        required : true,
        default : Date.now
    },
    owner : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    }
} , {timestamps : true})

expenseSchema.index({owner : 1 , date : -1})
expenseSchema.index({owner : 1 , category : 1, date : -1})

export const Expense = mongoose.model("Expense",expenseSchema)