import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { Expense } from "../models/expense.model.js";
import mongoose from "mongoose";

const addExpense = asyncHandler(async (req, res, next) => {
  const { amount, description, date, category } = req.body;

  // 1. Amount Validation
  if (amount === undefined || amount === null) {
    throw new apiError(400, "Amount is required");
  }
  if (typeof amount !== "number" || amount <= 0) {
    throw new apiError(400, "Amount must be a positive number");
  }

  // 2. Category Validation (Type check + Trim)
  if (!category || typeof category !== "string" || !category.trim()) {
    throw new apiError(400, "Category is required and must be valid text");
  }
  
  const trimmedCategory = category.trim();
  const allowedCategories = ["Food", "Travel", "Shopping", "Entertainment", "Bills", "Health", "Others"];
  
  if (!allowedCategories.includes(trimmedCategory)) {
    throw new apiError(400, "Invalid category selected");
  }

  // 3. Date Validation (Type check + Trim + Logic)
  let finalDate = Date.now(); // Default aaj ki date

  if (date) {
    if (typeof date !== "string") {
      throw new apiError(400, "Date must be a string");
    }

    const trimmedDate = date.trim(); // Space hataya taaki user confuse na ho
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    if (!dateRegex.test(trimmedDate)) {
      throw new apiError(400, "Date must be strictly in YYYY-MM-DD format");
    }

    const parsedDate = new Date(trimmedDate);
    if (
      isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== trimmedDate
    ) {
      throw new apiError(400, "Invalid calendar date provided");
    }

    const year = parsedDate.getFullYear();
    if (year < 2000 || year > 2100) {
      throw new apiError(400, "Expense year must be between 2000 and 2100");
    }

    if (parsedDate > new Date()) {
      throw new apiError(400, "Expense date cannot be in the future");
    }
    
    finalDate = parsedDate; // Agar sab sahi hai toh final date update kar do
  }

  // description validation
  if(description !== undefined && description !== null) {
    if (typeof description !== "string") {
      throw new apiError(400, "Description must be a valid text string");
    }
  }

  // 4. Create Expense
  const expense = await Expense.create({
    amount,
    description: description ? description.trim() : "",
    date: finalDate,
    category: trimmedCategory,
    owner: req.user._id,
  });

  return res
    .status(201)
    .json(new apiResponse(201, expense, "Expense added successfully"));
});

const getAllExpenses = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    category,
    startDate,
    endDate,
    sortBy = "date",
    sortType = "desc",
    search,
  } = req.query;

  // 1 . Base query - Authenticated query
  const query = { owner: req.user._id };

  // 2 . filter by category (Crash-proof & Space handle)
  if (typeof category === "string" && category.trim()) {
    query.category = category.trim();
  }

  // 3. filter by dateRange
  // Lenient Date Filtering (Galat date aane par ignore karega, error nahi dega)
  let start, end;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  // 1. Validate startDate safely
  if (typeof startDate === "string" && dateRegex.test(startDate.trim())) {
    const trimmedStart = startDate.trim();
    const parsedStart = new Date(trimmedStart);
    if (!isNaN(parsedStart.getTime()) && parsedStart.toISOString().slice(0, 10) === trimmedStart) {
      start = parsedStart;
    }
  }

  // 2. Validate endDate safely
  if (typeof endDate === "string" && dateRegex.test(endDate.trim())) {
    const trimmedEnd = endDate.trim();
    const parsedEnd = new Date(trimmedEnd);
    if (!isNaN(parsedEnd.getTime()) && parsedEnd.toISOString().slice(0, 10) === trimmedEnd) {
      parsedEnd.setUTCHours(23, 59, 59, 999);
      end = parsedEnd;
    }
  }

  // 3. Agar dono valid hain, par start > end hai (ultaa range), toh dono ko ignore kar do
  if (start && end && start > end) {
    start = undefined;
    end = undefined;
  }

  // 4. Sirf tabhi query.date lagao jab kam se kam ek valid date mili ho!
  if (start || end) {
    query.date = {};
    if (start) query.date.$gte = start;
    if (end) query.date.$lte = end;
  }

  // 4. search in description (Array crash protection)
  if (typeof search === "string" && search.trim()) {
    const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.description = { $regex: safeSearch, $options: "i" };
  }

  // 5. pagination Math
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  // YAHAN MINUS LAGA DIYA HAI
  const skip = (pageNumber - 1) * limitNumber;

  // 6. sorting (Array crash protection for sortBy & sortType)
  const allowedSortFields = ["date", "amount", "category"];
  const safeSortBy = typeof sortBy === "string" ? sortBy.trim() : "date";
  const safeSortType = typeof sortType === "string" ? sortType.trim() : "desc";
  
  const actualSortBy = allowedSortFields.includes(safeSortBy) ? safeSortBy : "date";
  const sort = { [actualSortBy]: safeSortType === "asc" ? 1 : -1 };

  // Secondary sort: Agar amount/category se sort ho raha hai, toh same value walon ko date ke hisaab se descending rakho
  if (actualSortBy !== "date") {
    sort.date = -1; 
  }

  // 7. parallel queries
  const [expenses, totalExpenses] = await Promise.all([
    Expense.find(query).sort(sort).skip(skip).limit(limitNumber),
    Expense.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalExpenses / limitNumber);

  // 8. structured response
  return res.status(200).json(
    new apiResponse(
      200,
      {
        expenses,
        pagination: {
          totalExpenses,
          totalPages,
          currentPage: pageNumber,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
      },
      "Expenses fetched successfully",
    ),
  );
});

