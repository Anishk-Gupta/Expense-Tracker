import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Budget } from "../models/budget.model.js";
import { Expense } from "../models/expense.model.js";
import mongoose from "mongoose";

const createBudget = asyncHandler(async (req, res) => {
  const { category, amount, month, year } = req.body;

  // 1. Amount validation
  if (amount === undefined || amount === null) {
    throw new apiError(400, "Budget amount is required");
  }
  if (typeof amount !== "number" || amount <= 0) {
    throw new apiError(400, "Budget amount must be a positive number");
  }

  // 2. Category validation (Bugs fixed)
  if (category === undefined || category === null) {
    throw new apiError(400, "Category is required to set budget");
  }
  if (typeof category !== "string") {
    throw new apiError(400, "Category must be a valid text string"); // Added 400
  }

  const trimmedCategory = category.trim();

  if (!trimmedCategory) {
    // Fixed missing !
    throw new apiError(400, "Category cannot be empty");
  }

  const allowedCategories = [
    "Food",
    "Travel",
    "Shopping",
    "Entertainment",
    "Bills",
    "Health",
    "Others",
  ];
  if (!allowedCategories.includes(trimmedCategory)) {
    throw new apiError(400, "Invalid category selected");
  }

  // 3. Month and Year Strict Validation
  const currentDate = new Date();
  let budgetMonth = currentDate.getMonth() + 1;
  let budgetYear = currentDate.getFullYear();

  // Agar user ne month bheja hai, toh strict check karo
  if (month !== undefined) {
    if (
      typeof month !== "number" ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new apiError(400, "Month must be a valid integer between 1 and 12");
    }
    budgetMonth = month;
  }

  // Agar user ne year bheja hai, toh strict check karo
  if (year !== undefined) {
    if (
      typeof year !== "number" ||
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      throw new apiError(400, "Year must be a valid 4-digit integer");
    }
    budgetYear = year;
  }

  // 4. Duplicate Check (using trimmedCategory)
  const existingBudget = await Budget.findOne({
    owner: req.user._id,
    category: trimmedCategory, // Fixed this to trimmed
    month: budgetMonth,
    year: budgetYear,
  });

  if (existingBudget) {
    throw new apiError(
      409, // 409 Conflict is the perfect status code here
      `Budget for category '${trimmedCategory}' already exists for ${budgetMonth}/${budgetYear}. Use update endpoint to modify it.`,
    );
  }

  // 5. Create
  const budget = await Budget.create({
    owner: req.user._id,
    category: trimmedCategory,
    amount,
    month: budgetMonth,
    year: budgetYear,
  });

  return res
    .status(201)
    .json(new apiResponse(201, budget, "Budget created successfully"));
});

const getAllBudgets = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    year,
    month,
    sortBy = "year",
    sortType = "desc",
  } = req.query;

  // base query
  const query = {
    owner: req.user._id,
  };

  // filtering by category

  if (typeof category === "string" && category.trim()) {
    query.category = category.trim();
  }

  // filtering year and month

  // filtering year (100% strict against any array)
  if (typeof year === "string") {
    const parsedYear = Number(year);
    if (
      !isNaN(parsedYear) &&
      Number.isInteger(parsedYear) &&
      parsedYear > 2000 &&
      parsedYear < 2100
    ) {
      query.year = parsedYear;
    }
  }

  // filtering month (100% strict against any array)
  if (typeof month === "string") {
    const parsedMonth = Number(month);
    if (
      !isNaN(parsedMonth) &&
      Number.isInteger(parsedMonth) &&
      parsedMonth > 0 &&
      parsedMonth <= 12
    ) {
      query.month = parsedMonth;
    }
  }

  // sorting
  const validSortFields = ["year", "month", "category", "amount", "createdAt"];
  const safeSortBy = typeof sortBy === "string" ? sortBy.trim() : "year";
  const safeSortType = typeof sortType === "string" ? sortType.trim() : "desc";
  
  const sortField = validSortFields.includes(safeSortBy) ? safeSortBy : "year";
  const sort = { [sortField]: safeSortType === "asc" ? 1 : -1 };

  // Budget ki secondary & tertiary sorting
  if (sortField !== "year") {
    sort.year = -1; 
  }
  if (sortField !== "month") {
    sort.month = -1; 
  }

  // pagination
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
  const skip = (pageNumber - 1) * limitNumber;

  // 7. Parallel Queries (Data + Count)
  const [budgets, totalBudgets] = await Promise.all([
    Budget.find(query).sort(sort).skip(skip).limit(limitNumber),
    Budget.countDocuments(query),
  ]);
  // pagination - total pages
  const totalPages = Math.ceil(totalBudgets / limitNumber);
  return res.status(200).json(
    new apiResponse(
      200,
      {
        budgets,
        pagination: {
          totalBudgets,
          totalPages,
          currentPage: pageNumber,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
      },
      "Budgets fetched successfully",
    ),
  );
});

const updateBudget = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body || {};

  // 1. Validate Budget ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new apiError(400, "Invalid budget ID");
  }

  // 2. Amount Validation
  if (amount === undefined || amount === null) {
    throw new apiError(400, "Amount is required to update budget");
  }

  if (typeof amount !== "number" || amount <= 0) {
    throw new apiError(400, "Amount must be a positive number");
  }

  // 3. Update Budget (with ownership check)
  const updatedBudget = await Budget.findOneAndUpdate(
    {
      _id: id,
      owner: req.user._id, // 🔒 Security: Only owner can update
    },
    {
      $set: { amount },
    },
    {
      new: true, // Return updated document
      runValidators: true, // Run schema validations
    },
  );

  // 4. Budget not found or not owned by user
  if (!updatedBudget) {
    throw new apiError(404, "Budget not found");
  }

  return res
    .status(200)
    .json(new apiResponse(200, updatedBudget, "Budget updated successfully"));
});

