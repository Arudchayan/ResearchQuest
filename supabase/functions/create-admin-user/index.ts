const FETCH_TIMEOUT_MS = 10000; // 10 seconds timeout

// Sentinel: Constant-time string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let mismatch = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return mismatch === 0;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name, x-request-id, x-user-agent, x-forwarded-for',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: corsHeaders
        });
    }
  
    try {
      // Get parameters from request body
      // Ensure caller is authorized using a secret key
      const authHeader = req.headers.get('Authorization');
      const expectedApiKey = Deno.env.get('ADMIN_API_KEY');

      if (!expectedApiKey || !authHeader || !secureCompare(authHeader, `Bearer ${expectedApiKey}`)) {
        return new Response(JSON.stringify({
          error: { code: 'UNAUTHORIZED', message: 'Unauthorized request' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      const requestBody = await req.json();
      const { email, password, role = 'authenticated' } = requestBody;
      
      if (!email || !password) {
        return new Response(JSON.stringify({
          error: { code: 'MISSING_PARAMS', message: 'Email and password are required' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Sentinel: Prevent DoS via excessively large inputs
      if (email.length > 255 || password.length > 72 || role.length > 50) {
        return new Response(JSON.stringify({
          error: { code: 'INVALID_PARAMS', message: 'Input values exceed maximum allowed length' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
  
      // Get environment variables
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      
      if (!serviceRoleKey || !supabaseUrl) {
        return new Response(JSON.stringify({
          error: { code: 'CONFIG_ERROR', message: 'Missing Supabase configuration' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
  
      // Generate user ID
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      // Create user record (directly insert into auth.users table)
      const insertUserQuery = `
        INSERT INTO auth.users (
          id, email, encrypted_password, email_confirmed_at, 
          created_at, updated_at, role, aud, 
          confirmation_token, email_confirm_token_sent_at
        ) VALUES (
          $1, $2, crypt($3, gen_salt('bf')), $4,
          $5, $6, $7, 'authenticated',
          '', $8
        ) RETURNING id, email, created_at
      `;
      
      // Use fetch to call Supabase REST API
      const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({
          query: insertUserQuery,
          params: [userId, email, password, now, now, now, role, now]
        })
      });
  
      if (!response.ok) {
        // If direct insert fails, try using Admin API to create user
        const adminResponse = await fetchWithTimeout(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
          },
          body: JSON.stringify({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { role: role }
          })
        });
  
        if (!adminResponse.ok) {
          console.error(`Admin API error status ${adminResponse.status}`);
          return new Response(JSON.stringify({
            error: { 
              code: 'USER_CREATION_FAILED', 
              message: 'Failed to create admin user. Please check server logs.'
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }
  
        const userData = await adminResponse.json();
        return new Response(JSON.stringify({
          success: true,
          message: 'Admin user created successfully via Admin API',
          user: {
            id: userData.id,
            email: userData.email,
            created_at: userData.created_at,
            method: 'admin_api'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
  
      const userData = await response.json();
      return new Response(JSON.stringify({
        success: true,
        message: 'Admin user created successfully via direct SQL',
        user: {
          id: userId,
          email: email,
          created_at: now,
          method: 'direct_sql'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  
    } catch (error) {
      console.error('Function error:', error instanceof Error ? error.message : 'Unknown error');
      return new Response(JSON.stringify({
        error: { code: 'FUNCTION_ERROR', message: 'An internal server error occurred.' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  });            