const getExpenseById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
   id = id?.trim();

  // id mongoose id ki tarah hai bhi nhi
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new apiError(400, "Invalid expense ID");
  }

  const expense = await Expense.findOne({
    owner: req.user._id,
    _id: id,
  });

  if (!expense) {
    throw new apiError(404, "Expense not found");
  }

  return res
    .status(200)
    .json(new apiResponse(200, expense, "Expense fetched successfully"));
});

const updateExpense = asyncHandler(async (req, res, next) => {
  let { id } = req.params;
  const { category, description, amount, date } = req.body || {};
  
  id = id?.trim();

  // 1. Validation for ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new apiError(400, "Invalid expense ID");
  }

  // 2. Agar request body ekdum khali hai
  if (category === undefined && amount === undefined && description === undefined && date === undefined) {
    throw new apiError(400, "At least one field is required to update");
  }

  // Dynamic update data ka object
  const updateData = {};

  // 3. Category Validation (Crash-proof + Enum check)
  if (category !== undefined) {
    // Sirf pure string allow karega (null, number, array sab reject)
    if (typeof category !== "string") {
      throw new apiError(400, "Category must be a valid text string");
    }

    const trimmedCategory = category.trim();
    
    if (!trimmedCategory) {
      throw new apiError(400, "Category cannot be empty");
    }

    const allowedCategories = [
      "Food",
      "Travel",
      "Shopping",
      "Entertainment",
      "Bills",
      "Health",
      "Others"
    ];
    
    if (!allowedCategories.includes(trimmedCategory)) {
      throw new apiError(400, "Invalid category selected");
    }
    
    updateData.category = trimmedCategory;
  }

  // 4. Amount Validation (Crash-proof)
  if (amount !== undefined) {
    if (amount === null || typeof amount !== "number" || amount <= 0) {
      throw new apiError(400, "Amount must be a valid positive number");
    }
    updateData.amount = amount;
  }

  // 5. Description Validation (Array crash protection)
  if(description !== undefined){
    if(typeof description !== "string"){
      throw new apiError(400,"description must be a valid test string")
    }
    updateData.description = description.trim();
  }

  // 6. Date Validation (Crash-proof + Logic + Year boundaries)
  if (date !== undefined) {
    if (date === null || !String(date).trim()) {
      throw new apiError(400, "Date cannot be empty or null");
    }

    const trimmedDate = String(date).trim();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    if (!dateRegex.test(trimmedDate)) {
      throw new apiError(400, "Date must be strictly in YYYY-MM-DD format");
    }

    const parsedDate = new Date(trimmedDate);
    if (
      isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== trimmedDate
    ) {
      throw new apiError(400, "Invalid calendar date provided");
    }

    const year = parsedDate.getFullYear();
    if (year < 2000 || year > 2100) {
      throw new apiError(400, "Expense year must be between 2000 and 2100");
    }
    if (parsedDate > new Date()) {
      throw new apiError(400, "Expense date cannot be in the future");
    }

    updateData.date = parsedDate;
  }

  // 7. Database Update Operation
  const updatedExpense = await Expense.findOneAndUpdate(
    {
      _id: id,
      owner: req.user._id,
    },
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  // 8. Not Found Check (Very Important)
  if (!updatedExpense) {
    throw new apiError(404, "Expense not found or you don't have permission to update it");
  }

  return res
    .status(200)
    .json(new apiResponse(200, updatedExpense, "Expense updated successfully"));
});

