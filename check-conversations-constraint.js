const db = require('./src/models');

async function checkConversationConstraints() {
  try {
    console.log('🔍 Checking conversations table constraints...\n');
    
    // Get table constraints
    const constraints = await db.sequelize.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        ccu.column_name,
        pg_get_constraintdef(con.oid) as definition
      FROM information_schema.table_constraints tc
      JOIN pg_constraint con ON con.conname = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'conversations'
        AND tc.constraint_schema = 'public'
        AND tc.constraint_type = 'CHECK';
    `);
    
    console.log('Current CHECK constraints on conversations table:');
    if (constraints[0].length === 0) {
      console.log('❌ No CHECK constraints found (unexpected)');
    } else {
      console.table(constraints[0]);
    }
    
    // Get allowed values for status column
    const enumValues = await db.sequelize.query(`
      SELECT e.enumlabel as allowed_value
      FROM pg_type t 
      JOIN pg_enum e ON e.enumtypid = t.oid 
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'conversations_status_enum' 
        OR t.typname LIKE '%conversations%status%';
    `);
    
    if (enumValues[0].length > 0) {
      console.log('\n📋 Allowed values for status column:');
      enumValues[0].forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.allowed_value}`);
      });
    } else {
      console.log('\n📋 Status column is NOT an ENUM type');
    }
    
    // Get current column definition
    const columnDef = await db.sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
        AND column_name = 'status';
    `);
    
    console.log('\n📊 Current status column definition:');
    console.table(columnDef[0]);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit();
  }
}

checkConversationConstraints();