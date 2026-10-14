import mongoose  from "mongoose";

const budgetSchema = new  mongoose.Schema({
    owner : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    amount : {
        type : Number,
        required : true,
        min : [1,"Budget amount must be at least 1"]
    },
    category : {
        type : String,
        required : true,
        trim : true,
        enum : ["Food", "Travel", "Shopping", "Entertainment", "Bills", "Health", "Others"]
    },
    month : {
        type : Number,
        required : true,
        min : 1,
        max : 12
    },
    year: {
        type : Number,
        required : true,
        min : 2000,
        max : 2100
    }
},{timestamps : true})


budgetSchema.index(
    {owner : 1 , category : 1 ,  year : 1 , month : 1},
    {unique : true}
)

export const Budget = mongoose.model("Budget",budgetSchema)