const deleteBudget = asyncHandler(async (req, res) => {
  let { id } = req.params;
  id = id?.trim();

  // 1. Validate Budget ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new apiError(400, "Invalid budget ID");
  }

  // 2. Delete Budget (with ownership check)
  const deletedBudget = await Budget.findOneAndDelete({
    _id: id,
    owner: req.user._id, // 🔒 Security: Only owner can delete
  });

  // 3. Budget not found or not owned by user
  if (!deletedBudget) {
    throw new apiError(404, "Budget not found");
  }

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        { deletedBudgetId: deletedBudget._id },
        "Budget deleted successfully",
      ),
    );
});

const getBudgetVsExpense = asyncHandler(async (req, res, next) => {
  const { month, year } = req.query;

  // 1. Lenient Validation (Sahi hai toh lo, warna ignore karo)
  let validYear = null;
  let validMonth = null;

  if (typeof year === "string") {
    const parsedYear = Number(year);
    if (
      !isNaN(parsedYear) &&
      Number.isInteger(parsedYear) &&
      parsedYear > 2000 &&
      parsedYear < 2100
    ) {
      validYear = parsedYear;
    }
  }

  if (typeof month === "string") {
    const parsedMonth = Number(month);
    if (
      !isNaN(parsedMonth) &&
      Number.isInteger(parsedMonth) &&
      parsedMonth >= 1 &&
      parsedMonth <= 12
    ) {
      validMonth = parsedMonth;
    }
  }

  const id = new mongoose.Types.ObjectId(req.user._id);
  const matchCondition = { owner: id };

  // 2. Charo Cases ki Date Filtering
  if (validYear && validMonth) {
    // Case A: User ne Year aur Month dono sahi diye
    const startDate = new Date(Date.UTC(validYear, validMonth - 1, 1));
    const endDate = new Date(Date.UTC(validYear, validMonth, 1));
    matchCondition.date = { $gte: startDate,$lt: endDate };
  } else if (validYear && !validMonth) {
    // Case B: Sirf Year diya (Us saal ke saare months)
    const startOfYear = new Date(`${validYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${validYear}-12-31T23:59:59.999Z`);
    matchCondition.date = { $gte: startOfYear,$lte: endOfYear };
  } else if (!validYear && validMonth) {
    // Case C: Sirf Month diya (Saare years ka wo specific month)
    matchCondition.$expr = {$eq: [{ $month: "$date" }, validMonth] };
  }
  // Case D: Kuch nahi diya (ya dono galat diye) -> matchCondition mein sirf owner rahega (All data)

  const comparisionData = await Expense.aggregate([
    {
      $match: matchCondition,
    },

    // 3. Group by Year, Month AND Category
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
          category: "$category",
        },
        totalSpent: { $sum: "$amount" },
      },
    },

    // 4. Dynamic Lookup (Har group ke year, month aur category ka budget dhoondo)
    {
      $lookup: {
        from: "budgets",
        let: {
          expCategory: "$_id.category",
          expYear: "$_id.year",
          expMonth: "$_id.month",
        },
        pipeline: [
          {
            $match: {
              $expr: {$and: [
                  { $eq: ["$owner", id] },
                  { $eq: ["$year", "$$expYear"] },
                  { $eq: ["$month", "$$expMonth"] },
                  { $eq: ["$category", "$$expCategory"] },
                ],
              },
            },
          },
        ],
        as: "budgetDetails",
      },
    },

    {
      $unwind: {
        path: "$budgetDetails",
        preserveNullAndEmptyArrays: true,
      },
    },

    // 5. Clean Projection with Fixed $totalSpent & Rounding
    {
      $project: {
        _id: 0,
        year: "$_id.year",
        month: "$_id.month",
        category: "$_id.category",
        totalSpent: 1,
        allocatedBudget: { $ifNull: ["$budgetDetails.amount", 0] },
        remaining: {
          $subtract: [{$ifNull: ["$budgetDetails.amount", 0] }, "$totalSpent"],
        },
        isOverBudget: {
          $gt: ["$totalSpent", { $ifNull: ["$budgetDetails.amount", 0] }],
        },
        percentageUsed: {
          $cond: {
            if: { $eq: [{ $ifNull: ["$budgetDetails.amount", 0] }, 0] },
            then: 100,
            else: {
              $round: [
                {
                  $multiply: [
                    { $divide: ["$totalSpent", "$budgetDetails.amount"] },
                    100,
                  ],
                },
                2, // 2 decimal places tak round kiya
              ],
            },
          },
        },
      },
    },

    // 6. Pro Sorting: Newest Year -> Newest Month -> Highest Spent Category
    {
      $sort: {
        year: -1,
        month: -1,
        totalSpent: -1,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        comparisionData,
        "Budget vs Expense data fetched successfully"
      )
    );
});

export {
  createBudget,
  getAllBudgets,
  updateBudget,
  deleteBudget,
  getBudgetVsExpense,
};
