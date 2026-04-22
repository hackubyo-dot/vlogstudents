const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
    auth: {
        persistSession: false
    }
});

/**
 * VlogStudents Storage Config
 * Bucket: 'vlogstudents_media'
 */
const storage = supabase.storage.from('vlogstudents_media');

module.exports = {
    supabase,
    storage
};