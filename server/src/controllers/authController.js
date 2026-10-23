import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { signToken } from '../config/jwt.js';

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { name, email, password, date_of_birth } = req.body;

    // Validate inputs
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // Validate Date of Birth if provided
    let formattedDob = null;
    if (date_of_birth) {
      const parsedDate = new Date(date_of_birth);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid Date of Birth format.' });
      }
      formattedDob = date_of_birth; // YYYY-MM-DD
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Check if email already exists
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user into database
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, date_of_birth) VALUES (?, ?, ?, ?)',
      [cleanName, cleanEmail, passwordHash, formattedDob]
    );

    const userId = result.insertId;

    // Generate JWT token
    const token = signToken({ id: userId, email: cleanEmail, name: cleanName });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        date_of_birth: formattedDob,
        avatar_url: null
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration. Please try again.'
    });
  }
}

/**
 * Log in an existing user
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Look up user by email
    const [rows] = await pool.query(
      "SELECT id, name, email, password_hash, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth, avatar_url, created_at FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = rows[0];

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate JWT token
    const token = signToken({ id: user.id, email: user.email, name: user.name });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        date_of_birth: user.date_of_birth || null,
        avatar_url: user.avatar_url,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login. Please try again.'
    });
  }
}

/**
 * Forgot Password with Email and Date of Birth verification
 * POST /api/auth/forgot-password
 */
export async function forgotPassword(req, res) {
  try {
    const { email, date_of_birth, new_password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    if (!date_of_birth) {
      return res.status(400).json({ success: false, message: 'Date of Birth is required for verification.' });
    }
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Look up user by email
    const [rows] = await pool.query(
      "SELECT id, email, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No account registered with this email address.'
      });
    }

    const user = rows[0];

    // Check if user has DOB recorded
    if (!user.date_of_birth) {
      return res.status(400).json({
        success: false,
        message: 'No Date of Birth on file for this account. Please contact system administrator.'
      });
    }

    const userDobStr = String(user.date_of_birth).trim();
    const inputDobStr = String(date_of_birth).split('T')[0].trim();

    if (userDobStr !== inputDobStr) {
      return res.status(401).json({
        success: false,
        message: 'The Date of Birth provided does not match our records for this account.'
      });
    }

    // Hash new password and update
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, user.id]);

    return res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again later.'
    });
  }
}

/**
 * Get authenticated user profile
 * GET /api/auth/me
 */
export async function getCurrentUser(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS date_of_birth, avatar_url, created_at FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      user: rows[0]
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve user profile.' });
  }
}

/**
 * Update authenticated user profile (Name, DOB, Profile Photo / Avatar)
 * PUT /api/auth/profile
 */
export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, date_of_birth, avatar_url } = req.body;

    // Fetch existing user data
    const [rows] = await pool.query(
      'SELECT id, name, email, date_of_birth, avatar_url, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];
    const newName = name && name.trim() ? name.trim() : user.name;
    
    let newDob = user.date_of_birth;
    if (date_of_birth) {
      const parsedDate = new Date(date_of_birth);
      if (!isNaN(parsedDate.getTime())) {
        newDob = date_of_birth;
      }
    }

    // Avatar can be passed directly as avatar_url or base64 data string
    let newAvatar = avatar_url !== undefined ? avatar_url : user.avatar_url;

    await pool.query(
      'UPDATE users SET name = ?, date_of_birth = ?, avatar_url = ? WHERE id = ?',
      [newName, newDob, newAvatar, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: userId,
        name: newName,
        email: user.email,
        date_of_birth: newDob ? new Date(newDob).toISOString().split('T')[0] : null,
        avatar_url: newAvatar,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.'
    });
  }
}
