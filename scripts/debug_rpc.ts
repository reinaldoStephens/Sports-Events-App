
import { createClient } from '@supabase/supabase-js';

// Hardcoded for debug purposes only
const supabaseUrl = 'https://ipyjwlxkvuozekwvmdug.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWp3bHhrdnVvemVrd3ZtZHVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc5ODUwOSwiZXhwIjoyMDgzMzc0NTA5fQ.Q_u9UvUxqcFDjuzmryZp5QX43qKlajrTP4QpIfWrwSA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
  console.log('Testing check_delete_impact RPC...');
  
  const { data, error } = await supabase.rpc('check_delete_impact', {
    p_entity_type: 'match',
    p_entity_id: '00000000-0000-0000-0000-000000000000'
  });

  if (error) {
    console.error('RPC Call Failed:', error.message);
    if (error.message.includes('function check_delete_impact') && error.message.includes('does not exist')) {
        console.log('\n>>> DIAGNOSIS: The function is MISSING. Migration not applied. <<<');
    }
  } else {
    console.log('RPC Call Success:', data);
    console.log('\n>>> DIAGNOSIS: The function EXISTS. <<<');
  }
}

checkRpc();
