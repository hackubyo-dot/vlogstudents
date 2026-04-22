const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false
    }
});

// Nome do bucket padrão definido no Supabase
const BUCKET_NAME = 'vlogstudents_media';

module.exports = {
    supabase,
    storage: supabase.storage.from(BUCKET_NAME),
    BUCKET_NAME
};