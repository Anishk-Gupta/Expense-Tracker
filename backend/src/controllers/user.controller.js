import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new apiError(500, "Internal servor error");
  }
};

const registerUser = asyncHandler(async (req, res, next) => {
  const { username, name, email, password } = req.body;

  // check for all fields present or not
  if ([username, email, password, name].some((field) => !field?.trim())) {
    throw new apiError(400, "All fields are required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new apiError(400, "Please provide a valid email address");
  }

  // check ki email or username ka same candidate phle se exist to nhi karta na

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new apiError(409, "User with this email or username already exist");
  }

  // user create kro
  const user = await User.create({
    username: username.toLowerCase(),
    email,
    password,
    name,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  if (!createdUser) {
    throw new apiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new apiResponse(201, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res, next) => {

  const { email, password } = req.body;
  if ([email, password].some((field) => !field?.trim())) {
    throw new apiError(400, "Email and Password are required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new apiError(400, "Please provide a valid email address");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new apiError(404, "User does not exist");
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new apiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id,
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new apiResponse(
        200,
        { user: loggedInUser, accessToken},
        "User logged in successfully",
      ),
    );
});

const changeCurrentPassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body || {};

  // validation
  if (!oldPassword) {
    throw new apiError(400, "Old-Password is required");
  }
  if (!newPassword) {
    throw new apiError(400, "New-Password is required");
  }

  if (oldPassword === newPassword) {
    throw new apiError(400, "Newpassword cannot be same as oldPassword");
  }

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.comparePassword(oldPassword);

  if (!isPasswordCorrect) {
    throw new apiError(400, "Invalid Password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new apiResponse(200, {}, "Password updated successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res, next) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new apiError(401, "Unauthorized Request");
  }

  try {
    // verify the token using refresh secret
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new apiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new apiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new apiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully",
        ),
      );
  } catch (error) {
    throw new apiError(error.statusCode || 400, error?.message || "Invalid refresh token");
  }
});

const logOut = asyncHandler(async (req, res, next) => {
  await User.findOneAndUpdate(
    { _id: req.user._id },
    { $set: { refreshToken: undefined } },
    { new: true },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged out successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res, next) => {
  const { username, name, email } = req.body || {};

  if (username=== undefined &&  name === undefined && email==undefined) {
    throw new apiError(400, "please provide at least one field to update");
  }

  const updateData = {};

  // Name update logic
  if (name !== undefined) {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw new apiError(400, "Name cannot be empty");
    }
    updateData.name = name;
  }

  // email update logic
  if (email !== undefined) {
    const trimmedEmail = email?.trim();
    if (!trimmedEmail) {
      throw new apiError(400, "Email cannot be empty");
    }

    const existingUser = await User.findOne({ email: trimmedEmail });

    if (
      existingUser &&
      existingUser._id.toString() !== req.user._id.toString()
    ) {
      throw new apiError(409, "Email is already in use by another account");
    }
    updateData.email = trimmedEmail;
  }

  if (username !== undefined) {
    const trimmedUsername = username?.trim().toLowerCase();
    if (!trimmedUsername) throw new apiError(400, "Username cannot be empty");

    const existingUsernameUser = await User.findOne({
      username: trimmedUsername,
    });

    if (
      existingUsernameUser &&
      existingUsernameUser._id.toString() !== req.user._id.toString()
    ) {
      throw new apiError(
        409,
        "Username is already taken. Please choose another.",
      );
    }
    updateData.username = trimmedUsername;
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    },
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(
      new apiResponse(200, updatedUser, "Account details updated successfully"),
    );
});
export {
  registerUser,
  loginUser,
  changeCurrentPassword,
  refreshAccessToken,
  logOut,
  updateAccountDetails,
};
