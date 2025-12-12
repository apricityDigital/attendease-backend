const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function createAdminUser() {
  try {
    console.log('🔍 Checking for existing admin user...');

    // Check if admin already exists
    const existingAdmin = await pool.query(
      "SELECT * FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (existingAdmin.rows.length > 0) {
      console.log('⚠️  Admin user already exists:');
      console.log('   Name:', existingAdmin.rows[0].name);
      console.log('   Email:', existingAdmin.rows[0].email);
      console.log('   Employee Code:', existingAdmin.rows[0].emp_code);
      console.log('\n🔑 Use these credentials to login:');
      console.log('   Email: admin@attendease.com');
      console.log('   Password: admin123');
      return;
    }

    console.log('✨ Creating new admin user...');

    // Admin user data
    const adminData = {
      name: "System Administrator",
      emp_code: "ADMIN001",
      email: "admin@attendease.com",
      phone: "9876543210",
      role: "admin",
      password: "admin123"
    };

    // Hash password
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);

    // Insert admin user
    console.log('💾 Inserting admin user into database...');
    const result = await pool.query(
      `INSERT INTO users (name, emp_code, email, phone, role, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT DO NOTHING
       RETURNING user_id, name, email, emp_code, role, created_at`,
      [adminData.name, adminData.emp_code, adminData.email, adminData.phone, adminData.role, hashedPassword]
    );

    if (result.rows.length === 0) {
      console.warn('Record exists, skipping');
      const existing = await pool.query(
        "SELECT user_id, name, email, emp_code, role, created_at FROM users WHERE email = $1",
        [adminData.email]
      );
      if (existing.rows.length > 0) {
        console.log('🔑 Existing admin credentials ready');
        return;
      }
      return;
    }

    console.log('✅ Admin user created successfully!');
    console.log('\n👤 Admin User Details:');
    console.log('   ID:', result.rows[0].user_id);
    console.log('   Name:', result.rows[0].name);
    console.log('   Email:', result.rows[0].email);
    console.log('   Employee Code:', result.rows[0].emp_code);
    console.log('   Role:', result.rows[0].role);
    console.log('   Created:', result.rows[0].created_at);

    console.log('\n🔑 Login Credentials for Mobile App:');
    console.log('   Email: admin@attendease.com');
    console.log('   Password: admin123');

    console.log('\n📱 Next Steps:');
    console.log('1. Start the mobile app: cd attendeaseApp && npx expo start');
    console.log('2. Login with the credentials above');
    console.log('3. App will automatically show admin interface (red theme)');
    console.log('4. Access 5 admin tabs: Dashboard, Supervisors, Employees, Analytics, Settings');

  } catch (error) {
    if (error.code === '23505') {
      console.warn('Record exists, skipping');
      return;
    }
    console.error('❌ Error creating admin user:', error);
  } finally {
    // Close database connection
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
console.log('🚀 Starting Admin User Creation Script...\n');
createAdminUser();
