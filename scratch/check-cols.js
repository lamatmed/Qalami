require('dotenv').config();

async function run() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });
    const data = await res.json();
    const definitions = data.definitions;
    if (definitions && definitions.enrollments) {
      console.log('enrollments properties:', Object.keys(definitions.enrollments.properties));
    } else {
      console.log('enrollments not found');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
