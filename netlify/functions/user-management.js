const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  throw new Error('Configuration error: Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-CHANGE-IN-PRODUCTION';

/**
 * Verify JWT token and check if user is super_admin
 */
const verifyAuth = async (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user exists and is super_admin
    const { data: user, error } = await supabase
      .from('admin_users')
      .select('id, email, role')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (error || !user || user.role !== 'super_admin') {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Verify authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    const token = authHeader.substring(7);
    const authUser = await verifyAuth(token);

    if (!authUser) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, error: 'Forbidden: Super admin access required' })
      };
    }

    const body = JSON.parse(event.body);
    const { action, data } = body;

    switch (action) {
      case 'create':
        return await createUser(data, authUser, headers);

      case 'update':
        return await updateUser(data, authUser, headers);

      case 'delete':
        return await deleteUser(data, authUser, headers);

      case 'reset-password':
        return await resetPassword(data, authUser, headers);

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Invalid action' })
        };
    }

  } catch (error) {
    console.error('❌ User management error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
};

async function createUser(data, authUser, headers) {
  try {
    const { first_name, last_name, email, password, role } = data;

    // Validate required fields
    if (!first_name || !last_name || !email || !password || !role) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    // Validate password strength
    if (password.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Password must be at least 8 characters' })
      };
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Password must contain uppercase, lowercase, and numbers'
        })
      };
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Email already exists' })
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error } = await supabase
      .from('admin_users')
      .insert({
        first_name,
        last_name,
        email,
        password: hashedPassword,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase
      .from('admin_activity_log')
      .insert({
        user_id: authUser.id,
        action: 'user_created',
        table_name: 'admin_users',
        record_id: newUser.id,
        new_values: { email: newUser.email, role: newUser.role }
      });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: userWithoutPassword
      })
    };

  } catch (error) {
    console.error('Error creating user:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Failed to create user' })
    };
  }
}

async function updateUser(data, authUser, headers) {
  try {
    const { id, first_name, last_name, email, role, is_active } = data;

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'User ID is required' })
      };
    }

    // Get old values for logging
    const { data: oldUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldUser) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    // Update user
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: updatedUser, error } = await supabase
      .from('admin_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase
      .from('admin_activity_log')
      .insert({
        user_id: authUser.id,
        action: 'user_updated',
        table_name: 'admin_users',
        record_id: id,
        old_values: {
          email: oldUser.email,
          role: oldUser.role,
          is_active: oldUser.is_active
        },
        new_values: {
          email: updatedUser.email,
          role: updatedUser.role,
          is_active: updatedUser.is_active
        }
      });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user: userWithoutPassword
      })
    };

  } catch (error) {
    console.error('Error updating user:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Failed to update user' })
    };
  }
}

async function deleteUser(data, authUser, headers) {
  try {
    const { id } = data;

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'User ID is required' })
      };
    }

    // Prevent deleting self
    if (id === authUser.id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Cannot delete your own account' })
      };
    }

    // Get user details for logging
    const { data: user } = await supabase
      .from('admin_users')
      .select('email, role')
      .eq('id', id)
      .single();

    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    // Delete user
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Log activity
    await supabase
      .from('admin_activity_log')
      .insert({
        user_id: authUser.id,
        action: 'user_deleted',
        table_name: 'admin_users',
        record_id: id,
        old_values: { email: user.email, role: user.role }
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Error deleting user:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Failed to delete user' })
    };
  }
}

async function resetPassword(data, authUser, headers) {
  try {
    const { id, newPassword } = data;

    if (!id || !newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'User ID and new password are required' })
      };
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Password must be at least 8 characters' })
      };
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Password must contain uppercase, lowercase, and numbers'
        })
      };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and reset lockout
    const { error } = await supabase
      .from('admin_users')
      .update({
        password: hashedPassword,
        failed_login_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    // Log activity
    await supabase
      .from('admin_activity_log')
      .insert({
        user_id: authUser.id,
        action: 'password_reset',
        table_name: 'admin_users',
        record_id: id
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Failed to reset password' })
    };
  }
}
