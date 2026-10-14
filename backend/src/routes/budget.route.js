import { Router } from "express";
import { createBudget, deleteBudget, getAllBudgets, updateBudget,  getBudgetVsExpense } from "../controllers/budget.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.use(verifyJWT)

// base route
router.route("/").post(createBudget).get(getAllBudgets)

// Budget status route - shows budget vs spending comparison
router.route("/budget-vs-expense").get(getBudgetVsExpense)
// dynamic route
router.route("/:id").patch(updateBudget).delete(deleteBudget)

export default router