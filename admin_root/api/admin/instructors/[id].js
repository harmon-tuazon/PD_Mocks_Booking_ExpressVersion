/**
 * GET/PUT/DELETE /api/admin/instructors/[id]
 * Single instructor operations
 * Permissions:
 *   GET: 'workcheck.view'
 *   PUT: 'workcheck.edit'
 *   DELETE: 'workcheck.delete'
 */

const { requirePermission } = require('../middleware/requirePermission');
const { validationMiddleware } = require('../../_shared/validation');
const { supabaseAdmin } = require('../../_shared/supabase');

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'Instructor ID is required' }
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Instructor ID must be a valid UUID' }
    });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, id);
      case 'PUT':
        return await handlePut(req, res, id);
      case 'DELETE':
        return await handleDelete(req, res, id);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
        });
    }
  } catch (error) {
    // Auth-specific error handling
    if (error.message.includes('authorization') || error.message.includes('token') || error.message.includes('Permission denied')) {
      const statusCode = error.statusCode || 401;
      return res.status(statusCode).json({
        success: false,
        error: { code: error.code || 'UNAUTHORIZED', message: error.message }
      });
    }

    console.error(`Error in instructor ${req.method} operation:`, error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'An error occurred'
    });
  }
};

/**
 * GET - Fetch single instructor by UUID
 */
async function handleGet(req, res, id) {
  await requirePermission(req, 'workcheck.view');

  const { data: instructor, error } = await supabaseAdmin
    .from('instructors')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !instructor) {
    return res.status(404).json({
      success: false,
      error: { code: 'INSTRUCTOR_NOT_FOUND', message: `Instructor with ID ${id} not found` }
    });
  }

  res.status(200).json({
    success: true,
    data: {
      id: instructor.id,
      instructor_name: instructor.instructor_name,
      email: instructor.email,
      is_active: instructor.is_active,
      auth_user_id: instructor.auth_user_id,
      created_at: instructor.created_at,
      updated_at: instructor.updated_at
    }
  });
}

/**
 * PUT - Update instructor
 */
async function handlePut(req, res, id) {
  await requirePermission(req, 'workcheck.edit');

  // Validate request body
  const validator = validationMiddleware('instructorUpdate');
  await new Promise((resolve, reject) => {
    validator(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const updates = req.validatedData;

  // Build update object
  const updateData = {
    updated_at: new Date().toISOString()
  };

  if (updates.instructor_name !== undefined) {
    updateData.instructor_name = updates.instructor_name.trim();
  }
  if (updates.email !== undefined) {
    updateData.email = updates.email.toLowerCase().trim();
  }
  if (updates.is_active !== undefined) {
    updateData.is_active = updates.is_active;
  }

  // Check if email is being changed and if it already exists
  if (updates.email) {
    const { data: existingInstructor } = await supabaseAdmin
      .from('instructors')
      .select('id')
      .eq('email', updates.email.toLowerCase())
      .neq('id', id)
      .single();

    if (existingInstructor) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'An instructor with this email already exists'
        }
      });
    }
  }

  const { data: updatedInstructor, error } = await supabaseAdmin
    .from('instructors')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error || !updatedInstructor) {
    if (error?.code === '23505') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'An instructor with this email already exists'
        }
      });
    }

    return res.status(404).json({
      success: false,
      error: { code: 'INSTRUCTOR_NOT_FOUND', message: `Instructor with ID ${id} not found` }
    });
  }

  console.log(`[Instructor Updated] ${id}`);

  res.status(200).json({
    success: true,
    message: 'Instructor updated successfully',
    data: {
      id: updatedInstructor.id,
      instructor_name: updatedInstructor.instructor_name,
      email: updatedInstructor.email,
      is_active: updatedInstructor.is_active,
      auth_user_id: updatedInstructor.auth_user_id,
      created_at: updatedInstructor.created_at,
      updated_at: updatedInstructor.updated_at
    }
  });
}

/**
 * DELETE - Soft delete instructor (set is_active=false)
 */
async function handleDelete(req, res, id) {
  await requirePermission(req, 'workcheck.delete');

  // Soft delete by setting is_active to false
  const { data: deletedInstructor, error } = await supabaseAdmin
    .from('instructors')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !deletedInstructor) {
    return res.status(404).json({
      success: false,
      error: { code: 'INSTRUCTOR_NOT_FOUND', message: `Instructor with ID ${id} not found` }
    });
  }

  console.log(`[Instructor Soft Deleted] ${id} - ${deletedInstructor.instructor_name}`);

  res.status(200).json({
    success: true,
    message: 'Instructor deactivated successfully',
    data: {
      id: deletedInstructor.id,
      instructor_name: deletedInstructor.instructor_name,
      email: deletedInstructor.email,
      is_active: deletedInstructor.is_active
    }
  });
}