const deleteExpense = asyncHandler(async (req, res, next) => {
  let { id } = req.params;
  id = id?.trim();
  // id validation
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new apiError(400, "Invalid expense ID");
  }

  const deletedExpense = await Expense.findOneAndDelete({
    owner: req.user._id,
    _id: id,
  });

  if (!deletedExpense) {
    throw new apiError(404, "Expense not found");
  }

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        { deletedExpenseId: deletedExpense._id },
        "Expense deleted successfully",
      ),
    );
});

const getExpenseSummary = asyncHandler(async (req, res, next) => {
  const stats = await Expense.aggregate([
    // stage 1 - Filter logged-in user
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    // stage 2- Group & math
    {
      $group: {
        _id: null,
        totalSpent: { $sum: "$amount" },
        avgExpense: { $avg: "$amount" },
        maxExpense: { $max: "$amount" },
        minExpense: { $min: "$amount" },
        totalCount: { $sum: 1 },
      },
    },
    // clean response
    {
      $project: {
        _id: 0,
        totalSpent: 1,
        avgExpense: { $round: ["$avgExpense", 2] },
        maxExpense: 1,
        minExpense: 1,
        totalCount: 1,
      },
    },
  ]);
  const summary = stats[0] || {
    totalSpent: 0,
    avgExpense: 0,
    maxExpense: 0,
    minExpense: 0,
    totalCount: 0,
  };

  return res
    .status(200)
    .json(
      new apiResponse(200, summary, "Expense summary fetched successfully"),
    );
});

const getCategoryStats = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  // base match condition
  const matchCondition = {
    owner: new mongoose.Types.ObjectId(req.user._id),
  };

  // 3. filter by dateRange
  // Lenient Date Filtering (Galat date aane par ignore karega, error nahi dega)
  let start, end;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  // 1. Validate startDate safely
  if (typeof startDate === "string" && dateRegex.test(startDate.trim())) {
    const trimmedStart = startDate.trim();
    const parsedStart = new Date(trimmedStart);
    if (!isNaN(parsedStart.getTime()) && parsedStart.toISOString().slice(0, 10) === trimmedStart) {
      start = parsedStart;
    }
  }

  // 2. Validate endDate safely
  if (typeof endDate === "string" && dateRegex.test(endDate.trim())) {
    const trimmedEnd = endDate.trim();
    const parsedEnd = new Date(trimmedEnd);
    if (!isNaN(parsedEnd.getTime()) && parsedEnd.toISOString().slice(0, 10) === trimmedEnd) {
      parsedEnd.setUTCHours(23, 59, 59, 999);
      end = parsedEnd;
    }
  }

  // 3. Agar dono valid hain, par start > end hai (ultaa range), toh dono ko ignore kar do
  if (start && end && start > end) {
    start = undefined;
    end = undefined;
  }

  // 4. Sirf tabhi query.date lagao jab kam se kam ek valid date mili ho!
  if (start || end) {
    matchCondition.date = {};
    if (start) matchCondition.date.$gte = start;
    if (end) matchCondition.date.$lte = end;
  }

  const categoryStats = await Expense.aggregate([
    {
      $match: matchCondition,
    },
    {
      $group: {
        _id: "$category",
        totalSpent: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        totalSpent: -1,
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        totalSpent: 1,
        count: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        categoryStats,
        "Category stats fetched successfully",
      ),
    );
});

const getMonthlyTrends = asyncHandler(async (req, res, next) => {
  const { year } = req.query;

  // 1. base match condition
  const matchCondition = {
    owner: new mongoose.Types.ObjectId(req.user._id),
  };

  if (typeof year === "string") {
    const parsedYear = Number(year);
    if (
      !isNaN(parsedYear) &&
      Number.isInteger(parsedYear) &&
      parsedYear > 2000 &&
      parsedYear < 2100
    ) {
       const startOfYear = new Date(`${parsedYear}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${parsedYear}-12-31T23:59:59.999Z`);
      matchCondition.date = {
        $gte : startOfYear,
        $lte : endOfYear
      }
    }
  }
  const monthlyTrends = await Expense.aggregate([
    {
      $match: matchCondition,
    },
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
        },
        totalSpent: { $sum: "$amount" },
        avgExpense: { $avg: "$amount" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },
    {
      $project: {
        _id: 0,
        year: "$_id.year",
        month: "$_id.month",
        totalSpent: 1,
        avgExpense: { $round: ["$avgExpense", 2] },
        count: 1,
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        monthlyTrends,
        "Monthly trends fetched successfully",
      ),
    );
});
export {
  addExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  getCategoryStats,
  getMonthlyTrends,
};
