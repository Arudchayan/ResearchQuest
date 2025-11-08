// Test script to debug Papers functionality
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co';
const supabaseAnonKey = 'REDACTED_SUPABASE_ANON_JWT';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

async function testCreatePaper() {
  try {
    console.log('Testing paper creation...');
    
    // Test data
    const testPaperData = {
      title: 'A Test Paper on Research Methods',
      authors: ['John Doe', 'Jane Smith'],
      doi: '10.1038/test123',
      source_url: 'https://example.com/test-paper',
      status: 'To Read'
    };
    
    // Since we need a user ID, let's first check what users exist
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log('Auth error:', authError.message);
      return;
    }
    
    if (!user) {
      console.log('No authenticated user found');
      return;
    }
    
    console.log('Authenticated user:', user.id);
    
    // Try to create the paper
    const { data, error } = await supabase
      .from('papers')
      .insert({
        ...testPaperData,
        user_id: user.id,
        authors: testPaperData.authors || [],
      })
      .select()
      .single();
      
    if (error) {
      console.log('Insert error:', error);
    } else {
      console.log('Paper created successfully:', data);
    }
    
  } catch (err) {
    console.log('Exception:', err.message);
  }
}

testCreatePaper();