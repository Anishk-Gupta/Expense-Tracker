import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { Expense } from "../models/expense.model.js";
import mongoose from "mongoose";

const addExpense = asyncHandler(async (req, res, next) => {
  const { amount, description, date, category } = req.body;

  if (amount === undefined || amount === null) {
    throw new apiError(400, "Amount is required");
  }
  if (typeof amount !== "number" || amount <= 0) {
    throw new apiError(400, "Amount must be a postive number");
  }

  if (!category?.trim()) {
    throw new apiError(400, "Category is required");
  }

  if (date) {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new apiError(400, "Invalid date format");
    }
  }

  const expense = await Expense.create({
    amount,
    description: description?.trim() || "",
    date: date || Date.now(),
    category: category.trim(),
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

  //2 .  filter by category(case-insensitive)
  if (category) {
    query.category = { $regex: new RegExp(`^${category}$`, "i") };
  }

  // 3.  filter by dateRange
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  // 4. search in description
  if (search) {
    query.description = { $regex: search, $options: "i" };
  }

  // 5. pagination Math
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNumber - 1) * limitNumber;

  //6. sorting
  const sort = { [sortBy]: sortType === "asc" ? 1 : -1 };
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
  const { id } = req.params;
  const { category, description, amount, date } = req.body || {};
  // validation
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new apiError(400, "Invalid expense ID");
  }

  if (
    category === undefined &&
    description === undefined &&
    amount === undefined &&
    date === undefined
  ) {
    throw new apiError(400, "At least one field is required to update");
  }
  // dynamic update data ka object
  const updateData = {};
  if (category !== undefined) {
    const trimedCategory = category?.trim();
    if (!trimedCategory) {
      throw new apiError(400, "Category cannot be empty");
    }
    updateData.category = trimedCategory;
  }

  if (amount !== undefined) {
    if (amount <= 0 || typeof amount !== "number") {
      throw new apiError(400, "Amount must be a positive number");
    }
    updateData.amount = amount;
  }

  if (description !== undefined) {
    updateData.description = description?.trim() || "";
  }

  if (date !== undefined) {
    if (typeof date !== "string") {
      throw new apiError(400, "Date must be a string in YYYY--MM--DD format");
    }

    const trimmedDate = date.trim();

    if (!trimmedDate) {
      throw new apiError(400, "Date cannot be empty");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof trimmedDate === "string" && !dateRegex.test(trimmedDate)) {
      throw new apiError(
        400,
        "Invalid date format. Use YYYY-MM-DD (e.g., 2026-10-15)",
      );
    }
    const parsedDate = new Date(trimmedDate);
    if (isNaN(parsedDate.getTime())) {
      throw new apiError(400, "Invalid date . Please provide a valid date");
    }

    updateData.date = parsedDate;
  }

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
    },
  );

  return res
    .status(200)
    .json(new apiResponse(200, updatedExpense, "Expense updated successfully"));
});

const deleteExpense = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
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

  // 2. optimal date range filter
  if (startDate || endDate) {
    matchCondition.date = {};
    if (startDate) matchCondition.date.$gte = new Date(startDate);
    if (endDate) matchCondition.date.$lte = new Date(endDate);
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

  if (year) {
    const yearNumber = parseInt(year, 10);
    if (isNaN(yearNumber) || yearNumber < 2000 || yearNumber > 2100) {
      throw new apiError(400, "Invalid year provided");
    }
    const startOfYear = new Date(`${yearNumber}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${yearNumber}-12-31T23:59:59.999Z`);

    matchCondition.date = {
      $gte: startOfYear,
      $lte: endOfYear,
    };
  }
  const monthlyTrends = await Expense.aggregate([
    {
        $match : matchCondition
    },
    {
        $group : {
            _id : {
                year : {$year : "$date"},
                month : {$month : "$date"}
            },
            totalSpent : {$sum : "$amount"},
            avgExpense : {$avg : "$amount"},
            count : {$sum : 1}
        }
    },
    {
        $sort : {
            "_id.year" : 1,
            "_id.month" : 1
        }
    },
    {
        $project : {
            _id : 0,
            year : "$_id.year",
            month : "$_id.month",
            totalSpent : 1,
            avgExpense : {$round : ["$avgExpense",2]},
            count : 1
        }
    }
  ])
  return res.status(200).json(
    new apiResponse(200,monthlyTrends,"Monthly trends fetched successfully")
  )
});
export {
  addExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  getCategoryStats,
  getMonthlyTrends
};
