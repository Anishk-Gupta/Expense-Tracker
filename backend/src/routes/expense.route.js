import {Router} from "express"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { addExpense, deleteExpense, getAllExpenses, getExpenseById, updateExpense } from "../controllers/expense.controller.js"


const router = Router()
router.use(verifyJWT)
router.route("/").post(addExpense).get(getAllExpenses)
router.route("/:id").get(getExpenseById).patch(updateExpense).delete(deleteExpense)

export default router