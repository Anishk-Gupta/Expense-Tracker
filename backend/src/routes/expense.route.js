import {Router} from "express"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { addExpense, deleteExpense, getAllExpenses, getCategoryStats, getExpenseById, getExpenseSummary, getMonthlyTrends, updateExpense } from "../controllers/expense.controller.js"


const router = Router()
router.use(verifyJWT)
// base route
router.route("/").post(addExpense).get(getAllExpenses)

// static route
router.route("/summary").get(getExpenseSummary)
router.route("/category-stats").get(getCategoryStats)
router.route("/monthly-trends").get(getMonthlyTrends)

// dynamic route
router.route("/:id").get(getExpenseById).patch(updateExpense).delete(deleteExpense)

export default router