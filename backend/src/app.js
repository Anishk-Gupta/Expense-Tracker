import express from "express"
import userRouter from "./routes/user.route.js"
import expenseRouter from "./routes/expense.route.js"
import budgetRouter from "./routes/budget.route.js"
import cors from "cors"
import { errorHandler } from "./middlewares/errorHandling.middleware.js";
import cookieParser from "cookie-parser"
const app = express();
app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials : true
}))
app.use(cookieParser())
app.use(express.json({limit : "16kb"}))
app.use(express.urlencoded({extended : true , limit : "16kb"}))
app.use("/api/v1/users",userRouter)
app.use("/api/v1/expenses",expenseRouter)
app.use("/api/v1/budgets",budgetRouter)


app.use(errorHandler)
export default app;